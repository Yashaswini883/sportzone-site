/* ══════════════════════════════════════════════
   NOTE ON CREDENTIALS
   ══════════════════════════════════════════════
   No client ID, client secret, or OAuth token belongs here. The
   Salesforce Interactions Web SDK (loaded via the <script> tag in
   <head>, scoped to connector "SportZone_Website") authenticates and
   batches/delivers events on its own. There is no server-side proxy
   to call either — that pattern (server.js + /api/token) is only
   needed if you're using the raw Ingestion API, which this page no
   longer does. */

/* ══════════════════════════════════════════════
   CONSENT
   The Web SDK will not collect or send ANY data until it receives an
   Opt In consent decision. We default this demo to Opt In so the
   live event log has something to show, but the toggle in the banner
   calls the real updateConsents() API so you can see opt-out behavior
   too — flip it and watch the event log go quiet.
   ══════════════════════════════════════════════ */
const CONSENT_PROVIDER = 'SportZone_ConsentBanner';

function buildConsent(optedIn) {
  return [{
    provider : CONSENT_PROVIDER,
    purpose  : SalesforceInteractions.ConsentPurpose.Tracking,
    status   : optedIn ? SalesforceInteractions.ConsentStatus.OptIn
                        : SalesforceInteractions.ConsentStatus.OptOut
  }];
}

const ConsentUI = (() => {
  let optedIn = true;
  function toggle() {
    optedIn = !optedIn;
    SalesforceInteractions.updateConsents(buildConsent(optedIn));
    const btn = document.getElementById('consent-toggle');
    btn.textContent = 'Tracking: ' + (optedIn ? 'Opt-In' : 'Opt-Out');
    btn.classList.toggle('opted-out', !optedIn);
  }
  return { toggle };
})();

/* ══════════════════════════════════════════════
   SDK STATUS + EVENT LIFECYCLE HOOKS
   These are real SalesforceInteractions CustomEvents, not simulated —
   they fire from inside the SDK itself.
   ══════════════════════════════════════════════ */
function _setStatus(ok, label) {
  const dot = document.getElementById('dc-dot');
  const txt = document.getElementById('dc-status-text');
  if (dot) dot.className = 'dc-dot ' + (ok ? 'connected' : 'error');
  if (txt) txt.textContent = label;
}

document.addEventListener('salesforce:OnInit', () => {
  _setStatus(true, 'Connected — Web SDK initialized');
});
document.addEventListener('salesforce:OnError', (e) => {
  console.error('SalesforceInteractions error:', e.detail);
  _setStatus(false, 'SDK error — check console');
});
document.addEventListener('salesforce:OnConsentRevoke', () => {
  _setStatus(true, 'Opted out — tracking paused');
});

/* ══════════════════════════════════════════════
   INITIALIZE THE SDK
   init() resolves once consent is recorded; only then is it safe to
   call sendEvent(). We boot the rest of the page from inside .then().
   ══════════════════════════════════════════════ */
SalesforceInteractions.init({
  consents: buildConsent(true)
}).then(() => {
  SalesforceInteractions.setLoggingLevel('debug'); // verbose console output for this demo; drop to 'error' or 'none' in production
  boot();
}).catch((err) => {
  console.error('SalesforceInteractions.init failed:', err);
  _setStatus(false, 'SDK failed to initialize');
});

/* ══════════════════════════════════════════════
   PRODUCT CATALOG
   ══════════════════════════════════════════════ */
const CATALOG = [
  {id:'P001', name:'Nike Air Zoom Pegasus',  price:8999,  category:'Running Shoes', brand:'Nike',       emoji:'👟'},
  {id:'P002', name:'Adidas Ultraboost 22',   price:12499, category:'Running Shoes', brand:'Adidas',     emoji:'🏃'},
  {id:'P003', name:'Saucony Ride 15',        price:7499,  category:'Running Shoes', brand:'Saucony',    emoji:'👟'},
  {id:'P004', name:'Brooks Ghost 14',        price:9499,  category:'Running Shoes', brand:'Brooks',     emoji:'🏃'},
  {id:'P005', name:'Garmin Forerunner 255',  price:24999, category:'Wearables',     brand:'Garmin',     emoji:'⌚'},
  {id:'P006', name:'Apple Watch Series 9',   price:34999, category:'Wearables',     brand:'Apple',      emoji:'⌚'},
  {id:'P007', name:'Fitbit Charge 6',        price:12999, category:'Wearables',     brand:'Fitbit',     emoji:'📟'},
  {id:'P008', name:'Resistance Band Set',    price:1499,  category:'Fitness Gear',  brand:'Decathlon',  emoji:'💪'},
  {id:'P009', name:'Foam Roller Pro',        price:2299,  category:'Fitness Gear',  brand:'Decathlon',  emoji:'🔵'},
  {id:'P010', name:'Hydration Running Vest', price:3999,  category:'Fitness Gear',  brand:'Decathlon',  emoji:'🎽'},
  {id:'P011', name:'New Balance Fresh Foam', price:8499,  category:'Casual Shoes',  brand:'New Balance',emoji:'👞'},
  {id:'P012', name:'Adidas Stan Smith',      price:4999,  category:'Casual Shoes',  brand:'Adidas',     emoji:'👟'},
];

