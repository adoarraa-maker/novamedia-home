(function () {
  'use strict';

  var CONFIG = Object.assign({
    storageKey: 'derra-commerce-cart-v1',
    janvierPhone: '22607554790'
  }, window.DERRA_COMMERCE_CONFIG || {});

  var PRODUCT_MAP = {
    'coque|airbag': 'coque-airbag',
    'cable|tresse': 'cable-tresse',
    'verre|hd': 'verre-hd',
    'verre|privacy': 'verre-privacy',
    'chargeur|fast': 'chargeur-fast',
    'audio|air31': 'audio-air31'
  };

  var PRODUCTS = {
    'coque-airbag': {
      product_key: 'coque-airbag',
      name: 'Coques Antichoc Airbag Silicone',
      image_url: 'coque1.png',
      stock_quantity: null,
      variants: ['Airbag', 'MagSafe', 'Béquille', 'Silicone'],
      price_tiers: [
        { min: 1, max: 49, unit: 1000, label: 'Détail 1-49 pcs' },
        { min: 50, max: null, unit: 600, label: 'Gros 50+ pcs' }
      ]
    },
    'cable-tresse': {
      product_key: 'cable-tresse',
      name: 'Câbles tressés de charge rapide',
      image_url: 'cable-charge.jpg',
      stock_quantity: null,
      variants: ['Type-C', 'Lightning', 'Micro-USB'],
      price_tiers: [
        { min: 1, max: 49, unit: 1000, label: 'Détail 1-49 pcs' },
        { min: 50, max: null, unit: 500, label: 'Gros 50+ pcs' }
      ]
    },
    'verre-hd': {
      product_key: 'verre-hd',
      name: 'Verres trempés 9D HD',
      image_url: 'V2.png',
      stock_quantity: null,
      variants: ['Tecno', 'Infinix', 'Samsung', 'iPhone'],
      price_tiers: [
        { min: 1, max: 49, unit: 1000, label: 'Détail 1-49 pcs' },
        { min: 50, max: null, unit: 500, label: 'Gros 50+ pcs' }
      ]
    },
    'verre-privacy': {
      product_key: 'verre-privacy',
      name: 'Verre Trempé Anti-Espion',
      image_url: 'VIN1.png',
      stock_quantity: null,
      variants: ['Tecno', 'Infinix', 'Samsung', 'iPhone'],
      price_tiers: [
        { min: 1, max: 19, unit: 1500, label: 'Détail 1-19 pcs' },
        { min: 20, max: null, unit: 1000, label: 'Gros 20+ pcs' }
      ]
    },
    'chargeur-fast': {
      product_key: 'chargeur-fast',
      name: 'Chargeurs Fast Charge 20W',
      image_url: 'bloc-charge.jpg',
      stock_quantity: null,
      variants: ['Kit 20W'],
      price_tiers: [
        { min: 1, max: 9, unit: 2500, label: 'Détail 1-9 pcs' },
        { min: 10, max: null, unit: 1800, label: 'Gros 10+ pcs' }
      ]
    },
    'audio-air31': {
      product_key: 'audio-air31',
      name: 'Écouteurs Air31 TWS Crystal LED',
      image_url: 'air31-1.jpg',
      stock_quantity: null,
      variants: ['Noir', 'Blanc', 'Vert', 'Bleu', 'Violet'],
      price_tiers: [
        { min: 1, max: null, unit: 3500, label: '1 Pièce' }
      ]
    },
    'briquet-electric': {
      product_key: 'briquet-electric',
      name: 'Mini Briquet Électrique Smartphone Porte-Clés',
      image_url: 'briquet-coffret.jpg',
      stock_quantity: 0,
      variants: ['Type-C', 'Lightning'],
      price_tiers: [
        { min: 1, max: 19, unit: 5000, label: 'Détail 1-19 pcs' },
        { min: 20, max: null, unit: 4000, label: 'Gros 20+ pcs' }
      ]
    }
  };

  function isSoldOutKey(key) {
    var product = PRODUCTS[key];
    return !!(product && typeof product.stock_quantity === 'number' && product.stock_quantity <= 0);
  }

  var storedCart = loadCart();
  var cart = storedCart.filter(function (item) { return !isSoldOutKey(item.product_key); });
  if (cart.length !== storedCart.length) {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(cart));
  }
  var ui = {};
  var productsReady = fetchProducts();

  function formatFcfa(value) {
    return String(value || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function productList() {
    return Object.keys(PRODUCTS).map(function (key) { return PRODUCTS[key]; });
  }

  function fetchProducts() {
    return Promise.resolve(productList());
  }

  function loadCart() {
    try {
      var raw = localStorage.getItem(CONFIG.storageKey);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function saveCart() {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(cart));
    renderCart();
  }

  function getTier(product, qty) {
    var tiers = (product && product.price_tiers) || [];
    return tiers.find(function (tier) {
      return qty >= Number(tier.min || 1) && (tier.max == null || qty <= Number(tier.max));
    }) || tiers[0] || { unit: 0, label: '' };
  }

  function itemUnit(item) {
    if (item && item.pack_price != null) return Number(item.pack_price) || 0;
    var product = PRODUCTS[item.product_key];
    return Number(getTier(product, item.quantity).unit || 0);
  }

  function itemTotal(item) {
    return itemUnit(item) * Number(item.quantity || 1);
  }

  function cartTotal() {
    return cart.reduce(function (sum, item) { return sum + itemTotal(item); }, 0);
  }

  function cartCount() {
    return cart.reduce(function (sum, item) { return sum + Number(item.quantity || 0); }, 0);
  }

  function productKeyFromCard(card) {
    if (!card) return '';
    if (card.id === 'prod-briquet' || card.id === 'cat-briquet') return 'briquet-electric';
    var key = (card.dataset.kind || '') + '|' + (card.dataset.sub || '');
    return PRODUCT_MAP[key] || '';
  }

  function selectedVariant(card, product) {
    if (!card) return (product.variants || [])[0] || '';
    var selected = card.querySelector('.brand-btn.is-on') ||
      card.querySelector('.range-thumbs button.is-on[data-color]') ||
      card.querySelector('.air31-thumbs button.is-on[data-color]') ||
      card.querySelector('.briquet-thumbs button.is-on');
    if (selected) {
      return selected.getAttribute('data-color') ||
        selected.getAttribute('data-brand') ||
        selected.getAttribute('data-finish') ||
        selected.getAttribute('data-variant') ||
        selected.textContent.trim();
    }
    return card.dataset.variant || card.dataset.brand || card.dataset.finish || (product.variants || [])[0] || '';
  }

  function selectedQuantity(card) {
    var input = card && card.querySelector('.buy-qty-input');
    return Math.max(1, parseInt(input && input.value, 10) || 1);
  }

  function upsertCartItem(next) {
    if (isSoldOutKey(next.product_key)) {
      setNotice('Épuisé pour le moment — Bientôt de retour', true);
      return;
    }
    var found = cart.find(function (item) {
      return item.product_key === next.product_key && item.variant === next.variant;
    });
    var stock = PRODUCTS[next.product_key] && PRODUCTS[next.product_key].stock_quantity;
    if (found) {
      found.quantity += next.quantity;
      if (next.pack_price != null) found.pack_price = next.pack_price;
    } else cart.push(next);
    if (typeof stock === 'number') {
      var item = found || next;
      item.quantity = Math.min(item.quantity, Math.max(stock, 0));
    }
    saveCart();
    openCart();
  }

  function addSelection(card) {
    var key = productKeyFromCard(card);
    var product = PRODUCTS[key];
    if (!product) return;
    if (typeof product.stock_quantity === 'number' && product.stock_quantity <= 0) {
      setNotice('Ce produit est en rupture de stock.', true);
      return;
    }
    var color = selectedVariant(card, product);
    var packTitle = card._buy && card._buy.packTitle;
    var variant = packTitle ? (color + ' · ' + packTitle) : color;
    var item = {
      product_key: key,
      name: product.name,
      image_url: product.image_url,
      variant: variant,
      quantity: selectedQuantity(card)
    };
    if (card._buy && card._buy.packPrice != null) item.pack_price = card._buy.packPrice;
    upsertCartItem(item);
  }

  function updateItem(index, quantity) {
    if (!cart[index]) return;
    if (isSoldOutKey(cart[index].product_key)) {
      removeItem(index);
      setNotice('Épuisé pour le moment — Bientôt de retour', true);
      return;
    }
    var product = PRODUCTS[cart[index].product_key];
    var stock = product && product.stock_quantity;
    var nextQty = Math.max(1, parseInt(quantity, 10) || 1);
    if (typeof stock === 'number') nextQty = Math.min(nextQty, Math.max(stock, 1));
    cart[index].quantity = nextQty;
    saveCart();
  }

  function removeItem(index) {
    cart.splice(index, 1);
    saveCart();
  }

  function makeButton(label, className) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    return button;
  }

  function mountAddButton(card) {
    var key = productKeyFromCard(card);
    if (!card || !key || card.querySelector('.commerce-add')) return;
    var target = card.querySelector('.buy-total') || card.querySelector('.range__act');
    if (!target) return;
    var stock = document.createElement('p');
    stock.className = 'commerce-stock';
    stock.setAttribute('data-commerce-stock', key);
    target.insertAdjacentElement('afterend', stock);
    var button = makeButton('Ajouter au panier', 'btn btn--gold commerce-add');
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      addSelection(card);
    });
    stock.insertAdjacentElement('afterend', button);
  }

  function mountProductButtons() {
    document.querySelectorAll('#telephonie .range[data-kind][data-sub]').forEach(mountAddButton);
    mountAddButton(document.getElementById('air31Modal'));

    var briquet = document.getElementById('prod-briquet');
    if (briquet && !briquet.querySelector('.commerce-add')) {
      var cta = briquet.querySelector('.briquet__cta');
      if (cta) {
        if (!briquet.querySelector('[data-commerce-stock="briquet-electric"]')) {
          var stockLine = document.createElement('p');
          stockLine.className = 'commerce-stock';
          stockLine.setAttribute('data-commerce-stock', 'briquet-electric');
          cta.insertAdjacentElement('beforebegin', stockLine);
        }
        var qty = document.createElement('label');
        qty.className = 'commerce-qty';
        qty.innerHTML = '<span>Quantité</span><input type="number" min="1" step="1" value="1" class="buy-qty-input">';
        cta.insertAdjacentElement('beforebegin', qty);
        var button = makeButton('Ajouter au panier', 'btn btn--gold commerce-add');
        button.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          addSelection(briquet);
        });
        cta.prepend(button);
      }
    }
    syncStockUi();
  }

  function syncStockUi() {
    document.querySelectorAll('[data-commerce-stock]').forEach(function (el) {
      var key = el.getAttribute('data-commerce-stock');
      var product = PRODUCTS[key];
      if (!product) return;
      var soldOut = typeof product.stock_quantity === 'number' && product.stock_quantity <= 0;
      if (soldOut && key === 'briquet-electric') {
        el.textContent = 'Épuisé pour le moment — Bientôt de retour';
        el.classList.add('commerce-stock--out');
      } else if (typeof product.stock_quantity === 'number') {
        el.classList.remove('commerce-stock--out');
        el.innerHTML = product.stock_quantity > 0
          ? 'Stock restant : <b>' + product.stock_quantity + '</b>'
          : '<b>Rupture de stock</b>';
      } else {
        el.classList.remove('commerce-stock--out');
        el.textContent = 'Disponible en boutique Ouaga';
      }
      var host = el.closest('.range, .briquet-sheet, .air31-modal');
      var add = host && host.querySelector('.commerce-add');
      if (add && typeof product.stock_quantity === 'number') {
        add.disabled = soldOut;
      }
      if (soldOut && key === 'briquet-electric' && host) {
        lockSoldOutControl(add, 'Rupture de stock temporaire');
        lockSoldOutControl(host.querySelector('[data-i18n="briquet_wa"]'));
        var qtyInput = host.querySelector('.buy-qty-input');
        if (qtyInput) qtyInput.disabled = true;
      }
    });
  }

  function lockSoldOutControl(el, label) {
    if (!el) return;
    el.disabled = true;
    el.setAttribute('disabled', 'disabled');
    el.setAttribute('aria-disabled', 'true');
    el.style.opacity = '0.6';
    el.style.pointerEvents = 'none';
    el.style.cursor = 'not-allowed';
    el.style.backgroundColor = '#9ca3af';
    if (label) el.textContent = label;
    if (el.tagName === 'A') {
      el.removeAttribute('href');
      el.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
      });
    }
  }

  function mountCartUi() {
    if (document.getElementById('commerceCart')) return;
    var button = makeButton('Panier', 'commerce-cart-fab');
    button.id = 'commerceCartButton';
    button.innerHTML = '<span>Panier</span><b>0</b>';
    button.addEventListener('click', openCart);

    var drawer = document.createElement('aside');
    drawer.id = 'commerceCart';
    drawer.className = 'commerce-cart';
    drawer.hidden = true;
    drawer.setAttribute('aria-label', 'Panier d’achat');
    drawer.innerHTML =
      '<div class="commerce-cart__head">' +
        '<div><p>Panier d’achat</p><strong>Boutique Ouagadougou</strong></div>' +
        '<button type="button" class="commerce-cart__close" aria-label="Fermer">×</button>' +
      '</div>' +
      '<div class="commerce-cart__items"></div>' +
      '<div class="commerce-checkout">' +
        '<fieldset class="commerce-pay-choice">' +
          '<legend>Mode de paiement</legend>' +
          '<label class="commerce-pay-option">' +
            '<input type="radio" name="commercePay" value="Orange Money" checked>' +
            '<span>Orange Money <small>+226 07 55 47 90</small></span>' +
          '</label>' +
          '<label class="commerce-pay-option">' +
            '<input type="radio" name="commercePay" value="Moov Money">' +
            '<span>Moov Money <small>+226 07 55 47 90</small></span>' +
          '</label>' +
        '</fieldset>' +
        '<button type="button" class="commerce-pay commerce-pay--wa">Commander via WhatsApp (Orange Money / Moov Money)</button>' +
      '</div>' +
      '<p class="commerce-notice" role="status"></p>';

    document.body.appendChild(button);
    document.body.appendChild(drawer);

    ui.button = button;
    ui.drawer = drawer;
    ui.items = drawer.querySelector('.commerce-cart__items');
    ui.form = drawer.querySelector('.commerce-checkout');
    ui.notice = drawer.querySelector('.commerce-notice');

    drawer.querySelector('.commerce-cart__close').addEventListener('click', closeCart);
    ui.form.querySelector('.commerce-pay--wa').addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      orderViaWhatsApp();
    });
    renderCart();
  }

  function openCart() {
    if (ui.drawer) {
      ui.drawer.hidden = false;
      renderCart();
    }
  }

  function closeCart() {
    if (ui.drawer) ui.drawer.hidden = true;
  }

  function setNotice(message, isError) {
    if (!ui.notice) return;
    ui.notice.textContent = message || '';
    ui.notice.classList.toggle('is-error', Boolean(isError));
  }

  function renderCart() {
    if (!ui.items || !ui.button) return;
    ui.button.querySelector('b').textContent = cartCount();
    if (!cart.length) {
      ui.items.innerHTML = '<p class="commerce-empty">Votre panier est vide.</p>';
      if (ui.form) ui.form.hidden = true;
      return;
    }
    if (ui.form) ui.form.hidden = false;
    ui.items.innerHTML = cart.map(function (item, index) {
      var product = PRODUCTS[item.product_key] || item;
      var stock = typeof product.stock_quantity === 'number' ? product.stock_quantity : null;
      var unitWord = item.pack_price != null ? ' / pack' : ' / unité';
      return '<article class="commerce-item">' +
        '<img src="' + (product.image_url || item.image_url || '') + '" alt="">' +
        '<div>' +
          '<strong>' + escapeHtml(product.name || item.name) + '</strong>' +
          '<span>' + escapeHtml(item.variant || 'Standard') + '</span>' +
          '<small>' + formatFcfa(itemUnit(item)) + ' F CFA' + unitWord + (stock !== null ? ' · stock ' + stock : '') + '</small>' +
        '</div>' +
        '<label>Qté<input data-cart-qty="' + index + '" type="number" min="1" value="' + item.quantity + '"></label>' +
        '<b>' + formatFcfa(itemTotal(item)) + ' F</b>' +
        '<button type="button" data-cart-remove="' + index + '" aria-label="Retirer">×</button>' +
      '</article>';
    }).join('') + '<div class="commerce-total"><span>Total marchandise</span><b>' + formatFcfa(cartTotal()) + ' F CFA</b></div>';
    ui.items.querySelectorAll('[data-cart-qty]').forEach(function (input) {
      input.addEventListener('change', function () { updateItem(Number(input.dataset.cartQty), input.value); });
      input.addEventListener('input', function () { updateItem(Number(input.dataset.cartQty), input.value); });
    });
    ui.items.querySelectorAll('[data-cart-remove]').forEach(function (button) {
      button.addEventListener('click', function () { removeItem(Number(button.dataset.cartRemove)); });
    });
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char];
    });
  }

  function selectedPayment() {
    var picked = ui.form && ui.form.querySelector('input[name="commercePay"]:checked');
    return (picked && picked.value) || 'Orange Money';
  }

  function orderViaWhatsApp() {
    if (cart.some(function (item) { return isSoldOutKey(item.product_key); })) {
      cart = cart.filter(function (item) { return !isSoldOutKey(item.product_key); });
      saveCart();
      setNotice('Épuisé pour le moment — Bientôt de retour. Cet article a été retiré de la commande.', true);
      return;
    }
    if (!cart.length) {
      setNotice('Ajoutez au moins un produit au panier.', true);
      return;
    }
    var articles = cart.map(function (item) {
      var product = PRODUCTS[item.product_key] || item;
      var name = product.name || item.name || 'Article';
      var variant = item.variant ? ' (' + item.variant + ')' : '';
      return name + variant + ' × ' + item.quantity + ' — ' + formatFcfa(itemUnit(item)) + ' FCFA';
    }).join('\n  ');
    var text = 'Bonjour Janvier, voici ma commande depuis le site :\n' +
      '- Articles :\n  ' + articles + '\n' +
      '- Total : ' + formatFcfa(cartTotal()) + ' FCFA\n' +
      '- Mode de paiement choisi : ' + selectedPayment() + '\n' +
      'Merci de me confirmer la réception.';
    var url = 'https://wa.me/22607554790?text=' + encodeURIComponent(text);
    var opened = window.open(url, '_blank');
    if (!opened) window.location.href = url;
  }

  document.addEventListener('DOMContentLoaded', function () {
    mountCartUi();
    mountProductButtons();
    renderCart();
    productsReady.then(syncStockUi);
  });

  window.DerraCommerce = {
    openCart: openCart,
    refreshProducts: fetchProducts,
    addProduct: function (productKey, quantity, variant) {
      var product = PRODUCTS[productKey];
      if (!product || isSoldOutKey(productKey)) return;
      upsertCartItem({
        product_key: productKey,
        name: product.name,
        image_url: product.image_url,
        variant: variant || (product.variants || [])[0] || '',
        quantity: Math.max(1, Number(quantity || 1))
      });
    }
  };
})();
