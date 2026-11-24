/**
 * Green India Gokul Foundation - Main Application Script
 * Full interactive JavaScript implementation satisfying all SRS & PDF requirements.
 */

document.addEventListener('DOMContentLoaded', () => {
  initHeroCarousel();
  initModals();
  initDonationModal();
  initVolunteerModal();
  initProgramDrawers();
  initGalleryLightbox();
  initChatbot();
  initMobileDrawer();
  initSocialAndContactActions();
});

/* ==========================================================================
   TOAST NOTIFICATION ENGINE
   ========================================================================== */
function showToast(message, icon = '✅') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}

/* ==========================================================================
   HERO BANNER CAROUSEL
   ========================================================================== */
function initHeroCarousel() {
  const slides = document.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('.carousel-dots .dot');
  const prevBtn = document.querySelector('.carousel-arrow.prev');
  const nextBtn = document.querySelector('.carousel-arrow.next');

  if (!slides.length) return;

  let currentSlide = 0;
  let autoplayTimer = null;

  function showSlide(index) {
    slides.forEach((s, i) => {
      s.classList.toggle('active', i === index);
    });
    dots.forEach((d, i) => {
      d.classList.toggle('active', i === index);
    });
    currentSlide = index;
  }

  function nextSlide() {
    let next = (currentSlide + 1) % slides.length;
    showSlide(next);
  }

  function prevSlide() {
    let prev = (currentSlide - 1 + slides.length) % slides.length;
    showSlide(prev);
  }

  if (nextBtn) nextBtn.addEventListener('click', () => {
    nextSlide();
    resetAutoplay();
  });

  if (prevBtn) prevBtn.addEventListener('click', () => {
    prevSlide();
    resetAutoplay();
  });

  dots.forEach((dot, idx) => {
    dot.addEventListener('click', () => {
      showSlide(idx);
      resetAutoplay();
    });
  });

  function startAutoplay() {
    autoplayTimer = setInterval(nextSlide, 6500);
  }

  function resetAutoplay() {
    clearInterval(autoplayTimer);
    startAutoplay();
  }

  const heroSection = document.querySelector('.hero-section');
  if (heroSection) {
    heroSection.addEventListener('mouseenter', () => clearInterval(autoplayTimer));
    heroSection.addEventListener('mouseleave', startAutoplay);
  }

  startAutoplay();
}

/* ==========================================================================
   MODAL WINDOW ENGINE
   ========================================================================== */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }
}

function initModals() {
  // Global backdrop click & close button handler
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove('show');
        document.body.style.overflow = '';
      }
    });

    const closeBtn = backdrop.querySelector('.btn-close-modal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        backdrop.classList.remove('show');
        document.body.style.overflow = '';
      });
    }
  });

  // Attach generic trigger elements
  document.querySelectorAll('[data-open-modal]').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const target = trigger.getAttribute('data-open-modal');
      openModal(target);
    });
  });
}

/* ==========================================================================
   DONATION PAYMENT GATEWAY SIMULATOR (PDF Module 4.5)
   ========================================================================== */
