/* Craving — shake the phone, spin the wheels, stop arguing about dinner.
   Everything is stored on the phone (localStorage). The only thing that ever
   touches the network is the "Find nearby" button, which hands a search to
   Google Maps. */

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const pick = a => a[Math.floor(Math.random() * a.length)];
const DAY = 864e5;

/* ---------- storage ---------- */
const Store = {
  get(k, d) { try { const v = localStorage.getItem('craving.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('craving.' + k, JSON.stringify(v)); } catch {} },
};
const S = {
  tab: 'spin',
  mode: 'cuisine',                     // main wheel: 'cuisine' | 'places'
  places: Store.get('places', []),
  hist: Store.get('hist', []),
  set: Object.assign({ offC: [], onStyles: STYLES.filter(s => !s.off).map(s => s.id), avoid: 0, sound: true, buzz: true }, Store.get('set', {})),
  lock: { price: null, style: null },
  veto: new Set(),                     // "not feeling it" this session
  only: null,                          // quiz picks to spin between
  res: null,                           // last spin result
  quiz: {},
  placeQ: '', placeF: 'all',
};
const save = () => { Store.set('places', S.places); Store.set('hist', S.hist); Store.set('set', S.set); };

const cuisine = id => CUISINES.find(c => c.id === id);
const price = lvl => PRICES.find(p => p.lvl === lvl);
const style = id => STYLES.find(s => s.id === id);
const lastAte = id => { const h = S.hist.find(h => h.cuisine === id); return h ? new Date(h.at).getTime() : 0; };
const mapsUrl = q => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);

let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2400); }

/* ---------- sound & buzz ---------- */
let ac;
function audio() { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch {} return ac; }
function tick() {
  if (S.set.buzz) navigator.vibrate?.(6);
  if (!S.set.sound || !ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'square'; o.frequency.value = 1400;
  g.gain.setValueAtTime(.05, ac.currentTime); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + .03);
  o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + .035);
}
function ding() {
  if (S.set.buzz) navigator.vibrate?.([40, 60, 120]);
  if (!S.set.sound || !ac) return;
  [660, 880, 1320].forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * .09;
    o.frequency.value = f; g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + .35);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + .36); });
}

/* ---------- the wheel ---------- */
const COLORS = ['#e84a27', '#f2b134', '#2f9e8f', '#7b4bc4', '#e2739b', '#3c7dd9', '#f08a24', '#5aa64a'];
class Wheel {
  constructor(canvas, { ticks = false, labels = true } = {}) {
    this.c = canvas; this.ticks = ticks; this.labels = labels; this.items = []; this.rot = 0; this.busy = false;
  }
  setItems(items) { this.items = items; this.draw(); }
  segAt(rot) { const n = this.items.length, seg = 2 * Math.PI / n;
    /* Which segment is under the pointer at the top (-π/2). */
    let a = ((-Math.PI / 2 - rot) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); return Math.floor(a / seg) % n; }
  draw() {
    const c = this.c, w = c.clientWidth; if (!w) return;
    const dpr = window.devicePixelRatio || 1, px = Math.round(w * dpr);
    if (c.width !== px) { c.width = px; c.height = px; }
    const x = c.getContext('2d'), r = px / 2, n = this.items.length;
    x.clearRect(0, 0, px, px);
    if (!n) return;
    const seg = 2 * Math.PI / n;
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    for (let i = 0; i < n; i++) {
      const a0 = this.rot + i * seg, it = this.items[i];
      x.beginPath(); x.moveTo(r, r); x.arc(r, r, r - 4 * dpr, a0, a0 + seg); x.closePath();
      /* The last slice touches the first; if they'd share a colour, borrow another. */
      x.fillStyle = it.color || (i === n - 1 && n > 1 && i % COLORS.length === 0 ? COLORS[3] : COLORS[i % COLORS.length]);
      x.fill();
      x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1.5 * dpr; x.stroke();
      if (!this.labels) continue;
      /* Labels on the left half are turned the other way so none read upside down. */
      const mid = a0 + seg / 2, flip = Math.cos(mid) < 0;
      x.save(); x.translate(r, r); x.rotate(flip ? mid + Math.PI : mid);
      const fs = Math.max(9 * dpr, Math.min(17 * dpr, r * seg * 0.5));
      x.font = `700 ${fs}px system-ui, -apple-system, sans-serif`; x.textAlign = flip ? 'left' : 'right'; x.textBaseline = 'middle';
      x.fillStyle = '#fff'; x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 3 * dpr;
      let label = flip ? it.label + (it.emoji ? ' ' + it.emoji : '') : (it.emoji ? it.emoji + ' ' : '') + it.label;
      const maxW = r * 0.68;
      while (x.measureText(label).width > maxW && label.length > 4) label = label.slice(0, -2) + '…';
      x.fillText(label, flip ? -(r - 14 * dpr) : r - 14 * dpr, 0);
      x.restore();
    }
    /* hub */
    x.beginPath(); x.arc(r, r, r * 0.12, 0, 2 * Math.PI); x.fillStyle = dark ? '#22140f' : '#fff'; x.fill();
    x.lineWidth = 3 * dpr; x.strokeStyle = dark ? '#f6ebe3' : '#24140f'; x.stroke();
    x.beginPath(); x.arc(r, r, r - 2 * dpr, 0, 2 * Math.PI); x.lineWidth = 4 * dpr; x.strokeStyle = dark ? '#f6ebe3' : '#24140f'; x.stroke();
  }
  /* Spin so that segment i ends under the pointer. A random offset inside the
     segment stops it landing dead-centre every time, which looks rigged. */
  spinTo(i, ms, turns = 5) {
    const n = this.items.length, seg = 2 * Math.PI / n;
    const jitter = (Math.random() - .5) * seg * 0.7;
    const target = -Math.PI / 2 - (i + .5) * seg + jitter;
    const delta = ((target - this.rot) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) + turns * 2 * Math.PI;
    const start = this.rot, t0 = performance.now();
    this.busy = true;
    let lastSeg = this.segAt(start);
    return new Promise(done => {
      const step = now => {
        const t = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - t, 4);
        this.rot = start + delta * e; this.draw();
        if (this.ticks) { const s = this.segAt(this.rot); if (s !== lastSeg) { lastSeg = s; tick(); } }
        if (t < 1) requestAnimationFrame(step);
        else { this.rot %= 2 * Math.PI; this.busy = false; done(); }
      };
      requestAnimationFrame(step);
    });
  }
  /* Snap straight to a segment (for locked wheels). */
  show(i) { const seg = 2 * Math.PI / this.items.length; this.rot = -Math.PI / 2 - (i + .5) * seg; this.draw(); }
}