/* ══════════════════════════════════════════════
   DATA CLOUD EVENT TRACKER
   Routes each event to the correct DMO stream
   ══════════════════════════════════════════════ */
const DataCloud = (() => {
  const profile = { categoryClicks:{}, browsedIds:[], cart:[] };
  const MAX_LOG = 7;

  function send(eventType, payload) {
    _updateProfile(eventType, payload);
    Personalization.refresh();

    if (eventType === 'PRODUCT_VIEW' || eventType === 'PRODUCT_CLICK') {
      // Standard Catalog Interaction -> lands in the Catalog DLO/DMO.
      // ViewCatalogObject = browsing the grid, ViewCatalogObjectDetail = drilling into a recommended item.
      SalesforceInteractions.sendEvent({
        interaction: {
          name: eventType === 'PRODUCT_CLICK'
            ? SalesforceInteractions.CatalogObjectInteractionName.ViewCatalogObjectDetail
            : SalesforceInteractions.CatalogObjectInteractionName.ViewCatalogObject,
          catalogObject: {
            id: String(payload.id || ''),
            type: 'Product',
            attributes: {
              name: payload.name || '',
              category: payload.category || '',
              price: payload.price || 0,
              brand: payload.brand || ''
            }
          }
        }
      });
    }
    else if (eventType === 'ADD_TO_CART' || eventType === 'REMOVE_FROM_CART') {
      // Standard Cart Interaction -> lands in the Cart / Cart Item DLOs/DMOs.
      SalesforceInteractions.sendEvent({
        interaction: {
          name: eventType === 'ADD_TO_CART'
            ? SalesforceInteractions.CartInteractionName.AddToCart
            : SalesforceInteractions.CartInteractionName.RemoveFromCart,
          lineItem: {
            catalogObjectType: 'Product',
            catalogObjectId: String(payload.id || ''),
            quantity: 1,
            price: payload.price || 0,
            currency: 'INR',
            attributes: {
              name: payload.name || '',
              category: payload.category || '',
              brand: payload.brand || ''
            }
          }
        }
      });
    }
    else if (eventType === 'PAGE_VIEW') {
      // No sitemap pageTypes are configured on this demo page, so we dispatch a
      // custom interaction directly. eventType must be a valid identifier (no
      // spaces) so we set it explicitly — "name" stays human-readable for the
      // console/log, "eventType" is what actually becomes the DLO field.
      SalesforceInteractions.sendEvent({
        interaction: {
          name: 'View Page',
          eventType: 'viewPage',
          pageUrl: payload.pageUrl || window.location.href,
          pageName: payload.pageName || 'SportZone Home',
          pageType: payload.pageType || 'home',
          referrerUrl: document.referrer || ''
        }
      });
    }
    else {
      // AGENT_QUERY and anything else — sent as a lightweight custom interaction.
      SalesforceInteractions.sendEvent({
        interaction: {
          name: 'Agent Query',
          eventType: 'agentQuery',
          message: payload.message || ''
        }
      });
    }

    _log(eventType, payload, 'ok', false);
  }

  function _updateProfile(eventType, payload) {
    if (eventType === 'PRODUCT_VIEW' || eventType === 'PRODUCT_CLICK') {
      profile.categoryClicks[payload.category] = (profile.categoryClicks[payload.category] || 0) + 1;
      if (!profile.browsedIds.includes(payload.id)) profile.browsedIds.push(payload.id);
    }
    if (eventType === 'ADD_TO_CART') {
      profile.categoryClicks[payload.category] = (profile.categoryClicks[payload.category] || 0) + 2;
      if (!profile.cart.find(p => p.id === payload.id)) profile.cart.push(payload);
    }
    if (eventType === 'REMOVE_FROM_CART') {
      profile.cart = profile.cart.filter(p => p.id !== payload.id);
    }
    if (eventType === 'ADD_TO_CART' || eventType === 'REMOVE_FROM_CART') {
      const badge = document.getElementById('cart-badge');
      if (badge) badge.textContent = profile.cart.length;
    }
  }

  function _log(eventType, payload, status, replace) {
    const el = document.getElementById('log-lines');
    if (!el) return;
    const label = payload.name || payload.category || payload.query || payload.message || payload.pageName || payload.email || '';
    const s = status === 'ok'      ? '<span class="log-status-ok"> ✓</span>'
            : status === 'err'     ? '<span class="log-status-err"> ✗</span>'
            :                        '<span class="log-status-pending"> ⟳</span>';
    if (replace && el.firstChild) {
      const sp = el.firstChild.querySelector('.log-status-ok,.log-status-err,.log-status-pending');
      if (sp) { sp.outerHTML = s; return; }
    }
    const line = document.createElement('div');
    line.className = 'log-line';
    line.innerHTML = '<span class="log-type">' + eventType + '</span> · ' + label + s;
    el.insertBefore(line, el.firstChild);
    while (el.children.length > MAX_LOG) el.removeChild(el.lastChild);
  }

  return { send, profile, _log };
})();

