/**
 * "Save Environment" awareness campaign page — content comes from the Foundation's printed
 * awareness brochure (Awareness_programs.pdf): slogans, 5 pledges, health effects of air pollution,
 * air-pollution/COVID-19 effects and "future combat strategies". Trilingual (EN / ಕನ್ನಡ / हिन्दी).
 * Kannada slogans/essay follow the brochure; other Kannada/Hindi text is translated and should be reviewed
 * by a native speaker.
 */
(function () {
  const G = window.GIGF, $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = G.esc, L = () => G.lang();
  const T = (en, kn, hi) => ({ en, kn, hi });
  const tx = (o) => (o && (o[L()] || o.en)) || '';
  const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };

  /* ---------------- content ---------------- */
  const S = {
    lead: T('No environment, no life. Our planet, our future.', 'ಪರಿಸರವಿಲ್ಲದೆ ಜೀವನವಿಲ್ಲ. ನಮ್ಮ ಭೂಮಿ, ನಮ್ಮ ಭವಿಷ್ಯ.', 'पर्यावरण नहीं, तो जीवन नहीं। हमारी धरती, हमारा भविष्य।'),
    hMessage: T('Our message', 'ನಮ್ಮ ಸಂದೇಶ', 'हमारा संदेश'),
    unity: T('We should all get together as a unit so that we can make the Earth green.', 'ನಾವೆಲ್ಲರೂ ಒಂದಾಗಿ ಒಂದು ಕೈ ಸೇರಿಸಿದರೆ, ಭೂಮಿಯನ್ನು ಹಸಿರು ಮಾಡಬಹುದು.', 'यदि हम सब एकजुट हो जाएँ, तो धरती को हरा-भरा बना सकते हैं।'),
    who: T('Natural resources are heading towards destruction. Who will protect them? This land and this water are ours — is protecting them not our responsibility?', 'ನೈಸರ್ಗಿಕ ಸಂಪತ್ತು ವಿನಾಶದ ಹಂತ ತಲುಪುತ್ತಿದೆ. ಇದರ ರಕ್ಷಣೆ ಯಾರು ಮಾಡುವರು? ಈ ನೆಲ, ಈ ಜಲ ನಮ್ಮದು — ಇದರ ರಕ್ಷಣೆಯ ಹೊಣೆಗಾರಿಕೆ ನಮ್ಮದಲ್ಲವೇ?', 'प्राकृतिक संसाधन विनाश की ओर बढ़ रहे हैं। इनकी रक्षा कौन करेगा? यह ज़मीन, यह पानी हमारा है — क्या इसकी रक्षा हमारी ज़िम्मेदारी नहीं?'),
    resp: T('Environment protection is our responsibility', 'ಪರಿಸರ ಸಂರಕ್ಷಣೆ ನಮ್ಮೆಲ್ಲರ ಹೊಣೆ', 'पर्यावरण संरक्षण हम सबकी ज़िम्मेदारी है'),
    hPledge: T('Take the Green Pledge', 'ಹಸಿರು ಪ್ರತಿಜ್ಞೆ ಮಾಡಿ', 'हरित शपथ लें'),
    pledgeSub: T('Tap a card for a simple tip, then tick what you will do.', 'ಸರಳ ಸಲಹೆ ನೋಡಲು ಕಾರ್ಡ್ ಒತ್ತಿ; ನೀವು ಮಾಡುವುದನ್ನು ಟಿಕ್ ಮಾಡಿ.', 'सरल सुझाव के लिए कार्ड दबाएँ, फिर जो आप करेंगे उस पर टिक करें।'),
    iPledge: T('I pledge', 'ನಾನು ಪ್ರತಿಜ್ಞೆ ಮಾಡುತ್ತೇನೆ', 'मैं शपथ लेता/लेती हूँ'),
    pledged: T('pledged', 'ಪ್ರತಿಜ್ಞೆ', 'शपथ'),
    thanks: T('Thank you, Earth Guardian! You have taken all 5 pledges. 🌍', 'ಧನ್ಯವಾದಗಳು, ಭೂಮಿ ರಕ್ಷಕರೇ! ನೀವು ಎಲ್ಲಾ 5 ಪ್ರತಿಜ್ಞೆಗಳನ್ನು ಮಾಡಿದ್ದೀರಿ. 🌍', 'धन्यवाद, पृथ्वी रक्षक! आपने पाँचों शपथ ले ली हैं। 🌍'),
    share: T('Share my pledge on WhatsApp', 'ನನ್ನ ಪ್ರತಿಜ್ಞೆಯನ್ನು WhatsApp ನಲ್ಲಿ ಹಂಚಿಕೊಳ್ಳಿ', 'मेरी शपथ WhatsApp पर साझा करें'),
    hHealth: T('Health effects of air pollution', 'ವಾಯು ಮಾಲಿನ್ಯದ ಆರೋಗ್ಯ ಪರಿಣಾಮಗಳು', 'वायु प्रदूषण के स्वास्थ्य पर प्रभाव'),
    short: T('Short-term effects', 'ಅಲ್ಪಾವಧಿ ಪರಿಣಾಮಗಳು', 'अल्पकालिक प्रभाव'),
    long: T('Long-term effects', 'ದೀರ್ಘಾವಧಿ ಪರಿಣಾಮಗಳು', 'दीर्घकालिक प्रभाव'),
    med: T('General awareness only — not medical advice. Please consult a doctor if you have symptoms.', 'ಇದು ಸಾಮಾನ್ಯ ಜಾಗೃತಿ ಮಾಹಿತಿ ಮಾತ್ರ; ವೈದ್ಯಕೀಯ ಸಲಹೆ ಅಲ್ಲ. ಲಕ್ಷಣಗಳಿದ್ದರೆ ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ.', 'यह केवल सामान्य जागरूकता है, चिकित्सकीय सलाह नहीं। लक्षण होने पर डॉक्टर से मिलें।'),
    hCovid: T('Air pollution, impacts and COVID-19', 'ವಾಯು ಮಾಲಿನ್ಯ, ಪರಿಣಾಮಗಳು ಮತ್ತು ಕೋವಿಡ್-19', 'वायु प्रदूषण, प्रभाव और कोविड-19'),
    covidSub: T('As shown in our awareness brochure — pick a part of the body.', 'ನಮ್ಮ ಜಾಗೃತಿ ಕರಪತ್ರದಲ್ಲಿ ತೋರಿಸಿದಂತೆ — ದೇಹದ ಭಾಗವನ್ನು ಆರಿಸಿ.', 'हमारे जागरूकता पत्रक के अनुसार — शरीर का कोई भाग चुनें।'),
    fAir: T('Air pollution', 'ವಾಯು ಮಾಲಿನ್ಯ', 'वायु प्रदूषण'), fImp: T('Impacts', 'ಪರಿಣಾಮಗಳು', 'प्रभाव'), fCov: T('COVID-19', 'ಕೋವಿಡ್-19', 'कोविड-19'),
    hTrees: T('Trees: the best answer', 'ಮರಗಳು: ಉತ್ತಮ ಪರಿಹಾರ', 'पेड़: सबसे अच्छा समाधान'),
    ctaEv: T('Join a plantation drive', 'ಗಿಡ ನೆಡುವ ಅಭಿಯಾನದಲ್ಲಿ ಸೇರಿ', 'वृक्षारोपण अभियान से जुड़ें'), ctaVol: T('Volunteer', 'ಸ್ವಯಂಸೇವಕರಾಗಿ', 'स्वयंसेवक बनें'), ctaDon: T('Sponsor saplings', 'ಸಸಿಗಳನ್ನು ಪ್ರಾಯೋಜಿಸಿ', 'पौधों को प्रायोजित करें'),
    hStrat: T('Future combat strategies', 'ಭವಿಷ್ಯದ ಹೋರಾಟದ ತಂತ್ರಗಳು', 'भविष्य की रणनीतियाँ'), stratSub: T('Tick what you can support.', 'ನೀವು ಬೆಂಬಲಿಸಬಹುದಾದವನ್ನು ಟಿಕ್ ಮಾಡಿ.', 'जिनका आप समर्थन कर सकते हैं उन पर टिक करें।'),
    hBro: T('Download our awareness brochure', 'ನಮ್ಮ ಜಾಗೃತಿ ಕರಪತ್ರ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ', 'हमारा जागरूकता पत्रक डाउनलोड करें'),
    broSub: T('Kannada + English · 2 pages · PDF. Print it and share it with your neighbours.', 'ಕನ್ನಡ + ಇಂಗ್ಲಿಷ್ · 2 ಪುಟಗಳು · PDF. ಮುದ್ರಿಸಿ ನೆರೆಹೊರೆಯವರೊಂದಿಗೆ ಹಂಚಿಕೊಳ್ಳಿ.', 'कन्नड़ + अंग्रेज़ी · 2 पृष्ठ · PDF। प्रिंट करके पड़ोसियों के साथ साझा करें।'),
    dl: T('Download PDF', 'PDF ಡೌನ್‌ಲೋಡ್', 'PDF डाउनलोड'), shareP: T('Share this page', 'ಈ ಪುಟವನ್ನು ಹಂಚಿಕೊಳ್ಳಿ', 'यह पृष्ठ साझा करें'),
    tip: T('Tip', 'ಸಲಹೆ', 'सुझाव')
  };
  const SLOGANS = [T('No environment, no life', 'ಪರಿಸರವಿಲ್ಲದೆ ಜೀವನವಿಲ್ಲ', 'पर्यावरण नहीं, तो जीवन नहीं'), T('Our planet, our future', 'ನಮ್ಮ ಭೂಮಿ, ನಮ್ಮ ಭವಿಷ್ಯ', 'हमारी धरती, हमारा भविष्य'), T('Save trees', 'ಮರಗಳನ್ನು ಉಳಿಸಿ', 'पेड़ बचाएँ'), T('Save nature', 'ಪ್ರಕೃತಿಯನ್ನು ಉಳಿಸಿ', 'प्रकृति बचाएँ'), T('Pollution is not the solution', 'ಮಾಲಿನ್ಯ ಪರಿಹಾರವಲ್ಲ', 'प्रदूषण समाधान नहीं है')];
  const PLEDGES = [
    { id: 'trees', icon: '🌳', t: T('Plant more trees', 'ಹೆಚ್ಚೆಚ್ಚು ಗಿಡಗಳನ್ನು ನೆಡೋಣ', 'अधिक से अधिक पेड़ लगाएँ'), tip: T('Plant a native sapling and keep watering it until it is established.', 'ಸ್ಥಳೀಯ ಸಸಿಯನ್ನು ನೆಟ್ಟು ಅದು ಬೇರೂರುವವರೆಗೆ ನೀರು ಹಾಕಿ.', 'एक देशी पौधा लगाएँ और उसके जड़ पकड़ने तक पानी देते रहें।') },
    { id: 'water', icon: '💧', t: T('Protect every drop of water', 'ಜಲ ಸಂರಕ್ಷಿಸೋಣ', 'पानी की हर बूँद बचाएँ'), tip: T('Fix leaking taps and reuse water wherever you safely can.', 'ಸೋರುವ ನಲ್ಲಿಗಳನ್ನು ಸರಿಪಡಿಸಿ; ಸಾಧ್ಯವಿರುವಲ್ಲೆಲ್ಲಾ ನೀರನ್ನು ಮರುಬಳಸಿ.', 'टपकते नल ठीक करें और जहाँ संभव हो पानी का दोबारा उपयोग करें।') },
    { id: 'plastic', icon: '🚫', t: T('Avoid using plastic', 'ಪ್ಲಾಸ್ಟಿಕ್ ಬಳಕೆ ನಿಷೇಧಿಸೋಣ', 'प्लास्टिक का उपयोग न करें'), tip: T('Carry a cloth bag and a reusable bottle.', 'ಬಟ್ಟೆಯ ಚೀಲ ಮತ್ತು ಮರುಬಳಕೆಯ ಬಾಟಲಿ ಜೊತೆಗಿರಲಿ.', 'कपड़े का थैला और दोबारा उपयोग होने वाली बोतल साथ रखें।') },
    { id: 'recycle', icon: '♻️', t: T('Reduce, Reuse, Recycle', 'ಮರು ಬಳಕೆಯನ್ನು ಉತ್ತೇಜಿಸೋಣ', 'कम करें, दोबारा उपयोग करें, रीसायकल करें'), tip: T('Segregate waste at home and give dry waste for recycling.', 'ಮನೆಯಲ್ಲಿ ತ್ಯಾಜ್ಯವನ್ನು ವಿಂಗಡಿಸಿ; ಒಣ ತ್ಯಾಜ್ಯವನ್ನು ಮರುಬಳಕೆಗೆ ನೀಡಿ.', 'घर पर कचरा अलग करें और सूखा कचरा रीसायकल के लिए दें।') },
    { id: 'resource', icon: '🌍', t: T('Save natural resources', 'ನೈಸರ್ಗಿಕ ಸಂಪನ್ಮೂಲಗಳನ್ನು ರಕ್ಷಿಸೋಣ', 'प्राकृतिक संसाधनों की रक्षा करें'), tip: T('Switch off what you are not using and choose energy-saving options.', 'ಬಳಸದ ಉಪಕರಣಗಳನ್ನು ಆರಿಸಿ; ಇಂಧನ ಉಳಿತಾಯದ ಆಯ್ಕೆಗಳನ್ನು ಬಳಸಿ.', 'जो उपयोग में नहीं है उसे बंद करें और ऊर्जा बचाने वाले विकल्प चुनें।') }
  ];
  const EFFECTS = {
    short: [['🤕', T('Headache', 'ತಲೆನೋವು', 'सिरदर्द')], ['😷', T('Coughing', 'ಕೆಮ್ಮು', 'खाँसी')], ['🫁', T('Pneumonia', 'ನ್ಯುಮೋನಿಯಾ', 'निमोनिया')], ['🌬️', T('Bronchitis', 'ಬ್ರಾಂಕೈಟಿಸ್', 'ब्रोंकाइटिस')], ['🩹', T('Skin irritation', 'ಚರ್ಮದ ಕೆರಳಿಕೆ', 'त्वचा में जलन')]],
    long: [['🧠', T('Central nervous system diseases', 'ಕೇಂದ್ರ ನರಮಂಡಲದ ರೋಗಗಳು', 'केंद्रीय तंत्रिका तंत्र के रोग')], ['❤️', T('Cardiovascular diseases', 'ಹೃದ್ರೋಗಗಳು', 'हृदय रोग')], ['🫁', T('Respiratory diseases', 'ಉಸಿರಾಟ ಸಂಬಂಧಿ ರೋಗಗಳು', 'श्वसन रोग')], ['🩺', T('Impacts on the liver', 'ಯಕೃತ್ತಿನ ಮೇಲೆ ಪರಿಣಾಮ', 'लिवर पर प्रभाव')], ['🧬', T('Impacts on the reproductive system', 'ಸಂತಾನೋತ್ಪತ್ತಿ ವ್ಯವಸ್ಥೆಯ ಮೇಲೆ ಪರಿಣಾಮ', 'प्रजनन तंत्र पर प्रभाव')]]
  };
  const BODY = [
    { id: 'nerve', icon: '🧠', n: T('Nerves & brain', 'ನರಮಂಡಲ ಮತ್ತು ಮೆದುಳು', 'तंत्रिका तंत्र और मस्तिष्क'), items: [T('Disturbs the central nervous system', 'ಕೇಂದ್ರ ನರಮಂಡಲಕ್ಕೆ ತೊಂದರೆ', 'केंद्रीय तंत्रिका तंत्र में गड़बड़ी')] },
    { id: 'general', icon: '🤒', n: T('General symptoms', 'ಸಾಮಾನ್ಯ ಲಕ್ಷಣಗಳು', 'सामान्य लक्षण'), items: [T('Fever', 'ಜ್ವರ', 'बुखार'), T('Exhaustion', 'ಬಳಲಿಕೆ', 'थकावट')] },
    { id: 'breath', icon: '🌬️', n: T('Breathing & nose', 'ಉಸಿರಾಟ ಮತ್ತು ಮೂಗು', 'साँस और नाक'), items: [T('Shortness of breath', 'ಉಸಿರಾಟದ ತೊಂದರೆ', 'साँस फूलना'), T('Running nose', 'ಮೂಗು ಸೋರುವುದು', 'नाक बहना'), T('Sneezing', 'ಸೀನು', 'छींकें')] },
    { id: 'heart', icon: '❤️', n: T('Heart', 'ಹೃದಯ', 'हृदय'), items: [T('Damage to heart muscles', 'ಹೃದಯದ ಸ್ನಾಯುಗಳಿಗೆ ಹಾನಿ', 'हृदय की मांसपेशियों को क्षति')] },
    { id: 'lungs', icon: '🫁', n: T('Lungs', 'ಶ್ವಾಸಕೋಶ', 'फेफड़े'), items: [T('Lung damage such as inflammation', 'ಉರಿಯೂತದಂತಹ ಶ್ವಾಸಕೋಶದ ಹಾನಿ', 'सूजन जैसी फेफड़ों की क्षति')] },
    { id: 'kidney', icon: '💧', n: T('Kidneys', 'ಮೂತ್ರಪಿಂಡ', 'गुर्दे'), items: [T('Kidney damage', 'ಮೂತ್ರಪಿಂಡಗಳ ಹಾನಿ', 'गुर्दों को क्षति')] },
    { id: 'blood', icon: '🩸', n: T('Blood & immunity', 'ರಕ್ತ ಮತ್ತು ರೋಗನಿರೋಧಕ ಶಕ್ತಿ', 'रक्त और रोग-प्रतिरोधक क्षमता'), items: [T('Reduced white cells', 'ಬಿಳಿ ರಕ್ತಕಣಗಳ ಇಳಿಕೆ', 'श्वेत रक्त कोशिकाओं में कमी'), T('Blood clotting', 'ರಕ್ತ ಹೆಪ್ಪುಗಟ್ಟುವಿಕೆ', 'रक्त का थक्का जमना')] },
    { id: 'gut', icon: '🍽️', n: T('Stomach & gut', 'ಹೊಟ್ಟೆ ಮತ್ತು ಕರುಳು', 'पेट और आँत'), items: [T('Intestinal infection such as diarrhoea', 'ಅತಿಸಾರದಂತಹ ಕರುಳಿನ ಸೋಂಕು', 'दस्त जैसा आँतों का संक्रमण')] }
  ];
  const STRAT = [
    T('Reduce airborne PM (particulate matter)', 'ಗಾಳಿಯಲ್ಲಿರುವ ಧೂಳಿನ ಕಣಗಳನ್ನು (PM) ಕಡಿಮೆ ಮಾಡುವುದು', 'हवा में मौजूद PM (धूल कण) को कम करना'),
    T('Improve air quality of polluted cities on a long-term basis', 'ಮಾಲಿನ್ಯಗೊಂಡ ನಗರಗಳ ಗಾಳಿಯ ಗುಣಮಟ್ಟವನ್ನು ದೀರ್ಘಾವಧಿಯಲ್ಲಿ ಸುಧಾರಿಸುವುದು', 'प्रदूषित शहरों की वायु गुणवत्ता में दीर्घकालिक सुधार'),
    T('Minimise the health impacts of air pollution', 'ವಾಯು ಮಾಲಿನ್ಯದ ಆರೋಗ್ಯ ಪರಿಣಾಮಗಳನ್ನು ಕನಿಷ್ಠಗೊಳಿಸುವುದು', 'वायु प्रदूषण के स्वास्थ्य प्रभावों को न्यूनतम करना'),
    T('Community interventions such as change in lifestyle, mental health, disease management and awareness programs', 'ಜೀವನಶೈಲಿ ಬದಲಾವಣೆ, ಮಾನಸಿಕ ಆರೋಗ್ಯ, ರೋಗ ನಿರ್ವಹಣೆ ಮತ್ತು ಜಾಗೃತಿ ಕಾರ್ಯಕ್ರಮಗಳಂತಹ ಸಮುದಾಯ ಕ್ರಮಗಳು', 'जीवनशैली में बदलाव, मानसिक स्वास्थ्य, रोग प्रबंधन और जागरूकता कार्यक्रम जैसे सामुदायिक प्रयास'),
    T('Decrease human and anthropogenic activities that pollute', 'ಮಾನವ ನಿರ್ಮಿತ ಮಾಲಿನ್ಯ ಚಟುವಟಿಕೆಗಳನ್ನು ಕಡಿಮೆ ಮಾಡುವುದು', 'मानवीय गतिविधियों से होने वाले प्रदूषण को घटाना'),
    T('In-depth studies on the ancillary effects of air pollution on COVID-19', 'ವಾಯು ಮಾಲಿನ್ಯದ ಕೋವಿಡ್-19 ಮೇಲಿನ ಸಹಾಯಕ ಪರಿಣಾಮಗಳ ಬಗ್ಗೆ ಆಳವಾದ ಅಧ್ಯಯನ', 'कोविड-19 पर वायु प्रदूषण के सहायक प्रभावों का गहन अध्ययन'),
    T('Lockdown measures and social distancing', 'ಲಾಕ್‌ಡೌನ್ ಕ್ರಮಗಳು ಮತ್ತು ಸಾಮಾಜಿಕ ಅಂತರ', 'लॉकडाउन उपाय और सामाजिक दूरी'),
    T('Extend vaccine development and curative medicine', 'ಲಸಿಕೆ ಅಭಿವೃದ್ಧಿ ಮತ್ತು ಚಿಕಿತ್ಸಕ ಔಷಧಗಳ ವಿಸ್ತರಣೆ', 'टीकों के विकास और उपचार दवाओं का विस्तार')
  ];

  const art = (id) => G.DB.get('articles', id) || (G.envArticles || []).find((a) => a.id === id);
  const artBody = (id) => { const a = art(id); if (!a) return []; const b = a.body; return Array.isArray(b) ? b : (b && (b[L()] || b.en)) || []; };
  const set = (el, h) => { el.innerHTML = h; G.observeReveal && G.observeReveal(el); };

  /* ---------------- sections ---------------- */
  function renderMessage() {
    // follows the site language (top-bar switcher). Tamil / Telugu fall back to English text which the auto-translator converts.
    const body = (art('only-one-earth') || { body: {} }).body;
    const paras = Array.isArray(body) ? body : (body[L()] || body.en || []);
    set($('#envMsg'), `<div class="env-msg-grid">
      <div class="card env-essay reveal"><div class="section-head" style="margin-bottom:10px"><h3>${tx(S.hMessage)}</h3></div>
        ${paras.map((p) => `<p>${esc(p)}</p>`).join('')}
        <blockquote class="env-quote">“${esc(tx(S.unity))}”</blockquote></div>
      <div class="env-side reveal"><img src="assets/about_natural_sprout.jpg" alt="Hands holding a young plant" loading="lazy"><div class="env-who">${esc(tx(S.who))}</div>
        <div class="env-resp">🌿 ${esc(tx(S.resp))}</div></div></div>`);
  }
  function renderSlogans() {
    set($('#envSlog'), `<ul class="env-slogans">${SLOGANS.map((s, i) => `<li class="reveal" style="--d:${i * 110}ms"><span class="sq"></span><b>${esc(tx(s))}</b></li>`).join('')}</ul>`);
  }
  function renderPledges() {
    let done = store.get('gigf_pledges', []);
    const C = 2 * Math.PI * 34;
    const draw = () => {
      const n = done.length;
      set($('#envPledges'), PLEDGES.map((p, i) => `<article class="pledge-card reveal ${done.includes(p.id) ? 'done' : ''}" style="--d:${i * 90}ms" data-id="${p.id}">
        <button class="pl-face" aria-expanded="false" data-flip><span class="pl-ico">${p.icon}</span><b>${esc(tx(p.t))}</b><small>${tx(S.tip)} ▾</small></button>
        <div class="pl-tip">💡 ${esc(tx(p.tip))}</div>
        <label class="pl-check"><input type="checkbox" ${done.includes(p.id) ? 'checked' : ''} data-pick="${p.id}"><span>${esc(tx(S.iPledge))}</span></label></article>`).join(''));
      const names = PLEDGES.filter((p) => done.includes(p.id)).map((p) => tx(p.t));
      const text = `${tx(S.hPledge)}: ${names.join(' • ')}\n${G.ORG.name} — ${location.href.split('#')[0]}`;
      set($('#envPledgeBar'), `<div class="pledge-bar reveal"><svg class="ring" viewBox="0 0 80 80" width="84" height="84" aria-hidden="true"><circle cx="40" cy="40" r="34" fill="none" stroke="#e5e7eb" stroke-width="8"/><circle cx="40" cy="40" r="34" fill="none" stroke="#16a34a" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - n / PLEDGES.length)}" transform="rotate(-90 40 40)" style="transition:stroke-dashoffset .8s cubic-bezier(.25,.8,.35,1)"/><text x="40" y="46" text-anchor="middle" font-size="22" font-weight="800" fill="#0f4d2a">${n}/5</text></svg>
        <div><b>${n} ${esc(tx(S.pledged))}</b><div class="pl-msg">${n === PLEDGES.length ? esc(tx(S.thanks)) : ''}</div>
        ${n ? `<a class="btn btn-primary btn-sm" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text)}">💬 ${esc(tx(S.share))}</a>` : ''}</div></div>`);
      if (n === PLEDGES.length) burst();
    };
    $('#envPledges').addEventListener('click', (e) => {
      const f = e.target.closest('[data-flip]'); if (f) { const c = f.closest('.pledge-card'); const open = c.classList.toggle('open'); f.setAttribute('aria-expanded', String(open)); return; }
    });
    $('#envPledges').addEventListener('change', (e) => {
      const id = e.target.dataset.pick; if (!id) return;
      done = e.target.checked ? Array.from(new Set(done.concat(id))) : done.filter((x) => x !== id); store.set('gigf_pledges', done);
      const open = $$('.pledge-card.open').map((c) => c.dataset.id); draw(); open.forEach((i) => { const c = $(`.pledge-card[data-id=${i}]`); c && c.classList.add('open'); });
    });
    draw();
  }
  function burst() {   // small celebratory leaves when all pledges are ticked
    const box = $('#envPledgeBar'); if (!box || document.documentElement.classList.contains('no-motion')) return;
    for (let i = 0; i < 18; i++) { const l = document.createElement('span'); l.className = 'confetti'; l.textContent = ['🍃', '🌿', '🍀', '🌳'][i % 4]; l.style.cssText = `left:${10 + Math.random() * 80}%;--x:${(Math.random() - .5) * 220}px;--r:${Math.random() * 360}deg;animation-delay:${Math.random() * .3}s`; box.appendChild(l); setTimeout(() => l.remove(), 1800); }
  }
  function renderHealth() {
    let tab = 'short';
    const draw = () => {
      set($('#envHealthBody'), `<div class="tabs env-tabs" role="tablist">${['short', 'long'].map((k) => `<button class="tab ${tab === k ? 'on' : ''}" role="tab" data-t="${k}">${k === 'short' ? '⚡' : '⏳'} ${esc(tx(S[k]))}</button>`).join('')}</div>
        <div class="eff-grid">${EFFECTS[tab].map(([i, n], k) => `<div class="eff reveal" style="--d:${k * 80}ms"><span>${i}</span><b>${esc(tx(n))}</b></div>`).join('')}</div>
        <p class="env-note">⚠️ ${esc(tx(S.med))}</p>`);
      $$('.env-tabs .tab', $('#envHealthBody')).forEach((b) => (b.onclick = () => { tab = b.dataset.t; draw(); }));
    };
    draw();
  }
  function renderCovid() {
    let sel = 'lungs';
    const draw = () => {
      const g = BODY.find((b) => b.id === sel);
      set($('#envCovidBody'), `<div class="flow"><div class="flow-box f1"><span>🏭</span>${esc(tx(S.fAir))}</div><span class="flow-arrow">➜</span><div class="flow-box f2"><span>⚠️</span>${esc(tx(S.fImp))}</div><span class="flow-arrow">➜</span><div class="flow-box f3"><span>🦠</span>${esc(tx(S.fCov))}</div></div>
        <div class="body-pills" role="tablist">${BODY.map((b) => `<button class="pill ${b.id === sel ? 'on' : ''}" role="tab" data-b="${b.id}">${b.icon} ${esc(tx(b.n))}</button>`).join('')}</div>
        <div class="body-out"><div class="body-ico">${g.icon}</div><div><h4>${esc(tx(g.n))}</h4><ul>${g.items.map((i) => `<li>${esc(tx(i))}</li>`).join('')}</ul></div></div>
        <p class="env-note">⚠️ ${esc(tx(S.med))}</p>`);
      $$('.body-pills .pill', $('#envCovidBody')).forEach((b) => (b.onclick = () => { sel = b.dataset.b; draw(); }));
    };
    draw();
  }
  function renderTrees() {
    const evs = G.DB.all('events').filter((e) => e.status === 'UPCOMING' && e.program === 'tree').sort((a, b) => a.date.localeCompare(b.date))[0];
    set($('#envTreesBody'), `<div class="trees-card reveal"><div class="trees-ico">🌳</div><div style="flex:1"><h3>${esc(tx(S.hTrees))}</h3>${artBody('trees-and-clean-air').slice(0, 2).map((p) => `<p>${esc(p)}</p>`).join('')}
      ${evs ? `<p class="env-next">📅 <a href="events.html#${evs.slug}">${esc(G.tr(evs.title))} — ${G.fmtDate(evs.date)}</a></p>` : ''}
      <div class="cta-row"><a class="btn btn-primary" href="events.html">📅 ${esc(tx(S.ctaEv))}</a><a class="btn btn-ghost" href="volunteer.html?program=tree">🤝 ${esc(tx(S.ctaVol))}</a><a class="btn btn-orange" href="donate.html?program=tree">💚 ${esc(tx(S.ctaDon))}</a></div></div></div>`);
  }
  function renderStrat() {
    let on = store.get('gigf_strat', []);
    const draw = () => {
      const pct = Math.round((on.length / STRAT.length) * 100);
      set($('#envStratBody'), `<div class="bar" aria-label="${pct}%"><i style="width:${pct}%"></i></div>
        <ul class="strat">${STRAT.map((s, i) => `<li class="reveal ${on.includes(i) ? 'on' : ''}" style="--d:${i * 60}ms"><label><input type="checkbox" data-s="${i}" ${on.includes(i) ? 'checked' : ''}><span class="bx"></span><span>${esc(tx(s))}</span></label></li>`).join('')}</ul>`);
      $$('input[data-s]', $('#envStratBody')).forEach((c) => (c.onchange = () => { const i = Number(c.dataset.s); on = c.checked ? Array.from(new Set(on.concat(i))) : on.filter((x) => x !== i); store.set('gigf_strat', on); draw(); }));
    };
    draw();
  }
  function renderBrochure() {
    const text = `${tx(S.hBro)} — ${location.href.split('#')[0]}`;
    set($('#envBro'), `<div class="bro-card reveal"><div class="bro-ico">📄</div><div style="flex:1"><h3>${esc(tx(S.hBro))}</h3><p>${esc(tx(S.broSub))}</p></div>
      <div class="cta-row" style="margin:0"><a class="btn btn-primary" href="assets/Green-India-Gokul-Awareness-Brochure.pdf" download>⬇ ${esc(tx(S.dl))}</a><a class="btn btn-ghost" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text)}">💬 ${esc(tx(S.shareP))}</a></div></div>
      <p class="bro-contact">📍 ${esc(G.ORG.address)}<br>📞 ${G.ORG.phones.map((p) => `<a href="tel:${p.tel}">${p.display}</a>`).join(' · ')} · ✉️ <a href="mailto:${G.ORG.email}">${G.ORG.email}</a></p>`);
  }

  G.boot(() => {
    if (document.body.dataset.page !== 'environment') return;
    const lead = $('.page-hero p'); if (lead) lead.textContent = tx(S.lead);
    $('#hPledge').textContent = tx(S.hPledge); $('#pledgeSub').textContent = tx(S.pledgeSub);
    $('#hHealth').textContent = tx(S.hHealth); $('#hCovid').textContent = tx(S.hCovid); $('#covidSub').textContent = tx(S.covidSub);
    $('#hStrat').textContent = tx(S.hStrat); $('#stratSub').textContent = tx(S.stratSub);
    renderMessage(); renderSlogans(); renderPledges(); renderHealth(); renderCovid(); renderTrees(); renderStrat(); renderBrochure();
  });
})();