/* ---------- candidates ---------- */
function cuisineCands() {
  let list = CUISINES.filter(c => !S.set.offC.includes(c.id));
  if (S.only) list = CUISINES.filter(c => S.only.includes(c.id));
  if (S.lock.price) list = list.filter(c => c.price.includes(S.lock.price));
  const fresh = list.filter(c => !S.veto.has(c.id));
  if (fresh.length) list = fresh;
  if (S.set.avoid && !S.only) {
    const recent = list.filter(c => Date.now() - lastAte(c.id) > S.set.avoid * DAY);
    if (recent.length >= 2) list = recent;
  }
  return list;
}
function placeCands() {
  let list = S.places;
  if (S.lock.price) list = list.filter(p => p.price === S.lock.price);
  const fresh = list.filter(p => !S.veto.has(p.id));
  return fresh.length ? fresh : list;
}
const styleItems = () => STYLES.filter(s => S.set.onStyles.includes(s.id));

/* ---------- views ---------- */
let W = {};
function setTab(t) {
  S.tab = t;
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  render(); window.scrollTo(0, 0);
}
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => setTab(b.dataset.tab));
$('#settings-btn').onclick = openSettings;

function render() {
  document.querySelector('.fab')?.remove();
  const v = $('#view');
  if (S.tab === 'spin') { v.innerHTML = viewSpin(); bindSpin(); }
  else if (S.tab === 'decide') { v.innerHTML = viewDecide(); bindDecide(); }
  else if (S.tab === 'places') { v.innerHTML = viewPlaces(); bindPlaces(); }
  else { v.innerHTML = viewHistory(); bindHistory(); }
}

