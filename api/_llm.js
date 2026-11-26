'use strict';
/**
 * Multi-provider LLM layer (all providers speak the OpenAI-compatible chat API).
 * Why: no single provider's free tier should carry the whole site. Requests walk down a priority list;
 * when a provider is rate-limited / down / out of budget the next one answers.
 *
 *   LLM_PROVIDERS   comma list in priority order, default "groq".  e.g.  groq,cerebras,gemini,openrouter,mistral
 *   <NAME>_API_KEY  a provider is only used when its key exists:  GROQ_API_KEY, CEREBRAS_API_KEY, GEMINI_API_KEY,
 *                   OPENROUTER_API_KEY, MISTRAL_API_KEY
 *   <NAME>_MODEL / <NAME>_VISION_MODEL   optional comma lists of models to try (see DEFS for defaults)
 *   LLM_DAILY_CAP   max LLM calls per server instance per day (default 3000) - protects free quotas from abuse
 *
 * Keys live only in the server environment.
 */
const split = (v) => String(v == null ? '' : v).split(',').map((s) => s.trim()).filter(Boolean);
const DEFS = {
  groq: { base: (e) => e.GROQ_BASE_URL || 'https://api.groq.com/openai/v1', key: 'GROQ_API_KEY',
    text: (e) => [e.GROQ_MODEL || 'openai/gpt-oss-120b'].concat(split(e.GROQ_FALLBACK_MODELS == null ? 'openai/gpt-oss-20b,qwen/qwen3.8-27b' : e.GROQ_FALLBACK_MODELS)),
    vision: (e) => split(e.GROQ_VISION_MODEL == null ? 'qwen/qwen3.8-27b' : e.GROQ_VISION_MODEL) },
  cerebras: { base: (e) => e.CEREBRAS_BASE_URL || 'https://api.cerebras.ai/v1', key: 'CEREBRAS_API_KEY', text: (e) => split(e.CEREBRAS_MODEL == null ? 'gpt-oss-120b' : e.CEREBRAS_MODEL), vision: () => [] },
  gemini: { base: (e) => e.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai', key: 'GEMINI_API_KEY', text: (e) => split(e.GEMINI_MODEL == null ? 'gemini-2.5-flash' : e.GEMINI_MODEL), vision: (e) => split(e.GEMINI_VISION_MODEL == null ? 'gemini-2.5-flash' : e.GEMINI_VISION_MODEL) },
  openrouter: { base: (e) => e.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1', key: 'OPENROUTER_API_KEY', text: (e) => split(e.OPENROUTER_MODEL == null ? 'openai/gpt-oss-120b:free' : e.OPENROUTER_MODEL), vision: (e) => split(e.OPENROUTER_VISION_MODEL), headers: { 'X-Title': 'Green India Gokul Foundation' } },
  mistral: { base: (e) => e.MISTRAL_BASE_URL || 'https://api.mistral.ai/v1', key: 'MISTRAL_API_KEY', text: (e) => split(e.MISTRAL_MODEL == null ? 'mistral-small-latest' : e.MISTRAL_MODEL), vision: (e) => split(e.MISTRAL_VISION_MODEL == null ? 'mistral-small-latest' : e.MISTRAL_VISION_MODEL) }
};

/** ordered list of {name, base, key, model, headers} for 'text' or 'vision' work */
function plan(env, kind) {
  const out = [];
  for (const name of split(env.LLM_PROVIDERS == null ? 'groq' : env.LLM_PROVIDERS)) {
    const d = DEFS[name]; if (!d || !env[d.key]) continue;
    for (const model of (kind === 'vision' ? d.vision(env) : d.text(env))) out.push({ name, base: d.base(env), key: env[d.key], model, headers: d.headers || {} });
  }
  return out;
}
const configured = (env, kind) => plan(env, kind || 'text').length > 0;
const providers = (env) => split(env.LLM_PROVIDERS == null ? 'groq' : env.LLM_PROVIDERS).filter((n) => DEFS[n] && env[DEFS[n].key]);

let day = '', used = 0;   // per-instance daily call budget
function budgetOK(env) { const d = new Date().toISOString().slice(0, 10); if (d !== day) { day = d; used = 0; } if (used >= Number(env.LLM_DAILY_CAP || 3000)) return false; used++; return true; }

const clean = (t) => String(t || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

/**
 * messages: OpenAI format (content may be an array with image_url parts when opt.kind === 'vision')
 * @returns {Promise<{text, provider, model} | {error:true, status}>}
 */
async function llm(env, messages, opt) {
  opt = opt || {};
  const steps = plan(env, opt.kind || 'text');
  if (!steps.length) return { error: true, status: 503 };
  if (!budgetOK(env)) { console.error('[llm] daily budget exhausted'); return { error: true, status: 429 }; }
  let lastStatus = 0;
  for (const s of steps) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const payload = Object.assign({ model: s.model, messages, temperature: opt.temperature == null ? 0.3 : opt.temperature, max_tokens: attempt ? 2400 : (opt.max || 1200) },
          /gpt-oss/.test(s.model) ? { reasoning_effort: 'low' } : {}, opt.json ? { response_format: { type: 'json_object' } } : {});
        if (s.name === 'groq') { payload.max_completion_tokens = payload.max_tokens; delete payload.max_tokens; }
        const r = await fetch(s.base + '/chat/completions', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.key }, s.headers), body: JSON.stringify(payload), signal: AbortSignal.timeout(opt.timeout || 25000) });
        lastStatus = r.status;
        if (!r.ok) { console.error('[llm]', s.name, s.model, 'HTTP', r.status); break; }          // next model / provider
        const data = await r.json();
        const text = clean(data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content);
        if (text) return { text, provider: s.name, model: s.model };
        console.error('[llm]', s.name, s.model, 'empty content' + (attempt ? '' : ' - retrying with a bigger budget'));
      } catch (e) { console.error('[llm]', s.name, s.model, e && e.name); lastStatus = 0; break; }   // never log keys or message contents
    }
  }
  return { error: true, status: lastStatus };
}
module.exports = { llm, plan, configured, providers, DEFS };