function initDonationModal() {
  const amountPresets = document.querySelectorAll('.preset-btn');
  const customAmountInput = document.getElementById('customDonationAmount');
  const payCards = document.querySelectorAll('.pay-card');
  const donationForm = document.getElementById('donationForm');
  const donateTabs = document.querySelectorAll('.donation-type-tabs .tab-btn');

  let selectedAmount = '1000';
  let selectedMethod = 'UPI';

  donateTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      donateTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  amountPresets.forEach(preset => {
    preset.addEventListener('click', () => {
      amountPresets.forEach(p => p.classList.remove('selected'));
      preset.classList.add('selected');
      selectedAmount = preset.getAttribute('data-amount');
      if (customAmountInput) customAmountInput.value = selectedAmount;
    });
  });

  if (customAmountInput) {
    customAmountInput.addEventListener('input', () => {
      amountPresets.forEach(p => p.classList.remove('selected'));
      selectedAmount = customAmountInput.value;
    });
  }

  payCards.forEach(card => {
    card.addEventListener('click', () => {
      payCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      selectedMethod = card.getAttribute('data-method');

      const upiQrBox = document.getElementById('upiQrBox');
      if (upiQrBox) {
        upiQrBox.style.display = selectedMethod === 'UPI' ? 'block' : 'none';
      }
    });
  });

  if (donationForm) {
    donationForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const donorName = document.getElementById('donorName')?.value || 'Kind Donor';
      const donorPan = document.getElementById('donorPan')?.value || 'ABCDE1234F';
      const program = document.getElementById('donationProgram')?.value || 'General Fund';

      const btn = donationForm.querySelector('.btn-submit-action');
      const originalText = btn.innerHTML;
      btn.innerHTML = '⏳ Processing Secure Payment...';
      btn.disabled = true;

      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
        closeModal('donationModal');

        // Open Success & Receipt Modal
        showDonationSuccess(donorName, selectedAmount, donorPan, program);
      }, 1500);
    });
  }
}

function showDonationSuccess(name, amount, pan, program) {
  const receiptModal = document.getElementById('receiptModal');
  if (receiptModal) {
    document.getElementById('receiptName').textContent = name;
    document.getElementById('receiptAmount').textContent = `₹${Number(amount).toLocaleString('en-IN')}`;
    document.getElementById('receiptPan').textContent = pan;
    document.getElementById('receiptProgram').textContent = program;
    document.getElementById('receiptDate').textContent = new Date().toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
    document.getElementById('receiptTxnId').textContent = 'TXN-' + Math.random().toString(36).substring(2, 10).toUpperCase();

    openModal('receiptModal');
    showToast(`Thank you ${name}! ₹${amount} received. 80G Tax receipt ready.`, '💚');
  }
}

/* ==========================================================================
   VOLUNTEER REGISTRATION & DIGITAL ID BADGE (PDF Module 4.4)
   ========================================================================== */
