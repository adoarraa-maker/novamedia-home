(function () {
  'use strict';

  var CONFIG = Object.assign({
    supabaseUrl: '',
    supabaseAnonKey: '',
    functionsUrl: '',
    cinetpayMode: 'PRODUCTION',
    currency: 'XOF',
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
        { min: 1, max: 1, unit: 3500, label: 'Détail 1 pc' },
        { min: 2, max: 2, unit: 3250, label: 'Duo 2 pcs' },
        { min: 3, max: 9, unit: 3500, label: 'Détail 3-9 pcs' },
        { min: 10, max: null, unit: 2500, label: 'Gros 10+ pcs' }
      ]
    },
    'briquet-electric': {
      product_key: 'briquet-electric',
      name: 'Mini Briquet Électrique Smartphone Porte-Clés',
      image_url: 'briquet-coffret.jpg',
      stock_quantity: null,
      variants: ['Type-C', 'Lightning'],
      price_tiers: [
        { min: 1, max: 19, unit: 5000, label: 'Détail 1-19 pcs' },
        { min: 20, max: null, unit: 4000, label: 'Gros 20+ pcs' }
      ]
    }
  };

  var cart = loadCart();
  var ui = {};
  var productsReady = fetchProducts();

  function formatFcfa(value) {
    return String(value || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function productList() {
    return Object.keys(PRODUCTS).map(function (key) { return PRODUCTS[key]; });
  }

  function configReady() {
    return Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
  }

  function functionsBaseUrl() {
    if (CONFIG.functionsUrl) return CONFIG.functionsUrl.replace(/\/+$/, '');
    return CONFIG.supabaseUrl.replace(/\/+$/, '') + '/functions/v1';
  }

  function edgeFetch(path, options) {
    var headers = Object.assign({
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + CONFIG.supabaseAnonKey
    }, (options && options.headers) || {});
    return fetch(functionsBaseUrl() + path, Object.assign({}, options || {}, { headers: headers }))
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok) throw new Error(body.error || body.message || 'Erreur Supabase');
          return body;
        });
      });
  }

  function fetchProducts() {
    if (!configReady()) return Promise.resolve(productList());
    var url = CONFIG.supabaseUrl.replace(/\/+$/, '') +
      '/rest/v1/ecommerce_products?select=product_key,name,image_url,stock_quantity,price_tiers,metadata,is_active&is_active=eq.true&order=sort_order.asc';
    return fetch(url, {
      headers: {
        apikey: CONFIG.supabaseAnonKey,
        Authorization: 'Bearer ' + CONFIG.supabaseAnonKey
      }
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Impossible de charger les produits Supabase');
        return res.json();
      })
      .then(function (rows) {
        rows.forEach(function (row) {
          var local = PRODUCTS[row.product_key] || { product_key: row.product_key };
          PRODUCTS[row.product_key] = Object.assign(local, {
            name: row.name || local.name,
            image_url: row.image_url || local.image_url,
            stock_quantity: typeof row.stock_quantity === 'number' ? row.stock_quantity : local.stock_quantity,
            price_tiers: Array.isArray(row.price_tiers) && row.price_tiers.length ? row.price_tiers : local.price_tiers,
            variants: row.metadata && Array.isArray(row.metadata.variants) ? row.metadata.variants : local.variants
          });
        });
        syncStockUi();
        renderCart();
        return rows;
      })
      .catch(function (err) {
        console.warn(err.message || err);
        return productList();
      });
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

  function itemTotal(item) {
    var product = PRODUCTS[item.product_key];
    var tier = getTier(product, item.quantity);
    return Number(tier.unit || 0) * Number(item.quantity || 1);
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
    var found = cart.find(function (item) {
      return item.product_key === next.product_key && item.variant === next.variant;
    });
    var stock = PRODUCTS[next.product_key] && PRODUCTS[next.product_key].stock_quantity;
    if (found) found.quantity += next.quantity;
    else cart.push(next);
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
    upsertCartItem({
      product_key: key,
      name: product.name,
      image_url: product.image_url,
      variant: selectedVariant(card, product),
      quantity: selectedQuantity(card)
    });
  }

  function updateItem(index, quantity) {
    if (!cart[index]) return;
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

  function mountProductButtons() {
    document.querySelectorAll('#telephonie .range[data-kind][data-sub]').forEach(function (card) {
      var key = productKeyFromCard(card);
      if (!key || card.querySelector('.commerce-add')) return;
      var target = card.querySelector('.range-col--buy .buy-total') || card.querySelector('.range__act');
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
    });

    var briquet = document.getElementById('prod-briquet');
    if (briquet && !briquet.querySelector('.commerce-add')) {
      var cta = briquet.querySelector('.briquet__cta');
      if (cta) {
        var stockLine = document.createElement('p');
        stockLine.className = 'commerce-stock';
        stockLine.setAttribute('data-commerce-stock', 'briquet-electric');
        cta.insertAdjacentElement('beforebegin', stockLine);
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
      if (typeof product.stock_quantity === 'number') {
        el.innerHTML = product.stock_quantity > 0
          ? 'Stock restant : <b>' + product.stock_quantity + '</b>'
          : '<b>Rupture de stock</b>';
      } else {
        el.textContent = 'Stock vérifié au paiement';
      }
      var host = el.closest('.range, .briquet-sheet');
      var add = host && host.querySelector('.commerce-add');
      if (add && typeof product.stock_quantity === 'number') {
        add.disabled = product.stock_quantity <= 0;
      }
    });
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
        '<div><p>Panier d’achat</p><strong>Paiement CinetPay sécurisé</strong></div>' +
        '<button type="button" class="commerce-cart__close" aria-label="Fermer">×</button>' +
      '</div>' +
      '<div class="commerce-cart__items"></div>' +
      '<form class="commerce-checkout">' +
        '<label>Nom et prénom<input name="name" required autocomplete="name" placeholder="Votre nom"></label>' +
        '<label>Téléphone Orange/Moov<input name="phone" required autocomplete="tel" inputmode="tel" placeholder="Ex. 07 00 00 00"></label>' +
        '<label>Quartier / ville<input name="area" autocomplete="address-level2" placeholder="Ouagadougou, Toudoubwéogo..."></label>' +
        '<p class="commerce-checkout__note">Aucun compte client à créer : choisissez Orange Money ou Moov Money Burkina Faso et validez dans CinetPay.</p>' +
        '<div class="commerce-pay-row">' +
          '<button type="submit" data-operator="ORANGE_MONEY_BF" class="commerce-pay commerce-pay--orange">Payer Orange Money</button>' +
          '<button type="submit" data-operator="MOOV_MONEY_BF" class="commerce-pay commerce-pay--moov">Payer Moov Money</button>' +
        '</div>' +
      '</form>' +
      '<p class="commerce-notice" role="status"></p>';

    var receipt = document.createElement('section');
    receipt.id = 'commerceReceipt';
    receipt.className = 'commerce-receipt';
    receipt.hidden = true;
    receipt.setAttribute('role', 'dialog');
    receipt.setAttribute('aria-modal', 'true');
    receipt.setAttribute('aria-label', 'Reçu de paiement validé');

    document.body.appendChild(button);
    document.body.appendChild(drawer);
    document.body.appendChild(receipt);

    ui.button = button;
    ui.drawer = drawer;
    ui.items = drawer.querySelector('.commerce-cart__items');
    ui.form = drawer.querySelector('.commerce-checkout');
    ui.notice = drawer.querySelector('.commerce-notice');
    ui.receipt = receipt;

    drawer.querySelector('.commerce-cart__close').addEventListener('click', closeCart);
    ui.form.addEventListener('submit', function (event) {
      event.preventDefault();
      var submitter = event.submitter || document.activeElement;
      startCheckout(submitter && submitter.getAttribute('data-operator') || 'ORANGE_MONEY_BF');
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
      var tier = getTier(product, item.quantity);
      var stock = typeof product.stock_quantity === 'number' ? product.stock_quantity : null;
      return '<article class="commerce-item">' +
        '<img src="' + (product.image_url || item.image_url || '') + '" alt="">' +
        '<div>' +
          '<strong>' + escapeHtml(product.name || item.name) + '</strong>' +
          '<span>' + escapeHtml(item.variant || 'Standard') + '</span>' +
          '<small>' + formatFcfa(tier.unit || 0) + ' F CFA / unité' + (stock !== null ? ' · stock ' + stock : '') + '</small>' +
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

  function checkoutPayload(operator) {
    var data = new FormData(ui.form);
    return {
      operator: operator,
      customer: {
        name: String(data.get('name') || '').trim(),
        phone: String(data.get('phone') || '').trim(),
        area: String(data.get('area') || '').trim() || 'Ouagadougou'
      },
      items: cart.map(function (item) {
        return {
          product_key: item.product_key,
          quantity: Number(item.quantity || 1),
          variant: item.variant || ''
        };
      })
    };
  }

  function validateCheckout() {
    if (!cart.length) throw new Error('Ajoutez au moins un produit au panier.');
    if (!ui.form.checkValidity()) {
      ui.form.reportValidity();
      throw new Error('');
    }
    if (!configReady()) {
      throw new Error('Configuration Supabase manquante : renseignez DERRA_COMMERCE_CONFIG avant de payer.');
    }
  }

  function setPaying(paying) {
    if (!ui.form) return;
    ui.form.querySelectorAll('button, input').forEach(function (el) { el.disabled = paying; });
    ui.form.classList.toggle('is-loading', paying);
  }

  function startCheckout(operator) {
    var payload;
    try {
      validateCheckout();
      payload = checkoutPayload(operator);
    } catch (err) {
      if (err.message) setNotice(err.message, true);
      return;
    }
    setNotice('Préparation du paiement CinetPay...', false);
    setPaying(true);
    productsReady
      .then(function () {
        return edgeFetch('/create-checkout', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      })
      .then(function (checkout) {
        return openCinetPay(checkout, payload.customer, operator);
      })
      .catch(function (err) {
        setNotice(err.message || 'Paiement impossible pour le moment.', true);
        setPaying(false);
      });
  }

  function loadCinetPaySdk() {
    if (window.CinetPay) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-cinetpay-sdk]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      var script = document.createElement('script');
      script.src = 'https://checkout.cinetpay.com/seamless/main.js';
      script.async = true;
      script.setAttribute('data-cinetpay-sdk', '1');
      script.onload = resolve;
      script.onerror = function () { reject(new Error('Le SDK CinetPay ne répond pas.')); };
      document.head.appendChild(script);
    });
  }

  function splitName(fullName) {
    var parts = String(fullName || 'Client Derra').trim().split(/\s+/);
    return {
      first: parts.shift() || 'Client',
      last: parts.join(' ') || 'Derra'
    };
  }

  function cleanPhone(phone) {
    return String(phone || '').replace(/[^\d+]/g, '');
  }

  function openCinetPay(checkout, customer, operator) {
    return loadCinetPaySdk().then(function () {
      if (!window.CinetPay) throw new Error('SDK CinetPay indisponible.');
      var cinetpay = checkout.cinetpay || {};
      var order = checkout.order || {};
      var names = splitName(customer.name);
      window.CinetPay.setConfig({
        apikey: cinetpay.apiKey,
        site_id: cinetpay.siteId,
        notify_url: cinetpay.notifyUrl,
        mode: cinetpay.mode || CONFIG.cinetpayMode
      });
      window.CinetPay.getCheckout({
        transaction_id: order.transaction_id,
        amount: order.amount,
        currency: order.currency || CONFIG.currency,
        channels: 'MOBILE_MONEY',
        description: 'Commande Derra Global Trading - ' + operatorLabel(operator),
        customer_name: names.first,
        customer_surname: names.last,
        customer_email: 'client+' + order.transaction_id + '@derra.local',
        customer_phone_number: cleanPhone(customer.phone),
        customer_address: customer.area || 'Ouagadougou',
        customer_city: 'Ouagadougou',
        customer_country: 'BF',
        customer_state: 'BF',
        customer_zip_code: '0000',
        metadata: JSON.stringify({ order_id: order.id, operator: operator })
      });
      window.CinetPay.waitResponse(function (response) {
        if (isAccepted(response && response.status)) {
          confirmPayment(checkout, response, customer, operator);
        } else {
          setPaying(false);
          setNotice('Paiement non validé : ' + ((response && response.message) || 'transaction annulée ou refusée.'), true);
        }
      });
      window.CinetPay.onError(function (error) {
        setPaying(false);
        setNotice((error && error.message) || 'Erreur CinetPay.', true);
      });
    });
  }

  function isAccepted(status) {
    return String(status || '').toUpperCase() === 'ACCEPTED';
  }

  function operatorLabel(operator) {
    return operator === 'MOOV_MONEY_BF' ? 'Moov Money Burkina Faso' : 'Orange Money Burkina Faso';
  }

  function confirmPayment(checkout, response, customer, operator) {
    setNotice('Paiement reçu, vérification CinetPay et mise à jour du stock...', false);
    return edgeFetch('/confirm-payment', {
      method: 'POST',
      body: JSON.stringify({
        order_id: checkout.order.id,
        transaction_id: checkout.order.transaction_id,
        cinetpay_response: response
      })
    })
      .then(function (result) {
        if (!result.ok) {
          throw new Error(result.message || 'Paiement en attente de confirmation CinetPay.');
        }
        setPaying(false);
        showReceipt(result.order || checkout.order, response, customer, operator);
        cart = [];
        saveCart();
        return fetchProducts();
      })
      .catch(function (err) {
        setPaying(false);
        setNotice(err.message || 'Paiement reçu, mais validation serveur en attente.', true);
      });
  }

  function showReceipt(order, response, customer, operator) {
    if (!ui.receipt) return;
    var items = (order.items || cart).map(function (item) {
      var product = PRODUCTS[item.product_key] || item;
      return '<li>' + escapeHtml(product.name || item.name) + ' · ' +
        escapeHtml(item.variant || 'Standard') + ' × ' + (item.quantity || 1) + '</li>';
    }).join('');
    ui.receipt.innerHTML =
      '<div class="commerce-receipt__card">' +
        '<p class="commerce-receipt__ok">Paiement validé</p>' +
        '<h2>Reçu à présenter à Janvier</h2>' +
        '<dl>' +
          '<div><dt>Commande</dt><dd>' + escapeHtml(order.order_code || order.id || '') + '</dd></div>' +
          '<div><dt>Transaction CinetPay</dt><dd>' + escapeHtml(order.transaction_id || (response && response.transaction_id) || '') + '</dd></div>' +
          '<div><dt>Client</dt><dd>' + escapeHtml(customer.name) + ' · ' + escapeHtml(customer.phone) + '</dd></div>' +
          '<div><dt>Paiement</dt><dd>' + operatorLabel(operator) + '</dd></div>' +
          '<div><dt>Montant</dt><dd>' + formatFcfa(order.amount || cartTotal()) + ' F CFA</dd></div>' +
        '</dl>' +
        '<ul>' + items + '</ul>' +
        '<strong class="commerce-receipt__show">Montrez cet écran vert à Janvier pour récupérer la commande.</strong>' +
        '<div class="commerce-receipt__actions">' +
          '<button type="button" onclick="window.print()">Imprimer</button>' +
          '<button type="button" data-receipt-close>Fermer</button>' +
        '</div>' +
      '</div>';
    ui.receipt.hidden = false;
    closeCart();
    ui.receipt.querySelector('[data-receipt-close]').addEventListener('click', function () {
      ui.receipt.hidden = true;
    });
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
      if (!product) return;
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