function viewSpin() {
  const placesOk = S.places.length >= 2;
  if (!placesOk) S.mode = 'cuisine';
  const banner = S.only ? `<div class="card" style="padding:10px 14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:8px">
      <span>🤔 Spinning between your ${S.only.length} picks</span><button class="btn ghost small" id="clear-only">Use all</button></div>` : '';
  return `<h1>What should we eat?</h1>
    <p class="sub">Tap the wheel, or shake your phone. Lock a wheel to keep its answer.</p>
    ${banner}
    <div class="spin-wrap ${S.res ? 'wide' : ''}">
      <div style="width:100%;display:flex;flex-direction:column;align-items:center">
        ${placesOk ? `<div class="seg"><button data-mode="cuisine" class="${S.mode === 'cuisine' ? 'on' : ''}">🍽️ Cuisines</button>
          <button data-mode="places" class="${S.mode === 'places' ? 'on' : ''}">📍 My places</button></div>` : ''}
        <div class="wheel-box"><div class="pointer"></div><canvas id="w-main" aria-label="Main wheel"></canvas></div>
        <button class="btn spin-btn" id="spin">🎰 Spin</button>
        <p class="hint" id="shake-hint">${shakeHint()}</p>
        <div class="minis">
          <div class="card mini"><div class="lbl">Price <button class="lock ${S.lock.price ? 'on' : ''}" data-lock="price">${S.lock.price ? '🔒 ' + price(S.lock.price).label : '🔓'}</button></div>
            <div class="wheel-box"><div class="pointer small"></div><canvas id="w-price"></canvas></div>
            <div class="val" id="v-price">${S.res ? esc(price(S.res.price).label + ' ' + price(S.res.price).name) : ''}</div></div>
          <div class="card mini"><div class="lbl">How <button class="lock ${S.lock.style ? 'on' : ''}" data-lock="style">${S.lock.style ? '🔒 ' + style(S.lock.style).emoji : '🔓'}</button></div>
            <div class="wheel-box"><div class="pointer small"></div><canvas id="w-style"></canvas></div>
            <div class="val" id="v-style">${S.res ? esc(style(S.res.style).emoji + ' ' + style(S.res.style).label) : ''}</div></div>
        </div>
      </div>
      <div id="result" style="width:100%;display:flex;justify-content:center">${S.res ? resultCard() : ''}</div>
    </div>`;
}
function bindSpin() {
  W.main = new Wheel($('#w-main'), { ticks: true });
  W.price = new Wheel($('#w-price'), { labels: true });
  W.style = new Wheel($('#w-style'), { labels: true });
  fillWheels();
  if (S.res) { W.price.show(PRICES.findIndex(p => p.lvl === S.res.price)); const si = styleItems().findIndex(s => s.id === S.res.style); if (si >= 0) W.style.show(si);
    const mi = W.main.items.findIndex(it => it.id === (S.res.place || S.res.cuisine)); if (mi >= 0) W.main.show(mi); }
  $('#spin').onclick = spinAll;
  /* On the folded Fold the button sits below the wheel; tapping a wheel spins too. */
  document.querySelectorAll('.wheel-box canvas').forEach(c => c.onclick = spinAll);
  document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { S.mode = b.dataset.mode; S.res = null; render(); });
  document.querySelectorAll('[data-lock]').forEach(b => b.onclick = () => openLock(b.dataset.lock));
  $('#clear-only')?.addEventListener('click', () => { S.only = null; render(); });
  $('#enable-shake')?.addEventListener('click', enableShake);
  bindResult();
}
function fillWheels() {
  const main = S.mode === 'places'
    ? placeCands().map(p => ({ id: p.id, label: p.name, emoji: cuisine(p.cuisine)?.emoji || '🍽️' }))
    : cuisineCands().map(c => ({ id: c.id, label: c.short || c.name, emoji: c.emoji }));
  W.main.setItems(main);
  W.price.setItems(PRICES.map(p => ({ id: p.lvl, label: p.label })));
  W.style.setItems(styleItems().map(s => ({ id: s.id, label: s.emoji })));
  if (S.lock.price) W.price.show(PRICES.findIndex(p => p.lvl === S.lock.price));
  if (S.lock.style) { const i = styleItems().findIndex(s => s.id === S.lock.style); if (i >= 0) W.style.show(i); }
}
addEventListener('resize', () => { if (S.tab === 'spin') Object.values(W).forEach(w => w.c.isConnected && w.draw()); });

