# My Little Diary 🐾

A cute, decorated online diary. Everyone gets their own private diary: sign up with email and password or continue with Google, and your pages follow you to any phone or computer.

Live at **https://cat-diary-b6y.pages.dev**

## Features

- **Accounts**: sign up with email and password, or continue with Google. Each person's pages and photos are private to them.
- **Templates**: dress each page in Cat Café, Sakura, Seaside, Forest, Starry Night or Vintage, each with its own colours, paper style and decorations.
- **Stickers**: hand-drawn cat stickers, washi tapes, labels and emoji. Drag to move, pull the corner dot to resize and spin, × to peel off.
- **Photos**: add photos from the sticker box, or drop / paste them onto the page. They are shrunk to under 1.5 MB before uploading. Choose a polaroid, taped, round or cut-out frame.
- **Mood & weather** for every page.
- **Calendar view** with moods on each day, a year overview, and a Year › Month folder list. Plus search.
- **Autosave** to your account, with Export / Import for backups (photos included).
- Diaries written in the browser before accounts existed are offered for moving into the account on first login.
- Works on desktop and phone.

## How it's built

Plain HTML, CSS and JavaScript in `public/` (no build step), hosted on Cloudflare Pages. The API is Cloudflare Pages Functions in `functions/api/`, and data lives in Cloudflare D1 (SQLite): users, sessions, pages and photos.

| Path | What it does |
| --- | --- |
| `public/index.html` | Page layout, login screen |
| `public/style.css` | Templates, page, sticker and login styling |
| `public/stickers.js` | Sticker artwork (inline SVG) and sticker packs |
| `public/account.js` | API calls, log in / sign up / password reset screen, account menu |
| `public/app.js` | Diary logic: pages, templates, stickers, photos, calendar, saving |
| `public/_headers` | Security headers (CSP and friends) |
| `functions/api/` | API routes: `auth/*`, `me`, `diary`, `prefs`, `entries/:id`, `photos/:id` |
| `lib/` | Shared server code: password hashing, sessions, validation, Google sign-in, email |
| `migrations/` | D1 database schema |
| `tests/` | Unit tests (`npm test`) |

### Security notes

- Passwords are hashed with PBKDF2-SHA256 (100,000 iterations, random salt).
- Sessions are random tokens in an `HttpOnly; Secure; SameSite=Lax` cookie. Only their SHA-256 is stored.
- Cross-site writes are blocked by an `Origin` check. Logins are rate-limited per email.
- Every query is scoped to the logged-in user, and photos are served only to their owner.

## Running locally

```sh
npm install
npm run db:migrate:local
npm run dev          # http://localhost:8790
npm test
```

## Settings (Cloudflare Pages → Settings → Variables and Secrets)

| Name | For |
| --- | --- |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | "Continue with Google". The button appears once both are set. |
| `RESEND_API_KEY`, `MAIL_FROM` | Password reset emails via [Resend](https://resend.com). "Forgot password?" appears once both are set. `MAIL_FROM` must be on a domain verified in Resend, e.g. `My Little Diary <diary@example.com>`. |

For local development put the same names in `.dev.vars` (never committed).

### Setting up Google sign-in

1. Go to https://console.cloud.google.com/, create a project, then **APIs & Services → OAuth consent screen**: choose *External*, fill in the app name and your email, and publish the app.
2. **APIs & Services → Credentials → Create credentials → OAuth client ID**, type *Web application*.
3. Under **Authorized redirect URIs** add `https://cat-diary-b6y.pages.dev/api/auth/google/callback` (and `http://localhost:8790/api/auth/google/callback` for local testing).
4. Put the client ID and secret into the Cloudflare settings above, then redeploy.

## Deploying

```sh
npm run db:migrate   # only when a new migration was added
npm run deploy
```
