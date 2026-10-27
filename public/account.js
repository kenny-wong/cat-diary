// Talking to the server, and the "Continue with Google" sign-in screen.
(() => {
  'use strict';

  const $ = id => document.getElementById(id);

  // ---------- API ----------
  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  }

  async function request(method, path, body, { keepalive = false } = {}) {
    const opts = { method, headers: {}, credentials: 'same-origin', keepalive };
    if (body instanceof Blob) {
      opts.body = body;
      opts.headers['Content-Type'] = body.type || 'application/octet-stream';
    } else if (body !== undefined) {
      opts.body = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
    }
    let res;
    try {
      res = await fetch(path, opts);
    } catch {
      throw new ApiError("Can't reach your diary. Check your internet connection.", 0);
    }
    const data = (res.headers.get('Content-Type') || '').includes('application/json') ? await res.json().catch(() => ({})) : {};
    if (res.status === 401 && !path.startsWith('/api/auth/') && currentUser) relogin();
    if (!res.ok) throw new ApiError(data.error || `Something went wrong (${res.status}).`, res.status);
    return data;
  }

  const Api = {
    get: path => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body, opts) => request('PUT', path, body, opts),
    del: path => request('DELETE', path),
  };

  // ---------- Sign-in screen ----------
  const AUTH_ERRORS = {
    google: "Google sign-in didn't work. Please try again.",
    'google-off': "Sign-in isn't switched on yet. Please try again later.",
    taken: 'Another Google account already has a diary with this email address.',
  };

  let currentUser = null;

  function open(message) {
    $('authMsg').textContent = message || '';
    $('auth').hidden = false;
    document.body.classList.add('auth-open');
    return new Promise(() => {}); // signing in leaves the page for Google and comes back with a fresh load
  }

  // Session ran out while writing: unsaved changes wait in the page while the person signs in again in a new tab.
  let reloginPromise = null;
  function relogin() {
    reloginPromise ||= new Promise(resolve => {
      $('googleBtn').target = '_blank';
      $('authMsg').textContent = 'You were logged out. Sign in again (it opens in a new tab), then come back here: your diary keeps saving.';
      $('auth').hidden = false;
      window.addEventListener('focus', async function check() {
        try {
          const me = await Api.get('/api/me');
          if (!me.user) return;
          window.removeEventListener('focus', check);
          if (me.user.id !== currentUser.id) return location.reload();
          reloginPromise = null;
          $('googleBtn').removeAttribute('target');
          $('auth').hidden = true;
          resolve(me.user);
        } catch { /* still offline: try again on the next focus */ }
      });
    });
    return reloginPromise;
  }

  async function start() {
    const hash = new URLSearchParams(location.hash.slice(1));
    const authError = AUTH_ERRORS[hash.get('auth-error')];
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);

    let me;
    try {
      me = await Api.get('/api/me');
    } catch (err) {
      return open(err.message);
    }
    if (me.user) {
      currentUser = me.user;
      return me.user;
    }
    return open(authError || (me.google ? '' : AUTH_ERRORS['google-off']));
  }

  // ---------- Account menu ----------
  function mountMenu(user, { beforeLogout }) {
    const btn = $('accountBtn');
    const pop = $('accountPop');
    $('accountName').textContent = user.name || user.email;
    $('accountEmail').textContent = user.email;
    btn.querySelector('.label').textContent = user.name || user.email.split('@')[0];
    btn.hidden = false;
    btn.addEventListener('click', () => {
      pop.hidden = !pop.hidden;
      btn.setAttribute('aria-expanded', !pop.hidden);
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('#accountBtn, #accountPop')) {
        pop.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
      }
    });
    $('logoutBtn').addEventListener('click', async () => {
      await beforeLogout();
      try {
        await Api.post('/api/auth/logout');
      } catch { /* the reload below shows the sign-in screen either way */ }
      location.reload();
    });
  }

  window.Api = Api;
  window.Account = { start, relogin, mountMenu };
})();