let spinning = false;
async function spinAll() {
  if (spinning) return;
  audio();
  fillWheels();
  const items = W.main.items;
  if (!items.length) { toast('Nothing on the wheel — check the price lock or ⚙️ settings.'); return; }
  spinning = true; $('#spin').disabled = true; $('#spin').textContent = '🎰 Spinning…';
  S.res = null; $('#result').innerHTML = ''; $('#v-price').textContent = ''; $('#v-style').textContent = '';
  document.querySelector('.spin-wrap').classList.remove('wide');
  Object.values(W).forEach(w => w.draw());

  const mi = Math.floor(Math.random() * items.length), chosen = items[mi];
  const place = S.mode === 'places' ? S.places.find(p => p.id === chosen.id) : null;
  const c = place ? cuisine(place.cuisine) : cuisine(chosen.id);
  const pl = S.lock.price || place?.price || pick(c?.price || [2]);
  const styles = styleItems();
  const st = S.lock.style || (styles.length ? pick(styles).id : 'dine');

  const jobs = [W.main.spinTo(mi, 4300, 6)];
  if (!S.lock.price) jobs.push(W.price.spinTo(PRICES.findIndex(p => p.lvl === pl), 2300, 4).then(() => { $('#v-price').textContent = price(pl).label + ' ' + price(pl).name; tick(); }));
  else $('#v-price').textContent = price(pl).label + ' ' + price(pl).name;
  const si = styles.findIndex(s => s.id === st);
  if (!S.lock.style && si >= 0) jobs.push(W.style.spinTo(si, 3100, 4).then(() => { $('#v-style').textContent = style(st).emoji + ' ' + style(st).label; tick(); }));
  else $('#v-style').textContent = style(st).emoji + ' ' + style(st).label;
  await Promise.all(jobs);

  S.res = { cuisine: c?.id || place?.cuisine, place: place?.id || null, price: pl, style: st };
  spinning = false; ding();
  if (S.tab !== 'spin') return;
  $('#spin').disabled = false; $('#spin').textContent = '🎰 Spin again';
  document.querySelector('.spin-wrap').classList.add('wide');
  $('#result').innerHTML = resultCard(); bindResult();
  if (innerWidth < 760) $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function nearbyQuery(c, pl, st) {
  const lead = pl === 1 ? 'cheap ' : pl >= 3 ? 'best ' : '';
  const tail = st === 'deliv' ? ' delivery' : st === 'take' ? ' takeout' : st === 'drive' ? ' drive thru' : '';
  return lead + (c?.q || 'restaurant') + tail + ' near me';
}
function resultCard() {
  const r = S.res, c = cuisine(r.cuisine), p = price(r.price), st = style(r.style);
  const place = r.place && S.places.find(x => x.id === r.place);
  const home = r.style === 'home';
  const mine = !place && S.places.filter(x => x.cuisine === r.cuisine).sort((a, b) => Math.abs(a.price - r.price) - Math.abs(b.price - r.price)).slice(0, 4);
  return `<div class="card result">
    <div class="big">${esc(c?.emoji || '🍽️')}</div>
    <div class="what">${esc(place ? place.name : c?.name)}</div>
    <div class="how">${esc(p.label)} · ${esc(p.name)} (${esc(p.range)}) · ${esc(st.emoji + ' ' + st.label)}</div>
    ${place && place.notes ? `<p style="margin:10px 0 0">📝 ${esc(place.notes)}</p>` : ''}
    ${!place && c ? `<ul>${c.order.map(o => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}
    ${mine && mine.length ? `<div class="matches"><strong>From your places:</strong>${mine.map(m => `<button data-goplace="${m.id}">${esc(m.name)} <span style="color:var(--muted)">· ${price(m.price).label}${m.area ? ' · ' + esc(m.area) : ''}</span></button>`).join('')}</div>` : ''}
    <div class="actions">
      ${home ? `<a class="btn" href="https://efem-code.github.io/simmer/" target="_blank" rel="noopener">🍳 Open Simmer recipes</a>`
        : `<a class="btn" href="${esc(place ? (place.link || mapsUrl(place.name + ' ' + (place.area || ''))) : mapsUrl(nearbyQuery(c, r.price, r.style)))}" target="_blank" rel="noopener">📍 ${place ? 'Open in Maps' : 'Find nearby'}</a>`}
      <button class="btn good" data-res="go">✓ Let’s go</button>
      <button class="btn ghost" data-res="veto">🙅 Not feeling it</button>
    </div></div>`;
}
function bindResult() {
  document.querySelectorAll('[data-res]').forEach(b => b.onclick = () => {
    const r = S.res;
    if (b.dataset.res === 'go') { logMeal({ cuisine: r.cuisine, place: r.place, price: r.price, style: r.style }); toast('Logged. Enjoy! 🍽️'); b.disabled = true; b.textContent = '✓ Logged'; }
    else { S.veto.add(r.place || r.cuisine); toast('Okay, that one’s off the wheel for now.'); spinAll(); }
  });
  document.querySelectorAll('[data-goplace]').forEach(b => b.onclick = () => openPlace(b.dataset.goplace));
}
function logMeal(m) { S.hist.unshift({ id: newId(), at: new Date().toISOString(), ...m }); save(); }

function openLock(which) {
  const opts = which === 'price'
    ? PRICES.map(p => ({ v: p.lvl, t: `${p.label} ${p.name}`, s: p.range }))
    : styleItems().map(s => ({ v: s.id, t: `${s.emoji} ${s.label}` }));
  const curV = S.lock[which];
  openSheet(`<h2 style="margin-top:4px">Lock the ${which === 'price' ? 'price' : '“how”'} wheel</h2>
    <p class="sub">A locked wheel stays put. Only the others spin.</p>
    <div class="chips">${opts.map(o => `<button class="chip ${curV === o.v ? 'on' : ''}" data-v="${o.v}">${esc(o.t)}${o.s ? ` <small style="opacity:.7">${esc(o.s)}</small>` : ''}</button>`).join('')}</div>
    <div style="margin-top:14px"><button class="btn ghost wide" data-v="">🔓 Unlock — let it spin</button></div>`);
  $('#sheet-body').querySelectorAll('[data-v]').forEach(b => b.onclick = () => {
    const v = b.dataset.v; S.lock[which] = v === '' ? null : which === 'price' ? +v : v;
    closeSheet(); S.res = null; render();
  });
}

/* ---------- shake to spin ---------- */
let gotMotion = false, needPerm = typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function';
function shakeHint() {
  if (needPerm && !gotMotion) return `<button class="btn ghost small" id="enable-shake">📳 Turn on shake-to-spin</button>`;
  return gotMotion ? '📳 Shake your phone to spin' : 'Tip: on a phone, shake to spin 📳';
}
async function enableShake() {
  try { const r = await DeviceMotionEvent.requestPermission(); if (r === 'granted') { needPerm = false; listenMotion(); toast('Shake away! 📳'); } else toast('Motion access was denied.'); }
  catch { toast('Could not turn on motion.'); }
  const h = $('#shake-hint'); if (h) h.innerHTML = shakeHint();
}
/* A shake is three strong movements inside a second. Strength is the size of
   the acceleration with gravity taken out: a walking bump is ~2–5 m/s², a
   deliberate shake 12–30. (Comparing back-to-back readings doesn't work — at
   60 readings a second each step is tiny even mid-shake.) */
let hits = [], lastShake = 0;
function onMotion(e) {
  const a = e.acceleration && e.acceleration.x != null ? e.acceleration : null;
  const g = e.accelerationIncludingGravity;
  if (!a && (!g || g.x == null)) return;
  if (!gotMotion) { gotMotion = true; const h = $('#shake-hint'); if (h) h.innerHTML = shakeHint(); }
  const force = a ? Math.hypot(a.x, a.y, a.z) : Math.abs(Math.hypot(g.x, g.y, g.z) - 9.81);
  const now = Date.now();
  if (force > 12 && (!hits.length || now - hits[hits.length - 1] > 90)) { hits = hits.filter(t => now - t < 1000); hits.push(now); }
  if (hits.length >= 3 && now - lastShake > 1500 && S.tab === 'spin' && $('#sheet').hidden && !spinning && document.visibilityState === 'visible') {
    lastShake = now; hits = []; spinAll();
  }
}
/* Listen from the start everywhere. iOS simply sends nothing until the user
   grants motion access, so the button only shows until the first reading. */
function listenMotion() { addEventListener('devicemotion', onMotion); }
listenMotion();

/* ---------- decide (quiz) ---------- */
const TRAIT_WHY = { comfort: 'comfort food', fresh: 'fresh and light', spicy: 'has a kick', quick: 'quick to get', share: 'great for sharing', date: 'good for a date' };
function scoreCuisines() {
  const w = {}; let pl = 0;
  QUIZ.forEach(q => { const i = S.quiz[q.id]; if (i == null) return; const a = q.a[i];
    if (a.price != null) pl = a.price; Object.entries(a.w || {}).forEach(([k, v]) => w[k] = (w[k] || 0) + v); });
  return CUISINES.filter(c => !S.set.offC.includes(c.id)).filter(c => !pl || c.price.includes(pl)).map(c => {
    let score = 0; const why = [];
    for (const [k, v] of Object.entries(w)) {
      if (k === 'novel') continue;
      score += v * c[k];
      if (v > 0 && c[k] === 2 && TRAIT_WHY[k]) why.push(TRAIT_WHY[k]);
      if (k === 'spicy' && v < 0 && c.spicy === 0) why.push('no heat');
    }
    const days = lastAte(c.id) ? (Date.now() - lastAte(c.id)) / DAY : null;
    if (w.novel) { const n = days == null ? 3 : Math.min(3, days / 7); score += w.novel * n; why.push(days == null ? 'you haven’t logged it yet' : `last had ${Math.round(days)} days ago`); }
    if (days != null && days < 2) { score -= 4; }
    return { c, score, why: [...new Set(why)].slice(0, 3), pl };
  }).sort((a, b) => b.score - a.score);
}
function viewDecide() {
  const answered = Object.keys(S.quiz).length;
  const top = answered ? scoreCuisines().slice(0, 3) : [];
  return `<h1>Help me decide</h1><p class="sub">Four quick taps and we’ll suggest three things to eat.</p>
    ${QUIZ.map(q => `<div class="card qcard"><h3>${esc(q.q)}</h3><div class="chips">${q.a.map((a, i) =>
      `<button class="chip ${S.quiz[q.id] === i ? 'on' : ''}" data-q="${q.id}" data-a="${i}">${esc(a.t)}</button>`).join('')}</div></div>`).join('')}
    ${answered ? `<h2>Try one of these</h2>
      ${top.length ? top.map((t, i) => `<div class="card pick"><div class="e">${t.c.emoji}</div><div class="body">
        <div class="n"><span class="rank">${i + 1}.</span> ${esc(t.c.name)} <span style="color:var(--muted);font-weight:600;font-size:14px">${t.c.price.map(l => price(l).label).join(' / ')}</span></div>
        ${t.why.length ? `<div class="why">${esc(t.why.join(' · '))}</div>` : ''}
        <ul>${t.c.order.slice(0, 3).map(o => `<li>${esc(o)}</li>`).join('')}</ul>
        <div class="chips"><a class="btn small" href="${esc(mapsUrl(nearbyQuery(t.c, t.pl, null)))}" target="_blank" rel="noopener">📍 Find nearby</a>
        <button class="btn good small" data-go="${t.c.id}">✓ Let’s go</button></div></div></div>`).join('')
      + `<button class="btn wide" id="spin-top" style="padding:14px">🎡 Can’t choose? Spin between these ${top.length}</button>`
      : `<div class="empty">Nothing fits that budget — try “Doesn’t matter”.</div>`}
      <div style="text-align:center;margin-top:10px"><button class="btn ghost small" id="quiz-reset">Start over</button></div>` : ''}`;
}
function bindDecide() {
  document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
    const q = b.dataset.q, a = +b.dataset.a;
    if (S.quiz[q] === a) delete S.quiz[q]; else S.quiz[q] = a;
    const y = scrollY; render(); scrollTo(0, y);
  });
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    const t = scoreCuisines().find(x => x.c.id === b.dataset.go);
    logMeal({ cuisine: t.c.id, price: t.pl || t.c.price[0], style: null }); toast(`Logged ${t.c.name}. Enjoy!`); b.disabled = true; b.textContent = '✓ Logged';
  });
  $('#spin-top')?.addEventListener('click', () => {
    S.only = scoreCuisines().slice(0, 3).map(t => t.c.id); S.mode = 'cuisine'; S.res = null;
    const pl = QUIZ[1].a[S.quiz.price ?? 3]?.price; S.lock.price = pl || null;
    setTab('spin'); setTimeout(spinAll, 350);
  });
  $('#quiz-reset')?.addEventListener('click', () => { S.quiz = {}; render(); });
}

/* ---------- places ---------- */
const STATUS = { fav: '⭐ Favourite', want: '🔖 Want to try', been: '✓ Been' };
function viewPlaces() {
  const q = S.placeQ.toLowerCase();
  let list = S.places.filter(p => S.placeF === 'all' || p.status === S.placeF)
    .filter(p => !q || [p.name, p.area, p.notes, cuisine(p.cuisine)?.name].join(' ').toLowerCase().includes(q));
  list.sort((a, b) => (b.status === 'fav') - (a.status === 'fav') || (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name));
  setTimeout(() => { const f = document.createElement('button'); f.className = 'fab'; f.textContent = '＋'; f.setAttribute('aria-label', 'Add a place'); f.onclick = () => openPlaceForm(); document.body.appendChild(f); });
  return `<h1>My places</h1><p class="sub">Restaurants you love or want to try. Add two or more and you can spin between them.</p>
    ${S.places.length ? `<div class="toolbar"><input id="pq" type="search" placeholder="Search name, cuisine, area…" value="${esc(S.placeQ)}" autocomplete="off"></div>
    <div class="chips" style="margin-bottom:12px">${[['all', 'All'], ['fav', '⭐ Favourites'], ['want', '🔖 Want to try'], ['been', '✓ Been']].map(([k, t]) =>
      `<button class="chip ${S.placeF === k ? 'on' : ''}" data-pf="${k}">${t}</button>`).join('')}</div>` : ''}
    ${list.length ? list.map(placeCard).join('') : S.places.length ? '<div class="empty">No matches.</div>'
      : `<div class="empty"><div class="big">📍</div>No places yet.<br>Tap ＋ to add your go-to spots and the ones on your list.</div>`}
    ${S.places.length >= 2 ? `<button class="btn wide" id="spin-places" style="padding:14px;margin-top:6px">🎡 Spin my places</button>` : ''}`;
}
function placeCard(p) {
  const c = cuisine(p.cuisine);
  const visits = S.hist.filter(h => h.place === p.id).length;
  return `<div class="card place"><div class="e">${c?.emoji || '🍽️'}</div><div class="body">
    <div class="n">${esc(p.name)} ${p.status === 'fav' ? '<span class="tag fav">Fave</span>' : p.status === 'want' ? '<span class="tag">To try</span>' : ''}</div>
    <div class="m"><span>${esc(c?.name || p.cuisineOther || 'Other')}</span><span>${price(p.price).label}</span>${p.area ? `<span>📍 ${esc(p.area)}</span>` : ''}
      ${p.rating ? `<span class="stars">${'★'.repeat(p.rating)}</span>` : ''}${visits ? `<span>${visits} visit${visits > 1 ? 's' : ''}</span>` : ''}</div>
    ${p.notes ? `<div class="note">📝 ${esc(p.notes)}</div>` : ''}
    <div class="row"><a class="btn small" href="${esc(p.link || mapsUrl(p.name + ' ' + (p.area || '')))}" target="_blank" rel="noopener">📍 Maps</a>
      <button class="btn good small" data-ate="${p.id}">✓ Ate here</button>
      <button class="btn ghost small" data-edit="${p.id}">Edit</button></div></div></div>`;
}
function bindPlaces() {
  const pq = $('#pq');
  if (pq) pq.oninput = () => { S.placeQ = pq.value; const pos = pq.selectionStart; render(); const n = $('#pq'); n.focus(); n.setSelectionRange(pos, pos); };
  document.querySelectorAll('[data-pf]').forEach(b => b.onclick = () => { S.placeF = b.dataset.pf; render(); });
  document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openPlaceForm(b.dataset.edit));
  document.querySelectorAll('[data-ate]').forEach(b => b.onclick = () => {
    const p = S.places.find(x => x.id === b.dataset.ate);
    logMeal({ cuisine: p.cuisine, place: p.id, price: p.price, style: 'dine' });
    if (p.status === 'want') { p.status = 'been'; save(); }
    toast(`Logged ${p.name}`); render();
  });
  $('#spin-places')?.addEventListener('click', () => { S.mode = 'places'; S.only = null; S.res = null; setTab('spin'); setTimeout(spinAll, 350); });
}
function openPlace(id) { S.placeQ = ''; S.placeF = 'all'; setTab('places'); setTimeout(() => openPlaceForm(id), 50); }
function openPlaceForm(id) {
  const p = id ? S.places.find(x => x.id === id) : null;
  let rating = p?.rating || 0;
  openSheet(`<h2 style="margin-top:4px">${p ? 'Edit place' : 'Add a place'}</h2>
    <form class="form" id="pform">
      <label>Name</label><input name="name" required value="${esc(p?.name || '')}" placeholder="e.g. Sushi Hachi">
      <div class="two"><div><label>Cuisine</label><select name="cuisine">${CUISINES.map(c => `<option value="${c.id}" ${p?.cuisine === c.id ? 'selected' : ''}>${c.emoji} ${esc(c.name)}</option>`).join('')}<option value="other" ${p?.cuisine === 'other' ? 'selected' : ''}>🍽️ Other</option></select></div>
        <div><label>Price</label><select name="price">${PRICES.map(x => `<option value="${x.lvl}" ${(p?.price || 2) === x.lvl ? 'selected' : ''}>${x.label} ${esc(x.name)}</option>`).join('')}</select></div></div>
      <div class="two"><div><label>Area</label><input name="area" value="${esc(p?.area || '')}" placeholder="e.g. Langley"></div>
        <div><label>Status</label><select name="status">${Object.entries(STATUS).map(([k, t]) => `<option value="${k}" ${(p?.status || 'fav') === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
      <label>Rating</label><div class="rate">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-star="${n}" class="${n <= rating ? 'on' : ''}">★</button>`).join('')}</div>
      <label>What to order / notes</label><textarea name="notes" placeholder="The spicy miso ramen, ask for extra egg">${esc(p?.notes || '')}</textarea>
      <label>Maps link (optional — paste from Google Maps “Share”)</label><input name="link" type="url" value="${esc(p?.link || '')}" placeholder="https://maps.app.goo.gl/…">
      <div style="display:flex;gap:8px;margin-top:16px"><button class="btn" style="flex:1;padding:14px">${p ? 'Save' : 'Add place'}</button>
        ${p ? '<button type="button" class="btn ghost" id="pdel">Delete</button>' : ''}</div>
    </form>`);
  const f = $('#pform');
  f.querySelectorAll('[data-star]').forEach(b => b.onclick = () => {
    const n = +b.dataset.star; rating = rating === n ? 0 : n;
    f.querySelectorAll('[data-star]').forEach(s => s.classList.toggle('on', +s.dataset.star <= rating));
  });
  f.onsubmit = e => {
    e.preventDefault();
    const link = f.link.value.trim();
    const rec = { id: p?.id || newId(), name: f.name.value.trim(), cuisine: f.cuisine.value, price: +f.price.value, area: f.area.value.trim(),
      status: f.status.value, rating, notes: f.notes.value.trim(), link: /^https:\/\//.test(link) ? link : '' };
    if (p) Object.assign(p, rec); else S.places.push(rec);
    save(); closeSheet(); toast(p ? 'Saved' : 'Added ' + rec.name); render();
  };
  $('#pdel')?.addEventListener('click', () => {
    if (!confirm(`Delete ${p.name}?`)) return;
    S.places = S.places.filter(x => x.id !== p.id); save(); closeSheet(); render();
  });
}

/* ---------- history ---------- */
function viewHistory() {
  const month = S.hist.filter(h => Date.now() - new Date(h.at) < 30 * DAY);
  const counts = {}; S.hist.forEach(h => counts[h.cuisine] = (counts[h.cuisine] || 0) + 1);
  const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const top = cuisine(topId);
  const stale = CUISINES.filter(c => !S.set.offC.includes(c.id) && lastAte(c.id) && Date.now() - lastAte(c.id) > 21 * DAY).slice(0, 6);
  const when = iso => { const d = new Date(iso), days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / DAY);
    return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : days < 7 ? d.toLocaleDateString(undefined, { weekday: 'long' }) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
  return `<h1>History</h1><p class="sub">Everything you tapped “Let’s go” or “Ate here” on.</p>
    ${S.hist.length ? `<div class="stats"><div class="card"><b>${S.hist.length}</b><small>meals logged</small></div>
      <div class="card"><b>${month.length}</b><small>last 30 days</small></div>
      <div class="card"><b>${top ? top.emoji : '—'}</b><small>${top ? esc(top.name) : 'favourite'}</small></div></div>
      ${stale.length ? `<div class="card" style="padding:12px 14px;margin-bottom:12px"><strong>Haven’t had in a while:</strong> ${stale.map(c => c.emoji + ' ' + esc(c.name)).join(', ')}</div>` : ''}
      <div class="card"><ul class="hist">${S.hist.map(h => { const c = cuisine(h.cuisine), p = h.place && S.places.find(x => x.id === h.place);
        return `<li><span class="e">${c?.emoji || '🍽️'}</span><div class="body"><strong>${esc(p ? p.name : c?.name || 'Meal')}</strong>
          <div class="d">${when(h.at)} · ${price(h.price)?.label || ''}${h.style && style(h.style) ? ' · ' + style(h.style).label : ''}</div></div>
          <button class="x" data-hdel="${h.id}" aria-label="Remove">✕</button></li>`; }).join('')}</ul></div>`
      : `<div class="empty"><div class="big">🧾</div>Nothing yet. Spin the wheel and tap “Let’s go”.<br>History helps Craving avoid repeats.</div>`}`;
}
function bindHistory() {
  document.querySelectorAll('[data-hdel]').forEach(b => b.onclick = () => { S.hist = S.hist.filter(h => h.id !== b.dataset.hdel); save(); render(); });
}

/* ---------- settings ---------- */
function openSettings() {
  openSheet(`<h2 style="margin-top:4px">Wheel settings</h2>
    <p class="sub">Tap a cuisine to take it off the wheel (or put it back).</p>
    <div class="chips" id="cz">${CUISINES.map(c => `<button class="chip ${S.set.offC.includes(c.id) ? 'off' : ''}" data-c="${c.id}">${c.emoji} ${esc(c.name)}</button>`).join('')}</div>
    <h2>“How” wheel</h2>
    <div class="chips" id="sz">${STYLES.map(s => `<button class="chip ${S.set.onStyles.includes(s.id) ? '' : 'off'}" data-s="${s.id}">${s.emoji} ${esc(s.label)}</button>`).join('')}</div>
    <h2>Options</h2>
    <div class="set-row"><span>Skip cuisines eaten in the last…</span><select id="avoid">${[[0, 'Off'], [1, '1 day'], [2, '2 days'], [3, '3 days'], [7, 'week']].map(([v, t]) => `<option value="${v}" ${S.set.avoid === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div class="set-row"><span>Click sound while spinning</span><input type="checkbox" id="snd" ${S.set.sound ? 'checked' : ''}></div>
    <div class="set-row"><span>Vibrate while spinning</span><input type="checkbox" id="bz" ${S.set.buzz ? 'checked' : ''}></div>
    ${S.veto.size ? `<div class="set-row"><span>${S.veto.size} “not feeling it” today</span><button class="btn ghost small" id="unveto">Put back</button></div>` : ''}
    <h2>Backup</h2><p class="sub">Your places and history live only on this phone. Save a copy now and then.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost" id="exp">⬇️ Save backup</button>
      <label class="btn ghost">⬆️ Restore<input type="file" id="imp" accept="application/json,.json" hidden></label></div>`);
  const b = $('#sheet-body');
  b.querySelectorAll('[data-c]').forEach(x => x.onclick = () => {
    const id = x.dataset.c, off = S.set.offC.includes(id);
    if (!off && CUISINES.length - S.set.offC.length <= 2) { toast('Keep at least 2 on the wheel'); return; }
    S.set.offC = off ? S.set.offC.filter(i => i !== id) : [...S.set.offC, id]; x.classList.toggle('off', !off); save();
  });
  b.querySelectorAll('[data-s]').forEach(x => x.onclick = () => {
    const id = x.dataset.s, on = S.set.onStyles.includes(id);
    if (on && S.set.onStyles.length <= 1) { toast('Keep at least 1'); return; }
    S.set.onStyles = on ? S.set.onStyles.filter(i => i !== id) : [...S.set.onStyles, id]; x.classList.toggle('off', on);
    if (on && S.lock.style === id) S.lock.style = null; save();
  });
  $('#avoid').onchange = e => { S.set.avoid = +e.target.value; save(); };
  $('#snd').onchange = e => { S.set.sound = e.target.checked; save(); };
  $('#bz').onchange = e => { S.set.buzz = e.target.checked; save(); };
  $('#unveto')?.addEventListener('click', () => { S.veto.clear(); toast('All back on the wheel'); openSettings(); });
  $('#exp').onclick = () => {
    const blob = new Blob([JSON.stringify({ app: 'craving', v: 1, places: S.places, hist: S.hist, set: S.set }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `craving-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $('#imp').onchange = async e => {
    try {
      const d = JSON.parse(await e.target.files[0].text());
      if (d.app !== 'craving' || !Array.isArray(d.places)) throw 0;
      if (!confirm(`Replace your ${S.places.length} places and ${S.hist.length} history entries with the backup (${d.places.length} places)?`)) return;
      S.places = d.places; S.hist = d.hist || []; Object.assign(S.set, d.set || {}); save(); closeSheet(); render(); toast('Restored');
    } catch { toast('That file isn’t a Craving backup.'); }
  };
}

/* ---------- sheet ---------- */
function openSheet(html) { $('#sheet-body').innerHTML = html; $('#sheet').hidden = false; $('.sheet-card').scrollTop = 0; document.body.style.overflow = 'hidden'; }
function closeSheet() {
  const wasSettings = !!$('#cz'); $('#sheet').hidden = true; document.body.style.overflow = '';
  if (wasSettings && S.tab === 'spin' && !spinning) { S.res = null; render(); }
}
$('#sheet-close').onclick = closeSheet;
$('#sheet').onclick = e => { if (e.target.id === 'sheet') closeSheet(); };
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet();
  if (e.key === ' ' && S.tab === 'spin' && $('#sheet').hidden && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); spinAll(); }
});

/* ---------- boot ---------- */
setTab('spin');
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  /* Reload onto a new build only when one replaces an older one. On the very
     first visit the worker claims the page too, and that must not reload. */
  const hadWorker = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => { if (nw.state === 'activated' && hadWorker) location.reload(); });
    });
  }).catch(() => {});
}
