/* Loads Google Fonts WITHOUT blocking the page and without an inline event handler (keeps the Content-Security-Policy strict). */
(function () {
  var l = document.createElement('link');
  l.rel = 'stylesheet'; l.media = 'print';
  l.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Noto+Sans+Devanagari:wght@400;600;700&family=Noto+Sans+Kannada:wght@400;600;700&family=Noto+Sans+Malayalam:wght@400;600;700&family=Noto+Sans+Tamil:wght@400;600;700&family=Noto+Sans+Telugu:wght@400;600;700&family=Playfair+Display:ital,wght@0,600;0,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
  l.onload = function () { l.media = 'all'; };
  document.head.appendChild(l);
})();
