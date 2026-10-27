# My Little Diary 🐾

A cute, decorated online diary. Everyone gets their own private diary: sign in with a Google account, and your pages follow you to any phone or computer.

Live at **https://my-little-diary.pages.dev**

## Features

- **Accounts**: "Continue with Google" is the only way in. A first sign-in creates the diary. Each person's pages and photos are private to them.
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
| `public/account.js` | API calls, "Continue with Google" screen, account menu |
| `public/app.js` | Diary logic: pages, templates, stickers, photos, calendar, saving |
| `public/privacy.html`, `public/terms.html` | Privacy policy and terms of service (linked from the login screen and account menu) |
| `public/_headers` | Security headers (CSP and friends) |
| `functions/api/` | API routes: `auth/google`, `auth/google/callback`, `auth/logout`, `me`, `diary`, `prefs`, `entries/:id`, `photos/:id` |
| `lib/` | Shared server code: tokens, sessions, validation, Google sign-in |
| `migrations/` | D1 database schema |
| `tests/` | Unit tests (`npm test`) |

### Security notes

- No passwords are stored: Google proves who each person is. The id_token's issuer, audience, expiry and verified email are checked.
- Sessions are random tokens in an `HttpOnly; Secure; SameSite=Lax` cookie. Only their SHA-256 is stored.
- Cross-site writes are blocked by an `Origin` check, and the Google sign-in uses a `state` cookie against forged callbacks.
- Every query is scoped to the logged-in user, and photos are served only to their owner.

## Running locally

```sh
npm install
npm run db:migrate:local
npm run dev          # http://localhost:8790
npm test
```

## Settings (Cloudflare Pages → my-little-diary → Settings → Variables and Secrets)

| Name | For |
| --- | --- |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | "Continue with Google". Both are set as encrypted secrets. Without them nobody can sign in. |

### Google sign-in setup (done once)

In Google Cloud Console (project "My Little Diary" → Google Auth Platform):

1. **Branding**: app name, support email, home page `https://my-little-diary.pages.dev`, privacy `…/privacy`, terms `…/terms`, authorised domain `my-little-diary.pages.dev`.
2. **Audience**: External, published (In production).
3. **Clients**: a Web application client with redirect URI `https://my-little-diary.pages.dev/api/auth/google/callback`.
4. Put the client ID and secret into the Cloudflare settings above (`wrangler pages secret put … --project-name my-little-diary`), then redeploy.

Local dev can't complete a Google sign-in (the localhost callback isn't registered), so local testing uses a session row inserted into the local database.

## Deploying

```sh
npm run db:migrate   # only when a new migration was added
npm run deploy
```