function initVolunteerModal() {
  const form = document.getElementById('volunteerForm');
  if (!form) return;

  const idUpload = document.getElementById('volunteerIdUpload');
  const fileNameDisplay = document.getElementById('uploadedFileName');

  if (idUpload && fileNameDisplay) {
    idUpload.addEventListener('change', () => {
      if (idUpload.files.length) {
        fileNameDisplay.textContent = `📎 ${idUpload.files[0].name}`;
        showToast('ID Proof attached successfully', '📄');
      }
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('volName')?.value || 'Volunteer';
    const domain = document.getElementById('volDomain')?.value || 'Environmental Protection';
    const city = document.getElementById('volCity')?.value || 'Bengaluru';

    const submitBtn = form.querySelector('.btn-submit-action');
    submitBtn.innerHTML = '⚡ Generating Volunteer ID Badge...';
    submitBtn.disabled = true;

    setTimeout(() => {
      submitBtn.innerHTML = '✓ Registered Successfully!';
      submitBtn.disabled = false;

      // Populate Badge
      const badge = document.getElementById('idBadgePreview');
      if (badge) {
        document.getElementById('badgeName').textContent = name;
        document.getElementById('badgeDomain').textContent = domain;
        document.getElementById('badgeCity').textContent = city;
        document.getElementById('badgeIdNum').textContent = 'GOKUL-VOL-' + Math.floor(1000 + Math.random() * 9000);
        badge.style.display = 'block';
      }

      showToast(`Welcome to the team, ${name}! Your Digital Volunteer ID is generated.`, '🎖️');
    }, 1200);
  });
}

/* ==========================================================================
   PROGRAM DETAILS MODAL / DRAWER
   ========================================================================== */
const programData = {
  tree: {
    title: 'Tree Plantation & Environmental Protection',
    icon: '🌳',
    tagline: 'Restoring green cover, biodiversity, and clean air across India.',
    description: 'We organize community-driven mass tree plantation drives targeting degraded lands, rural schools, public parks, and river basins. Every sapling is nurtured for 3 years with local community stewardship.',
    stats: '150,000+ Native Trees Planted | 85% Survival Rate | 120 Village Green Belts',
    initiatives: ['Miyawaki Urban Micro-Forests', 'Fruit-Bearing Trees for Rural Farmers', 'School Eco-Clubs & Sapling Adoption']
  },
  cow: {
    title: 'Cow Protection & Goshala Conservation',
    icon: '🐮',
    tagline: 'Sheltering, nourishing, and conserving indigenous Desi cow breeds.',
    description: 'Our Gau-Seva and Goshala centers rescue abandoned, sick, and aging indigenous cows. We promote organic Panchagavya agriculture, zero-budget natural farming, and conserve rare native breeds like Gir, Sahiwal, and Hallikar.',
    stats: '2,500+ Rescued Cows Sheltered | Daily Nutritious Fodder | Organic Manure Training for 5,000+ Farmers',
    initiatives: ['Gau-Dham Medical & Rescue Shelter', 'Indigenous Breed Gene-Pool Conservation', 'Cow-Dung Biogas & Bio-Fertilizer Units']
  },
  health: {
    title: 'Yoga Awareness & Rural Health Outreach',
    icon: '🧘',
    tagline: 'Bringing daily community yoga, pranayama, free diagnostic camps, and wellness to villages.',
    description: 'Promoting authentic classical yoga, mindfulness, pranayama, and preventive healthcare. We conduct regular health checkups, eye testing camps, yoga therapy for chronic lifestyle disorders, and maternal health programs in underserved rural areas.',
    stats: '350+ Free Health & Yoga Camps | 45,000+ Beneficiaries | 120 Certified Village Yoga Instructors',
    initiatives: ['Daily Morning Community Yoga & Meditation', 'Village Mobile Diagnostic Clinics', 'Yoga for Hypertension, Diabetes & Stress Relief']
  },
  skill: {
    title: 'Women Empowerment, Employment & Youth Skills',
    icon: '💼',
    tagline: 'Empowering rural women with Self-Help Groups (SHGs) and youth with vocational jobs.',
    description: 'Vocational training centers offering tailoring, eco-handicrafts, food processing, natural soap manufacture, and digital literacy. We facilitate micro-finance and direct market linkages so village women achieve sustained financial independence.',
    stats: '12,000+ Women & Youths Certified | 280 Active Women SHGs | 74% Direct Employment / Micro-Enterprises',
    initiatives: ['Women Tailoring, Embroidery & Handloom Cooperatives', 'Panchagavya Organic Products & Eco-Packaging Units', 'Digital Saksharta Computer Training Centers']
  },
  community: {
    title: 'Community Development & Self-Reliance',
    icon: '👥',
    tagline: 'Strengthening grassroots communities through self-help groups and civic infrastructure.',
    description: 'Empowering village panchayats, creating women self-help groups (SHGs), reviving traditional water bodies, and fostering sustainable rural ecosystems.',
    stats: '280+ Self-Help Groups Supported | 65 Traditional Water Tanks Revived | Zero-Waste Villages',
    initiatives: ['Community Water Tank De-silting', 'Village Micro-Finance Support', 'Solar Street Lighting Projects']
  },
  sustainable: {
    title: 'Sustainable Living & Eco-Conscious Lifestyles',
    icon: '🌿',
    tagline: 'Championing renewable energy, circular economy, and chemical-free living.',
    description: 'Educating families on waste segregation, plastic-free alternatives, solar cooking, rooftop rainwater harvesting, and chemical-free natural living.',
    stats: '40 Tons Plastic Waste Diverted | 15,000 Households Trained | 500+ Rainwater Harvesters',
    initiatives: ['Say No to Single-Use Plastic Drives', 'Composting & Terrace Gardening Workshops', 'Traditional Herbal Medicine Gardens']
  }
};

function initProgramDrawers() {
  document.querySelectorAll('.pillar-card').forEach(card => {
    card.addEventListener('click', () => {
      const type = card.getAttribute('data-program');
      openProgramDetails(type);
    });
  });

  // Initiative checklist clicks in Card 2
  document.querySelectorAll('.initiative-item').forEach(item => {
    item.addEventListener('click', () => {
      const progType = item.getAttribute('data-program-ref') || 'tree';
      openProgramDetails(progType);
    });
  });
}

function openProgramDetails(type) {
  const data = programData[type] || programData.tree;
  const modal = document.getElementById('programModal');
  if (!modal) return;

  document.getElementById('progModalIcon').textContent = data.icon;
  document.getElementById('progModalTitle').textContent = data.title;
  document.getElementById('progModalTagline').textContent = data.tagline;
  document.getElementById('progModalDesc').textContent = data.description;
  document.getElementById('progModalStats').textContent = data.stats;

  const listEl = document.getElementById('progModalInitiatives');
  if (listEl) {
    listEl.innerHTML = data.initiatives.map(item => `<li>✓ ${item}</li>`).join('');
  }

  openModal('programModal');
}

/* ==========================================================================
   GALLERY LIGHTBOX (PDF Module 4.6)
   ========================================================================== */
const galleryItems = [
  { src: 'assets/gallery_1.jpg', caption: 'Tree Plantation Drive with Youth Volunteers in Village School', category: 'tree' },
  { src: 'assets/gallery_2.jpg', caption: 'Indigenous Desi Cows Grazing at Gokul Cow Sanctuary', category: 'cow' },
  { src: 'assets/gallery_3.jpg', caption: 'Free Comprehensive Rural Health & Diagnostic Camp', category: 'health' },
  { src: 'assets/gallery_4.jpg', caption: 'Community Skill Development & Women Empowerment Convention', category: 'community' }
];

function initGalleryLightbox() {
  const lightboxModal = document.getElementById('lightboxModal');
  const lbImg = document.getElementById('lightboxImg');
  const lbCaption = document.getElementById('lightboxCaption');
  const prevBtn = document.getElementById('lightboxPrev');
  const nextBtn = document.getElementById('lightboxNext');

  let currentIdx = 0;

  function showLightboxIndex(idx) {
    currentIdx = (idx + galleryItems.length) % galleryItems.length;
    const item = galleryItems[currentIdx];
    if (lbImg) lbImg.src = item.src;
    if (lbCaption) lbCaption.textContent = item.caption;
  }

  document.querySelectorAll('.gal-thumb').forEach((thumb, idx) => {
    thumb.addEventListener('click', () => {
      showLightboxIndex(idx);
      openModal('lightboxModal');
    });
  });

  if (prevBtn) prevBtn.addEventListener('click', () => showLightboxIndex(currentIdx - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => showLightboxIndex(currentIdx + 1));
}

/* ==========================================================================
   AI ASSISTANT CHATBOT ("Gokul Sewa Mitra") (PDF Module 6)
   ========================================================================== */
function initChatbot() {
  const launcher = document.getElementById('chatLauncher');
  const chatWindow = document.getElementById('chatWindow');
  const closeChat = document.getElementById('closeChat');
  const sendBtn = document.getElementById('sendChatBtn');
  const input = document.getElementById('chatInput');
  const messagesBox = document.getElementById('chatMessages');
  const chipButtons = document.querySelectorAll('.chip-btn');

  if (!launcher || !chatWindow) return;

  launcher.addEventListener('click', () => {
    chatWindow.classList.toggle('open');
    if (chatWindow.classList.contains('open')) {
      input.focus();
    }
  });

  if (closeChat) {
    closeChat.addEventListener('click', () => {
      chatWindow.classList.remove('open');
    });
  }

  function appendMessage(text, isUser = false) {
    const msg = document.createElement('div');
    msg.className = `chat-msg ${isUser ? 'user' : 'bot'}`;
    msg.textContent = text;
    messagesBox.appendChild(msg);
    messagesBox.scrollTop = messagesBox.scrollHeight;
  }

  function handleBotResponse(query) {
    const q = query.toLowerCase();
    let reply = "I'm glad to assist you! Green India Gokul Foundation works across environmental protection, cow welfare, rural healthcare, and skill development.";

    if (q.includes('tax') || q.includes('80g') || q.includes('receipt')) {
      reply = "All donations to Green India Gokul Foundation qualify for 50% tax exemption under Section 80G of the Income Tax Act. Instant receipts with PAN are generated upon donation.";
    } else if (q.includes('donate') || q.includes('money') || q.includes('sponsor')) {
      reply = "You can donate easily via UPI, Credit/Debit cards, or Netbanking. Click the 'Donate Now' button to select a specific program like Cow Fodder or Tree Plantation.";
    } else if (q.includes('volunteer') || q.includes('join')) {
      reply = "We welcome volunteers! Click 'Join Us' to register for upcoming plantation drives, goshala care, or medical camps, and receive your digital Volunteer ID.";
    } else if (q.includes('goshala') || q.includes('cow') || q.includes('visit')) {
      reply = "Our Gokul Cow Sanctuary is open for family visits and Gau-Puja every day from 8:00 AM to 6:00 PM. Fodder sponsorship is available at ₹500/cow.";
    } else if (q.includes('tree') || q.includes('plant')) {
      reply = "We organize weekend tree plantation drives across schools and village lands. Sponsoring 5 saplings with 3 years maintenance is just ₹1,000.";
    } else if (q.includes('contact') || q.includes('phone') || q.includes('address')) {
      reply = "Reach our central office at +91 98765 43210 or email info@greenindiagokulfoundation.org. We're also available on WhatsApp!";
    }

    setTimeout(() => {
      appendMessage(reply, false);
    }, 600);
  }

  function sendQuery(text) {
    if (!text.trim()) return;
    appendMessage(text, true);
    input.value = '';
    handleBotResponse(text);
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', () => sendQuery(input.value));
  }

  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendQuery(input.value);
    });
  }

  chipButtons.forEach(chip => {
    chip.addEventListener('click', () => {
      sendQuery(chip.textContent);
    });
  });
}

