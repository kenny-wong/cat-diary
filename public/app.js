(async () => {
  'use strict';

  // Before accounts, the diary lived only in the browser under this key. It is now read once, to offer moving it into the account.
  const STORE_KEY = 'littleDiary.v1';
  const MIGRATED_KEY = 'littleDiary:migratedTo:v1';
  const LAST_PAGE_KEY = 'littleDiary:lastPage:v1';
  const PHOTO_BYTES = 1500000; // stay well under the server's 1.9 MB photo limit
  const MOODS = [['😊', 'Happy'], ['🥰', 'Loved'], ['😆', 'Excited'], ['😌', 'Calm'], ['😐', 'Meh'], ['😢', 'Sad'], ['😠', 'Grumpy'], ['😴', 'Sleepy']];
  const WEATHERS = [['☀️', 'Sunny'], ['⛅', 'Cloudy'], ['🌧️', 'Rainy'], ['⛈️', 'Stormy'], ['❄️', 'Snowy'], ['🌈', 'Rainbow'], ['🌬️', 'Windy']];
  const FRAMES = ['polaroid', 'tape', 'round', 'none'];
  const PHOTO_MAX = 1400;
  const { paw, blossom, escape } = Stickers;

  // Photos from the browser-only diary, kept in IndexedDB. Read once when moving that diary into an account.
  // A page only stores a sticker with ref "photo:<id>"; the image itself lives on the server at /api/photos/<id>.
  const LegacyPhotos = (() => {
    let dbPromise;
    const open = () => dbPromise || (dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('littleDiaryPhotos', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('photos');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
    const run = async (mode, fn) => {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('photos', mode);
        const req = fn(tx.objectStore('photos'));
        tx.oncomplete = () => resolve(req && req.result);
        tx.onerror = () => reject(tx.error);
      });
    };
    return { get: id => run('readonly', s => s.get(id)) };
  })();
  const isPhoto = ref => ref.startsWith('photo:');
  const photoUrl = id => `/api/photos/${encodeURIComponent(id)}`;
  // Photos known to be on the server, so the ones no page uses any more can be removed.
  const knownPhotos = new Set();

  // ---------- Templates ----------
  const ear = side =>
    `<svg class="deco ear ear-${side}" viewBox="0 0 92 70">` +
    `<path class="ear-fill" d="M4 70 L36 10 Q44 -2 54 10 L88 70 Z"/>` +
    `<path class="ear-edge" d="M11.5 56 L36 10 Q44 -2 54 10 L80 56"/>` +
    `<path class="ear-inner" d="M27 56 L42 26 Q45 20 48 26 L64 56 Z"/></svg>`;

  const leaf = (x, y, len, angle, color) =>
    `<g transform="translate(${x} ${y}) rotate(${angle})">` +
    `<path d="M0 0 C${len * .3} ${-len * .3} ${len * .7} ${-len * .3} ${len} 0 C${len * .7} ${len * .3} ${len * .3} ${len * .3} 0 0 Z" fill="${color}"/>` +
    `<path d="M4 0 L${len * .85} 0" stroke="#fff" stroke-opacity=".45" stroke-width="1.6"/></g>`;

  const star4 = (x, y, r) => `<path d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z"/>`;

  const wave = y => `M0 ${y} Q25 ${y - 14} 50 ${y} ${[100, 150, 200, 250, 300, 350, 400].map(x => `T${x} ${y}`).join(' ')} V74 H0 Z`;

  const THEMES = {
    cat: {
      name: 'Cat Café', icon: '🐱', swatch: '#fbe0cc', meta: '#fbeee0',
      deco: ear('l') + ear('r') +
        `<svg class="deco paw-trail" viewBox="0 0 150 60"><g class="paw-fill">${paw(16, 44, .8, -20)}${paw(54, 26, .8, 10)}${paw(92, 42, .8, -15)}${paw(130, 22, .8, 15)}</g></svg>`,
    },
    sakura: {
      name: 'Sakura', icon: '🌸', swatch: '#fcd6e2', meta: '#fdebf0',
      deco: `<svg class="deco sakura-branch" viewBox="0 0 210 150">
          <path d="M210 12 C172 20 146 34 116 60 C98 76 78 86 46 92" stroke="#8b5e4a" stroke-width="5" fill="none" stroke-linecap="round"/>
          <path d="M146 34 C152 50 148 64 140 78 M106 68 C108 84 104 96 96 110" stroke="#8b5e4a" stroke-width="3" fill="none" stroke-linecap="round"/>
          ${blossom(46, 92, 17)}${blossom(140, 78, 15)}${blossom(96, 110, 14)}${blossom(170, 22, 13, '#fbc4d4')}${blossom(118, 56, 11, '#fbc4d4')}
          <circle cx="78" cy="83" r="4" fill="#f59ab5"/><circle cx="192" cy="15" r="3.5" fill="#f59ab5"/></svg>
        <svg class="deco petals" viewBox="0 0 120 40"><g fill="#f7b6ca">
          <ellipse cx="12" cy="24" rx="6" ry="3.5" transform="rotate(30 12 24)"/><ellipse cx="48" cy="12" rx="5" ry="3" transform="rotate(-20 48 12)"/>
          <ellipse cx="80" cy="30" rx="6" ry="3.5" transform="rotate(55 80 30)"/><ellipse cx="108" cy="14" rx="4.5" ry="2.8" transform="rotate(-45 108 14)"/></g></svg>`,
    },
    ocean: {
      name: 'Seaside', icon: '🐳', swatch: '#cbe6f6', meta: '#e4f2fa',
      deco: `<svg class="deco bubbles" viewBox="0 0 60 80"><g fill="#fff" fill-opacity=".5" stroke="#9fd0ee" stroke-width="2.5">
          <circle cx="30" cy="64" r="10"/><circle cx="42" cy="38" r="7"/><circle cx="25" cy="20" r="5"/><circle cx="40" cy="7" r="3.5"/></g></svg>
        <svg class="deco whale" viewBox="0 0 100 70">
          <path d="M82 40 C90 34 97 26 95 18 C90 24 85 27 80 29 Z" fill="#5fa8d6"/>
          <path d="M10 44 C10 24 34 16 56 20 C74 23 84 34 86 44 C88 56 70 62 48 62 C26 62 10 58 10 44 Z" fill="#5fa8d6"/>
          <path d="M16 50 C30 58 60 60 82 51 C72 61 30 63 16 50 Z" fill="#cfe8f7"/>
          <circle cx="28" cy="40" r="3" fill="#1f3b57"/><ellipse cx="35" cy="48" rx="4" ry="2.5" fill="#f4a3b5" opacity=".8"/>
          <path d="M42 18 q-2 -8 -9 -10 M42 18 q2 -8 9 -10 M42 18 v-13" stroke="#7cc2ec" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>
        <div class="deco waves-wrap"><svg viewBox="0 0 400 74" preserveAspectRatio="none">
          <path d="${wave(34)}" fill="#cbe6f6"/><path d="${wave(50)}" fill="#9fd0ee"/></svg></div>`,
    },
    forest: {
      name: 'Forest', icon: '🍃', swatch: '#d6e9c9', meta: '#ebf3e4',
      deco: `<svg class="deco leaves" viewBox="0 0 230 110">
          <path d="M230 38 C190 34 160 54 130 58 C100 62 70 54 34 72" stroke="#6b8f4e" stroke-width="3" fill="none" stroke-linecap="round"/>
          ${[[204, 37, 30, -65, '#76b366'], [184, 41, 32, 115, '#5c9a4f'], [160, 50, 30, -105, '#8cc47a'], [140, 56, 34, 75, '#4f8a46'],
             [114, 60, 28, -95, '#76b366'], [94, 60, 32, 105, '#8cc47a'], [72, 58, 26, -120, '#5c9a4f'], [52, 64, 30, 125, '#76b366'], [36, 71, 28, 195, '#4f8a46']]
            .map(([x, y, len, angle, color]) => leaf(x, y, len, angle, color)).join('')}
          <circle cx="150" cy="92" r="5" fill="#e0614f"/><circle cx="160" cy="98" r="4.5" fill="#e0614f"/><circle cx="141" cy="99" r="4" fill="#c94c3d"/>
          <path d="M150 87 L148 66 M160 94 L150 70" stroke="#6b8f4e" stroke-width="1.5"/></svg>
        <svg class="deco mushroom" viewBox="0 0 60 60">
          <path d="M22 32 L20 54 Q30 58 40 54 L38 32 Z" fill="#f6ead6"/>
          <path d="M6 33 C6 12 54 12 54 33 Z" fill="#e8624f"/>
          <circle cx="18" cy="24" r="4" fill="#fff"/><circle cx="32" cy="18" r="3.5" fill="#fff"/><circle cx="44" cy="26" r="4" fill="#fff"/>
          <path d="M8 56 q4 -8 6 0 M46 56 q4 -9 6 0" stroke="#5c9a4f" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`,
    },
    night: {
      name: 'Starry Night', icon: '🌙', swatch: '#2c3366', meta: '#1b2040',
      deco: `<svg class="deco moon" viewBox="0 0 130 130">
          <defs><mask id="moonCut"><rect width="130" height="130" fill="#fff"/><circle cx="86" cy="48" r="34" fill="#000"/></mask></defs>
          <circle cx="65" cy="65" r="54" fill="#ffd36e" opacity=".1"/>
          <circle cx="65" cy="65" r="40" fill="#ffd36e" mask="url(#moonCut)"/>
          <g fill="#fff3c4">${star4(108, 92, 7)}${star4(96, 112, 4)}</g></svg>
        <svg class="deco night-stars" viewBox="0 0 150 60"><g fill="#ffe9a8">
          ${star4(14, 22, 6)}${star4(70, 10, 4)}${star4(120, 36, 5)}</g>
          <g fill="#ffe9a8" opacity=".7"><circle cx="40" cy="44" r="1.6"/><circle cx="96" cy="20" r="1.3"/><circle cx="140" cy="8" r="1.5"/></g></svg>`,
    },
    kraft: {
      name: 'Vintage', icon: '📜', swatch: '#e2cfae', meta: '#e8d9bf',
      deco: `<span class="deco tape tape-l"></span><span class="deco tape tape-r"></span>
        <svg class="deco stamp" viewBox="0 0 90 90"><g fill="none" stroke="#a8643a">
          <circle cx="45" cy="45" r="38" stroke-width="3"/><circle cx="45" cy="45" r="30" stroke-width="1.5"/></g>
          <g fill="#a8643a" font-family="'Special Elite', monospace" font-size="12" text-anchor="middle">
          <text x="45" y="42">DEAR</text><text x="45" y="58">DIARY</text></g></svg>`,
    },
  };

  // ---------- State ----------
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const parseDate = s => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function newEntry(extra = {}) {
    const now = Date.now();
    return {
      id: uid(), date: todayStr(), title: '', body: '', mood: '', weather: '',
      theme: state?.defaultTheme || 'cat', stickers: [], createdAt: now, updatedAt: now, ...extra,
    };
  }

  function welcomeEntry() {
    return newEntry({
      theme: 'cat', mood: '🥰', weather: '☀️',
      title: 'My very first page 🐾',
      body: 'Dear diary,\n\nThis little notebook is all mine! Here is how it works:\n\n' +
        '• Pick a template above the page: Cat Café, Sakura, Seaside and more.\n' +
        '• Tap a sticker in the sticker box to stick it on the page.\n' +
        '• Drag a sticker to move it. Pull the corner dot to resize and spin it, or tap × to peel it off.\n' +
        '• Everything saves to your account by itself, so your diary is there on any phone or computer you log in on.\n\n' +
        'Now tell me about your day ✏️',
      stickers: [
        { id: uid(), ref: 'svg:tapePaw', x: 30, y: 6, size: 150, rot: -5 },
        { id: uid(), ref: 'svg:meow', x: 68, y: 610, size: 110, rot: -6 },
        { id: uid(), ref: 'svg:catFace', x: 86, y: 680, size: 100, rot: 8 },
        { id: uid(), ref: '🐟', x: 56, y: 700, size: 48, rot: -20 },
      ],
    });
  }

  function sanitizeEntry(e) {
    if (!e || typeof e !== 'object') return null;
    const str = (v, max = 100000) => (typeof v === 'string' ? v.slice(0, max) : '');
    const num = (v, d) => (Number.isFinite(v) ? v : d);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : todayStr();
    return {
      id: str(e.id, 40) || uid(),
      date,
      title: str(e.title, 120),
      body: str(e.body),
      mood: str(e.mood, 16),
      weather: str(e.weather, 16),
      theme: THEMES[e.theme] ? e.theme : 'cat',
      stickers: (Array.isArray(e.stickers) ? e.stickers : [])
        .filter(s => s && typeof s.ref === 'string')
        .map(s => {
          const st = {
            id: str(s.id, 40) || uid(),
            ref: s.ref.slice(0, 48),
            x: clamp(num(s.x, 50), 0, 100),
            y: Math.max(0, num(s.y, 100)),
            size: clamp(num(s.size, 60), 20, 600),
            rot: num(s.rot, 0) % 360,
          };
          if (isPhoto(st.ref)) st.frame = FRAMES.includes(s.frame) ? s.frame : 'polaroid';
          return st;
        }),
      createdAt: num(e.createdAt, Date.now()),
      updatedAt: num(e.updatedAt, Date.now()),
    };
  }

  // Per-device conveniences only; storage may be blocked, and the diary works without it.
  const local = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* blocked */ } },
  };

  const photoIdsIn = entries => {
    const ids = new Set();
    for (const e of entries) for (const s of e.stickers) if (isPhoto(s.ref)) ids.add(s.ref.slice(6));
    return ids;
  };

  // ---------- Loading ----------
  const user = await Account.start();
  let state;
  for (;;) {
    try {
      const diary = await Api.get('/api/diary');
      state = {
        entries: diary.entries.map(sanitizeEntry).filter(Boolean),
        currentId: local.get(LAST_PAGE_KEY),
        defaultTheme: THEMES[diary.prefs.defaultTheme] ? diary.prefs.defaultTheme : 'cat',
        view: diary.prefs.view === 'list' ? 'list' : 'calendar',
      };
      break;
    } catch (err) {
      if (err.status === 401) await Account.relogin();
      else if (!confirm(`${err.message}\n\nTry again?`)) return;
    }
  }
  photoIdsIn(state.entries).forEach(id => knownPhotos.add(id));

  // Pages changed since the last save, and whether the settings changed.
  const dirty = new Set();
  let prefsDirty = false;

  // The browser-only diary from before accounts, if this browser still has one to move.
  function legacyEntries() {
    if (local.get(MIGRATED_KEY)) return [];
    try {
      if (sessionStorage.getItem(MIGRATED_KEY)) return [];
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      return Array.isArray(saved?.entries) ? saved.entries.map(sanitizeEntry).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  async function moveLegacyDiary() {
    const legacy = legacyEntries().filter(e => !state.entries.some(x => x.id === e.id));
    if (!legacy.length) return 0;
    const n = legacy.length;
    if (!confirm(`This browser has ${n} page${n === 1 ? '' : 's'} from your diary before you had an account.\n\n` +
      `Add ${n === 1 ? 'it' : 'them'} to the diary of ${user.email}?\n(Cancel to ask again next time.)`)) {
      try { sessionStorage.setItem(MIGRATED_KEY, 'later'); } catch { /* blocked */ }
      return 0;
    }
    for (const id of photoIdsIn(legacy)) {
      if (knownPhotos.has(id)) continue;
      try {
        let blob = await LegacyPhotos.get(id);
        if (!blob) continue;
        if (blob.size > PHOTO_BYTES) blob = (await shrinkImage(blob)).blob;
        await Api.put(`/api/photos/${id}`, blob);
        knownPhotos.add(id);
      } catch (err) {
        if (err.status === 0 || err.status >= 500) throw err; // try again next time; other photos show as "not found"
      }
    }
    for (const entry of legacy) {
      await Api.put(`/api/entries/${entry.id}`, entry);
      state.entries.push(entry);
    }
    local.set(MIGRATED_KEY, user.id);
    return n;
  }

  let moved = 0;
  try {
    moved = await moveLegacyDiary();
  } catch (err) {
    alert(`Couldn't move all of your old pages: ${err.message}\nThey are still in this browser, and you'll be asked again next time.`);
  }

  if (!state.entries.length) {
    const first = welcomeEntry();
    state.entries.push(first);
    state.currentId = first.id;
    dirty.add(first.id);
  }
  if (!state.entries.some(e => e.id === state.currentId)) state.currentId = sortedEntries()[0].id;

  let selectedStickerId = null;
  let drag = null;

  // Sidebar calendar position (not saved) and which year/month folders are open.
  const startDate = parseDate(state.entries.find(e => e.id === state.currentId).date);
  const cal = { y: startDate.getFullYear(), m: startDate.getMonth(), zoom: 'month', day: null };
  const expanded = new Set();
  const expandFor = date => { expanded.add(date.slice(0, 4)); expanded.add(date.slice(0, 7)); };
  expandFor(state.entries.find(e => e.id === state.currentId).date);

  // ---------- Elements ----------
  const $ = id => document.getElementById(id);
  const els = {
    page: $('page'), deco: $('pageDeco'), layer: $('stickerLayer'),
    title: $('titleInput'), body: $('bodyInput'),
    dateBadge: $('dateBadge'), dateInput: $('dateInput'), dateDay: $('dateDay'), dateMonth: $('dateMonth'), dateWeek: $('dateWeek'),
    moodBtn: $('moodBtn'), moodPop: $('moodPop'), weatherBtn: $('weatherBtn'), weatherPop: $('weatherPop'),
    templates: $('templates'), list: $('entryList'), search: $('search'), viewSeg: $('viewSeg'),
    photoBtn: $('photoBtn'), photoInput: $('photoInput'),
    trayTabs: $('trayTabs'), trayGrid: $('trayGrid'), tray: $('tray'), fab: $('stickerFab'), trayClose: $('trayClose'),
    sidebar: $('sidebar'), scrim: $('scrim'), menuBtn: $('menuBtn'),
    saveStatus: $('saveStatus'), wordCount: $('wordCount'), toast: $('toast'),
  };

  const current = () => state.entries.find(e => e.id === state.currentId);

  function sortedEntries() {
    return [...state.entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }

  // ---------- Saving ----------
  // Changes go to the server shortly after typing stops. Saves run one at a time, in order.
  let saveTimer = null;
  let saveChain = Promise.resolve();
  const prefsBody = () => ({ defaultTheme: state.defaultTheme, view: state.view });
  function setStatus(kind) {
    els.saveStatus.classList.toggle('error', kind === 'error');
    els.saveStatus.textContent = { saving: 'Saving…', saved: 'Saved ✓', error: 'Not saved yet…' }[kind] || '';
  }
  function schedule(ms) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, ms);
  }
  async function flush() {
    const ids = [...dirty];
    const prefs = prefsDirty;
    dirty.clear();
    prefsDirty = false;
    if (!ids.length && !prefs) return;
    try {
      for (const id of ids) {
        const entry = state.entries.find(e => e.id === id);
        if (entry) await Api.put(`/api/entries/${id}`, entry);
      }
      if (prefs) await Api.put('/api/prefs', prefsBody());
      if (!saveTimer && !dirty.size) setStatus('saved');
    } catch (err) {
      ids.forEach(id => dirty.add(id));
      prefsDirty ||= prefs;
      setStatus('error');
      if (err.status === 400 || err.status === 413) toast(`Couldn't save: ${err.message}`);
      else schedule(5000); // offline, logged out or a server hiccup: keep trying
    }
  }
  function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    saveChain = saveChain.then(flush);
    return saveChain;
  }
  function touch(entry = current()) {
    if (entry) {
      entry.updatedAt = Date.now();
      dirty.add(entry.id);
    }
    setStatus('saving');
    schedule(600);
  }
  function touchPrefs() {
    prefsDirty = true;
    schedule(600);
  }
  // Closing the tab: send what's left with keepalive, and ask the browser to warn about unsaved changes.
  window.addEventListener('beforeunload', e => {
    if (!dirty.size && !prefsDirty) return;
    for (const id of dirty) {
      const entry = state.entries.find(x => x.id === id);
      if (entry) Api.put(`/api/entries/${id}`, entry, { keepalive: true }).catch(() => {});
    }
    if (prefsDirty) Api.put('/api/prefs', prefsBody(), { keepalive: true }).catch(() => {});
    e.preventDefault();
  });
  // Phones often close a tab without beforeunload, so save as soon as it goes to the background.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (dirty.size || prefsDirty)) saveNow();
  });

  let toastTimer;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { els.toast.hidden = true; }, 2800);
  }

  // ---------- Rendering ----------
  function renderTemplates() {
    els.templates.innerHTML = Object.entries(THEMES).map(([id, t]) =>
      `<button class="tpl" type="button" role="radio" data-theme="${id}">` +
      `<span class="tpl-sw" style="background:${t.swatch}">${t.icon}</span>${t.name}</button>`).join('');
  }

  function applyTheme(entry) {
    const t = THEMES[entry.theme] || THEMES.cat;
    document.body.dataset.theme = entry.theme;
    els.deco.innerHTML = t.deco;
    document.querySelector('meta[name="theme-color"]').content = t.meta;
    els.templates.querySelectorAll('.tpl').forEach(b => {
      const on = b.dataset.theme === entry.theme;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', on);
    });
  }

  function renderMeta(entry) {
    const d = parseDate(entry.date);
    els.dateDay.textContent = d.getDate();
    els.dateMonth.textContent = d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    els.dateWeek.textContent = d.toLocaleDateString(undefined, { weekday: 'long' });
    els.dateInput.value = entry.date;

    const label = (list, value, name) => {
      const found = list.find(([e]) => e === value);
      return found
        ? `<span class="emo">${found[0]}</span><span class="label">${found[1]}</span>`
        : `<span class="emo">＋</span><span class="label">${name}</span>`;
    };
    els.moodBtn.innerHTML = label(MOODS, entry.mood, 'Mood');
    els.moodBtn.classList.toggle('set', !!entry.mood);
    els.weatherBtn.innerHTML = label(WEATHERS, entry.weather, 'Weather');
    els.weatherBtn.classList.toggle('set', !!entry.weather);
    els.moodPop.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === entry.mood && !!b.dataset.v));
    els.weatherPop.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === entry.weather && !!b.dataset.v));
  }

  function autosize() {
    els.body.style.height = 'auto';
    els.body.style.height = els.body.scrollHeight + 'px';
  }

  function updateWordCount(entry) {
    const cjkRe = /[぀-ヿ㐀-鿿豈-﫿가-힯]/g;
    const text = `${entry.title} ${entry.body}`;
    const cjk = (text.match(cjkRe) || []).length;
    const words = text.replace(cjkRe, ' ').trim().split(/\s+/).filter(Boolean).length;
    const n = cjk + words;
    const photos = entry.stickers.filter(s => isPhoto(s.ref)).length;
    const stickers = entry.stickers.length - photos;
    els.wordCount.textContent = `${n} word${n === 1 ? '' : 's'} · ${stickers} sticker${stickers === 1 ? '' : 's'}` +
      (photos ? ` · ${photos} photo${photos === 1 ? '' : 's'}` : '');
  }

  function renderEntry() {
    const entry = current();
    applyTheme(entry);
    renderMeta(entry);
    els.title.value = entry.title;
    els.body.value = entry.body;
    autosize();
    renderStickers();
    updateWordCount(entry);
  }

  // ---------- Sidebar: calendar, year > month folders, search ----------
  const pad = n => String(n).padStart(2, '0');
  const pages = n => `${n} page${n === 1 ? '' : 's'}`;

  function entryItem(e, dateFormat = { weekday: 'short', month: 'short', day: 'numeric' }) {
    const t = THEMES[e.theme] || THEMES.cat;
    const snippet = e.body.replace(/\s+/g, ' ').trim().slice(0, 60);
    return `<button class="entry-item${e.id === state.currentId ? ' active' : ''}" type="button" data-id="${e.id}">` +
      `<span class="ei-mood" style="background:${t.swatch}">${escape(e.mood || t.icon)}</span>` +
      `<span class="ei-main"><span class="ei-date">${parseDate(e.date).toLocaleDateString(undefined, dateFormat)}</span>` +
      `<span class="ei-title">${escape(e.title || 'Untitled page')}</span>` +
      (snippet ? `<span class="ei-snippet">${escape(snippet)}</span>` : '') +
      `</span></button>`;
  }

  function renderList() {
    els.viewSeg.querySelectorAll('button').forEach(b => {
      const on = b.dataset.view === state.view;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on);
    });
    const q = els.search.value.trim().toLowerCase();
    els.list.innerHTML = q ? searchHtml(q) : state.view === 'list' ? treeHtml() : calendarHtml();
  }

  function searchHtml(q) {
    const hits = sortedEntries().filter(e => e.title.toLowerCase().includes(q) || e.body.toLowerCase().includes(q));
    if (!hits.length) return '<p class="empty-list">No pages match your search.</p>';
    return `<div class="side-label">${hits.length} found</div>` +
      hits.map(e => entryItem(e, { year: 'numeric', month: 'short', day: 'numeric' })).join('');
  }

  function treeHtml() {
    const years = new Map();
    for (const e of sortedEntries()) {
      const y = e.date.slice(0, 4);
      const m = e.date.slice(0, 7);
      if (!years.has(y)) years.set(y, new Map());
      const months = years.get(y);
      if (!months.has(m)) months.set(m, []);
      months.get(m).push(e);
    }
    let html = '';
    for (const [y, months] of years) {
      const total = [...months.values()].reduce((n, list) => n + list.length, 0);
      html += `<details class="tree-year" data-key="${y}"${expanded.has(y) ? ' open' : ''}>` +
        `<summary>${y}<span class="count">${total}</span></summary>`;
      for (const [m, list] of months) {
        const name = parseDate(`${m}-01`).toLocaleDateString(undefined, { month: 'long' });
        html += `<details class="tree-month" data-key="${m}"${expanded.has(m) ? ' open' : ''}>` +
          `<summary>${name}<span class="count">${list.length}</span></summary>${list.map(e => entryItem(e)).join('')}</details>`;
      }
      html += '</details>';
    }
    return html;
  }

  function calendarHtml() {
    const byDate = new Map();
    for (const e of [...state.entries].sort((a, b) => a.createdAt - b.createdAt)) {
      if (!byDate.has(e.date)) byDate.set(e.date, []);
      byDate.get(e.date).push(e);
    }
    const cur = current();

    if (cal.zoom === 'year') {
      let total = 0;
      let html = `<div class="cal-head"><button class="cal-nav" type="button" data-nav="-1" aria-label="Previous year">‹</button>` +
        `<button class="cal-title up" type="button" data-zoom="month" title="Back to month">${cal.y}</button>` +
        `<button class="cal-nav" type="button" data-nav="1" aria-label="Next year">›</button></div><div class="cal-months">`;
      for (let m = 0; m < 12; m++) {
        const prefix = `${cal.y}-${pad(m + 1)}`;
        const n = state.entries.filter(e => e.date.startsWith(prefix)).length;
        total += n;
        const name = new Date(cal.y, m, 1).toLocaleDateString(undefined, { month: 'short' });
        html += `<button class="cal-month${n ? ' has' : ''}${cur.date.startsWith(prefix) ? ' cur' : ''}" type="button" data-month="${m}">` +
          `<span class="cm-name">${name}</span><span class="cm-count">${n ? pages(n) : '–'}</span></button>`;
      }
      return html + `</div><div class="side-label">${cal.y} · ${pages(total)}</div>`;
    }

    const title = new Date(cal.y, cal.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    let html = `<div class="cal-head"><button class="cal-nav" type="button" data-nav="-1" aria-label="Previous month">‹</button>` +
      `<button class="cal-title" type="button" data-zoom="year" title="Pick a month">${title}</button>` +
      `<button class="cal-nav" type="button" data-nav="1" aria-label="Next month">›</button></div><div class="cal-grid">`;
    for (let i = 0; i < 7; i++) {
      html += `<span class="cal-dow">${new Date(2023, 0, 1 + i).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>`;
    }
    html += '<span></span>'.repeat(new Date(cal.y, cal.m, 1).getDay());
    const days = new Date(cal.y, cal.m + 1, 0).getDate();
    const today = todayStr();
    for (let d = 1; d <= days; d++) {
      const date = `${cal.y}-${pad(cal.m + 1)}-${pad(d)}`;
      const list = byDate.get(date) || [];
      const cls = ['cal-day', list.length && 'has', date === today && 'today', date === cal.day && 'sel', date === cur.date && 'cur'].filter(Boolean).join(' ');
      const mark = list.length ? (list[0].mood ? `<span class="cd-mark">${escape(list[0].mood)}</span>` : '<span class="cd-dot"></span>') : '';
      html += `<button class="${cls}" type="button" data-date="${date}" aria-label="${parseDate(date).toLocaleDateString(undefined, { dateStyle: 'long' })}, ${pages(list.length)}">` +
        `<span class="cd-num">${d}</span>${mark}${list.length > 1 ? `<span class="cd-more">${list.length}</span>` : ''}</button>`;
    }
    html += '</div>';

    if (cal.day) {
      const list = byDate.get(cal.day) || [];
      html += `<div class="side-label">${parseDate(cal.day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}` +
        `<button class="link-btn" type="button" data-clear-day>whole month</button></div>` +
        list.map(e => entryItem(e)).join('') +
        `<button class="btn add-day" type="button" data-new-on="${cal.day}">＋ Write a page for this day</button>`;
    } else {
      const prefix = `${cal.y}-${pad(cal.m + 1)}`;
      const list = sortedEntries().filter(e => e.date.startsWith(prefix));
      html += `<div class="side-label">This month · ${pages(list.length)}</div>` +
        (list.length ? list.map(e => entryItem(e)).join('') : '<p class="empty-list">No pages this month yet.</p>');
    }
    return html;
  }

  // ---------- Stickers on the page ----------
  function positionSticker(el, st, index) {
    el.style.left = st.x + '%';
    el.style.top = st.y + 'px';
    el.style.width = st.size + 'px';
    el.style.fontSize = st.size * 0.8 + 'px';
    el.style.setProperty('--rot', st.rot + 'deg');
    if (index !== undefined) el.style.zIndex = index + 1;
  }

  function renderStickers() {
    const entry = current();
    els.layer.innerHTML = '';
    entry.stickers.forEach((st, i) => {
      const el = document.createElement('div');
      const photo = isPhoto(st.ref);
      el.className = 'sticker' + (Stickers.meta(st.ref).tape ? ' is-tape' : '') +
        (photo ? ` is-photo frame-${st.frame}` : '') + (st.id === selectedStickerId ? ' selected' : '');
      el.dataset.id = st.id;
      el.innerHTML = `<div class="sticker-art">${photo ? photoHtml(st) : Stickers.render(st.ref)}</div>` +
        `<button class="st-del" type="button" aria-label="Remove">×</button>` +
        (photo ? `<button class="st-frame" type="button" aria-label="Change frame" title="Change frame">🖼️</button>` : '') +
        `<span class="st-handle" aria-hidden="true"></span>`;
      positionSticker(el, st, i);
      els.layer.appendChild(el);
    });
    fitPage();
  }

  const photoHtml = st => `<div class="photo"><img src="${photoUrl(st.ref.slice(6))}" alt="" draggable="false"></div>`;

  els.layer.addEventListener('error', e => {
    const img = e.target;
    if (img.tagName !== 'IMG') return;
    const box = img.parentElement;
    box.classList.add('missing');
    box.textContent = '📷 Photo not found';
  }, true);

  // Grow the page so stickers placed near the bottom never fall off it.
  function fitPage() {
    const bottom = current().stickers.reduce((max, st) => Math.max(max, st.y + st.size / 2), 0);
    els.page.style.setProperty('--sticker-bottom', `${Math.round(bottom + 40)}px`);
  }

  function selectSticker(id) {
    selectedStickerId = id;
    els.layer.querySelectorAll('.sticker').forEach(el => el.classList.toggle('selected', el.dataset.id === id));
  }

  function bringToFront(st) {
    const list = current().stickers;
    list.splice(list.indexOf(st), 1);
    list.push(st);
    list.forEach((s, i) => {
      const el = els.layer.querySelector(`[data-id="${s.id}"]`);
      if (el) el.style.zIndex = i + 1;
    });
  }

  function removeSticker(id) {
    const entry = current();
    entry.stickers = entry.stickers.filter(s => s.id !== id);
    if (selectedStickerId === id) selectedStickerId = null;
    renderStickers();
    updateWordCount(entry);
    touch(entry);
    gcPhotos();
  }

  // opts.x (%) / opts.y (px) place the sticker exactly, e.g. where a photo was dropped.
  function addSticker(ref, opts = {}) {
    const entry = current();
    const photo = isPhoto(ref);
    const size = photo ? Math.round(Math.min(220, els.layer.clientWidth * 0.55)) : Stickers.meta(ref).size;
    const rect = els.page.getBoundingClientRect();
    const trayCovers = window.matchMedia('(max-width: 1180px)').matches && els.tray.classList.contains('open');
    const visTop = Math.max(rect.top, 70);
    const visBottom = Math.min(rect.bottom, window.innerHeight - (trayCovers ? els.tray.offsetHeight : 0));
    const y = visBottom > visTop + 40 ? (visTop + visBottom) / 2 - rect.top : 160;
    const st = {
      id: uid(), ref,
      x: opts.x ?? clamp(50 + (Math.random() * 36 - 18), 10, 90),
      y: opts.y ?? Math.max(size / 2, y + (Math.random() * 60 - 30)),
      size,
      rot: Math.round(Math.random() * (photo ? 10 : 24) - (photo ? 5 : 12)),
    };
    if (photo) st.frame = opts.frame || 'polaroid';
    entry.stickers.push(st);
    selectedStickerId = st.id;
    renderStickers();
    updateWordCount(entry);
    touch(entry);
  }

  els.layer.addEventListener('pointerdown', e => {
    const el = e.target.closest('.sticker');
    if (!el || e.target.closest('.st-del, .st-frame')) return;
    const st = current().stickers.find(s => s.id === el.dataset.id);
    if (!st) return;
    e.preventDefault();
    selectSticker(st.id);
    bringToFront(st);

    const layerRect = els.layer.getBoundingClientRect();
    if (e.target.closest('.st-handle')) {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      drag = {
        mode: 'transform', st, el, cx, cy,
        startDist: Math.max(10, Math.hypot(e.clientX - cx, e.clientY - cy)),
        startAngle: Math.atan2(e.clientY - cy, e.clientX - cx),
        startSize: st.size, startRot: st.rot,
      };
    } else {
      drag = {
        mode: 'move', st, el,
        offX: e.clientX - (layerRect.left + (st.x / 100) * layerRect.width),
        offY: e.clientY - (layerRect.top + st.y),
      };
    }
    drag.moved = false;
    el.classList.add('dragging');
    el.setPointerCapture(e.pointerId);
  });

  els.layer.addEventListener('pointermove', e => {
    if (!drag) return;
    const { st, el } = drag;
    if (drag.mode === 'move') {
      const r = els.layer.getBoundingClientRect();
      st.x = clamp(((e.clientX - drag.offX - r.left) / r.width) * 100, 0, 100);
      st.y = clamp(e.clientY - drag.offY - r.top, 0, r.height + 30);
    } else {
      const dist = Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy);
      const angle = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx);
      st.size = Math.round(clamp(drag.startSize * (dist / drag.startDist), 24, 600));
      let rot = drag.startRot + ((angle - drag.startAngle) * 180) / Math.PI;
      if (e.shiftKey) rot = Math.round(rot / 15) * 15;
      st.rot = Math.round(rot) % 360;
    }
    drag.moved = true;
    positionSticker(el, st);
  });

  function endDrag() {
    if (!drag) return;
    drag.el.classList.remove('dragging');
    if (drag.moved) {
      fitPage();
      touch();
    }
    drag = null;
  }
  els.layer.addEventListener('pointerup', endDrag);
  els.layer.addEventListener('pointercancel', endDrag);

  els.layer.addEventListener('click', e => {
    const del = e.target.closest('.st-del');
    if (del) removeSticker(del.closest('.sticker').dataset.id);
    const frameBtn = e.target.closest('.st-frame');
    if (frameBtn) {
      const el = frameBtn.closest('.sticker');
      const st = current().stickers.find(s => s.id === el.dataset.id);
      el.classList.remove(`frame-${st.frame}`);
      st.frame = FRAMES[(FRAMES.indexOf(st.frame) + 1) % FRAMES.length];
      el.classList.add(`frame-${st.frame}`);
      touch();
    }
  });

  // ---------- Photos ----------
  function hasTransparency(canvas) {
    const probe = document.createElement('canvas');
    probe.width = probe.height = 48;
    const ctx = probe.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0, 48, 48);
    const data = ctx.getImageData(0, 0, 48, 48).data;
    for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true;
    return false;
  }

  // Downscale big camera photos, then lower the quality (and if need be the size) until the photo is under PHOTO_BYTES.
  // Transparent PNGs keep their transparency, so for them only the size can shrink.
  async function shrinkImage(file) {
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    let side = PHOTO_MAX;
    let quality = 0.86;
    let transparent = null;
    try {
      for (;;) {
        const scale = Math.min(1, side / Math.max(bmp.width, bmp.height));
        canvas.width = Math.max(1, Math.round(bmp.width * scale));
        canvas.height = Math.max(1, Math.round(bmp.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
        transparent ??= file.type !== 'image/jpeg' && hasTransparency(canvas);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, transparent ? 'image/png' : 'image/jpeg', quality));
        if (!blob) throw new Error('Could not encode image');
        if (blob.size <= PHOTO_BYTES) return { blob, transparent };
        if (!transparent && quality > 0.6) quality -= 0.13;
        else if (side > 300) side = Math.round(Math.min(side, Math.max(canvas.width, canvas.height)) * 0.8);
        else throw new Error('Image too big');
      }
    } finally {
      bmp.close();
    }
  }

  async function addPhotos(files, at) {
    const images = [...files].filter(f => f.type.startsWith('image/'));
    if (!images.length) return toast('Please choose an image file.');
    const entry = current();
    let i = 0;
    for (const file of images) {
      try {
        toast(images.length > 1 ? `Adding photo ${i + 1} of ${images.length}…` : 'Adding photo…');
        const { blob, transparent } = await shrinkImage(file);
        const pid = uid();
        await Api.put(`/api/photos/${pid}`, blob);
        knownPhotos.add(pid);
        if (!state.entries.includes(entry)) return; // the page was torn out while the photo uploaded
        if (current() !== entry) openEntry(entry.id);
        const offset = i++ * 24;
        addSticker(`photo:${pid}`, {
          frame: transparent ? 'none' : 'polaroid',
          ...(at && { x: clamp(at.x + offset / 10, 0, 100), y: at.y + offset }),
        });
        els.toast.hidden = true;
      } catch (err) {
        toast(err.status !== undefined ? `Couldn't add "${file.name}": ${err.message}` : `Couldn't add "${file.name}". Try a JPG or PNG.`);
      }
    }
  }

  const referencedPhotos = () => photoIdsIn(state.entries);

  // Remove photos from the server that no page uses any more (after saving, so the server agrees).
  async function gcPhotos() {
    const used = referencedPhotos();
    const unused = [...knownPhotos].filter(id => !used.has(id));
    if (!unused.length) return;
    await saveNow();
    if (dirty.size) return; // not saved yet: try again on the next tidy-up
    for (const id of unused) {
      try {
        await Api.del(`/api/photos/${id}`);
        knownPhotos.delete(id);
      } catch (err) {
        if (err.status === 409) knownPhotos.delete(id);
      }
    }
  }

  els.photoBtn.addEventListener('click', () => els.photoInput.click());
  els.photoInput.addEventListener('change', () => {
    addPhotos(els.photoInput.files);
    els.photoInput.value = '';
  });

  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', e => { if (hasFiles(e)) e.preventDefault(); });
  els.page.addEventListener('dragover', e => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    els.page.classList.add('drop-hover');
  });
  els.page.addEventListener('dragleave', e => {
    if (!els.page.contains(e.relatedTarget)) els.page.classList.remove('drop-hover');
  });
  els.page.addEventListener('drop', e => {
    els.page.classList.remove('drop-hover');
    if (!hasFiles(e)) return;
    e.preventDefault();
    const r = els.layer.getBoundingClientRect();
    addPhotos(e.dataTransfer.files, { x: ((e.clientX - r.left) / r.width) * 100, y: e.clientY - r.top });
  });
  document.addEventListener('paste', e => {
    const images = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
    if (!images.length) return;
    e.preventDefault();
    addPhotos(images);
  });

  document.addEventListener('pointerdown', e => {
    if (selectedStickerId && !e.target.closest('.sticker') && !e.target.closest('.tray')) selectSticker(null);
  });

  // ---------- Sticker tray ----------
  let activePack = Stickers.PACKS[0].id;
  function renderTray() {
    els.trayTabs.innerHTML = Stickers.PACKS.map(p =>
      `<button class="tray-tab${p.id === activePack ? ' active' : ''}" type="button" role="tab" aria-selected="${p.id === activePack}" data-pack="${p.id}">${p.label}</button>`).join('');
    const pack = Stickers.PACKS.find(p => p.id === activePack);
    els.trayGrid.innerHTML = pack.items.map(ref =>
      `<button class="tray-item${Stickers.meta(ref).wide ? ' wide' : ''}" type="button" data-ref="${escape(ref)}" aria-label="Add sticker">${Stickers.render(ref)}</button>`).join('');
  }
  els.trayTabs.addEventListener('click', e => {
    const tab = e.target.closest('.tray-tab');
    if (!tab) return;
    activePack = tab.dataset.pack;
    renderTray();
  });
  els.trayGrid.addEventListener('click', e => {
    const item = e.target.closest('.tray-item');
    if (item) addSticker(item.dataset.ref);
  });

  function setTray(open) {
    els.tray.classList.toggle('open', open);
    document.body.classList.toggle('tray-open', open);
  }
  els.fab.addEventListener('click', () => setTray(true));
  els.trayClose.addEventListener('click', () => setTray(false));

  // ---------- Entry editing ----------
  els.title.addEventListener('input', () => {
    const entry = current();
    entry.title = els.title.value;
    updateWordCount(entry);
    renderList();
    touch(entry);
  });

  els.body.addEventListener('input', () => {
    const entry = current();
    entry.body = els.body.value;
    autosize();
    updateWordCount(entry);
    renderList();
    touch(entry);
  });

  els.dateBadge.addEventListener('click', () => {
    try {
      els.dateInput.showPicker();
    } catch {
      els.dateInput.classList.add('visible');
      els.dateInput.focus();
    }
  });
  els.dateInput.addEventListener('change', () => {
    if (!els.dateInput.value) return;
    const entry = current();
    entry.date = els.dateInput.value;
    expandFor(entry.date);
    const d = parseDate(entry.date);
    Object.assign(cal, { y: d.getFullYear(), m: d.getMonth(), zoom: 'month', day: null });
    els.dateInput.classList.remove('visible');
    renderMeta(entry);
    renderList();
    touch(entry);
  });

  function setupPicker(btn, pop, options, key) {
    pop.innerHTML = options.map(([emo, name]) => `<button type="button" data-v="${emo}" title="${name}" aria-label="${name}">${emo}</button>`).join('') +
      `<button type="button" class="clear" data-v="" title="Clear">clear</button>`;
    btn.addEventListener('click', () => {
      const willOpen = pop.hidden;
      closePops();
      pop.hidden = !willOpen;
      btn.setAttribute('aria-expanded', willOpen);
    });
    pop.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      const entry = current();
      entry[key] = b.dataset.v;
      closePops();
      renderMeta(entry);
      renderList();
      touch(entry);
    });
  }
  function closePops() {
    [[els.moodBtn, els.moodPop], [els.weatherBtn, els.weatherPop]].forEach(([btn, pop]) => {
      pop.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    });
  }
  setupPicker(els.moodBtn, els.moodPop, MOODS, 'mood');
  setupPicker(els.weatherBtn, els.weatherPop, WEATHERS, 'weather');
  document.addEventListener('click', e => { if (!e.target.closest('.picker')) closePops(); });

  els.templates.addEventListener('click', e => {
    const b = e.target.closest('.tpl');
    if (!b) return;
    const entry = current();
    entry.theme = b.dataset.theme;
    state.defaultTheme = entry.theme;
    prefsDirty = true;
    applyTheme(entry);
    renderList();
    touch(entry);
  });

  // ---------- Pages ----------
  // fromCalendar keeps the calendar where the user is browsing; otherwise it jumps to the page's month.
  function openEntry(id, { fromCalendar = false } = {}) {
    if (saveTimer) saveNow();
    state.currentId = id;
    selectedStickerId = null;
    const entry = current();
    expandFor(entry.date);
    if (!fromCalendar) {
      const d = parseDate(entry.date);
      Object.assign(cal, { y: d.getFullYear(), m: d.getMonth(), zoom: 'month', day: null });
    }
    renderEntry();
    renderList();
    setDrawer(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    local.set(LAST_PAGE_KEY, id);
  }

  els.list.addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.classList.contains('entry-item')) return openEntry(t.dataset.id, { fromCalendar: true });
    if (t.dataset.nav) {
      const step = Number(t.dataset.nav);
      if (cal.zoom === 'year') cal.y += step;
      else {
        const d = new Date(cal.y, cal.m + step, 1);
        cal.y = d.getFullYear();
        cal.m = d.getMonth();
      }
      cal.day = null;
    } else if (t.dataset.zoom) {
      cal.zoom = t.dataset.zoom;
    } else if (t.dataset.month) {
      Object.assign(cal, { m: Number(t.dataset.month), zoom: 'month', day: null });
    } else if (t.dataset.date) {
      const date = t.dataset.date;
      cal.day = cal.day === date ? null : date;
      const onDay = state.entries.filter(x => x.date === date);
      if (cal.day && onDay.length === 1) return openEntry(onDay[0].id, { fromCalendar: true });
    } else if ('clearDay' in t.dataset) {
      cal.day = null;
    } else if (t.dataset.newOn) {
      const entry = newEntry({ date: t.dataset.newOn });
      state.entries.push(entry);
      openEntry(entry.id, { fromCalendar: true });
      return els.title.focus();
    } else return;
    renderList();
  });

  // Remember which year / month folders are open across re-renders.
  els.list.addEventListener('toggle', e => {
    const key = e.target.dataset?.key;
    if (key) e.target.open ? expanded.add(key) : expanded.delete(key);
  }, true);

  els.viewSeg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    state.view = b.dataset.view;
    els.search.value = '';
    renderList();
    touchPrefs();
  });

  $('newBtn').addEventListener('click', () => {
    const entry = newEntry();
    state.entries.push(entry);
    els.search.value = '';
    openEntry(entry.id);
    els.title.focus();
  });

  $('deleteBtn').addEventListener('click', async () => {
    const entry = current();
    const name = entry.title ? `"${entry.title}"` : 'this page';
    if (!confirm(`Tear out ${name}? This can't be undone.`)) return;
    dirty.delete(entry.id);
    state.entries = state.entries.filter(e => e.id !== entry.id);
    if (!state.entries.length) state.entries.push(newEntry());
    openEntry(sortedEntries()[0].id);
    try {
      await saveChain; // a save of this page that's already on its way must not bring it back
      await Api.del(`/api/entries/${entry.id}`);
      toast('Page torn out.');
      gcPhotos();
    } catch (err) {
      state.entries.push(entry);
      openEntry(entry.id);
      toast(`Couldn't tear out the page: ${err.message}`);
    }
  });

  els.search.addEventListener('input', renderList);

  // ---------- Drawer (small screens) ----------
  function setDrawer(open) {
    els.sidebar.classList.toggle('open', open);
    els.scrim.hidden = !open;
  }
  els.menuBtn.addEventListener('click', () => setDrawer(true));
  els.scrim.addEventListener('click', () => setDrawer(false));

  // ---------- Keyboard ----------
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName);
    if (e.key === 'Escape') {
      closePops();
      selectSticker(null);
      setDrawer(false);
      setTray(false);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedStickerId && !typing) {
      e.preventDefault();
      removeSticker(selectedStickerId);
    }
  });

  // ---------- Backup ----------
  const blobToDataUrl = blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const dataUrlToBlob = url => {
    const [head, b64] = url.split(',');
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: head.slice(5).split(';')[0] });
  };

  $('exportBtn').addEventListener('click', async () => {
    saveNow();
    toast('Preparing your backup…');
    const photos = {};
    for (const id of referencedPhotos()) {
      try {
        const res = await fetch(photoUrl(id));
        if (res.ok) photos[id] = await blobToDataUrl(await res.blob());
      } catch { /* a missing photo is skipped */ }
    }
    const data = { app: 'my-little-diary', version: 2, exportedAt: new Date().toISOString(), entries: state.entries, photos };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `my-diary-${todayStr()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(`Exported ${state.entries.length} page${state.entries.length === 1 ? '' : 's'}.`);
  });

  $('importInput').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let data, incoming;
    try {
      data = JSON.parse(await file.text());
      incoming = (Array.isArray(data) ? data : data.entries || []).map(sanitizeEntry).filter(Boolean);
      if (!incoming.length) throw new Error('empty');
    } catch {
      return toast("That file doesn't look like a diary backup.");
    }
    toast('Importing…');
    try {
      for (const [id, url] of Object.entries(data.photos || {})) {
        if (!/^[a-z0-9]{1,40}$/i.test(id) || knownPhotos.has(id) || typeof url !== 'string' || !url.startsWith('data:image/')) continue;
        let blob = dataUrlToBlob(url);
        if (blob.size > PHOTO_BYTES) blob = (await shrinkImage(blob)).blob;
        await Api.put(`/api/photos/${id}`, blob);
        knownPhotos.add(id);
      }
    } catch (err) {
      return toast(`Import stopped: ${err.message}`);
    }
    let added = 0, updated = 0;
    for (const entry of incoming) {
      const i = state.entries.findIndex(x => x.id === entry.id);
      if (i === -1) { state.entries.push(entry); added++; }
      else if (entry.updatedAt > state.entries[i].updatedAt) { state.entries[i] = entry; updated++; }
      else continue;
      dirty.add(entry.id);
    }
    renderEntry();
    renderList();
    await saveNow();
    toast(dirty.size ? `Imported ${added} new, ${updated} updated. Still saving…` : `Imported: ${added} new, ${updated} updated.`);
  });

  // ---------- Start ----------
  renderTemplates();
  renderTray();
  renderEntry();
  renderList();
  setStatus('');
  if (dirty.size) saveNow();
  window.addEventListener('resize', autosize);
  Account.mountMenu(user, { beforeLogout: saveNow });
  if (moved) toast(`Moved ${moved} page${moved === 1 ? '' : 's'} from this browser into your account.`);
})();
