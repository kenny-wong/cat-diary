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
    if (Demo.active && path !== '/api/me') return Demo.request(method, path, body); // trying it without an account
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
    del: (path, body) => request('DELETE', path, body),
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
      if (Demo.active) return tryIt();
      return open(err.message);
    }
    if (me.user) {
      if (Demo.active) { // signed in already: /?try just opens your own diary
        Demo.active = false;
        history.replaceState(null, '', location.pathname);
      }
      currentUser = me.user;
      return me.user;
    }
    if (Demo.active) return tryIt();
    return open(authError || (me.google ? '' : AUTH_ERRORS['google-off']));
  }

  async function tryIt() {
    document.body.classList.add('trying');
    $('tryBar').hidden = false;
    return Demo.start();
  }

  // ---------- Account menu ----------
  function mountMenu(user, { beforeLogout }) {
    const btn = $('accountBtn');
    const pop = $('accountPop');
    const showName = () => {
      $('accountName').textContent = user.name || user.email;
      btn.querySelector('.label').textContent = user.name || user.email.split('@')[0];
    };
    showName();
    $('accountEmail').textContent = user.email;
    btn.hidden = false;

    // Changing your name
    const form = $('nameForm');
    const input = $('nameInput');
    const msg = (text, isError = false) => {
      $('nameMsg').textContent = text;
      $('nameMsg').classList.toggle('error', isError);
    };
    $('editNameBtn').addEventListener('click', () => {
      form.hidden = !form.hidden;
      msg('');
      if (!form.hidden) {
        input.value = user.name;
        input.focus();
        input.select();
      }
    });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name) return msg('Please enter a name.', true);
      if (name === user.name) return (form.hidden = true);
      msg('Saving…');
      try {
        user.name = (await Api.put('/api/me', { name })).user.name;
        if (currentUser) currentUser.name = user.name;
        showName();
        form.hidden = true;
        msg('');
      } catch (err) {
        msg(err.message, true);
      }
    });
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
