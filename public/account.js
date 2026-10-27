// Talking to the server, and the log in / sign up screen.
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

  // ---------- Log in / sign up screen ----------
  const els = {
    auth: $('auth'), form: $('authForm'), title: $('authTitle'), sub: $('authSub'), tabs: $('authTabs'),
    google: $('googleBtn'), or: $('authOr'), msg: $('authMsg'), submit: $('authSubmit'),
    forgot: $('forgotLink'), back: $('backLink'), password: $('authPassword'),
  };

  const COPY = {
    login: { title: 'Welcome back!', sub: 'Log in to open your diary.', submit: 'Log in' },
    signup: { title: 'Start your own diary', sub: 'Your pages are private: only you can read them.', submit: 'Create my diary' },
    forgot: { title: 'Forgot your password?', sub: "Enter your email and we'll send you a link to choose a new one.", submit: 'Send reset link' },
    reset: { title: 'Choose a new password', sub: 'Pick a password with at least 8 characters.', submit: 'Save new password' },
  };
  const AUTH_ERRORS = {
    google: "Google sign-in didn't work. Please try again.",
    'google-off': "Google sign-in isn't switched on yet. Please use your email and password.",
  };

  let config = { google: false, reset: false };
  let mode = 'login';
  let resetToken = null;
  let currentUser = null;
  let firstUserId = null;
  let resolveLogin = null;
  let reloginPromise = null;

  function message(text, kind = 'error') {
    els.msg.textContent = text || '';
    els.msg.className = `auth-msg ${kind}`;
  }

  function setMode(m) {
    mode = m;
    const copy = COPY[m];
    els.title.textContent = copy.title;
    els.sub.textContent = copy.sub;
    els.submit.textContent = copy.submit;
    els.form.querySelectorAll('[data-modes]').forEach(el => { el.hidden = !el.dataset.modes.split(' ').includes(m); });
    const entry = m === 'login' || m === 'signup';
    els.tabs.hidden = !entry;
    els.tabs.querySelectorAll('button').forEach(b => {
      const on = b.dataset.mode === m;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on);
    });
    els.google.hidden = els.or.hidden = !(entry && config.google);
    els.forgot.hidden = !(m === 'login' && config.reset);
    els.back.hidden = entry;
    els.password.autocomplete = m === 'login' ? 'current-password' : 'new-password';
    message('');
  }

  function open(m, text) {
    setMode(m);
    if (text) message(text);
    els.auth.hidden = false;
    document.body.classList.add('auth-open');
    return new Promise(resolve => { resolveLogin = resolve; });
  }

  function done(user) {
    currentUser = user;
    firstUserId ??= user.id;
    els.auth.hidden = true;
    document.body.classList.remove('auth-open');
    els.form.reset();
    resolveLogin?.(user);
    resolveLogin = null;
  }

  els.tabs.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) setMode(b.dataset.mode);
  });
  els.forgot.addEventListener('click', () => setMode('forgot'));
  els.back.addEventListener('click', () => {
    resetToken = null;
    setMode('login');
  });

  els.form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(els.form);
    const email = String(f.get('email') || '').trim();
    const password = String(f.get('password') || '');
    els.submit.disabled = true;
    message('');
    try {
      if (mode === 'login') {
        done((await Api.post('/api/auth/login', { email, password })).user);
      } else if (mode === 'signup') {
        done((await Api.post('/api/auth/signup', { email, password, name: f.get('name') })).user);
      } else if (mode === 'forgot') {
        await Api.post('/api/auth/forgot', { email });
        message("If that email has a diary, a reset link is on its way. Check your inbox (and spam folder).", 'ok');
      } else if (mode === 'reset') {
        await Api.post('/api/auth/reset', { token: resetToken, password });
        resetToken = null;
        done((await Api.get('/api/me')).user);
      }
    } catch (err) {
      message(err.message);
    } finally {
      els.submit.disabled = false;
    }
  });

  // Session ran out while writing: log in again, then the diary carries on saving.
  // A different account on the same tab gets a fresh start instead.
  function relogin() {
    reloginPromise ||= open('login', 'You were logged out. Please log in again to keep saving.').then(user => {
      reloginPromise = null;
      if (user.id !== firstUserId) location.reload();
      return user;
    });
    return reloginPromise;
  }

  async function start() {
    const hash = new URLSearchParams(location.hash.slice(1));
    resetToken = hash.get('reset');
    const authError = AUTH_ERRORS[hash.get('auth-error')];
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);

    let me;
    try {
      me = await Api.get('/api/me');
    } catch (err) {
      return open('login', err.message);
    }
    config = me;
    if (resetToken) return open('reset');
    if (me.user) {
      done(me.user);
      return me.user;
    }
    return open('login', authError);
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
      } catch { /* the reload below shows the login screen either way */ }
      location.reload();
    });
  }

  window.Api = Api;
  window.Account = { start, relogin, mountMenu };
})();