/* ==========================================================================
   MOBILE DRAWER NAVIGATION
   ========================================================================== */
function initMobileDrawer() {
  const menuToggle = document.getElementById('mobileMenuBtn');
  const drawer = document.getElementById('mobileNavDrawer');
  const closeDrawer = document.getElementById('closeMobileDrawer');

  if (menuToggle && drawer) {
    menuToggle.addEventListener('click', () => {
      drawer.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  }

  if (closeDrawer && drawer) {
    closeDrawer.addEventListener('click', () => {
      drawer.classList.remove('open');
      document.body.style.overflow = '';
    });
  }

  // Close drawer on link click
  document.querySelectorAll('.mobile-drawer-link').forEach(link => {
    link.addEventListener('click', () => {
      if (drawer) {
        drawer.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  });
}

/* ==========================================================================
   SOCIAL & ACTION POPUPS (PDF Module 4.8)
   ========================================================================== */
function initSocialAndContactActions() {
  document.querySelectorAll('.social-icon-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const platform = btn.getAttribute('data-platform') || 'Social Media';
      showToast(`Connecting to Green India Gokul Foundation on ${platform}...`, '🌐');
    });
  });

  // Hotspots on Hero Banner
  document.querySelectorAll('.hero-hotspot').forEach(spot => {
    spot.addEventListener('click', () => {
      const label = spot.getAttribute('data-label') || 'Green India Gokul Initiative';
      showToast(`Feature Spotlight: ${label}`, '✨');
    });
  });

  // Download PDF Reports
  document.querySelectorAll('.btn-download-pdf').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const doc = btn.getAttribute('data-doc') || 'Document';
      showToast(`Downloading official verified ${doc}...`, '📄');
      setTimeout(() => {
        showToast(`${doc} downloaded successfully!`, '✅');
      }, 1000);
    });
  });
}
