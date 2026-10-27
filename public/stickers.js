// Sticker artwork. SVG stickers are referenced as "svg:<name>", anything else is an emoji.
// No SVG here uses ids, so the same sticker can appear many times on one page.
const Stickers = (() => {
  const FONT = "Fredoka, 'Segoe UI', sans-serif";

  const paw = (x, y, scale = 1, rot = 0) =>
    `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${scale})">` +
    `<ellipse cy="5" rx="7.5" ry="6.5"/><circle cx="-8.5" cy="-4" r="3.2"/><circle cx="-3" cy="-9.5" r="3.2"/>` +
    `<circle cx="3" cy="-9.5" r="3.2"/><circle cx="8.5" cy="-4" r="3.2"/></g>`;

  const blossom = (cx, cy, r, fill = '#f7a8c0', center = '#e2577f') => {
    let petals = '';
    for (let i = 0; i < 5; i++) {
      petals += `<ellipse cx="${cx}" cy="${cy - r * 0.55}" rx="${r * 0.42}" ry="${r * 0.58}" transform="rotate(${i * 72} ${cx} ${cy})" fill="${fill}"/>`;
    }
    return petals + `<circle cx="${cx}" cy="${cy}" r="${r * 0.24}" fill="${center}"/>`;
  };

  const heart = (x, y, s, fill) =>
    `<path transform="translate(${x} ${y}) scale(${s})" fill="${fill}" d="M0 6 C-6 1 -8 -2 -8 -5 C-8 -8 -5 -10 -3 -10 C-1.5 -10 -.5 -9 0 -7.5 C.5 -9 1.5 -10 3 -10 C5 -10 8 -8 8 -5 C8 -2 6 1 0 6 Z"/>`;

  const svg = (vb, body) => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

  const TAPE_EDGE = 'M6 8 L154 8 L149 14 L155 20 L149 26 L155 32 L150 38 L6 38 L11 32 L5 26 L11 20 L5 14 Z';
  const tape = (color, pattern) => svg('0 0 160 46', `<path d="${TAPE_EDGE}" fill="${color}" opacity=".88"/>${pattern}`);

  const dots = (() => {
    let s = '';
    for (let x = 20; x <= 140; x += 16) {
      s += `<circle cx="${x}" cy="16" r="2.6" fill="#fff" opacity=".85"/><circle cx="${x + 8}" cy="30" r="2.6" fill="#fff" opacity=".85"/>`;
    }
    return s;
  })();
  const stripes = (() => {
    let s = '';
    for (let x = 16; x <= 132; x += 14) s += `<path d="M${x} 8 l10 30" stroke="#fff" stroke-width="5" opacity=".55"/>`;
    return s;
  })();
  const tapePaws = `<g fill="#c98a4b" opacity=".55">${paw(30, 24, .7, -15)}${paw(62, 22, .7, 12)}${paw(94, 25, .7, -10)}${paw(126, 22, .7, 15)}</g>`;
  const tapeHearts = [28, 58, 88, 118].map((x, i) => heart(x + 6, 23 + (i % 2 ? -2 : 2), .9, '#fff')).join('');

  const ART = {
    catFace: {
      size: 96,
      svg: svg('0 0 100 100', `
        <path d="M18 42 L21 8 L46 28 Z" fill="#f4a259"/><path d="M82 42 L79 8 L54 28 Z" fill="#f4a259"/>
        <path d="M25 34 L26 18 L38 28 Z" fill="#f7c6c7"/><path d="M75 34 L74 18 L62 28 Z" fill="#f7c6c7"/>
        <ellipse cx="50" cy="58" rx="38" ry="32" fill="#f4a259"/>
        <path d="M50 28 v9 M42 30 l2 7 M58 30 l-2 7" stroke="#d9822b" stroke-width="4" stroke-linecap="round"/>
        <ellipse cx="36" cy="55" rx="5" ry="6.5" fill="#3b2a20"/><ellipse cx="64" cy="55" rx="5" ry="6.5" fill="#3b2a20"/>
        <circle cx="37.8" cy="52.5" r="1.9" fill="#fff"/><circle cx="65.8" cy="52.5" r="1.9" fill="#fff"/>
        <ellipse cx="27" cy="67" rx="6" ry="3.8" fill="#f28c8c" opacity=".6"/><ellipse cx="73" cy="67" rx="6" ry="3.8" fill="#f28c8c" opacity=".6"/>
        <path d="M46 63 h8 l-4 4.5 z" fill="#e5737a"/>
        <path d="M50 67.5 q-3 5.5 -8 3 M50 67.5 q3 5.5 8 3" stroke="#3b2a20" stroke-width="2.2" fill="none" stroke-linecap="round"/>
        <path d="M10 60 l15 3 M11 71 l15 -2 M90 60 l-15 3 M89 71 l-15 -2" stroke="#3b2a20" stroke-width="1.8" stroke-linecap="round"/>`),
    },
    blackCat: {
      size: 96,
      svg: svg('0 0 100 100', `
        <path d="M70 88 C90 86 94 68 84 60" stroke="#2d2a32" stroke-width="7" fill="none" stroke-linecap="round"/>
        <path d="M30 92 C26 70 30 54 38 46 L34 20 L46 33 C49 32 53 32 56 33 L68 20 L64 46 C72 54 76 70 72 92 Z" fill="#2d2a32"/>
        <ellipse cx="44" cy="46" rx="4.2" ry="5.2" fill="#ffd166"/><ellipse cx="58" cy="46" rx="4.2" ry="5.2" fill="#ffd166"/>
        <ellipse cx="44" cy="46" rx="1.5" ry="4" fill="#2d2a32"/><ellipse cx="58" cy="46" rx="1.5" ry="4" fill="#2d2a32"/>
        <path d="M49 53 h4 l-2 2.5 z" fill="#f29bb0"/>
        <path d="M38 61 q13 7 26 0" stroke="#e85d75" stroke-width="4" fill="none" stroke-linecap="round"/>
        <circle cx="51" cy="66" r="3.4" fill="#ffd166"/>`),
    },
    catLoaf: {
      size: 110,
      svg: svg('0 0 120 86', `
        <ellipse cx="68" cy="62" rx="46" ry="22" fill="#c9ced8"/>
        <path d="M72 44 q4 8 0 16 M86 45 q4 8 0 15 M100 51 q3 6 0 12" stroke="#a9b0bd" stroke-width="4" fill="none" stroke-linecap="round"/>
        <path d="M20 40 L20 18 L36 30 Z M60 40 L60 18 L44 30 Z" fill="#d5dae3"/>
        <circle cx="40" cy="52" r="24" fill="#d5dae3"/>
        <path d="M23 34 L23 24 L31 29.5 Z M57 34 L57 24 L49 29.5 Z" fill="#f4b8c1"/>
        <path d="M28 53 q5 4 10 0 M42 53 q5 4 10 0" stroke="#4a4f5c" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <path d="M38 58 h4 l-2 2.5 z" fill="#e88a98"/>
        <ellipse cx="26" cy="61" rx="4" ry="2.5" fill="#f4b8c1" opacity=".8"/><ellipse cx="54" cy="61" rx="4" ry="2.5" fill="#f4b8c1" opacity=".8"/>
        <text x="80" y="30" font-family="${FONT}" font-weight="600" font-size="18" fill="#7d8aa8">z</text>
        <text x="94" y="17" font-family="${FONT}" font-weight="600" font-size="13" fill="#7d8aa8">z</text>`),
    },
    catHeart: {
      size: 84,
      svg: svg('0 0 100 100', `
        <path d="M14 26 L16 3 L37 15 Z M86 26 L84 3 L63 15 Z" fill="#ff8fab"/>
        <path d="M50 90 C20 68 8 52 8 36 C8 21 20 11 32 11 C40 11 46 15 50 23 C54 15 60 11 68 11 C80 11 92 21 92 36 C92 52 80 68 50 90 Z" fill="#ff8fab"/>
        <ellipse cx="37" cy="44" rx="4" ry="5" fill="#5a2a3a"/><ellipse cx="63" cy="44" rx="4" ry="5" fill="#5a2a3a"/>
        <path d="M43 55 q3.5 4 7 0 q3.5 4 7 0" stroke="#5a2a3a" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <ellipse cx="28" cy="54" rx="5" ry="3" fill="#ff5c8a" opacity=".5"/><ellipse cx="72" cy="54" rx="5" ry="3" fill="#ff5c8a" opacity=".5"/>`),
    },
    paw: {
      size: 76,
      svg: svg('0 0 100 100', `<g fill="#f48fb1">
        <ellipse cx="50" cy="66" rx="21" ry="18"/>
        <ellipse cx="23" cy="43" rx="8.5" ry="10.5" transform="rotate(-22 23 43)"/>
        <ellipse cx="40" cy="26" rx="8.5" ry="11.5"/><ellipse cx="60" cy="26" rx="8.5" ry="11.5"/>
        <ellipse cx="77" cy="43" rx="8.5" ry="10.5" transform="rotate(22 77 43)"/></g>`),
    },
    fish: {
      size: 90,
      svg: svg('0 0 100 100', `
        <path d="M74 50 L95 33 L90 50 L95 67 Z" fill="#4aa3c4"/>
        <path d="M8 50 C26 25 62 24 78 50 C62 76 26 75 8 50 Z" fill="#6ec3e0"/>
        <circle cx="26" cy="46" r="4" fill="#23395b"/><circle cx="27.3" cy="44.7" r="1.3" fill="#fff"/>
        <path d="M44 38 q6 12 0 24 M55 38 q6 12 0 24" stroke="#4aa3c4" stroke-width="3" fill="none" stroke-linecap="round"/>`),
    },
    yarn: {
      size: 84,
      svg: svg('0 0 100 100', `
        <path d="M74 72 q16 6 12 18 q-4 7 -15 3" stroke="#9c86d0" stroke-width="3" fill="none" stroke-linecap="round"/>
        <circle cx="46" cy="50" r="32" fill="#b39ddb"/>
        <g stroke="#8e7cc3" stroke-width="3" fill="none" stroke-linecap="round">
          <path d="M20 34 q26 10 48 -6"/><path d="M16 50 q30 8 58 -10"/><path d="M20 68 q28 4 52 -18"/>
          <path d="M34 20 q-8 30 4 60"/><path d="M54 19 q-6 34 10 56"/></g>`),
    },
    meow: {
      size: 116,
      svg: svg('0 0 120 90', `
        <path d="M14 8 H106 a10 10 0 0 1 10 10 V54 a10 10 0 0 1 -10 10 H52 L32 84 L35 64 H14 a10 10 0 0 1 -10 -10 V18 a10 10 0 0 1 10 -10 Z" fill="#fff" stroke="#5b4034" stroke-width="3" stroke-linejoin="round"/>
        <text x="60" y="45" text-anchor="middle" font-family="${FONT}" font-size="27" font-weight="600" fill="#e85d75">Meow!</text>`),
    },
    today: {
      size: 120, wide: true,
      svg: svg('0 0 120 60', `
        <path d="M22 8 H108 a8 8 0 0 1 8 8 V44 a8 8 0 0 1 -8 8 H22 L4 30 Z" fill="#ffd166"/>
        <circle cx="20" cy="30" r="4" fill="#fff"/>
        <text x="67" y="38.5" text-anchor="middle" font-family="${FONT}" font-weight="600" font-size="22" fill="#6b4a1f" letter-spacing="2">TODAY</text>`),
    },
    goodDay: {
      size: 150, wide: true,
      svg: svg('0 0 160 56', `
        <path d="M4 14 L24 14 L24 46 L4 46 L13 30 Z M156 14 L136 14 L136 46 L156 46 L147 30 Z" fill="#e46f95"/>
        <path d="M20 40 L24 46 V40 Z M140 40 L136 46 V40 Z" fill="#b84a70"/>
        <rect x="20" y="8" width="120" height="32" fill="#ff8fab"/>
        <text x="80" y="31" text-anchor="middle" font-family="${FONT}" font-weight="600" font-size="19" fill="#fff">Good day ♡</text>`),
    },
    tapePink: { size: 150, wide: true, tape: true, svg: tape('#f9a8c4', dots) },
    tapeMint: { size: 150, wide: true, tape: true, svg: tape('#9edcc7', stripes) },
    tapePaw: { size: 150, wide: true, tape: true, svg: tape('#f8deb0', tapePaws) },
    tapeLilac: { size: 150, wide: true, tape: true, svg: tape('#c9b6f0', tapeHearts) },
  };

  const PACKS = [
    { id: 'cats', label: '🐱 Cats', items: ['svg:catFace', 'svg:blackCat', 'svg:catLoaf', 'svg:catHeart', 'svg:paw', 'svg:fish', 'svg:yarn', 'svg:meow', '🐱', '😺', '😻', '😹', '🙀', '🐈', '🐈‍⬛', '🐾'] },
    { id: 'tape', label: '🎀 Tape & labels', items: ['svg:tapePink', 'svg:tapeMint', 'svg:tapePaw', 'svg:tapeLilac', 'svg:today', 'svg:goodDay'] },
    { id: 'cute', label: '💖 Cute', items: ['💖', '💕', '💗', '💌', '⭐', '✨', '🌟', '🎀', '🌈', '🍀', '🦋', '👑', '🫶', '💫', '☁️', '🔮'] },
    { id: 'food', label: '🍰 Yummy', items: ['🍰', '🧁', '🍩', '🍪', '🍓', '🍑', '🍙', '🍜', '🍣', '🧋', '☕', '🍦', '🥐', '🍕', '🍉', '🍫'] },
    { id: 'nature', label: '🌸 Nature', items: ['🌸', '🌷', '🌻', '🌼', '🍁', '🍂', '🌿', '🌵', '🌙', '☀️', '🌧️', '❄️', '🌊', '🐚', '🐰', '🐻'] },
    { id: 'life', label: '✏️ My day', items: ['📚', '✏️', '🎧', '🎮', '🎨', '🎂', '🎁', '✈️', '🏖️', '🎬', '📷', '💤', '🏃', '💼', '🎉', '💯'] },
  ];

  const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const meta = ref => {
    if (ref.startsWith('svg:')) {
      const art = ART[ref.slice(4)];
      if (art) return art;
    }
    return { size: 60 };
  };

  const render = ref => {
    if (ref.startsWith('svg:') && ART[ref.slice(4)]) return ART[ref.slice(4)].svg;
    return `<span class="emoji">${escape(ref)}</span>`;
  };

  return { PACKS, meta, render, paw, blossom, heart, escape };
})();
