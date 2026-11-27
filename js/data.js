/**
 * Green India Gokul Foundation — data layer (front-end "API").
 *
 * Everything the site shows (programs, events, news, articles, gallery, donations,
 * volunteers, tickets, users, audit log) lives in ONE place: GIGF.DB.
 * Today it is persisted in this browser's localStorage so the whole site is
 * interactive without a server. Each method maps 1:1 to a REST endpoint in
 * REQUIREMENTS_FOR_CLAUDE.md §4.8, so replacing the bodies with fetch('/api/...')
 * is the only change needed when the backend exists.
 *
 * DEMO MODE: no real money moves, no real e-mail/SMS is sent, passwords are only
 * salted+hashed in the browser. Real security needs the backend (see README-ROADMAP).
 */
(function () {
  try { if (localStorage.getItem('gigf_motion') === 'off') document.documentElement.classList.add('no-motion'); } catch (e) { }
  const GIGF = (window.GIGF = window.GIGF || {});

  /* ---------- Official organisation details (REQUIREMENTS §0) ---------- */
  GIGF.ORG = {
    name: 'Green India Gokul Foundation',
    nameCaps: 'GREEN INDIA GOKUL FOUNDATION',
    address: 'No. 17A, 3rd Floor, Aditya Layout, H T Lane, New Kalkere Main Road, Ramamurthy Nagar, Bengaluru – 560016, Karnataka, India',
    addressShort: 'Ramamurthy Nagar, Bengaluru – 560016',
    email: 'greenindiagokulfoundation@gmail.com', // TODO(owner): confirm ".com" — the source card was cropped
    phones: [
      { display: '+91 93412 29667', tel: '+919341229667', wa: '919341229667' },
      { display: '+91 93531 21523', tel: '+919353121523', wa: '919353121523' }
    ],
    mapQuery: 'Aditya Layout, H T Lane, New Kalkere Main Road, Ramamurthy Nagar, Bengaluru 560016'
  };
  GIGF.ORG.mapEmbed = 'https://www.google.com/maps?q=' + encodeURIComponent(GIGF.ORG.mapQuery) + '&output=embed';
  GIGF.ORG.mapLink = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(GIGF.ORG.mapQuery);
  GIGF.ORG.waLink = (text) => 'https://wa.me/' + GIGF.ORG.phones[0].wa + (text ? '?text=' + encodeURIComponent(text) : '');

  /* ---------- tiny helpers ---------- */
  const KEY = 'gigf_db_v2';
  const uid = (p) => (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const today = () => new Date().toISOString().slice(0, 10);
  GIGF.uid = uid;
  GIGF.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  GIGF.inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
  GIGF.fmtDate = (d, opts) => new Date(d).toLocaleDateString({ kn: 'kn-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN', ml: 'ml-IN' }[localStorage.getItem('gigf_lang')] || 'en-IN', opts || { day: 'numeric', month: 'short', year: 'numeric' });

  /* ---------- seed content ---------- */
  const T = (en, kn, hi) => ({ en, kn, hi });

  function seed() {
    const programs = [
      {
        id: 'tree', slug: 'tree-plantation', icon: '🌳', color: '#1ea855', img: 'assets/gallery/gallery3.jpg', active: true, order: 1,
        title: T('Tree Plantation & Environment', 'ವೃಕ್ಷಾರೋಪಣ ಮತ್ತು ಪರಿಸರ', 'वृक्षारोपण और पर्यावरण'),
        tagline: T('Restoring green cover, biodiversity and clean air.', 'ಹಸಿರು ಹೊದಿಕೆ, ಜೀವವೈವಿಧ್ಯ ಮತ್ತು ಶುದ್ಧ ಗಾಳಿಯ ಪುನರುಜ್ಜೀವನ.', 'हरित आवरण, जैव विविधता और स्वच्छ हवा की बहाली।'),
        desc: T('Community-driven plantation drives on public land, schools, parks and village commons. Every sapling is planted with local volunteers and followed up so it has a real chance to grow.',
          'ಸಾರ್ವಜನಿಕ ಭೂಮಿ, ಶಾಲೆ, ಉದ್ಯಾನ ಮತ್ತು ಹಳ್ಳಿಗಳಲ್ಲಿ ಸಮುದಾಯ ಆಧಾರಿತ ಗಿಡ ನೆಡುವ ಅಭಿಯಾನಗಳು. ಪ್ರತಿ ಸಸಿಯನ್ನು ಸ್ಥಳೀಯ ಸ್ವಯಂಸೇವಕರೊಂದಿಗೆ ನೆಟ್ಟು ಬೆಳೆಯಲು ಅನುಸರಣೆ ಮಾಡಲಾಗುತ್ತದೆ.',
          'सार्वजनिक भूमि, स्कूलों, पार्कों और गाँवों में समुदाय-आधारित वृक्षारोपण अभियान। हर पौधा स्थानीय स्वयंसेवकों के साथ लगाया जाता है और उसकी देखभाल की जाती है।'),
        initiatives: [T('Mass plantation drives', 'ಸಾಮೂಹಿಕ ಗಿಡ ನೆಡುವ ಅಭಿಯಾನ', 'सामूहिक वृक्षारोपण अभियान'), T('Native & fruit-bearing saplings', 'ಸ್ಥಳೀಯ ಮತ್ತು ಹಣ್ಣಿನ ಸಸಿಗಳು', 'देशी और फलदार पौधे'), T('School eco-clubs', 'ಶಾಲಾ ಪರಿಸರ ಕ್ಲಬ್‌ಗಳು', 'स्कूल इको-क्लब')],
        impact: []
      },
      {
        id: 'cow', slug: 'cow-protection', icon: '🐮', color: '#8d5b2d', img: 'assets/desi_cow_hd.jpg', active: true, order: 2,
        title: T('Cow Protection & Goshala', 'ಗೋ ರಕ್ಷಣೆ ಮತ್ತು ಗೋಶಾಲೆ', 'गौ संरक्षण और गौशाला'),
        tagline: T('Shelter, fodder and care for indigenous cows.', 'ದೇಸಿ ಹಸುಗಳಿಗೆ ಆಶ್ರಯ, ಮೇವು ಮತ್ತು ಆರೈಕೆ.', 'देसी गायों के लिए आश्रय, चारा और देखभाल।'),
        desc: T('Gau-Seva for abandoned, sick and ageing indigenous cows, with support for natural farming that uses cow-based inputs.',
          'ಅನಾಥ, ಅಸ್ವಸ್ಥ ಮತ್ತು ವಯಸ್ಸಾದ ದೇಸಿ ಹಸುಗಳ ಗೋ-ಸೇವೆ ಹಾಗೂ ಗೋ-ಆಧಾರಿತ ನೈಸರ್ಗಿಕ ಕೃಷಿಗೆ ಬೆಂಬಲ.',
          'परित्यक्त, बीमार और वृद्ध देसी गायों की सेवा तथा गौ-आधारित प्राकृतिक खेती को सहयोग।'),
        initiatives: [T('Fodder & shelter seva', 'ಮೇವು ಮತ್ತು ಆಶ್ರಯ ಸೇವೆ', 'चारा और आश्रय सेवा'), T('Veterinary care', 'ಪಶುವೈದ್ಯಕೀಯ ಆರೈಕೆ', 'पशु चिकित्सा'), T('Natural-farming awareness', 'ನೈಸರ್ಗಿಕ ಕೃಷಿ ಜಾಗೃತಿ', 'प्राकृतिक खेती जागरूकता')],
        impact: []
      },
      {
        id: 'health', slug: 'yoga-health', icon: '🧘', color: '#dc2626', img: 'assets/hero_yoga_women.jpg', active: true, order: 3,
        title: T('Yoga, Health & Rural Welfare', 'ಯೋಗ, ಆರೋಗ್ಯ ಮತ್ತು ಗ್ರಾಮೀಣ ಕಲ್ಯಾಣ', 'योग, स्वास्थ्य और ग्रामीण कल्याण'),
        tagline: T('Yoga awareness and preventive health for every community.', 'ಪ್ರತಿ ಸಮುದಾಯಕ್ಕೂ ಯೋಗ ಜಾಗೃತಿ ಮತ್ತು ತಡೆಗಟ್ಟುವ ಆರೋಗ್ಯ.', 'हर समुदाय के लिए योग जागरूकता और निवारक स्वास्थ्य।'),
        desc: T('Yoga awareness sessions, health-checkup camps, nutrition guidance and wellness education for communities that have limited access to care.',
          'ಯೋಗ ಜಾಗೃತಿ ಶಿಬಿರಗಳು, ಆರೋಗ್ಯ ತಪಾಸಣಾ ಶಿಬಿರಗಳು, ಪೋಷಣೆ ಮಾರ್ಗದರ್ಶನ ಮತ್ತು ಆರೋಗ್ಯ ಶಿಕ್ಷಣ.',
          'योग जागरूकता सत्र, स्वास्थ्य जाँच शिविर, पोषण मार्गदर्शन और स्वास्थ्य शिक्षा।'),
        initiatives: [T('Community yoga sessions', 'ಸಮುದಾಯ ಯೋಗ ಅವಧಿಗಳು', 'सामुदायिक योग सत्र'), T('Health-checkup camps', 'ಆರೋಗ್ಯ ತಪಾಸಣಾ ಶಿಬಿರಗಳು', 'स्वास्थ्य जाँच शिविर'), T('Nutrition awareness', 'ಪೋಷಣೆ ಜಾಗೃತಿ', 'पोषण जागरूकता')],
        impact: []
      },
      {
        id: 'skill', slug: 'women-youth-skills', icon: '💼', color: '#1e40af', img: 'assets/hero_yoga_women.jpg', active: true, order: 4,
        title: T('Women Empowerment & Skills', 'ಮಹಿಳಾ ಸಬಲೀಕರಣ ಮತ್ತು ಕೌಶಲ್ಯ', 'महिला सशक्तिकरण और कौशल'),
        tagline: T('Skills and livelihoods for women and youth.', 'ಮಹಿಳೆಯರು ಮತ್ತು ಯುವಕರಿಗೆ ಕೌಶಲ್ಯ ಮತ್ತು ಜೀವನೋಪಾಯ.', 'महिलाओं और युवाओं के लिए कौशल और आजीविका।'),
        desc: T('Vocational training, self-help-group support and market linkages so that women and young people can earn with dignity.',
          'ವೃತ್ತಿಪರ ತರಬೇತಿ, ಸ್ವಸಹಾಯ ಗುಂಪುಗಳ ಬೆಂಬಲ ಮತ್ತು ಮಾರುಕಟ್ಟೆ ಸಂಪರ್ಕ.',
          'व्यावसायिक प्रशिक्षण, स्वयं सहायता समूह सहयोग और बाज़ार से जुड़ाव।'),
        initiatives: [T('Vocational training', 'ವೃತ್ತಿಪರ ತರಬೇತಿ', 'व्यावसायिक प्रशिक्षण'), T('Self-help groups', 'ಸ್ವಸಹಾಯ ಗುಂಪುಗಳು', 'स्वयं सहायता समूह'), T('Digital literacy', 'ಡಿಜಿಟಲ್ ಸಾಕ್ಷರತೆ', 'डिजिटल साक्षरता')],
        impact: []
      },
      {
        id: 'community', slug: 'community-development', icon: '👥', color: '#0f766e', img: 'assets/gallery/gallery2.jpg', active: true, order: 5,
        title: T('Community Development', 'ಸಮುದಾಯ ಅಭಿವೃದ್ಧಿ', 'सामुदायिक विकास'),
        tagline: T('Strong, self-reliant villages and neighbourhoods.', 'ಸಶಕ್ತ, ಸ್ವಾವಲಂಬಿ ಗ್ರಾಮಗಳು ಮತ್ತು ನೆರೆಹೊರೆಗಳು.', 'मजबूत, आत्मनिर्भर गाँव और मोहल्ले।'),
        desc: T('Working with local groups on water, sanitation, civic awareness and welfare-scheme access.',
          'ನೀರು, ನೈರ್ಮಲ್ಯ, ನಾಗರಿಕ ಜಾಗೃತಿ ಮತ್ತು ಸರ್ಕಾರಿ ಯೋಜನೆಗಳ ಪ್ರವೇಶಕ್ಕಾಗಿ ಸ್ಥಳೀಯ ಗುಂಪುಗಳೊಂದಿಗೆ ಕೆಲಸ.',
          'जल, स्वच्छता, नागरिक जागरूकता और कल्याण योजनाओं तक पहुँच के लिए स्थानीय समूहों के साथ कार्य।'),
        initiatives: [T('Water-body care', 'ಜಲಮೂಲ ಆರೈಕೆ', 'जल स्रोत देखभाल'), T('Scheme-access help desks', 'ಯೋಜನೆ ಸಹಾಯ ಕೇಂದ್ರಗಳು', 'योजना सहायता केंद्र'), T('Civic awareness', 'ನಾಗರಿಕ ಜಾಗೃತಿ', 'नागरिक जागरूकता')],
        impact: []
      },
      {
        id: 'sustainable', slug: 'sustainable-living', icon: '🌿', color: '#15803d', img: 'assets/about_natural_sprout.jpg', active: true, order: 6,
        title: T('Sustainable Living', 'ಸುಸ್ಥಿರ ಜೀವನ', 'सतत जीवनशैली'),
        tagline: T('Everyday habits that protect the planet.', 'ಭೂಮಿಯನ್ನು ರಕ್ಷಿಸುವ ದೈನಂದಿನ ಅಭ್ಯಾಸಗಳು.', 'धरती की रक्षा करने वाली रोज़मर्रा की आदतें।'),
        desc: T('Workshops on waste segregation, plastic-free alternatives, composting, terrace gardening and rainwater harvesting.',
          'ತ್ಯಾಜ್ಯ ವಿಂಗಡಣೆ, ಪ್ಲಾಸ್ಟಿಕ್ ಮುಕ್ತ ಪರ್ಯಾಯಗಳು, ಗೊಬ್ಬರ, ಮಾಳಿಗೆ ತೋಟ ಮತ್ತು ಮಳೆ ನೀರು ಕೊಯ್ಲು ಕಾರ್ಯಾಗಾರಗಳು.',
          'कचरा पृथक्करण, प्लास्टिक-मुक्त विकल्प, खाद, छत बागवानी और वर्षा जल संचयन पर कार्यशालाएँ।'),
        initiatives: [T('Plastic-free drives', 'ಪ್ಲಾಸ್ಟಿಕ್ ಮುಕ್ತ ಅಭಿಯಾನ', 'प्लास्टिक-मुक्त अभियान'), T('Composting workshops', 'ಗೊಬ್ಬರ ಕಾರ್ಯಾಗಾರ', 'खाद कार्यशाला'), T('Rainwater harvesting', 'ಮಳೆ ನೀರು ಕೊಯ್ಲು', 'वर्षा जल संचयन')],
        impact: []
      }
    ];

    // Tentative sample schedule — the Foundation edits/replaces these from Admin → Events.
    const events = [
      { id: 'ev1', slug: 'tree-plantation-drive', program: 'tree', date: '2026-12-13', time: '07:30', location: 'Bengaluru (venue to be announced)', capacity: 40, status: 'UPCOMING', tentative: true,
        title: T('Tree Plantation Drive', 'ವೃಕ್ಷಾರೋಪಣ ಅಭಿಯಾನ', 'वृक्षारोपण अभियान'),
        desc: T('Join us to plant saplings together. Gloves, saplings and tools are arranged. Wear comfortable clothes and bring a water bottle.', 'ಸಸಿಗಳನ್ನು ನೆಡಲು ಜೊತೆಗೂಡಿ. ಕೈಗವಸು, ಸಸಿ ಮತ್ತು ಉಪಕರಣಗಳ ವ್ಯವಸ್ಥೆ ಇದೆ.', 'पौधे लगाने के लिए हमारे साथ जुड़ें। दस्ताने, पौधे और औज़ार उपलब्ध हैं।') },
      { id: 'ev2', slug: 'yoga-awareness-camp', program: 'health', date: '2026-12-20', time: '06:30', location: 'Bengaluru (venue to be announced)', capacity: 60, status: 'UPCOMING', tentative: true,
        title: T('Yoga & Health Awareness Camp', 'ಯೋಗ ಮತ್ತು ಆರೋಗ್ಯ ಜಾಗೃತಿ ಶಿಬಿರ', 'योग और स्वास्थ्य जागरूकता शिविर'),
        desc: T('A beginner-friendly yoga session followed by a basic health-awareness talk. Bring your own mat.', 'ಆರಂಭಿಕರಿಗೆ ಸೂಕ್ತ ಯೋಗ ಅವಧಿ ಮತ್ತು ಆರೋಗ್ಯ ಜಾಗೃತಿ ಮಾತುಕತೆ. ನಿಮ್ಮ ಚಾಪೆ ತನ್ನಿ.', 'शुरुआती लोगों के लिए योग सत्र और स्वास्थ्य जागरूकता चर्चा। अपनी चटाई लाएँ।') },
      { id: 'ev3', slug: 'gau-seva-day', program: 'cow', date: '2027-01-03', time: '08:00', location: 'Goshala (location to be announced)', capacity: 30, status: 'UPCOMING', tentative: true,
        title: T('Gau-Seva Volunteer Day', 'ಗೋ-ಸೇವಾ ಸ್ವಯಂಸೇವಕ ದಿನ', 'गौ-सेवा स्वयंसेवक दिवस'),
        desc: T('Spend a morning feeding and caring for indigenous cows with our team.', 'ನಮ್ಮ ತಂಡದೊಂದಿಗೆ ದೇಸಿ ಹಸುಗಳಿಗೆ ಮೇವು ನೀಡಿ ಆರೈಕೆ ಮಾಡುವ ಒಂದು ಬೆಳಗು.', 'हमारी टीम के साथ देसी गायों को चारा खिलाने और देखभाल में एक सुबह बिताएँ।') },
      { id: 'ev4', slug: 'women-skills-workshop', program: 'skill', date: '2027-01-17', time: '10:00', location: 'Bengaluru (venue to be announced)', capacity: 35, status: 'UPCOMING', tentative: true,
        title: T('Women Skills & Livelihood Workshop', 'ಮಹಿಳಾ ಕೌಶಲ್ಯ ಮತ್ತು ಜೀವನೋಪಾಯ ಕಾರ್ಯಾಗಾರ', 'महिला कौशल और आजीविका कार्यशाला'),
        desc: T('An introduction to self-help groups, small-business basics and government schemes.', 'ಸ್ವಸಹಾಯ ಗುಂಪುಗಳು, ಸಣ್ಣ ವ್ಯಾಪಾರದ ಮೂಲಭೂತ ಅಂಶಗಳು ಮತ್ತು ಸರ್ಕಾರಿ ಯೋಜನೆಗಳ ಪರಿಚಯ.', 'स्वयं सहायता समूह, छोटे व्यवसाय की बुनियादी बातें और सरकारी योजनाओं का परिचय।') }
    ];

    const news = [
      { id: 'n1', date: '2026-11-25', status: 'PUBLISHED', pinned: true,
        title: T('Our new website is live', 'ನಮ್ಮ ಹೊಸ ವೆಬ್‌ಸೈಟ್ ಈಗ ಲಭ್ಯ', 'हमारी नई वेबसाइट शुरू हो गई है'),
        summary: T('Browse programs, register for events, volunteer and donate online.', 'ಕಾರ್ಯಕ್ರಮಗಳನ್ನು ನೋಡಿ, ಕಾರ್ಯಕ್ರಮಗಳಿಗೆ ನೋಂದಣಿ ಮಾಡಿ, ಸ್ವಯಂಸೇವಕರಾಗಿ ಮತ್ತು ದೇಣಿಗೆ ನೀಡಿ.', 'कार्यक्रम देखें, आयोजनों के लिए पंजीकरण करें, स्वयंसेवक बनें और दान करें।'), link: 'programs.html' },
      { id: 'n2', date: '2026-11-24', status: 'PUBLISHED', pinned: false,
        title: T('Volunteer registrations are open', 'ಸ್ವಯಂಸೇವಕ ನೋಂದಣಿ ಆರಂಭ', 'स्वयंसेवक पंजीकरण शुरू'),
        summary: T('Register with your ID proof and receive a digital volunteer badge once approved.', 'ನಿಮ್ಮ ಗುರುತಿನ ಪುರಾವೆಯೊಂದಿಗೆ ನೋಂದಾಯಿಸಿ; ಅನುಮೋದನೆಯ ನಂತರ ಡಿಜಿಟಲ್ ಬ್ಯಾಡ್ಜ್ ಪಡೆಯಿರಿ.', 'अपने पहचान प्रमाण के साथ पंजीकरण करें और स्वीकृति के बाद डिजिटल बैज पाएँ।'), link: 'volunteer.html' },
      { id: 'n3', date: '2026-11-20', status: 'PUBLISHED', pinned: false,
        title: T('Photos from our plantation drive', 'ನಮ್ಮ ಗಿಡ ನೆಡುವ ಅಭಿಯಾನದ ಚಿತ್ರಗಳು', 'हमारे वृक्षारोपण अभियान की तस्वीरें'),
        summary: T('See photos and videos from our recent tree plantation activity in the gallery.', 'ಇತ್ತೀಚಿನ ಗಿಡ ನೆಡುವ ಚಟುವಟಿಕೆಯ ಫೋಟೋ ಮತ್ತು ವೀಡಿಯೊಗಳನ್ನು ಗ್ಯಾಲರಿಯಲ್ಲಿ ನೋಡಿ.', 'हाल की वृक्षारोपण गतिविधि की तस्वीरें और वीडियो गैलरी में देखें।'), link: 'gallery.html' }
    ];

    const A = (id, cat, date, tEn, tKn, tHi, sEn, sKn, sHi, body) => ({ id, slug: id, category: cat, date, status: 'PUBLISHED', title: T(tEn, tKn, tHi), summary: T(sEn, sKn, sHi), body });
    const articles = [
      A('yoga-for-beginners', 'yoga', '2026-11-18', 'Yoga for beginners: where to start', 'ಆರಂಭಿಕರಿಗೆ ಯೋಗ: ಎಲ್ಲಿಂದ ಶುರು ಮಾಡಬೇಕು', 'शुरुआती लोगों के लिए योग: कहाँ से शुरू करें',
        'A simple, safe routine you can follow at home.', 'ಮನೆಯಲ್ಲಿ ಅನುಸರಿಸಬಹುದಾದ ಸರಳ, ಸುರಕ್ಷಿತ ದಿನಚರಿ.', 'घर पर अपनाने योग्य सरल और सुरक्षित दिनचर्या।',
        ['Yoga does not need special equipment. Start with 10–15 minutes a day on an empty stomach, in a quiet place.', 'A gentle sequence: a few rounds of Surya Namaskar, standing poses such as Tadasana and Trikonasana, seated poses such as Sukhasana and Vajrasana, and finish with 5 minutes of Shavasana.', 'Add Pranayama (slow, steady breathing) once you are comfortable. Never force a posture; if you have a medical condition, are pregnant or recovering from surgery, check with your doctor or a qualified instructor first.', 'International Day of Yoga is observed every year on 21 June — a good goal to build a habit towards.']),
      A('balanced-plate', 'health', '2026-11-12', 'Building a balanced, affordable plate', 'ಸಮತೋಲಿತ, ಕೈಗೆಟುಕುವ ಊಟ', 'संतुलित और किफ़ायती थाली',
        'Local grains, pulses and vegetables go a long way.', 'ಸ್ಥಳೀಯ ಧಾನ್ಯ, ಬೇಳೆ ಮತ್ತು ತರಕಾರಿಗಳು ಬಹಳ ಉಪಯುಕ್ತ.', 'स्थानीय अनाज, दालें और सब्ज़ियाँ बहुत काम आती हैं।',
        ['Half the plate vegetables and greens, a quarter grains (millets such as ragi are rich in calcium and fibre), a quarter pulses or protein.', 'Cut back on sugary drinks and deep-fried snacks; drink enough clean water.', 'Pregnant women, children and older adults have special needs — talk to your nearest Anganwadi worker, ASHA worker or doctor.']),
      A('women-shg-basics', 'women', '2026-11-05', 'Self-help groups: how women build savings and income', 'ಸ್ವಸಹಾಯ ಗುಂಪುಗಳು: ಮಹಿಳೆಯರ ಉಳಿತಾಯ ಮತ್ತು ಆದಾಯ', 'स्वयं सहायता समूह: महिलाएँ बचत और आय कैसे बनाती हैं',
        'A SHG is a small group that saves together and lends to members.', 'ಸ್ವಸಹಾಯ ಗುಂಪು ಒಟ್ಟಾಗಿ ಉಳಿಸಿ ಸದಸ್ಯರಿಗೆ ಸಾಲ ನೀಡುವ ಸಣ್ಣ ಗುಂಪು.', 'SHG एक छोटा समूह है जो मिलकर बचत करता है और सदस्यों को ऋण देता है।',
        ['A typical self-help group has 10–20 women who save a fixed amount every month, keep records, and lend to each other at agreed rates.', 'Once the group is stable it can open a bank account and approach banks for loans. Under the Pradhan Mantri MUDRA Yojana, collateral-free loans up to ₹10 lakh are available for small businesses (Shishu up to ₹50,000, Kishor ₹50,000–₹5 lakh, Tarun ₹5–₹10 lakh).', 'Always confirm current terms on the official portal or at your bank branch before applying.']),
      A('our-mission-in-action', 'stories', '2026-10-30', 'Why we plant: stories from the field', 'ನಾವು ಗಿಡ ನೆಡುವುದೇಕೆ', 'हम पौधे क्यों लगाते हैं',
        'A plantation morning, seen through volunteers’ eyes.', 'ಸ್ವಯಂಸೇವಕರ ಕಣ್ಣಲ್ಲಿ ಒಂದು ಗಿಡ ನೆಡುವ ಬೆಳಗು.', 'स्वयंसेवकों की नज़र से एक वृक्षारोपण की सुबह।',
        ['Our plantation drives bring neighbours, students and families together on open land to plant native saplings.', 'Planting is only the first step — follow-up watering and protection is what lets a sapling become a tree. Check the Gallery for photos and videos from our recent drive.', 'Want to be part of the next one? Register as a volunteer or check the Events page.']),
      A('know-your-schemes', 'schemes', '2026-10-22', 'Government health cover you may be eligible for', 'ನೀವು ಅರ್ಹರಾಗಿರಬಹುದಾದ ಸರ್ಕಾರಿ ಆರೋಗ್ಯ ವಿಮೆ', 'सरकारी स्वास्थ्य कवर जिसके आप पात्र हो सकते हैं',
        'Ayushman Bharat PM-JAY and how to check eligibility.', 'ಆಯುಷ್ಮಾನ್ ಭಾರತ್ PM-JAY ಮತ್ತು ಅರ್ಹತೆ ಪರಿಶೀಲನೆ.', 'आयुष्मान भारत PM-JAY और पात्रता की जाँच।',
        ['Ayushman Bharat PM-JAY provides health cover of up to ₹5 lakh per family per year for secondary and tertiary hospitalisation at empanelled hospitals, for eligible families.', 'You can check eligibility on the official PM-JAY portal or helpline, or at a Common Service Centre / empanelled hospital Ayushman Mitra desk.', 'Eligibility rules change over time — always verify on the official government website. Our team can help you find the right desk.'])
    ];


    // --- Environment awareness campaign (from the Foundation's printed awareness brochure) ---
    const AB = (id, tEn, tKn, tHi, sEn, sKn, sHi, bEn, bKn, bHi) => ({ id, slug: id, category: 'environment', date: '2026-11-25', status: 'PUBLISHED', title: T(tEn, tKn, tHi), summary: T(sEn, sKn, sHi), body: { en: bEn, kn: bKn, hi: bHi } });
    const envArticles = [
      AB('only-one-earth', 'There is only one Earth', 'ಇರುವುದು ಒಂದೇ ಭೂಮಿ', 'धरती सिर्फ़ एक है',
        'In the name of development we are damaging the one planet we have. It is time to heal it.', 'ಅಭಿವೃದ್ಧಿಯ ಹೆಸರಲ್ಲಿ ನಮ್ಮಲ್ಲಿರುವ ಒಂದೇ ಭೂಮಿಯನ್ನು ನಾವು ಹಾನಿಗೊಳಿಸುತ್ತಿದ್ದೇವೆ. ಅದನ್ನು ಗುಣಪಡಿಸುವ ಸಮಯ ಇದು.', 'विकास के नाम पर हम अपनी इकलौती धरती को नुकसान पहुँचा रहे हैं। अब इसे सँवारने का समय है।',
        ['Today, in the name of development, people are destroying the environment with their own hands. Unable to get clean air to breathe, we are in a condition that feels like living on a hospital ventilator, and many of us suffer from one disease or another.',
          'The air and water that once came free now have to be paid for. Thinking about the generations to come sends a shiver through the chest.',
          'Let us fill what remains of nature with greenery. Let us plant more trees and protect the environment. If we all join hands as one, we can make the Earth green again.'],
        ['ಇಂದು ಅಭಿವೃದ್ಧಿ ಹೆಸರಲ್ಲಿ ಮನುಷ್ಯ ತನ್ನ ಕೈಯಾರೆ ಪರಿಸರವನ್ನು ನಾಶ ಮಾಡಿ, ಶುದ್ಧ ಗಾಳಿ ಸಿಗದೆ ಆಸ್ಪತ್ರೆಯ ವೆಂಟಿಲೇಟರ್‌ನಿಂದ ಗಾಳಿ ಪಡೆದು ಬದುಕುವ ಸ್ಥಿತಿಗೆ ತಲುಪಿದೆ. ನಾವು ನಾನಾ ರೋಗಗಳಿಗೆ ತುತ್ತಾಗಿದ್ದೇವೆ.',
          'ಉಚಿತವಾಗಿ ಸಿಗುತ್ತಿದ್ದ ಗಾಳಿ ಮತ್ತು ನೀರಿಗೆ ದುಡ್ಡು ಕೊಟ್ಟು ಬದುಕುವಂತಾಗಿದೆ ಈಗಿನ ಆಧುನಿಕ ಜೀವನ. ನಾಳಿನ ತಲೆಮಾರಿನವರ ಬಗ್ಗೆ ನೆನೆದರೆ ಎದೆಯಲ್ಲಿ ನಡುಕ ಹುಟ್ಟಿಸುತ್ತದೆ.',
          'ಅಳಿದು ಉಳಿದ ಈ ಪ್ರಕೃತಿಯನ್ನು ಹಸಿರಿನಿಂದ ತುಂಬುವ ಕೆಲಸ ಮಾಡೋಣ. ಹೆಚ್ಚು ಹೆಚ್ಚು ಗಿಡ ಮರಗಳನ್ನು ನೆಟ್ಟು ಪರಿಸರ ಸಂರಕ್ಷಣೆ ಮಾಡೋಣ. ನಾವೆಲ್ಲರೂ ಒಂದಾಗಿ ಕೈ ಸೇರಿಸಿದರೆ ಭೂಮಿಯನ್ನು ಹಸಿರು ಮಾಡಬಹುದು.'],
        ['आज विकास के नाम पर इंसान अपने ही हाथों से पर्यावरण को नष्ट कर रहा है। शुद्ध हवा न मिलने से हम अस्पताल के वेंटिलेटर जैसी हालत में जी रहे हैं और तरह-तरह की बीमारियों से घिर गए हैं।',
          'जो हवा और पानी कभी मुफ़्त मिलते थे, आज उनके लिए पैसे देने पड़ते हैं। आने वाली पीढ़ियों के बारे में सोचकर सीने में सिहरन होती है।',
          'आइए, बची हुई प्रकृति को हरियाली से भर दें। अधिक से अधिक पेड़ लगाएँ और पर्यावरण बचाएँ। यदि हम सब एकजुट हो जाएँ, तो धरती को फिर से हरा-भरा बना सकते हैं।']),
      AB('air-pollution-health', 'Health effects of air pollution', 'ವಾಯು ಮಾಲಿನ್ಯದ ಆರೋಗ್ಯ ಪರಿಣಾಮಗಳು', 'वायु प्रदूषण के स्वास्थ्य पर प्रभाव',
        'Short-term and long-term effects of polluted air, as highlighted in our awareness brochure.', 'ಮಲಿನ ಗಾಳಿಯ ಅಲ್ಪಾವಧಿ ಮತ್ತು ದೀರ್ಘಾವಧಿ ಪರಿಣಾಮಗಳು — ನಮ್ಮ ಜಾಗೃತಿ ಕರಪತ್ರದಿಂದ.', 'प्रदूषित हवा के अल्पकालिक और दीर्घकालिक प्रभाव — हमारे जागरूकता पत्रक से।',
        ['Polluted air affects the body in both the short term and the long term.',
          'Short-term effects: headache, coughing, pneumonia, bronchitis and skin irritation.',
          'Long-term effects: diseases of the central nervous system, cardiovascular diseases, respiratory diseases, and impacts on the liver and the reproductive system.',
          'This is general awareness information, not medical advice. If you or someone in your family has breathing trouble or other symptoms, please consult a doctor. See the full interactive guide on the Save Environment page.'],
        ['ಮಲಿನ ಗಾಳಿ ದೇಹದ ಮೇಲೆ ಅಲ್ಪಾವಧಿ ಮತ್ತು ದೀರ್ಘಾವಧಿ ಎರಡೂ ರೀತಿಯ ಪರಿಣಾಮ ಬೀರುತ್ತದೆ.',
          'ಅಲ್ಪಾವಧಿ ಪರಿಣಾಮಗಳು: ತಲೆನೋವು, ಕೆಮ್ಮು, ನ್ಯುಮೋನಿಯಾ, ಬ್ರಾಂಕೈಟಿಸ್ ಮತ್ತು ಚರ್ಮದ ಕೆರಳಿಕೆ.',
          'ದೀರ್ಘಾವಧಿ ಪರಿಣಾಮಗಳು: ಕೇಂದ್ರ ನರಮಂಡಲದ ರೋಗಗಳು, ಹೃದ್ರೋಗಗಳು, ಉಸಿರಾಟ ಸಂಬಂಧಿ ರೋಗಗಳು, ಯಕೃತ್ತು ಮತ್ತು ಸಂತಾನೋತ್ಪತ್ತಿ ವ್ಯವಸ್ಥೆಯ ಮೇಲೆ ಪರಿಣಾಮ.',
          'ಇದು ಸಾಮಾನ್ಯ ಜಾಗೃತಿ ಮಾಹಿತಿ, ವೈದ್ಯಕೀಯ ಸಲಹೆ ಅಲ್ಲ. ಉಸಿರಾಟದ ತೊಂದರೆ ಅಥವಾ ಇತರ ಲಕ್ಷಣಗಳಿದ್ದರೆ ದಯವಿಟ್ಟು ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ.'],
        ['प्रदूषित हवा शरीर पर अल्पकाल और दीर्घकाल, दोनों में असर डालती है।',
          'अल्पकालिक प्रभाव: सिरदर्द, खाँसी, निमोनिया, ब्रोंकाइटिस और त्वचा में जलन।',
          'दीर्घकालिक प्रभाव: केंद्रीय तंत्रिका तंत्र के रोग, हृदय रोग, श्वसन रोग, तथा लिवर और प्रजनन तंत्र पर प्रभाव।',
          'यह सामान्य जागरूकता की जानकारी है, चिकित्सकीय सलाह नहीं। साँस की तकलीफ़ या अन्य लक्षण हों तो कृपया डॉक्टर से मिलें।']),
      AB('trees-and-clean-air', 'Trees: the best answer to polluted air', 'ಮರಗಳು: ಮಲಿನ ಗಾಳಿಗೆ ಉತ್ತಮ ಪರಿಹಾರ', 'पेड़: प्रदूषित हवा का सबसे अच्छा समाधान',
        'Why planting trees is the last and best way to reduce the ill effects of air pollution.', 'ವಾಯು ಮಾಲಿನ್ಯದ ದುಷ್ಪರಿಣಾಮ ಕಡಿಮೆ ಮಾಡಲು ಮರ ನೆಡುವುದು ಏಕೆ ಉತ್ತಮ ಮಾರ್ಗ.', 'वायु प्रदूषण के दुष्प्रभाव घटाने का सबसे अच्छा तरीका वृक्षारोपण क्यों है।',
        ['The last and best way of reducing the ill effects of air pollution is tree plantation.',
          'Plants and trees reduce a large amount of pollution in the air. Planting trees in areas with high pollution levels is extremely effective.',
          'Join our next plantation drive — see the Events page — or sponsor saplings through the Donate page.'],
        ['ವಾಯು ಮಾಲಿನ್ಯದ ದುಷ್ಪರಿಣಾಮಗಳನ್ನು ಕಡಿಮೆ ಮಾಡಲು ಕೊನೆಯ ಮತ್ತು ಉತ್ತಮ ಮಾರ್ಗವೆಂದರೆ ಮರ, ಗಿಡಗಳನ್ನು ನೆಡುವುದು.',
          'ಸಸ್ಯಗಳು ಮತ್ತು ಮರಗಳು ಗಾಳಿಯಲ್ಲಿನ ಮಾಲಿನ್ಯಕಾರಕಗಳನ್ನು ಕಡಿಮೆ ಮಾಡುತ್ತವೆ. ಅಧಿಕ ವಾಯು ಮಾಲಿನ್ಯ ಮಟ್ಟವಿರುವ ಪ್ರದೇಶಗಳಲ್ಲಿ ಹೆಚ್ಚು ಮರ, ಗಿಡಗಳನ್ನು ನೆಡುವುದು ಅತ್ಯಂತ ಅವಶ್ಯವಾಗಿರುತ್ತದೆ.',
          'ನಮ್ಮ ಮುಂದಿನ ಗಿಡ ನೆಡುವ ಅಭಿಯಾನದಲ್ಲಿ ಭಾಗವಹಿಸಿ — ಕಾರ್ಯಕ್ರಮಗಳ ಪುಟ ನೋಡಿ.'],
        ['वायु प्रदूषण के दुष्प्रभावों को कम करने का अंतिम और सबसे अच्छा तरीका वृक्षारोपण है।',
          'पेड़-पौधे हवा में मौजूद बहुत-से प्रदूषकों को कम करते हैं। अधिक प्रदूषण वाले क्षेत्रों में अधिक पेड़ लगाना बेहद प्रभावी होता है।',
          'हमारे अगले वृक्षारोपण अभियान में शामिल हों — आयोजन पृष्ठ देखें।']),
      AB('five-ways-to-save-environment', 'Five simple ways to save the environment', 'ಪರಿಸರ ಉಳಿಸಲು ಐದು ಸರಳ ಮಾರ್ಗಗಳು', 'पर्यावरण बचाने के पाँच आसान तरीके',
        'Plant trees, protect water, avoid plastic, reduce-reuse-recycle and save natural resources.', 'ಗಿಡ ನೆಡಿ, ನೀರು ಉಳಿಸಿ, ಪ್ಲಾಸ್ಟಿಕ್ ತಪ್ಪಿಸಿ, ಮರುಬಳಕೆ ಮಾಡಿ, ನೈಸರ್ಗಿಕ ಸಂಪನ್ಮೂಲ ರಕ್ಷಿಸಿ.', 'पेड़ लगाएँ, पानी बचाएँ, प्लास्टिक से बचें, रीसायकल करें और प्राकृतिक संसाधन बचाएँ।',
        ['1. Plant more trees — plant a native sapling and keep watering it until it is established.', '2. Protect every drop of water — fix leaking taps and reuse water wherever you safely can.', '3. Avoid using plastic — carry a cloth bag and a reusable bottle.', '4. Reduce, reuse, recycle — segregate waste at home and give dry waste for recycling.', '5. Save natural resources — switch off what you are not using and choose energy-saving options.'],
        ['1. ಹೆಚ್ಚೆಚ್ಚು ಗಿಡಗಳನ್ನು ನೆಡೋಣ — ಸ್ಥಳೀಯ ಸಸಿಯನ್ನು ನೆಟ್ಟು ಅದು ಬೇರೂರುವವರೆಗೆ ನೀರು ಹಾಕಿ.', '2. ಜಲ ಸಂರಕ್ಷಿಸೋಣ — ಸೋರುವ ನಲ್ಲಿಗಳನ್ನು ಸರಿಪಡಿಸಿ; ಸಾಧ್ಯವಿರುವಲ್ಲೆಲ್ಲಾ ನೀರನ್ನು ಮರುಬಳಸಿ.', '3. ಪ್ಲಾಸ್ಟಿಕ್ ಬಳಕೆ ನಿಷೇಧಿಸೋಣ — ಬಟ್ಟೆಯ ಚೀಲ ಮತ್ತು ಮರುಬಳಕೆಯ ಬಾಟಲಿ ಜೊತೆಗಿರಲಿ.', '4. ಮರು ಬಳಕೆಯನ್ನು ಉತ್ತೇಜಿಸೋಣ — ಮನೆಯಲ್ಲಿ ತ್ಯಾಜ್ಯವನ್ನು ವಿಂಗಡಿಸಿ; ಒಣ ತ್ಯಾಜ್ಯವನ್ನು ಮರುಬಳಕೆಗೆ ನೀಡಿ.', '5. ನೈಸರ್ಗಿಕ ಸಂಪನ್ಮೂಲಗಳನ್ನು ರಕ್ಷಿಸೋಣ — ಬಳಸದ ಉಪಕರಣಗಳನ್ನು ಆರಿಸಿ; ಇಂಧನ ಉಳಿತಾಯದ ಆಯ್ಕೆಗಳನ್ನು ಬಳಸಿ.'],
        ['1. अधिक से अधिक पेड़ लगाएँ — एक देशी पौधा लगाएँ और उसके जड़ पकड़ने तक पानी देते रहें।', '2. पानी की हर बूँद बचाएँ — टपकते नल ठीक करें और जहाँ संभव हो पानी का दोबारा उपयोग करें।', '3. प्लास्टिक का उपयोग न करें — कपड़े का थैला और दोबारा उपयोग होने वाली बोतल साथ रखें।', '4. कम करें, दोबारा उपयोग करें, रीसायकल करें — घर पर कचरा अलग करें और सूखा कचरा रीसायकल के लिए दें।', '5. प्राकृतिक संसाधनों की रक्षा करें — जो उपयोग में नहीं है उसे बंद करें और ऊर्जा बचाने वाले विकल्प चुनें।'])
    ];

    const gallery = [
      { id: 'g1', type: 'PHOTO', src: 'assets/gallery/gallery1.jpg', category: 'tree', date: '2026-11-20', featured: true,
        title: T('Planting saplings together', 'ಒಟ್ಟಾಗಿ ಸಸಿ ನೆಡುವುದು', 'साथ मिलकर पौधे लगाना') },
      { id: 'g2', type: 'PHOTO', src: 'assets/gallery/gallery2.jpg', category: 'community', date: '2026-11-20', featured: true,
        title: T('Volunteers at the Green Bengaluru plantation drive', 'ಗ್ರೀನ್ ಬೆಂಗಳೂರು ಗಿಡ ನೆಡುವ ಅಭಿಯಾನದಲ್ಲಿ ಸ್ವಯಂಸೇವಕರು', 'ग्रीन बेंगलुरु वृक्षारोपण अभियान में स्वयंसेवक') },
      { id: 'g3', type: 'PHOTO', src: 'assets/gallery/gallery3.jpg', category: 'tree', date: '2026-11-20', featured: true,
        title: T('Every sapling counts', 'ಪ್ರತಿ ಸಸಿಯೂ ಮುಖ್ಯ', 'हर पौधा मायने रखता है') },
      { id: 'g4', type: 'VIDEO', src: 'assets/gallery/gallery_video1.mp4', category: 'tree', date: '2026-11-20', featured: true,
        title: T('Plantation drive — video 1', 'ಗಿಡ ನೆಡುವ ಅಭಿಯಾನ — ವೀಡಿಯೊ 1', 'वृक्षारोपण अभियान — वीडियो 1') },
      { id: 'g5', type: 'VIDEO', src: 'assets/gallery/gallery_video2.mp4', category: 'community', date: '2026-11-20', featured: true,
        title: T('Plantation drive — video 2', 'ಗಿಡ ನೆಡುವ ಅಭಿಯಾನ — ವೀಡಿಯೊ 2', 'वृक्षारोपण अभियान — वीडियो 2') }
    ];

    articles.unshift(...envArticles);
    GIGF.envArticles = envArticles;   // the campaign page reads its text from here, so it never depends on saved browser data
    return {
      seedVersion: 4,
      programs, events, news, articles, gallery,
      donations: [], volunteers: [], tickets: [], registrations: [], users: [], audit: [], chats: [], subscribers: [], tasks: [], testimonials: [],
      settings: { reg80G: '', reg12A: '', pan: '', receiptSeq: 0, volSeq: 0, ticketSeq: 0, impact: [], automation: { autoTranslate: true, autoReplyRoutine: false, autoApproveVolunteers: false, flagStuckPayments: true, stuckMinutes: 15 } }
    };
  }

  /* ---------- DB ---------- */
  let cache = null;
  function load() {
    if (cache) return cache;
    try { cache = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { cache = null; }
    if (!cache) { cache = seed(); persist(); }
    const s = seed();
    Object.keys(s).forEach((k) => { if (k !== 'seedVersion' && cache[k] === undefined) cache[k] = s[k]; }); // forward-compat (seedVersion is handled by the migration below)
    if ((cache.seedVersion || 1) < 4) { s.articles.filter((a) => a.category === 'environment').forEach((a) => { if (!cache.articles.find((x) => x.id === a.id)) cache.articles.unshift(a); }); cache.seedVersion = 4; persist(); }
    return cache;
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { console.warn('storage full', e); } }

  GIGF.DB = {
    all: (c) => load()[c],
    get: (c, id) => load()[c].find((x) => x.id === id || x.slug === id),
    add: (c, item) => { item.id = item.id || uid(c.slice(0, 2)); item.createdAt = item.createdAt || new Date().toISOString(); load()[c].unshift(item); persist(); return item; },
    update: (c, id, patch) => { const it = load()[c].find((x) => x.id === id); if (it) { Object.assign(it, patch); persist(); } return it; },
    remove: (c, id) => { const d = load(); d[c] = d[c].filter((x) => x.id !== id); persist(); },
    settings: () => load().settings,
    reload: () => { cache = null; },   // read the stored copy again (another tab changed it)
    saveSettings: (p) => { Object.assign(load().settings, p); persist(); },
    reset: () => { cache = seed(); persist(); },
    export: () => JSON.stringify(load(), null, 2),
    nextSeq: (k) => { const s = load().settings; s[k] = (s[k] || 0) + 1; persist(); return s[k]; }
  };

  /* ---------- localisation helpers ---------- */
  GIGF.lang = () => localStorage.getItem('gigf_lang') || 'en';
  GIGF.tr = (field) => (field && (field[GIGF.lang()] || field.en)) || ''; // CMS field with English fallback

  /* ---------- audit log ---------- */
  GIGF.audit = (action, entity, entityId, meta) => {
    const u = GIGF.Auth.current();
    GIGF.DB.add('audit', { action, entity, entityId: entityId || '', meta: meta || '', actor: u ? u.email : 'public', role: u ? u.role : 'PUBLIC', at: new Date().toISOString() });
  };

  /* ---------- Auth (DEMO: salted SHA-256 in browser; replace with /api/auth/*) ---------- */
  const SESSION = 'gigf_session';
  async function sha(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  GIGF.ADMIN_DEMO = { email: 'admin@gigf.demo', password: 'Admin@12345' };
  GIGF.PW_RULES_TEXT = 'Password must have at least 8 characters, one capital letter, one number and one special character.';
  GIGF.Auth = {
    /** returns the list of rules a password fails ([] = strong enough) */
    passwordIssues(pw) {
      pw = String(pw || ''); const bad = [];
      if (pw.length < 8) bad.push('length');
      if (!/[A-Z]/.test(pw)) bad.push('capital');
      if (!/\d/.test(pw)) bad.push('number');
      if (!/[^A-Za-z0-9\s]/.test(pw)) bad.push('special');
      return bad;
    },
    current() { try { return JSON.parse(localStorage.getItem(SESSION) || 'null'); } catch (e) { return null; } },
    isAdmin() { const u = this.current(); return !!u && /ADMIN/.test(u.role); },
    async ensureDemoAdmin() {
      if (!GIGF.demoAdminAllowed || !GIGF.demoAdminAllowed() || !(window.crypto && crypto.subtle)) return;   // never create the known-password demo admin on a public/insecure site
      const users = GIGF.DB.all('users');
      users.filter((u) => u.id === 'u_admin' && u.name === 'Demo Admin').forEach((u) => GIGF.DB.update('users', u.id, { name: 'Admin' }));
      if (!users.find((u) => u.email === GIGF.ADMIN_DEMO.email)) {
        const salt = uid('s');
        GIGF.DB.add('users', { id: 'u_admin', name: 'Admin', email: GIGF.ADMIN_DEMO.email, phone: '', role: 'SUPER_ADMIN', salt, hash: await sha(salt + GIGF.ADMIN_DEMO.password), locale: 'en' });
      }
    },
    async signup({ name, email, phone, password, role }) {
      email = email.trim().toLowerCase();
      if (this.passwordIssues(password).length) throw new Error(GIGF.PW_RULES_TEXT);
      if (GIGF.DB.all('users').find((u) => u.email === email)) throw new Error('This email is already registered. Please log in, or use “Forgot password”.');
      const ph = String(phone || '').replace(/\D/g, '').slice(-10);
      if (ph && GIGF.DB.all('users').find((u) => String(u.phone || '').replace(/\D/g, '').slice(-10) === ph)) throw new Error('This mobile number is already registered. Please log in, or use a different number.');
      const map = { volunteer: 'VOLUNTEER', donor: 'DONOR', member: 'REGISTERED_USER', partner: 'REGISTERED_USER' };
      const salt = uid('s');
      const user = GIGF.DB.add('users', { name, email, phone, role: map[role] || 'REGISTERED_USER', salt, hash: await sha(salt + password), locale: GIGF.lang() });
      this._start(user);
      return user;
    },
    async login(email, password) {
      await this.ensureDemoAdmin();
      email = email.trim().toLowerCase();
      const key = 'gigf_lock_' + email, lock = JSON.parse(localStorage.getItem(key) || '{"n":0,"until":0}');
      if (lock.until > Date.now()) throw new Error('Too many attempts. Try again in a few minutes.');
      const user = GIGF.DB.all('users').find((u) => u.email === email);
      if (!user || (await sha(user.salt + password)) !== user.hash) {
        lock.n += 1; if (lock.n >= 5) { lock.until = Date.now() + 5 * 60 * 1000; lock.n = 0; }
        localStorage.setItem(key, JSON.stringify(lock));
        throw new Error('Incorrect email or password.');
      }
      localStorage.removeItem(key);
      this._start(user);
      GIGF.audit('LOGIN', 'user', user.id);
      return user;
    },
    /* ---- server-verified flows: the one-time code is e-mailed / texted by /api/auth; it never reaches the browser ---- */
    byEmail(email) { email = String(email).trim().toLowerCase(); return GIGF.DB.all('users').find((x) => x.email === email); },
    byPhone(phone) { phone = String(phone).replace(/\D/g, '').slice(-10); return phone.length === 10 ? GIGF.DB.all('users').find((x) => String(x.phone || '').replace(/\D/g, '').slice(-10) === phone) : null; },
    async _api(body) {
      const cfg = window.GIGF_CONFIG || {};
      let r; try { r = await fetch(cfg.authApi || '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch (e) { throw new Error('Cannot reach the server. Please try again.'); }
      const j = await r.json().catch(() => ({}));
      if (r.ok) return j;
      const msg = { delivery_not_configured: 'Sending e-mail / SMS is not set up on this server yet (the site owner must add the e-mail / SMS service keys).', delivery_failed: 'We could not send the message. Please try again in a minute.', too_many_requests: 'Too many tries. Please wait a few minutes.', expired: 'That code has expired. Please request a new one.', wrong_code: 'That code is not correct.', bad_target: 'Please check the e-mail / mobile number.', not_configured: 'This sign-in method is not set up on this server yet.', invalid_token: 'Google could not confirm your sign-in. Please try again.' };
      throw new Error(msg[j.error] || 'Something went wrong. Please try again.');
    },
    /** channel 'email' | 'sms'. Returns {ticket, devCode?}. The account must exist (we do not send codes to strangers). */
    async codeSend(channel, to, purpose) {
      if (channel === 'email' ? !this.byEmail(to) : !this.byPhone(to)) throw new Error(channel === 'email' ? 'No account uses this email. Please sign up first.' : 'No account uses this mobile number. Please sign up first.');
      return this._api({ action: 'otp-send', channel, to, purpose });
    },
    async codeCheck(channel, to, code, ticket) { await this._api({ action: 'otp-verify', channel, to, code, ticket }); return true; },
    async resetPassword(email, code, ticket, password) {
      if (this.passwordIssues(password).length) throw new Error(GIGF.PW_RULES_TEXT);
      await this.codeCheck('email', email, code, ticket);
      const u = this.byEmail(email); if (!u) throw new Error('No account found.');
      const salt = uid('s'); GIGF.DB.update('users', u.id, { salt, hash: await sha(salt + password) });
      GIGF.audit('PASSWORD_RESET', 'user', u.id);
    },
    async otpLogin(phone, code, ticket) {
      await this.codeCheck('email', phone, code, ticket);
      const u = this.byEmail(phone); if (!u) throw new Error('No account found.');
      this._start(u); GIGF.audit('LOGIN_OTP', 'user', u.id); return u;
    },
    /** Google: the server checks the ID token with Google; we then log in (or create) the account for that verified e-mail. */
    async googleLogin(credential, role) {
      const g = await this._api({ action: 'google', credential });
      let u = this.byEmail(g.email);
      if (!u) { const salt = uid('s'); u = GIGF.DB.add('users', { name: g.name, email: g.email, phone: '', role: role === 'volunteer' ? 'VOLUNTEER' : 'DONOR', salt, hash: await sha(salt + uid('x') + uid('y')), locale: GIGF.lang(), via: 'google' }); GIGF.audit('SIGNUP_GOOGLE', 'user', u.id); }
      this._start(u); GIGF.audit('LOGIN_GOOGLE', 'user', u.id); return u;
    },
    _start(u) { localStorage.setItem(SESSION, JSON.stringify({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role })); },
    logout() { localStorage.removeItem(SESSION); localStorage.removeItem('gigf_loggedIn'); }
  };

  /* ---------- Accounts in Supabase (when configured). Passwords, codes and roles are handled by the server. ---------- */
  (function supabaseAuth() {
    const cfg = window.GIGF_CONFIG || {}, url = cfg.supabaseUrl, key = cfg.supabaseKey, TOK = 'gigf_sb';
    if (!url || !key) return;
    const A = GIGF.Auth, local = { login: A.login, logout: A.logout };
    const clean = (e) => String(e).trim().toLowerCase();
    const demo = (email) => GIGF.demoAdminAllowed && GIGF.demoAdminAllowed() && clean(email) === GIGF.ADMIN_DEMO.email;   // localhost only, until the admin portal moves over
    async function sb(path, body, token, method) {
      let r; try { r = await fetch(url + path, { method: method || (body ? 'POST' : 'GET'), headers: Object.assign({ apikey: key, 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}), body: body ? JSON.stringify(body) : undefined }); } catch (e) { throw new Error('Cannot reach the server. Please try again.'); }
      const j = await r.json().catch(() => ({}));
      if (r.ok) return j;
      const code = j.error_code || j.code || j.error || '', text = String(j.msg || j.error_description || j.message || '');
      const known = { invalid_credentials: 'Incorrect email or password.', email_not_confirmed: 'Please confirm your email first: open the message we sent you.', user_already_exists: 'This email is already registered. Please log in, or use “Forgot password”.', otp_expired: 'That code is wrong or has expired.', otp_disabled: 'No account uses this email. Please sign up first.', over_email_send_rate_limit: 'Too many emails for now. Please try again later.', over_request_rate_limit: 'Too many tries. Please wait a few minutes.', email_address_not_authorized: 'The mail service is not set up for this address yet.', provider_disabled: 'Google sign-in is not switched on yet.', weak_password: GIGF.PW_RULES_TEXT, same_password: 'Choose a password you have not used before.' };
      if (/database error saving new user/i.test(text)) throw new Error('This mobile number is already registered. Please log in, or use a different number.');
      throw new Error(known[code] || text || 'Something went wrong. Please try again.');
    }
    async function enter(sess) {
      const rows = await sb('/rest/v1/profiles?select=name,email,phone,role&id=eq.' + encodeURIComponent(sess.user.id), null, sess.access_token);
      const p = rows[0] || { name: sess.user.email.split('@')[0], email: sess.user.email, phone: '', role: 'REGISTERED_USER' };
      localStorage.setItem(TOK, JSON.stringify({ access: sess.access_token, refresh: sess.refresh_token }));
      const u = { id: sess.user.id, name: p.name, email: p.email, phone: p.phone || '', role: p.role };
      const old = GIGF.DB.all('users').find((x) => x.email === u.email);   // local copy so the not-yet-moved screens keep working (no password stored)
      if (old) GIGF.DB.update('users', old.id, { name: u.name, phone: u.phone, role: u.role, hash: '', salt: '' }); else GIGF.DB.add('users', Object.assign({ via: 'supabase' }, u));
      A._start(u); GIGF.audit('LOGIN', 'user', u.id); return u;
    }
    Object.assign(A, {
      async login(email, password) { if (demo(email)) return local.login.call(A, email, password); return enter(await sb('/auth/v1/token?grant_type=password', { email: clean(email), password })); },
      async signup({ name, email, phone, password, role }) {
        if (A.passwordIssues(password).length) throw new Error(GIGF.PW_RULES_TEXT);
        const j = await sb('/auth/v1/signup', { email: clean(email), password, data: { name, phone: String(phone).replace(/\D/g, '').slice(-10), role: role === 'volunteer' ? 'VOLUNTEER' : role === 'donor' ? 'DONOR' : '' } });
        if (j.access_token) return enter(j);
        const user = j.user || j;
        if (user.identities && !user.identities.length) throw new Error('This email is already registered. Please log in, or use “Forgot password”.');
        return null;   // the server wants the e-mail confirmed first
      },
      async codeSend(channel, to, purpose) { if (purpose === 'reset') await sb('/auth/v1/recover', { email: clean(to) }); else await sb('/auth/v1/otp', { email: clean(to), create_user: false }); return { ticket: 'server' }; },
      async otpLogin(email, code) { return enter(await sb('/auth/v1/verify', { type: 'email', email: clean(email), token: String(code).trim() })); },
      async resetPassword(email, code, ticket, password) {
        if (A.passwordIssues(password).length) throw new Error(GIGF.PW_RULES_TEXT);
        const sess = await sb('/auth/v1/verify', { type: 'recovery', email: clean(email), token: String(code).trim() });
        await sb('/auth/v1/user', { password }, sess.access_token, 'PUT');
        await sb('/auth/v1/logout', {}, sess.access_token).catch(() => { });
      },
      async googleLogin(credential) { return enter(await sb('/auth/v1/token?grant_type=id_token', { provider: 'google', id_token: credential })); },
      logout() {
        let t = null; try { t = JSON.parse(localStorage.getItem(TOK) || 'null'); } catch (e) { }
        if (t) fetch(url + '/auth/v1/logout', { method: 'POST', keepalive: true, headers: { apikey: key, Authorization: 'Bearer ' + t.access } }).catch(() => { });
        localStorage.removeItem(TOK); local.logout.call(A);
      }
    });
  })();

  /* ---------- Donations & receipts ---------- */
  const fy = (d) => { d = new Date(d); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return y + '-' + String(y + 1).slice(2); };
  GIGF.Donations = {
    PAN: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
    /** Demo equivalent of POST /api/donations/create-order + verify. outcome: CAPTURED | FAILED | PENDING */
    create(d, outcome) {
      if (!GIGF.Auth.current()) throw new Error('LOGIN_REQUIRED');
      const rec = GIGF.DB.add('donations', {
        donorName: d.name, donorEmail: d.email, donorPhone: d.phone, donorPan: (d.pan || '').toUpperCase(),
        program: d.program, amount: Number(d.amount), frequency: d.frequency, method: d.method,
        userEmail: (GIGF.Auth.current() || {}).email || d.email.toLowerCase(),
        orderId: (GIGF.present ? 'order_' : 'demo_order_') + uid('o'), paymentId: outcome === 'CAPTURED' ? (GIGF.present ? 'pay_' : 'demo_pay_') + uid('p') : '',
        status: outcome || 'CAPTURED', receiptNo: '', demo: true
      });
      GIGF.audit('PAYMENT_ORDER_CREATED', 'donation', rec.id, `${rec.orderId} · ${GIGF.inr(rec.amount)} · ${rec.method} · ${rec.frequency}`);
      GIGF.audit('PAYMENT_' + rec.status, 'donation', rec.id, rec.status === 'CAPTURED' ? rec.paymentId : rec.status === 'FAILED' ? 'gateway reported failure' : 'awaiting gateway confirmation');
      if (rec.status === 'CAPTURED') this.issueReceipt(rec.id);
      return GIGF.DB.get('donations', rec.id);
    },
    /** Automatic housekeeping (runs by itself): receipts for captured payments, tickets for payments stuck in PENDING. */
    reconcile() {
      const a = GIGF.auto(); let n = 0;
      if (a.flagStuckPayments) GIGF.DB.all('donations').forEach((d) => {
        if (d.status === 'PENDING' && !d.autoFlagged && Date.now() - new Date(d.createdAt).getTime() > a.stuckMinutes * 60000) {
          const t = GIGF.Tickets.create({ category: 'PAYMENT_ISSUE', name: d.donorName, email: d.donorEmail, phone: d.donorPhone, subject: `Payment pending for over ${a.stuckMinutes} minutes (auto-flagged)`, message: `Order ${d.orderId} for ${GIGF.inr(d.amount)} has been PENDING since ${new Date(d.createdAt).toLocaleString('en-IN')}.`, donationId: d.id });
          GIGF.DB.update('donations', d.id, { autoFlagged: true, ticketNo: t.no }); GIGF.audit('AUTO_FLAG_PENDING', 'donation', d.id, t.no); n++;
        }
      });
      GIGF.DB.all('donations').forEach((d) => { if (d.status === 'CAPTURED' && !d.receiptNo) { this.issueReceipt(d.id); GIGF.audit('AUTO_RECEIPT', 'donation', d.id, ''); n++; } });
      return n;
    },
    issueReceipt(id) {
      const d = GIGF.DB.get('donations', id);
      if (!d || d.receiptNo) return d;
      const n = GIGF.DB.nextSeq('receiptSeq');
      const upd = GIGF.DB.update('donations', id, { receiptNo: `GIGF/${fy(d.createdAt)}/${String(n).padStart(5, '0')}` });
      GIGF.audit('RECEIPT_ISSUED', 'donation', id, upd.receiptNo);
      return upd;
    },
    mine() { const u = GIGF.Auth.current(); if (!u) return []; return GIGF.DB.all('donations').filter((d) => d.userEmail === u.email.toLowerCase() || d.donorEmail.toLowerCase() === u.email.toLowerCase()); },
    receiptHTML(d) {
      const s = GIGF.DB.settings(), o = GIGF.ORG;
      const row = (a, b) => `<tr><td style="padding:7px 10px;border:1px solid #ddd;background:#f6faf7;width:38%"><b>${a}</b></td><td style="padding:7px 10px;border:1px solid #ddd">${b}</td></tr>`;
      return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${GIGF.esc(d.receiptNo)}</title>
      <style>body{font-family:Arial,sans-serif;max-width:720px;margin:24px auto;color:#222}h1{color:#0f4d2a;margin:0}table{border-collapse:collapse;width:100%;margin:16px 0}
      .demo{background:#fff7ed;border:1px dashed #ea580c;color:#9a3412;padding:8px 12px;border-radius:6px;font-size:13px}.btn{padding:10px 18px;background:#156637;color:#fff;border:0;border-radius:6px;cursor:pointer}@media print{.btn{display:none}}</style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #156637;padding-bottom:10px"><div><h1>${o.nameCaps}</h1><div style="font-size:13px">${o.address}<br>${o.email} · ${o.phones.map((p) => p.display).join(', ')}</div></div><img src="${location.origin + location.pathname.replace(/[^/]*$/, '')}assets/logo-emblem-192.png" width="72" alt=""></div>
      <h2 style="margin-top:18px">Donation Receipt</h2>
      ${d.demo ? '<div class="demo"><b>DEMO RECEIPT</b> — generated in test mode. No money was charged and this is not a valid tax document.</div>' : ''}
      <table>${row('Receipt No.', GIGF.esc(d.receiptNo))}${row('Date', GIGF.fmtDate(d.createdAt))}${row('Donor Name', GIGF.esc(d.donorName))}${row('Email / Phone', GIGF.esc(d.donorEmail) + ' / ' + GIGF.esc(d.donorPhone))}${row('PAN', GIGF.esc(d.donorPan || '—'))}${row('Programme', GIGF.esc(d.program))}${row('Frequency', d.frequency === 'MONTHLY' ? 'Monthly' : 'One-time')}${row('Payment Method', GIGF.esc(d.method))}${row('Payment ID', GIGF.esc(d.paymentId))}${row('Amount', '<b>' + GIGF.inr(d.amount) + '</b>')}</table>
      <p style="font-size:13px">${s.reg80G ? 'Registered under Section 80G: <b>' + GIGF.esc(s.reg80G) + '</b>. ' : ''}${s.reg12A ? 'Section 12A: <b>' + GIGF.esc(s.reg12A) + '</b>. ' : ''}${!s.reg80G && !s.reg12A ? '80G / 12A registration numbers have not yet been configured by the Foundation (Admin → Settings).' : ''}</p>
      <p style="font-size:12px;color:#666">Thank you for supporting ${o.name}.</p><button class="btn" id="pbtn">Print / Save as PDF</button></body></html>`;
    },
    openReceipt(id) {
      const d = GIGF.DB.get('donations', id); if (!d || !d.receiptNo) return false;
      return GIGF.openPrint(this.receiptHTML(d));
    }
  };

  /* ---------- Tickets (contact / payment issue / chat escalation) ---------- */
  GIGF.Tickets = {
    create({ category, name, email, phone, subject, message, donationId }) {
      const n = GIGF.DB.nextSeq('ticketSeq');
      const t = GIGF.DB.add('tickets', { no: 'TKT-' + String(n).padStart(4, '0'), category, name, email, phone: phone || '', subject, message, donationId: donationId || '', status: 'OPEN', assignedTo: '', notes: [], replies: [] });
      GIGF.audit(category === 'PAYMENT_ISSUE' ? 'PAYMENT_ISSUE_RAISED' : 'TICKET_CREATED', 'ticket', t.id, t.no + ' · ' + category);
      return t;
    }
  };

  /* ---------- Volunteers ---------- */
  GIGF.Volunteers = {
    apply(v) {
      if (!GIGF.Auth.current()) throw new Error('LOGIN_REQUIRED');
      const n = GIGF.DB.nextSeq('volSeq');
      const rec = GIGF.DB.add('volunteers', Object.assign({ status: 'PENDING', badge: 'GIGF-VOL-' + String(n).padStart(4, '0'), hours: 0, attendance: [], tasks: [] }, v));
      GIGF.audit('VOLUNTEER_APPLIED', 'volunteer', rec.id, rec.badge);
      if (GIGF.auto().autoApproveVolunteers && rec.idFile) { GIGF.DB.update('volunteers', rec.id, { status: 'APPROVED', autoApproved: true }); GIGF.audit('AUTO_APPROVE', 'volunteer', rec.id, 'automation setting is ON'); return GIGF.DB.get('volunteers', rec.id); }
      return rec;
    },
    mine() { const u = GIGF.Auth.current(); return u ? GIGF.DB.all('volunteers').find((v) => v.email.toLowerCase() === u.email.toLowerCase()) : null; },
    certificateHTML(v) {
      const o = GIGF.ORG;
      return `<!doctype html><html><head><meta charset="utf-8"><title>Certificate</title><style>body{font-family:Georgia,serif;text-align:center;padding:40px}.b{border:10px double #156637;padding:50px;max-width:820px;margin:auto}h1{color:#0f4d2a;font-size:40px;margin:0}h2{font-size:32px;margin:24px 0;color:#156637}.btn{padding:10px 18px;background:#156637;color:#fff;border:0;border-radius:6px;cursor:pointer}@media print{.btn{display:none}}</style></head><body><div class="b"><div style="letter-spacing:3px">${o.nameCaps}</div><h1>Certificate of Appreciation</h1><p>This is proudly presented to</p><h2>${GIGF.esc(v.name)}</h2><p>for volunteering with the Foundation in the area of <b>${GIGF.esc(v.domain)}</b>.<br>Badge ID: <b>${GIGF.esc(v.badge)}</b> · Hours recorded: <b>${v.hours || 0}</b></p><p style="margin-top:40px">Issued on ${GIGF.fmtDate(new Date())}</p><p style="font-size:12px;color:#888">${o.address}</p><button class="btn" id="pbtn">Print / Save as PDF</button></div></body></html>`;
    }
  };

  /** opens a printable document (receipt / certificate) in a new tab; the Print button is wired here, not with an inline handler (CSP) */
  GIGF.openPrint = (html) => { const w = window.open('', '_blank'); if (!w) return false; w.document.write(html); w.document.close(); const b = w.document.getElementById('pbtn'); if (b) b.addEventListener('click', () => w.print()); return true; };
  GIGF.AUTO_DEFAULTS = { autoTranslate: true, autoReplyRoutine: false, autoApproveVolunteers: false, flagStuckPayments: true, stuckMinutes: 15 };
  GIGF.auto = () => Object.assign({}, GIGF.AUTO_DEFAULTS, (GIGF.DB.settings() || {}).automation || {});
  /** the fake admin portal trusts browser storage, so it only runs on this computer unless explicitly enabled */
  // Presenting from this computer: demo wording is hidden. Any public address keeps it, so no real visitor is misled.
  GIGF.present = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(location.hostname);
  if (GIGF.present && document.documentElement && document.documentElement.classList) document.documentElement.classList.add('present');
  GIGF.demoAdminAllowed = () => ['localhost', '127.0.0.1', '[::1]', '::1', ''].includes(location.hostname) || !!(window.GIGF_CONFIG && window.GIGF_CONFIG.demoAdmin === true);
  /** Only these URL shapes may be put into href/src: site pages, assets, http(s), mailto/tel, in-page anchors. Blocks javascript:, data: (except via the dedicated image paths) and attribute-breaking characters. */
  GIGF.safeUrl = (u, fallback) => { u = String(u == null ? '' : u).trim(); return /^(https?:\/\/[^\s"'<>`]+|[\w./-]+\.(html|mp4|jpg|jpeg|png|webp|svg|pdf)(\?[\w=&%.~-]*)?(#[\w-]*)?|assets\/[\w./ ()%-]+|#[\w-]*|mailto:[^\s"'<>`]+|tel:[+\d ]+)$/i.test(u) ? u : (fallback == null ? '#' : fallback); };
  /** a picture or video address that may be shown: inline uploaded pictures, or a safe address */
  GIGF.mediaUrl = (u) => (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(u || '') ? u : GIGF.safeUrl(u, ''));
  GIGF.sortMedia = (list) => list.map((m, i) => [m, m.order == null ? 100000 + i : Number(m.order)]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
  GIGF.today = today;
  load();
})();