/* ══════════════════════════════════════════════
   SHOPPER IDENTITY
   Demonstrates the Profile-category events: Identity,
   Contact Point Email, and Party Identification. These are
   what let Identity Resolution stitch the anonymous deviceId
   that's been browsing to a real, known shopper.
   ══════════════════════════════════════════════ */
const ShopperIdentity = (() => {
  let known = null;

  function open()  { document.getElementById('signin-overlay').classList.add('open'); }
  function close() { document.getElementById('signin-overlay').classList.remove('open'); }

  function submit() {
    const firstName = document.getElementById('si-first').value.trim() || 'Guest';
    const lastName  = document.getElementById('si-last').value.trim();
    const email     = document.getElementById('si-email').value.trim();
    const loyalty   = document.getElementById('si-loyalty').value.trim() ||
                       ('SZ' + Math.floor(Math.random() * 900000 + 100000));

    if (!email) { alert('Email is required to sign in.'); return; }

    // 1. Identity profile event
    SalesforceInteractions.sendEvent({
      user: { attributes: { eventType: 'identity', firstName, lastName } }
    });
    // 2. Contact Point Email profile event
    SalesforceInteractions.sendEvent({
      user: { attributes: { eventType: 'contactPointEmail', email } }
    });
    // 3. Party Identification profile event — the deterministic anchor for Identity Resolution
    SalesforceInteractions.sendEvent({
      user: { attributes: {
        eventType : 'partyIdentification',
        IDName    : 'Web ID',
        IDType    : 'Loyalty Number',
        userId    : loyalty
      } }
    });

    known = { firstName, lastName, email, loyalty };
    const chip = document.getElementById('signed-in-chip');
    chip.textContent = '✓ ' + firstName + ' · ' + loyalty;
    chip.style.display = 'inline-block';
    document.getElementById('signin-btn').textContent = '👤 ' + firstName;

    DataCloud._log('IDENTITY', { name: firstName }, 'ok', false);
    DataCloud._log('CONTACT_POINT_EMAIL', { email }, 'ok', false);
    DataCloud._log('PARTY_IDENTIFICATION', { name: loyalty }, 'ok', false);

    close();
    showToast('Signed in — profile linked in Data Cloud');
  }

  return { open, close, submit, get known() { return known; } };
})();

/* ══════════════════════════════════════════════
   CART DRAWER + CHECKOUT
   Checkout fires the standard Order interaction (Purchase),
   then a ReplaceCart with an empty array to signal the cart
   is now empty — both standard SDK interaction specs.
   ══════════════════════════════════════════════ */
