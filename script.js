(function () {
  var WA_BF = '22607554790';
  var WA_CH = '41765761672';
  var BF_TEXT = 'Bonjour Agence Derra Global Trading Ouaga, je vous contacte depuis le site web pour des informations sur vos produits et le fret.';

  function digits(phone) {
    return String(phone || '').replace(/\D/g, '');
  }

  function resolvePhone(phone) {
    var key = String(phone || '').trim().toLowerCase();
    if (key === 'bf' || key === 'ouaga') return WA_BF;
    return digits(phone);
  }

  function isMobile() {
    return /Android|iPhone|iPad|iPod|IEMobile|Mobile/i.test(navigator.userAgent || '');
  }

  /* Universal catalog URL as requested */
  function waMeUrl(phone, text) {
    var n = resolvePhone(phone);
    var q = encodeURIComponent(text || '');
    return 'https://wa.me/' + n + (q ? '?text=' + q : '');
  }

  /* Desktop: WhatsApp Web send URL avoids Windows whatsapp:// protocol prompt */
  function waWebUrl(phone, text) {
    var n = resolvePhone(phone);
    var q = encodeURIComponent(text || '');
    return 'https://web.whatsapp.com/send?phone=' + n + (q ? '&text=' + q : '');
  }

  function waOpenUrl(phone, text) {
    return isMobile() ? waMeUrl(phone, text) : waWebUrl(phone, text);
  }

  function parseWaHref(href) {
    if (!href) return null;
    var s = String(href);
    var phone = '';
    var text = '';
    var m;
    if (/^whatsapp:\/\//i.test(s)) {
      m = s.match(/phone=(\d+)/i);
      if (m) phone = m[1];
      m = s.match(/(?:\?|&)text=([^&]*)/i);
      if (m) { try { text = decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (e) { text = m[1]; } }
      return { phone: resolvePhone(phone), text: text };
    }
    m = s.match(/(?:wa\.me\/|whatsapp\.com\/send\?phone=)(\d+)/i);
    if (!m) return null;
    phone = m[1];
    m = s.match(/[?&]text=([^&]*)/i);
    if (m) { try { text = decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (e) { text = m[1]; } }
    return { phone: resolvePhone(phone), text: text };
  }

  window.DerraWA = {
    BF: WA_BF,
    CH: WA_CH,
    BF_TEXT: BF_TEXT,
    meUrl: waMeUrl,
    openUrl: waOpenUrl,
    open: function (phone, text) {
      var n = resolvePhone(phone);
      var href = waMeUrl(n, text);
      window.open(waOpenUrl(n, text), '_blank', 'noopener,noreferrer');
      return href;
    }
  };

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var parsed = parseWaHref(href);
    if (!parsed || !parsed.phone) return;
    e.preventDefault();
    window.DerraWA.open(parsed.phone, parsed.text);
  }, true);
})();

(function () {
  var OFFSET = 90;
  var links = document.querySelectorAll('nav.main a.nav-link[data-nav]');
  if (!links.length) return;

  function setActive(key) {
    links.forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('data-nav') === key);
    });
  }

  function spy() {
    var catalogue = document.getElementById('catalogue');
    var categories = document.getElementById('categories');
    var tarifs = document.getElementById('tarifs-fret');
    var temoignages = document.getElementById('temoignages');
    var contact = document.getElementById('contact');
    var accueil = document.getElementById('accueil');
    var catOpen = !!(catalogue && catalogue.classList.contains('is-open'));
    var maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    var vh = window.innerHeight || 1;

    if (window.scrollY < 80) {
      setActive('accueil');
      return;
    }
    if (maxScroll > 0 && window.scrollY >= maxScroll - 180) {
      setActive('contact');
      return;
    }

    var current = 'accueil';
    var best = -Infinity;
    var candidates = [
      { key: 'accueil', el: accueil },
      { key: 'produits', el: catOpen ? catalogue : categories },
      { key: 'tarifs', el: tarifs },
      { key: 'temoignages', el: temoignages },
      { key: 'contact', el: contact }
    ];
    candidates.forEach(function (c) {
      if (!c.el) return;
      if (c.el === catalogue && !catOpen) return;
      var top = c.el.getBoundingClientRect().top;
      if (top <= OFFSET + 8 && top >= best) {
        best = top;
        current = c.key;
      }
    });

    var tarifsInView = false;
    if (tarifs) {
      var tr = tarifs.getBoundingClientRect();
      tarifsInView = tr.top < vh * 0.45 && tr.bottom > OFFSET;
    }
    if (tarifsInView) {
      current = 'tarifs';
    } else if (catOpen && catalogue) {
      var ct = catalogue.getBoundingClientRect();
      if (ct.top >= 0 && ct.top < vh * 0.5) current = 'produits';
    } else if (categories) {
      var cr = categories.getBoundingClientRect();
      if (cr.top < vh * 0.45 && cr.bottom > OFFSET) current = 'produits';
    }

    setActive(current);
  }

  var ticking = false;
  function requestSpy() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      spy();
    });
  }

  links.forEach(function (a) {
    a.addEventListener('click', function () {
      var key = a.getAttribute('data-nav');
      if (key) setActive(key);
    });
  });

  window.addEventListener('scroll', requestSpy, { passive: true });
  window.addEventListener('resize', requestSpy);
  window.addEventListener('load', spy);
  spy();
})();
