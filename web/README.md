# Website in React

Every public page and the admin portal, rebuilt with React 19 and Vite.
The old plain HTML site in the repository root still works and is still the live one.

## Commands (run inside `web/`)

| Command | What it does |
|---|---|
| `npm install` | first time only |
| `npm run dev` | development, http://localhost:5173 |
| `npm run build` | production files in `web/dist` |
| `npm run preview` | try the production files, http://localhost:4173 |
| `npm test` | unit tests, then browser journeys (needs Google Chrome) |
| `node tests/parity.mjs` | compares every page with the old site (see the top of the file) |

The chat assistant, translation, admin AI helpers and e-mailed codes need the API server too:
run `node dev-server.js` in the repository root (port 8081). `dev` and `preview` forward `/api` to it.

## What is React and what is shared

- **React (`web/src`)**: every screen, popup and menu.
- **Shared plain JavaScript (repository `js/`)**: data storage, login, Supabase sync, donation and ticket records,
  translations. Both sites use the same files, so a rule changed there changes both.
- **Shared styling and pictures**: `css/`, `assets/`, `gallery/`.
- **`web/src/content/`**: translated text and banner markup copied from the old site.

Screen changes must be made in both sites until the old one is retired.

## Addresses

Same as before: `#donate?program=cow`, `#events/<id>`, `admin.html#donations`. The old files (`donate.html`,
`article.html?a=...`) are generated in `dist`, each with its own title, so old links and search results keep working.
Pages are still drawn in the browser, as before. Server-side rendering would need Next.js.

## Putting it live (not done yet)

`web/dist` is a static site. The live site, the Dockerfile, Kubernetes files and Vercel settings still serve the old
one. To switch: publish `web/dist` (for GitHub Pages use a build workflow), keep the `api/` functions for the AI
features, then remove the old HTML files and `js/layout.js`, `pages.js`, `extra.js`, `admin.js`, `auth.js`,
`dashboard.js`, `campaign.js`, `upi.js`, `urls.js`. Keep the shared files listed in `src/lib/gigf.js`.
Note: the build reads titles from the old HTML files (`plugins/site-files.js`), so change that first.

## Not covered by the tests

Real Supabase sign-in, sign-up and writes; the real admin two-step sign-in; Google sign-in; e-mailed codes;
voice typing; uploads to cloud storage; a real phone.