const CartUI = (() => {
  function open() {
    render();
    document.getElementById('cart-overlay').classList.add('open');
  }
  function close() { document.getElementById('cart-overlay').classList.remove('open'); }

  function render() {
    const cart = DataCloud.profile.cart;
    const itemsEl = document.getElementById('cart-drawer-items');
    const totalEl = document.getElementById('cart-drawer-total');
    const btn = document.getElementById('checkout-btn');
    if (!cart.length) {
      itemsEl.innerHTML = '<div style="font-size:12px;color:#888780">Your cart is empty.</div>';
      totalEl.style.display = 'none';
      btn.disabled = true;
      return;
    }
    const total = cart.reduce((s, p) => s + p.price, 0);
    itemsEl.innerHTML = cart.map(p =>
      '<div class="cart-drawer-item"><span class="ci-name">' + p.name + '</span><span class="ci-price">₹' + p.price.toLocaleString() + '</span></div>'
    ).join('');
    totalEl.style.display = 'flex';
    totalEl.innerHTML = '<span>Total</span><span>₹' + total.toLocaleString() + '</span>';
    btn.disabled = false;
  }

  function checkout() {
    const cart = DataCloud.profile.cart;
    if (!cart.length) return;
    const orderId = 'ORD' + Date.now();
    const total = cart.reduce((s, p) => s + p.price, 0);

    // Standard Order Interaction -> Order / Order Item DMOs
    SalesforceInteractions.sendEvent({
      interaction: {
        name: SalesforceInteractions.OrderInteractionName.Purchase,
        order: {
          id: orderId,
          totalValue: total,
          currency: 'INR',
          lineItems: cart.map(p => ({
            catalogObjectType: 'Product',
            catalogObjectId: String(p.id),
            quantity: 1,
            price: p.price,
            currency: 'INR',
            attributes: { name: p.name, category: p.category, brand: p.brand }
          }))
        }
      }
    });
    // Standard Cart Interaction -> signal the cart is now empty
    SalesforceInteractions.sendEvent({
      interaction: {
        name: SalesforceInteractions.CartInteractionName.ReplaceCart,
        lineItems: []
      }
    });

    DataCloud._log('CHECKOUT', { name: orderId }, 'ok', false);
    DataCloud.profile.cart = [];
    document.getElementById('cart-badge').textContent = '0';
    close();
    showToast('Order placed — ' + orderId);
    Personalization.refresh();
  }

  return { open, close, checkout };
})();

/* ══════════════════════════════════════════════
   PERSONALIZATION ENGINE
   ══════════════════════════════════════════════ */
