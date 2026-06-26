/* ══════════════════════════════════════════════
   IDENTITY HELPERS
   (kept for the on-page demo log only — the real
   Data Cloud identity resolution is now handled by
   the beacon script tag in index.html)
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
   ON-SCREEN ACTIVITY TRACKER
   This drives the recommendations, the chatbot, and
   the little "live event" panel in the corner.
   It does NOT call any external API — the real
   Data Cloud event capture now happens automatically
   via the beacon script tag (no secrets needed).
   ══════════════════════════════════════════════ */
const DataCloud = (() => {
  const profile = { categoryClicks:{}, browsedIds:[], cart:[] };
  const MAX_LOG = 7;

  function send(eventType, payload) {
    _updateProfile(eventType, payload);
    Personalization.refresh();
    _log(eventType, payload);
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

  function _log(eventType, payload) {
    const el = document.getElementById('log-lines');
    if (!el) return;
    const label = payload.name || payload.category || payload.query || payload.message || payload.pageName || '';
    const line = document.createElement('div');
    line.className = 'log-line';
    line.innerHTML = '<span class="log-type">' + eventType + '</span> · ' + label + '<span class="log-status-ok"> ✓</span>';
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

// Mark the status banner as connected (the real connection is now the beacon script)
(function() {
  const dot = document.getElementById('dc-dot');
  const txt = document.getElementById('dc-status-text');
  if (dot) dot.className = 'dc-dot connected';
  if (txt) txt.textContent = 'Connected to Data Cloud';
})();

DataCloud.send('PAGE_VIEW', { pageName: 'SportZone Home' });
