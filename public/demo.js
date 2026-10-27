// "Try it first": the diary without an account, at /?try. The same app runs, but its API calls are
// answered here from this browser: pages in localStorage, photos in IndexedDB (the store the browser-only
// diary used, so app.js moves them into an account the same way once the person signs in).
(() => {
  'use strict';

  const KEY = 'littleDiary:try:v1';
  const load = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      return saved && Array.isArray(saved.entries) ? saved : null;
    } catch {
      return null;
    }
  };
  let store = { entries: [], prefs: {} };
  const fail = (message, status) => Object.assign(new Error(message), { status });
  const persist = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch {
      throw fail("This device has no room to keep more pages. Sign in to keep writing.", 413);
    }
  };

  let dbPromise;
  const db = () => dbPromise || (dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open('littleDiaryPhotos', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('photos');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
  const photos = async (mode, fn) => {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction('photos', mode);
      const req = fn(tx.objectStore('photos'));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
    });
  };
  const urls = new Map(); // photo id -> blob: URL for <img>
  const photoIds = entries => new Set(entries.flatMap(e => (e.stickers || []).map(s => s.ref)).filter(r => r?.startsWith('photo:')).map(r => r.slice(6)));

  async function start() {
    store = load() || store;
    for (const id of photoIds(store.entries)) {
      try {
        const blob = await photos('readonly', s => s.get(id));
        if (blob) urls.set(id, URL.createObjectURL(blob));
      } catch { /* shows as a missing photo */ }
    }
    return { id: 'try', name: 'You', email: '', trying: true };
  }

  async function request(method, path, body) {
    const p = new URL(path, location.origin).pathname;
    let m;
    if (method === 'GET' && p === '/api/diary') return JSON.parse(JSON.stringify({ entries: store.entries, prefs: store.prefs }));
    if ((m = p.match(/^\/api\/entries\/([^/]+)$/)) && (method === 'PUT' || method === 'DELETE')) {
      const id = decodeURIComponent(m[1]);
      store.entries = store.entries.filter(e => e.id !== id);
      if (method === 'PUT') store.entries.push(JSON.parse(JSON.stringify(body)));
      persist();
      return {};
    }
    if (method === 'PUT' && p === '/api/prefs') {
      store.prefs = body;
      persist();
      return { prefs: body };
    }
    if ((m = p.match(/^\/api\/photos\/([^/]+)$/)) && (method === 'PUT' || method === 'DELETE')) {
      const id = decodeURIComponent(m[1]);
      URL.revokeObjectURL(urls.get(id));
      urls.delete(id);
      try {
        if (method === 'PUT') {
          await photos('readwrite', s => s.put(body, id));
          urls.set(id, URL.createObjectURL(body));
        } else {
          await photos('readwrite', s => s.delete(id));
        }
      } catch {
        throw fail("Couldn't keep the photo on this device.", 500);
      }
      return {};
    }
    // Things that need an account answer as if there were nothing yet.
    if (method === 'GET' && p === '/api/friends') return { friends: [], incoming: [], outgoing: [] };
    if (method === 'GET' && p === '/api/notifications') return { items: [], unread: 0 };
    if (method === 'GET' && p === '/api/push') return { key: null, reminder: null };
    throw fail('Sign in to do that.', 403);
  }

  // After signing in: the pages written while trying, and clearing them once they're in the account.
  const saved = () => load()?.entries || [];
  async function clear() {
    for (const id of photoIds(saved())) await photos('readwrite', s => s.delete(id)).catch(() => {});
    try { localStorage.removeItem(KEY); } catch { /* blocked */ }
  }

  window.Demo = {
    active: new URLSearchParams(location.search).has('try'),
    start, request, saved, clear,
    photoUrl: id => urls.get(id) || '',
  };
})();