const Personalization = (() => {
  function getRecs() {
    const { categoryClicks, browsedIds } = DataCloud.profile;
    const topCats = Object.entries(categoryClicks).sort((a,b) => b[1]-a[1]).map(e => e[0]);
    if (!topCats.length) return CATALOG.filter(p => p.category === 'Running Shoes').slice(0,4);
    let pool = [];
    for (const cat of topCats) pool = [...pool, ...CATALOG.filter(p => p.category === cat && !browsedIds.includes(p.id))];
    if (pool.length < 4) pool = [...pool, ...CATALOG.filter(p => !pool.find(x => x.id === p.id))];
    return pool.slice(0,4);
  }
  function reason(p) {
    const n = DataCloud.profile.categoryClicks[p.category];
    return n >= 3 ? 'Based on your ' + p.category + ' interest' : n >= 1 ? 'You browsed ' + p.category : 'Trending this week';
  }
  function refresh() {
    const slot = document.getElementById('sf-reco-slot');
    if (!slot) return;
    const recs = getRecs();
    const active = Object.keys(DataCloud.profile.categoryClicks).length > 0;
    slot.innerHTML =
      '<div class="sf-injected-label"><span class="badge">DATA CLOUD</span><span class="title">✦ Recommended for you</span>' +
      '<span style="font-size:11px;color:#888780;margin-left:6px">' + (active ? '· from your activity' : '· trending picks') + '</span></div>' +
      '<div class="sf-reco-strip">' + recs.map(p =>
        '<div class="sf-reco-card" onclick="DataCloud.send(\'PRODUCT_CLICK\',{id:\'' + p.id + '\',name:\'' + p.name.replace(/'/g,"\\'") + '\',category:\'' + p.category + '\',price:' + p.price + ',brand:\'' + p.brand + '\'})">' +
        '<span class="emoji">' + p.emoji + '</span><div class="name">' + p.name + '</div>' +
        '<div class="price">₹' + p.price.toLocaleString() + '</div>' +
        '<div class="reason">' + reason(p) + '</div></div>'
      ).join('') + '</div>';
  }
  return { refresh };
})();

/* ══════════════════════════════════════════════
   AGENTFORCE SHOPPER AGENT
   ══════════════════════════════════════════════ */
const SFAgent = (() => {
  let open = false;
  function show() {
    open = true;
    document.getElementById('sf-agent-panel').classList.add('open');
    if (!document.getElementById('agent-messages').children.length)
      _msg('agent', "Hi! I'm your Shopper Agent. I can see your browsing history and cart. Ask me anything!");
  }
  function hide()   { open = false; document.getElementById('sf-agent-panel').classList.remove('open'); }
  function toggle() { open ? hide() : show(); }

  function _msg(role, text) {
    const d = document.createElement('div');
    d.className = 'msg msg-' + role;
    d.textContent = text;
    const m = document.getElementById('agent-messages');
    m.appendChild(d); m.scrollTop = m.scrollHeight;
  }
  function _typing() {
    const d = document.createElement('div');
    d.className = 'msg msg-agent msg-typing'; d.id = 'typing';
    d.innerHTML = '<span></span><span></span><span></span>';
    const m = document.getElementById('agent-messages');
    m.appendChild(d); m.scrollTop = 9999; return d;
  }
  function _reply(text) {
    const msg = text.toLowerCase();
    const { categoryClicks, cart } = DataCloud.profile;
    const top = Object.entries(categoryClicks).sort((a,b) => b[1]-a[1])[0]?.[0] || null;
    if (msg.includes('browsing') || msg.includes('activity')) {
      return top ? 'Your activity: ' + Object.entries(categoryClicks).map(([c,n]) => c + ' (' + n + ' events)').join(', ') + '.'
                 : "You haven't browsed anything yet — explore some products!";
    }
    if (msg.includes('cart')) {
      return cart.length ? 'Cart: ' + cart.map(p => p.name).join(', ') + '. Total ₹' + cart.reduce((s,p)=>s+p.price,0).toLocaleString() + '.'
                         : 'Your cart is empty. Want suggestions?';
    }
    if (msg.includes('running') || msg.includes('marathon')) {
      let r = CATALOG.filter(p => p.category === 'Running Shoes');
      const b = text.match(/(\d{4,5})/);
      if (b) r = r.filter(p => p.price <= +b[1]);
      return r.length ? 'Running picks: ' + r.slice(0,3).map(p => p.name + ' (₹' + p.price.toLocaleString() + ')').join(', ') + '.' : 'No running shoes in that budget.';
    }
    if (msg.includes('fitness') || msg.includes('workout')) {
      return 'Fitness picks: ' + CATALOG.filter(p => ['Wearables','Fitness Gear'].includes(p.category)).slice(0,3).map(p => p.name + ' (₹' + p.price.toLocaleString() + ')').join(', ') + '.';
    }
    if (msg.includes('wearable') || msg.includes('watch') || msg.includes('tracker')) {
      return 'Wearables: ' + CATALOG.filter(p => p.category === 'Wearables').map(p => p.name + ' (₹' + p.price.toLocaleString() + ')').join(', ') + '.';
    }
    if (top) return 'Based on your interest in ' + top + ': ' + CATALOG.filter(p => p.category === top).slice(0,2).map(p => p.name).join(', ') + '.';
    return "Tell me what you need — running shoes, wearables, fitness gear, or a budget — and I'll help!";
  }
  function send(text) {
    const inp = document.getElementById('agent-input');
    const m   = text || (inp ? inp.value.trim() : '');
    if (!m) return;
    if (!open) show();
    _msg('user', m);
    if (inp) inp.value = '';
    DataCloud.send('AGENT_QUERY', { message: m });
    const t = _typing();
    setTimeout(() => { t.remove(); _msg('agent', _reply(m)); }, 600);
  }
  return { open: show, close: hide, toggle, send };
})();

/* ══════════════════════════════════════════════
   PRODUCT GRID + TOAST + BOOT
   ══════════════════════════════════════════════ */
function renderProductGrid() {
  document.getElementById('product-grid').innerHTML = CATALOG.map(p =>
    '<div class="existing-product-card" onclick="DataCloud.send(\'PRODUCT_VIEW\',{id:\'' + p.id + '\',name:\'' + p.name.replace(/'/g,"\\'") + '\',category:\'' + p.category + '\',price:' + p.price + ',brand:\'' + p.brand + '\'})">' +
    '<span class="prod-emoji">' + p.emoji + '</span>' +
    '<div class="prod-name">' + p.name + '</div>' +
    '<div class="prod-cat">' + p.category + '</div>' +
    '<div class="prod-price">₹' + p.price.toLocaleString() + '</div>' +
    '<button class="btn-atc" onclick="event.stopPropagation();DataCloud.send(\'ADD_TO_CART\',{id:\'' + p.id + '\',name:\'' + p.name.replace(/'/g,"\\'") + '\',category:\'' + p.category + '\',price:' + p.price + ',brand:\'' + p.brand + '\'});showToast(\'Added to cart\')">+ Add to cart</button>' +
    '</div>'
  ).join('');
}

let _toastTimer;
function showToast(msg) {
  const t = document.getElementById('sf-toast');
  t.textContent = '⚡ ' + msg; t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

// Boot — called from SalesforceInteractions.init().then() once consent is recorded
function boot() {
  renderProductGrid();
  Personalization.refresh();

  // Fire page view
  DataCloud.send('PAGE_VIEW', {
    pageUrl: window.location.href, pageName: 'SportZone Home',
    pageType: 'home', objectType: 'Page'
  });
}
