/* ══════════════════════════════════════════════
   IDENTITY HELPERS
   ══════════════════════════════════════════════ */
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
function getCookieId() {
  let id = localStorage.getItem('sz_cookie');
  if (!id) { id = 'cookie_' + uuid(); localStorage.setItem('sz_cookie', id); }
  return id;
}
function getSessionId() {
  let id = sessionStorage.getItem('sz_session');
  if (!id) { id = 'sess_' + uuid(); sessionStorage.setItem('sz_session', id); }
  return id;
}

const SESSION_ID    = getSessionId();
const COOKIE_ID     = getCookieId();
const USER_ID       = 'user_' + COOKIE_ID.slice(-8);
const SESSION_START = new Date().toISOString();

/* ══════════════════════════════════════════════
   OAUTH TOKEN MANAGER
   ══════════════════════════════════════════════ */
const TokenManager = (() => {
  let _token = null;
  let _expiry = 0;

  async function getToken() {
    if (_token && Date.now() < _expiry) return _token;
    try {
      const body = new URLSearchParams({
        grant_type    : 'client_credentials',
        client_id     : DC_CONFIG.clientId,
        client_secret : DC_CONFIG.clientSecret
      });
      const res = await fetch(DC_CONFIG.loginUrl + '/services/oauth2/token', {
        method  : 'POST',
        headers : { 'Content-Type': 'application/x-www-form-urlencoded' },
        body    : body.toString()
      });
      if (!res.ok) throw new Error('Token ' + res.status);
      const d = await res.json();
      _token  = d.access_token;
      _expiry = Date.now() + ((d.expires_in || 3600) * 1000) - 60000;
      _setStatus(true);
      return _token;
    } catch(e) {
      console.error('OAuth error:', e);
      _setStatus(false);
      return null;
    }
  }

  function _setStatus(ok) {
    const dot  = document.getElementById('dc-dot');
    const txt  = document.getElementById('dc-status-text');
    if (dot) dot.className = 'dc-dot ' + (ok ? 'connected' : 'error');
    if (txt) txt.textContent = ok ? 'Connected to Data Cloud' : 'Auth failed — check credentials';
  }

  return { getToken };
})();

/* ══════════════════════════════════════════════
   INGESTION API
   ══════════════════════════════════════════════ */
