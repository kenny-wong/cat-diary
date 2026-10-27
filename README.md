# My Little Diary 🐾

A cute, decorated diary that runs entirely in your browser — no install, no account, no server.

## Features

- **Templates** — dress each page in Cat Café, Sakura, Seaside, Forest, Starry Night or Vintage, each with its own colours, paper style and decorations.
- **Stickers** — hand-drawn cat stickers, washi tapes, labels and emoji. Drag to move, pull the corner dot to resize and spin, × to peel off.
- **Photos** — add photos from the sticker box, or drop / paste them onto the page. Choose a polaroid, taped, round or cut-out frame.
- **Mood & weather** for every page.
- **Calendar view** with moods on each day, a year overview, and a Year › Month folder list. Plus search.
- **Autosave** in the browser, with Export / Import for backups (photos included).
- Works on desktop and phone.

## Usage

Open `index.html` in a browser. That's it.

Pages are saved in the browser's own storage (text in `localStorage`, photos in IndexedDB), so they stay on the device and browser you write them in. Use **Export** now and then to keep a backup file, and **Import** to restore it or move your diary to another browser.

## Files

| File | What it does |
| --- | --- |
| `index.html` | Page layout |
| `style.css` | Templates, page and sticker styling |
| `stickers.js` | Sticker artwork (inline SVG) and sticker packs |
| `app.js` | Diary logic: pages, templates, stickers, photos, calendar, saving |