const IngestionAPI = (() => {
  function endpoint(stream) {
    return DC_CONFIG.tenantEndpoint + '/api/v1/ingest/sources/' + DC_CONFIG.connectorName + '/' + stream;
  }

  async function post(stream, record) {
    const token = await TokenManager.getToken();
    if (!token) return false;
    try {
      const res = await fetch(endpoint(stream), {
        method  : 'POST',
        headers : { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body    : JSON.stringify({ data: [record] })
      });
      const ok = res.status === 202;
      console.log((ok ? 'DC OK' : 'DC ERR') + ' [' + stream + ']', record);
      return ok;
    } catch(e) {
      console.error('DC network error:', e);
      return false;
    }
  }

  return { post };
})();

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
   ══════════════════════════════════════════════ */
const DataCloud = (() => {
  const profile = { categoryClicks:{}, browsedIds:[], cart:[] };
  const MAX_LOG = 7;

  async function send(eventType, payload) {
    _updateProfile(eventType, payload);
    Personalization.refresh();
    _log(eventType, payload, 'pending');

    let stream = null;
    let record = null;

    if (eventType === 'PRODUCT_VIEW' || eventType === 'PRODUCT_CLICK' || eventType === 'SEARCH_QUERY') {
      stream = DC_CONFIG.streams.browse;
      record = {
        ssot__Id__c                       : uuid(),
        ssot__EngagementDateTm__c         : new Date().toISOString(),
        ssot__SessionId__c                : SESSION_ID,
        ssot__IndividualId__c             : USER_ID,
        ssot__WebCookieId__c              : COOKIE_ID,
        ssot__ProductId__c                : String(payload.id   || ''),
        ssot__Name__c                     : payload.name         || '',
        ssot__ProductCategoryName__c      : payload.category     || '',
        ssot__ProductPriceAmount__c       : payload.price        || 0,
        ssot__ProductBrandName__c         : payload.brand        || '',
        ssot__ProductViewURL__c           : 'https://sportzone.demo/products/' + payload.id,
        ssot__KeywordSearch__c            : payload.query        || '',
        ssot__EngagementChannelActionId__c: eventType
      };
    }
    else if (eventType === 'ADD_TO_CART' || eventType === 'REMOVE_FROM_CART') {
      stream = DC_CONFIG.streams.cart;
      const cartTotal = profile.cart.reduce((s, p) => s + p.price, 0);
      record = {
        ssot__Id__c                          : uuid(),
        ssot__ShoppingCartEngagementId__c    : SESSION_ID,
        ssot__ProductId__c                   : String(payload.id   || ''),
        ssot__ShoppingCartProductItemName__c : payload.name         || '',
        ssot__ProductCategoryName__c         : payload.category     || '',
        ssot__ProductPrice__c                : payload.price        || 0,
        ssot__ProductBrandName__c            : payload.brand        || '',
        ssot__ProductQuantity__c             : 1,
        ssot__AdjustedTotalProductAmount__c  : cartTotal,
        ssot__ProductViewURL__c              : 'https://sportzone.demo/products/' + payload.id,
        ssot__EngagementChannelActionId__c   : eventType
      };
    }
    else if (eventType === 'PAGE_VIEW') {
      stream = DC_CONFIG.streams.session;
      record = {
        ssot__Id__c                       : uuid(),
        ssot__EngagementDateTm__c         : new Date().toISOString(),
        ssot__SessionId__c                : SESSION_ID,
        ssot__WebSessionId__c             : SESSION_ID,
        ssot__IndividualId__c             : USER_ID,
        ssot__WebCookieId__c              : COOKIE_ID,
        ssot__PageURL__c                  : payload.pageUrl  || window.location.href,
        ssot__PageName__c                 : payload.pageName || 'SportZone Home',
        ssot__WebpageType__c              : payload.pageType || 'home',
        ssot__VisitStartTm__c             : SESSION_START,
        ssot__VisitEndTm__c               : new Date().toISOString(),
        ssot__ReferrerURL__c              : document.referrer || '',
        ssot__DeviceTypeTxt__c            : /Mobi/.test(navigator.userAgent) ? 'mobile' : 'desktop',
        ssot__BrowserName__c              : navigator.userAgent.includes('Chrome')  ? 'Chrome'  :
                                            navigator.userAgent.includes('Firefox') ? 'Firefox' :
                                            navigator.userAgent.includes('Safari')  ? 'Safari'  : 'Other',
        ssot__DomainName__c               : 'sportzone.demo',
        ssot__WebsiteCatalogCategoryId__c : payload.categoryId || '',
        ssot__WebsiteCatalogObjectId__c   : payload.productId  || '',
        ssot__WebsiteCatalogObjectType__c : payload.objectType || 'Page',
        ssot__IsPageView__c               : 'true',
        ssot__EngmtChannelActionStatus__c : 'Success'
      };
    }
    else {
      _log(eventType, payload, 'ok', true);
      return;
    }

    const ok = await IngestionAPI.post(stream, record);
    _log(eventType, payload, ok ? 'ok' : 'err', true);
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
  }

  function _log(eventType, payload, status, replace) {
    const el = document.getElementById('log-lines');
    if (!el) return;
    const label = payload.name || payload.category || payload.query || payload.message || payload.pageName || '';
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

  return { send, profile };
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

// Boot
renderProductGrid();
Personalization.refresh();
TokenManager.getToken();

DataCloud.send('PAGE_VIEW', {
  pageUrl: window.location.href, pageName: 'SportZone Home',
  pageType: 'home', objectType: 'Page'
});
