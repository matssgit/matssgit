// Gera os painéis do README a partir do portfólio (matheusantanadev.vercel.app).
//   npm install && npm run build
//
// Cada painel reproduz uma seção do site, com as regras do CSS dele (my-site/css/site.css):
//   hero       .hero-title / .hero-roles                (papel)
//   sobre      .manifesto                               (grafite)
//   trabalhos  .section-head / .ghost / .section-title  (grafite)
//   work-*     .work-item / .stage / .work-meta ...     (grafite)
//   outros     lista "Outros projetos"                  (grafite)
//   stack      .stack / .stack-main / .stack-cols       (papel)
//   contato    .contact                                 (grafite)
// O site em 1440px foi escalado para painéis de 1680 unidades. Textos secundários foram
// ampliados porque o README mostra o painel com ~830px. Variantes "-mobile" seguem o
// layout do site no celular. O texto vira curva: <img> não acessa fontes web.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import opentype from 'opentype.js';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'assets');
mkdirSync(OUT, { recursive: true });

// ---------- Tokens (my-site/css/tokens.css) ----------
const T = {
  paper: '#f2f1ec', ink: '#141415', ink2: '#4a4a4c', ink3: '#6c6c6e',
  graphite: '#1b1b1d',
  onDark: '#f2f1ec', onDark2: '#b9b8b2', onDark3: '#8d8c87',
  accent: '#3f5bd9', accentOnDark: '#8ea2ff',
  line: 'rgba(20,20,21,.14)', lineDark: 'rgba(242,241,236,.13)',
};

// ---------- Tipografia ----------
const load = (pkg, file) => {
  const b = readFileSync(join(here, 'node_modules/@fontsource', pkg, 'files', file));
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const F = {
  d3: load('funnel-display', 'funnel-display-latin-300-normal.woff'),
  d5: load('funnel-display', 'funnel-display-latin-500-normal.woff'),
  d6: load('funnel-display', 'funnel-display-latin-600-normal.woff'),
  d7: load('funnel-display', 'funnel-display-latin-700-normal.woff'),
  d8: load('funnel-display', 'funnel-display-latin-800-normal.woff'),
  s4: load('geist-sans', 'geist-sans-latin-400-normal.woff'),
  s5: load('geist-sans', 'geist-sans-latin-500-normal.woff'),
  m5: load('geist-mono', 'geist-mono-latin-500-normal.woff'),
};

// path.toPathData() do opentype.js 2.0.0 às vezes escreve "NaN"; serializador próprio.
const round = (n) => Math.round(n * 10) / 10;
const pathData = (cmds) => {
  let d = '', cx = 0, cy = 0;
  const rel = (x, y) => `${round(x - cx)} ${round(y - cy)}`.replace(/ -/g, '-');
  for (const c of cmds) {
    if (c.type === 'Z') { d += 'z'; continue; }
    const x = round(c.x), y = round(c.y);
    if (c.type === 'M') d += `M${x} ${y}`.replace(/ -/g, '-');
    if (c.type === 'L') d += `l${rel(x, y)}`;
    if (c.type === 'Q') d += `q${rel(c.x1, c.y1)} ${rel(x, y)}`;
    if (c.type === 'C') d += `c${rel(c.x1, c.y1)} ${rel(c.x2, c.y2)} ${rel(x, y)}`;
    cx = x; cy = y;
  }
  return d;
};
// track em "em", como letter-spacing no CSS
const W = (s, font, size, track = 0) => font.getAdvanceWidth(s, size, { kerning: true, letterSpacing: track });
const text = (s, x, y, { font = F.s4, size = 30, fill = T.onDark, track = 0, anchor = 'start', stroke } = {}) => {
  const w = W(s, font, size, track);
  const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  const d = pathData(font.getPath(s, x0, y, size, { kerning: true, letterSpacing: track }).commands);
  return stroke ? `<path fill="none" stroke="${stroke}" stroke-width="1.6" d="${d}"/>` : `<path fill="${fill}" d="${d}"/>`;
};
const wrap = (s, maxW, font, size, track = 0) => {
  const lines = [''];
  for (const word of s.split(' ')) {
    const next = lines.at(-1) ? `${lines.at(-1)} ${word}` : word;
    if (W(next, font, size, track) > maxW && lines.at(-1)) lines.push(word);
    else lines[lines.length - 1] = next;
  }
  return lines;
};
// Parágrafo; devolve o markup e a linha de base da última linha.
const para = (s, x, y, maxW, o = {}) => {
  const { font = F.s4, size = 32, lh = 1.6, track = 0, anchor = 'start' } = o;
  const lines = wrap(s, maxW, font, size, track);
  return { svg: lines.map((l, i) => text(l, x, y + i * size * lh, { ...o, font, size, track, anchor })).join(''), y: y + (lines.length - 1) * size * lh, n: lines.length };
};
// .kicker / .work-meta: Geist Mono 500, maiúsculas, tracking .18em
const mono = (s, x, y, o = {}) => text(s.toUpperCase(), x, y, { font: F.m5, size: 22, track: 0.18, fill: T.onDark3, ...o });
// .work-tags: separador "·" com espaço largo, tracking .16em
const tags = (list, x, y, maxW, o = {}) => {
  const st = { font: F.m5, size: 22, track: 0.16, fill: T.onDark3, ...o };
  const sep = '   ·   ', lines = [''];
  for (const it of list.map((t) => t.toUpperCase())) {
    const next = lines.at(-1) ? lines.at(-1) + sep + it : it;
    if (W(next, st.font, st.size, st.track) > maxW && lines.at(-1)) lines.push(it); else lines[lines.length - 1] = next;
  }
  return { svg: lines.map((l, i) => text(l, x, y + i * st.size * 1.7, st)).join(''), y: y + (lines.length - 1) * st.size * 1.7 };
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const svg = (w, h, title, body, dispW) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${dispW ?? w}" height="${Math.round(((dispW ?? w) * h) / w)}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${body}</svg>\n`;
const write = (name, content) => {
  writeFileSync(join(OUT, name), content);
  console.log(name.padEnd(30), `${(Buffer.byteLength(content) / 1024).toFixed(1)} KB`);
};
// Painel = uma seção do site. O papel ganha contorno fino para separar do fundo branco do GitHub.
const R = 24;
const panel = (w, h, tone) => tone === 'paper'
  ? `<rect x=".75" y=".75" width="${w - 1.5}" height="${h - 1.5}" rx="${R}" fill="${T.paper}" stroke="rgba(20,20,21,.10)" stroke-width="1.5"/>`
  : `<rect width="${w}" height="${h}" rx="${R}" fill="${T.graphite}"/>`;
// Desktop: 1680 unidades, exibido a 100% da coluna. Mobile: 780 unidades, até 560px.
const DESK = 1680, MOB = 780, MOB_DISPLAY = 560;
const pair = (name, alt, desk, mob) => {
  write(`${name}.svg`, svg(DESK, desk.h, alt, desk.body));
  write(`${name}-mobile.svg`, svg(MOB, mob.h, alt, mob.body, MOB_DISPLAY));
};

// ---------- Hero ----------
// .hero-title: 800, entrelinha .82, tracking -0.065em, centralizado; ponto na cor de destaque.
// .hero-roles: três colunas no rodapé (esquerda, centro, direita).
const ROLES = ['Desenvolvedor Full Stack', 'JavaScript · TypeScript · React · Node.js · PostgreSQL', 'Projetos próprios e sistemas para clientes'];
function nameBlock(cx, top, size) {
  const tr = -0.065, lh = 0.82;
  const w1 = W('Matheus', F.d8, size, tr), w2 = W('Santana', F.d8, size, tr), wd = W('.', F.d8, size, tr);
  const y1 = top + size * 0.74, y2 = y1 + size * lh;
  return text('Matheus', cx - w1 / 2, y1, { font: F.d8, size, track: tr, fill: T.ink }) +
    text('Santana', cx - (w2 + wd) / 2, y2, { font: F.d8, size, track: tr, fill: T.ink }) +
    text('.', cx - (w2 + wd) / 2 + w2 + size * 0.012, y2, { font: F.d8, size, track: tr, fill: T.accent });
}
function hero() {
  const g = 70, deskH = 940;
  const desk = {
    h: deskH,
    body: panel(DESK, deskH, 'paper') +
      text('Matheus Santana', g, 92, { font: F.d7, size: 30, track: -0.03, fill: T.ink }) +
      nameBlock(DESK / 2, 190, 290) +
      `<path d="M${g} ${deskH - 150}H${DESK - g}" stroke="${T.line}" stroke-width="1.5"/>` +
      text(ROLES[0], g, deskH - 82, { font: F.s5, size: 25, fill: T.ink }) +
      text(ROLES[1], (g + W(ROLES[0], F.s5, 25) + DESK - g - W(ROLES[2], F.s4, 25)) / 2, deskH - 82, { size: 25, fill: T.ink2, anchor: 'middle' }) +
      text(ROLES[2], DESK - g, deskH - 82, { size: 25, fill: T.ink2, anchor: 'end' }),
  };
  const mg = 40, mobH = 1040;
  const mob = {
    h: mobH,
    body: panel(MOB, mobH, 'paper') +
      text('Matheus Santana', mg, 92, { font: F.d7, size: 32, track: -0.03, fill: T.ink }) +
      nameBlock(MOB / 2, 210, 186) +
      `<path d="M${mg} ${mobH - 270}H${MOB - mg}" stroke="${T.line}" stroke-width="1.5"/>` +
      text(ROLES[0], mg, mobH - 200, { font: F.s5, size: 32, fill: T.ink }) +
      para(ROLES[1], mg, mobH - 146, MOB - mg * 2, { size: 32, fill: T.ink2, lh: 1.5 }).svg +
      text(ROLES[2], mg, mobH - 50, { size: 32, fill: T.ink2 }),
  };
  pair('hero', 'Matheus Santana. Desenvolvedor Full Stack. JavaScript, TypeScript, React, Node.js e PostgreSQL. Projetos próprios e sistemas para clientes.', desk, mob);
}

// ---------- Sobre (composição do .manifesto) ----------
// Frase central em Funnel Display 600, com destaque; complemento em Geist. Texto do README validado.
const SOBRE_A = [
  ['Sou desenvolvedor Full Stack e trabalho com', T.onDark],
  ['JavaScript, TypeScript, React, Node.js e PostgreSQL.', T.accentOnDark],
];
const SOBRE_B = 'Atuo de forma autônoma pela MS Desenvolvimento de Softwares, criando sistemas para pequenos negócios. Antes do desenvolvimento, trabalhei com suporte técnico e infraestrutura. Formação em Análise e Desenvolvimento de Sistemas pela UniSantos.';
function richCentered(segs, cx, y, maxW, size, lh, font, track) {
  const words = segs.flatMap(([s, c]) => s.split(' ').map((w) => [w, c]));
  const space = W(' ', font, size, track);
  const lines = [[]];
  let lw = 0;
  for (const [w, c] of words) {
    const ww = W(w, font, size, track);
    if (lines.at(-1).length && lw + space + ww > maxW) { lines.push([]); lw = 0; }
    lw += (lines.at(-1).length ? space : 0) + ww;
    lines.at(-1).push([w, c, ww]);
  }
  let out = '';
  lines.forEach((ln, i) => {
    const tw = ln.reduce((a, [, , ww], j) => a + ww + (j ? space : 0), 0);
    let x = cx - tw / 2;
    for (const [w, c, ww] of ln) { out += text(w, x, y + i * size * lh, { font, size, track, fill: c }); x += ww + space; }
  });
  return { svg: out, y: y + (lines.length - 1) * size * lh };
}
function sobre() {
  const g = 70;
  const a = richCentered(SOBRE_A, DESK / 2, 300, 1240, 96, 1.02, F.d6, -0.045);
  const b = para(SOBRE_B, DESK / 2, a.y + 120, 1000, { size: 32, fill: T.onDark2, lh: 1.6, anchor: 'middle' });
  const deskH = Math.ceil(b.y + 130);
  const desk = { h: deskH, body: panel(DESK, deskH, 'dark') + mono('Sobre', g, 100) + a.svg + b.svg };
  const mg = 40;
  const am = richCentered(SOBRE_A, MOB / 2, 250, MOB - mg * 2, 64, 1.04, F.d6, -0.045);
  const bm = para(SOBRE_B, mg, am.y + 110, MOB - mg * 2, { size: 32, fill: T.onDark2, lh: 1.6 });
  const mobH = Math.ceil(bm.y + 90);
  const mob = { h: mobH, body: panel(MOB, mobH, 'dark') + mono('Sobre', mg, 96, { size: 24 }) + am.svg + bm.svg };
  pair('sobre', `Sobre. ${SOBRE_A.map(([s]) => s).join(' ')} ${SOBRE_B}`, desk, mob);
}

// ---------- Cabeçalho de seção (.section-head + .ghost + .section-title) ----------
// Título 700, entrelinha .86, tracking -0.06em; palavra-fantasma em 300 só com contorno.
function sectionHead({ kicker, title, ghost, intro, tone }) {
  const dark = tone === 'dark';
  const fg = dark ? T.onDark : T.ink, k = dark ? T.onDark3 : T.ink3, sub = dark ? T.onDark2 : T.ink2;
  const ghostStroke = dark ? 'rgba(242,241,236,.13)' : 'rgba(20,20,21,.12)';
  const rule = dark ? T.lineDark : T.line;
  const g = 70, size = 158, lh = 0.86, yT = 250;
  const yLast = yT + (title.length - 1) * size * lh;
  const titleSvg = title.map((l, i) => text(l, g - 4, yT + i * size * lh, { font: F.d7, size, track: -0.06, fill: fg })).join('');
  const ghostSvg = text(ghost, g + 130, yLast + 70, { font: F.d3, size: 300, track: -0.06, stroke: ghostStroke });
  const introP = intro ? para(intro, DESK - g - 560, yLast + 10, 560, { size: 32, fill: sub, lh: 1.6 }) : null;
  const deskH = Math.ceil(yLast + 170);
  const desk = {
    h: deskH,
    body: panel(DESK, deskH, tone) + mono(kicker, g, 112, { fill: k }) + ghostSvg + titleSvg + (introP ? introP.svg : '') +
      `<path d="M${g} ${deskH - 60}H${DESK - g}" stroke="${rule}" stroke-width="1.5"/>`,
  };
  const mg = 40, ms = 104;
  const yl = 220 + (title.length - 1) * ms * lh;
  const tm = title.map((l, i) => text(l, mg - 3, 220 + i * ms * lh, { font: F.d7, size: ms, track: -0.06, fill: fg })).join('');
  const gm = text(ghost, mg + 40, yl + 60, { font: F.d3, size: 190, track: -0.06, stroke: ghostStroke });
  const im = intro ? para(intro, mg, yl + 120, MOB - mg * 2, { size: 32, fill: sub, lh: 1.55 }) : { svg: '', y: yl + 20 };
  const mobH = Math.ceil(im.y + 110);
  const mob = {
    h: mobH,
    body: panel(MOB, mobH, tone) + mono(kicker, mg, 100, { size: 24, fill: k }) + gm + tm + im.svg +
      `<path d="M${mg} ${mobH - 40}H${MOB - mg}" stroke="${rule}" stroke-width="1.5"/>`,
  };
  return { desk, mob };
}

// ---------- Palco (.stage) ----------
// aspect-ratio 5/4, raio 18px, fundo --stage + radial-gradient(70% 60% at 70% 20%, --stage-light, transparent 70%).
// Imagens: raio 10px, anel 1px branco 10%, sombra 0 30px 60px -24px. Posições de .s-desk, .s-phone, .s-tall-a/b.
const SW = 1280, SH = 1024, K = SW / 740;
const box = (w, h, inner) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${inner}</svg>`);
const solid = (w, h, r) => box(w, h, `<rect width="${w}" height="${h}" rx="${r}" fill="#fff"/>`);
async function stageImage({ stage, light }, shots) {
  for (const s of shots) {
    const m = await sharp(join(here, 'screens', s.file)).metadata();
    s.h = Math.round((s.w * m.height) / m.width);
    if (s.phone) s.y = SH + 0.06 * SH - s.h; // bottom: -6%
    s.x = Math.round(s.x); s.y = Math.round(s.y); s.w = Math.round(s.w);
  }
  const cx = SW * 0.7, cy = SH * 0.2, k = (0.6 * SH) / (0.7 * SW);
  const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}"><defs>
    <radialGradient id="l" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${0.7 * SW}" gradientTransform="translate(${cx} ${cy}) scale(1 ${k}) translate(${-cx} ${-cy})">
      <stop offset="0" stop-color="${light[0]}" stop-opacity="${light[1]}"/><stop offset=".7" stop-color="${light[0]}" stop-opacity="0"/></radialGradient>
    <filter id="s" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${15 * K}"/></filter></defs>
    <rect width="${SW}" height="${SH}" fill="${stage}"/><rect width="${SW}" height="${SH}" fill="url(#l)"/>
    ${shots.map((s) => `<rect x="${s.x + 24 * K}" y="${s.y + 30 * K}" width="${s.w - 48 * K}" height="${s.h - 48 * K}" rx="${s.r}" fill="#000" opacity=".7" filter="url(#s)"/>`).join('')}
  </svg>`;
  const layers = [];
  for (const s of shots) {
    const visH = Math.min(s.h, SH - s.y);
    let img = await sharp(join(here, 'screens', s.file)).resize(s.w, s.h, { kernel: 'lanczos3' })
      .composite([{ input: solid(s.w, s.h, s.r), blend: 'dest-in' }]).png().toBuffer();
    // Celular: anel escuro de 5px e borda clara, como em .stage .s-phone.
    const ring = box(s.w, s.h, (s.phone ? `<rect x="${2.5 * K}" y="${2.5 * K}" width="${s.w - 5 * K}" height="${s.h - 5 * K}" rx="${s.r - 2.5 * K}" fill="none" stroke="rgba(10,10,11,.92)" stroke-width="${5 * K}"/>` : '') +
      `<rect x=".75" y=".75" width="${s.w - 1.5}" height="${s.h - 1.5}" rx="${s.r}" fill="none" stroke="rgba(255,255,255,${s.phone ? 0.18 : 0.1})" stroke-width="1.5"/>`);
    let ringB = await sharp(ring).png().toBuffer();
    if (visH < s.h) {
      img = await sharp(img).extract({ left: 0, top: 0, width: s.w, height: visH }).png().toBuffer();
      ringB = await sharp(ringB).extract({ left: 0, top: 0, width: s.w, height: visH }).png().toBuffer();
    }
    layers.push({ input: img, left: s.x, top: s.y }, { input: ringB, left: s.x, top: s.y });
  }
  const flat = await sharp(Buffer.from(bg)).composite(layers).png().toBuffer();
  const out = await sharp(flat)
    .composite([{ input: solid(SW, SH, 18 * K), blend: 'dest-in' },
      { input: box(SW, SH, `<rect x=".75" y=".75" width="${SW - 1.5}" height="${SH - 1.5}" rx="${18 * K}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="1.5"/>`) }])
    .webp({ quality: 80, effort: 6, smartSubsample: true, alphaQuality: 90 }).toBuffer();
  return out.toString('base64');
}
const sDesk = (file) => ({ file, x: 0.08 * SW, y: 0.14 * SH, w: 0.74 * SW, r: 10 * K });
const sPhone = (file) => ({ file, phone: true, x: SW - 0.07 * SW - 0.24 * SW, y: 0, w: 0.24 * SW, r: 18 * K });
const sTallA = (file) => ({ file, x: 0.14 * SW, y: 0.12 * SH, w: 0.37 * SW, r: 10 * K });
const sTallB = (file) => ({ file, x: 0.49 * SW, y: 0.22 * SH, w: 0.37 * SW, r: 10 * K });

// ---------- Trabalho (.work-item) ----------
// Grade 1.42fr / 1fr; palco e texto lado a lado, alternando o lado como no site.
function workPanel(name, stageB64, w, side) {
  const g = 70, gap = 84, pad = 80;
  const colM = ((DESK - g * 2 - gap) * 1.42) / 2.42, colT = DESK - g * 2 - gap - colM;
  const stW = colM, stH = (stW * 4) / 5;
  const mx = side === 'left' ? g : g + colT + gap, tx = side === 'left' ? g + colM + gap : g;
  const media = (x, y, ww, hh) => `<clipPath id="c${x}"><rect x="${x}" y="${y}" width="${ww}" height="${hh}" rx="${18 * (ww / 740)}"/></clipPath>` +
    `<image x="${x}" y="${y}" width="${ww}" height="${hh}" clip-path="url(#c${x})" href="data:image/webp;base64,${stageB64}"/>`;
  // .work-meta / .work-title (600, entrelinha .94, -0.05em) / .work-desc / .work-tags
  const textBlock = (x, y0, maxW, s) => {
    const mt = tags(w.meta.split('·').map((t) => t.trim()), x, y0, maxW, { size: s.meta, track: 0.18 });
    let o = mt.svg; y0 = mt.y;
    let y = y0 + s.title * 1.18;
    const tl = wrap(w.title, maxW, F.d6, s.title, -0.05);
    tl.forEach((l, i) => { o += text(l, x - 3, y + i * s.title * 0.94, { font: F.d6, size: s.title, track: -0.05 }); });
    y += (tl.length - 1) * s.title * 0.94 + s.desc * 1.9;
    const d = para(w.desc, x, y, maxW, { size: s.desc, fill: T.onDark2, lh: 1.6 });
    o += d.svg; y = d.y + s.desc * 2.1;
    const t = tags(w.tags, x, y, maxW, { size: s.meta });
    o += t.svg; y = t.y;
    if (w.note) { const n = para(w.note, x, y + s.meta * 2.6, maxW, { size: s.desc * 0.86, fill: T.onDark3, lh: 1.5 }); o += n.svg; y = n.y; }
    return { svg: o, y };
  };
  const S = { meta: 21, title: 82, desc: 31 };
  const textH = textBlock(tx, 0, colT, S).y + 20;
  const deskH = Math.ceil(pad * 2 + Math.max(stH, textH));
  const tb = textBlock(tx, pad + (deskH - pad * 2 - textH) / 2 + 22, colT, S);
  const deskBody = panel(DESK, deskH, 'dark') + media(mx, pad + (deskH - pad * 2 - stH) / 2, stW, stH) + tb.svg;

  const mg = 40, mW = MOB - mg * 2, mH = (mW * 4) / 5;
  const tm = textBlock(mg, 40 + mH + 90, mW, { meta: 23, title: 92, desc: 32 });
  const mobH = Math.ceil(tm.y + 70);
  pair(`work-${name}`, w.alt, { h: deskH, body: deskBody }, { h: mobH, body: panel(MOB, mobH, 'dark') + media(mg, 40, mW, mH) + tm.svg });
}

// ---------- Outros projetos (lista do site) ----------
function others(rows) {
  const g = 70, head = 150, rowH = 150;
  const deskH = head + rows.length * rowH + 70;
  let b = panel(DESK, deskH, 'dark') + mono('Outros projetos', g, 104) + `<path d="M${g} ${head}H${DESK - g}" stroke="${T.lineDark}" stroke-width="1.5"/>`;
  rows.forEach((r, i) => {
    const y = head + i * rowH, mid = y + rowH / 2;
    r.status.forEach((s, j) => { b += mono(s, g, mid + 8 + (j - (r.status.length - 1) / 2) * 30, { size: 20, track: 0.12 }); });
    b += text(r.name, g + 450, mid + 24, { font: F.d6, size: 68, track: -0.05 });
    const dl = wrap(r.desc, 420, F.s4, 27).length;
    b += para(r.desc, g + 1040, mid + 10 - (dl - 1) * 21, 420, { size: 27, fill: T.onDark2, lh: 1.55 }).svg;
    b += `<path d="M${DESK - g - 26} ${mid + 14}L${DESK - g} ${mid - 12}M${DESK - g - 22} ${mid - 12}H${DESK - g}V${mid + 10}" fill="none" stroke="${T.onDark}" stroke-width="2.4"/>`;
    b += `<path d="M${g} ${y + rowH}H${DESK - g}" stroke="${T.lineDark}" stroke-width="1.5"/>`;
  });
  const mg = 40;
  let mb = mono('Outros projetos', mg, 96, { size: 24 });
  let y = 140;
  rows.forEach((r) => {
    mb += `<path d="M${mg} ${y}H${MOB - mg}" stroke="${T.lineDark}" stroke-width="1.5"/>`;
    r.status.forEach((s, j) => { mb += mono(s, mg, y + 62 + j * 32, { size: 24 }); });
    y += 62 + (r.status.length - 1) * 32 + 92;
    mb += text(r.name, mg - 2, y, { font: F.d6, size: 72, track: -0.05 });
    const d = para(r.desc, mg, y + 64, MOB - mg * 2, { size: 32, fill: T.onDark2, lh: 1.5 });
    mb += d.svg; y = d.y + 56;
  });
  mb += `<path d="M${mg} ${y}H${MOB - mg}" stroke="${T.lineDark}" stroke-width="1.5"/>`;
  const mobH = Math.ceil(y + 50);
  pair('outros', `Outros projetos. ${rows.map((r) => `${r.name} (${r.status.join(', ').toLowerCase()}): ${r.desc}`).join(' ')}`,
    { h: deskH, body: b }, { h: mobH, body: panel(MOB, mobH, 'dark') + mb });
}

// ---------- Tecnologias (.stack: título, lista grande, colunas) ----------
const MAIN = ['JavaScript', 'TypeScript', 'React', 'Node.js', 'PostgreSQL'];
const COLS = [
  ['Frontend', ['JavaScript', 'TypeScript', 'React', 'HTML', 'CSS', 'Tailwind CSS']],
  ['Backend', ['Node.js', 'Fastify', 'Express', 'APIs REST']],
  ['Banco de dados', ['PostgreSQL', 'MySQL', 'SQLite', 'Knex', 'Drizzle']],
  ['Ferramentas e testes', ['Git', 'GitHub', 'Docker', 'Vitest', 'Testes de integração']],
];
function bigList(x, y, maxW, size) {
  const tr = -0.05, gap = size * 0.32, sw = W('/', F.d3, size);
  let cx = x, cy = y, out = '';
  MAIN.forEach((w, i) => {
    const ww = W(w, F.d7, size, tr);
    const tail = i < MAIN.length - 1 ? gap * 2 + sw : 0;
    if (cx > x && cx + ww + tail > x + maxW) { cx = x; cy += size * 0.98; }
    out += text(w, cx, cy, { font: F.d7, size, track: tr, fill: T.ink });
    cx += ww;
    if (i < MAIN.length - 1) { out += text('/', cx + gap, cy, { font: F.d3, size, fill: 'rgba(20,20,21,.12)' }); cx += gap * 2 + sw; }
  });
  return { svg: out, y: cy };
}
function stack() {
  const h = sectionHead({ kicker: 'Tecnologias', title: ['Com o que', 'trabalho'], ghost: 'stack', tone: 'paper' });
  const g = 70;
  const headBody = h.desk.body.replace(/^<rect[^>]*\/>/, '');
  const bl = bigList(g, h.desk.h + 140, DESK - g * 2, 128);
  const y = bl.y + 110, colW = (DESK - g * 2) / 4;
  let cols = `<path d="M${g} ${y}H${DESK - g}" stroke="${T.line}" stroke-width="1.5"/>`;
  let maxY = y;
  const longest = Math.max(...COLS.map(([, i]) => i.length));
  COLS.forEach(([t, items], i) => {
    const x = g + i * colW + (i ? 34 : 0);
    if (i) cols += `<path d="M${g + i * colW} ${y}V${y + 140 + (longest - 1) * 48 + 40}" stroke="${T.line}" stroke-width="1.5"/>`;
    cols += text(t, x, y + 78, { font: F.d6, size: 42, track: -0.03, fill: T.ink });
    items.forEach((it, j) => { cols += text(it, x, y + 140 + j * 48, { size: 30, fill: T.ink2 }); });
    maxY = Math.max(maxY, y + 140 + (items.length - 1) * 48);
  });
  const deskH = Math.ceil(maxY + 100);
  const desk = { h: deskH, body: panel(DESK, deskH, 'paper') + headBody + bl.svg + cols };

  const mg = 40;
  const mHead = h.mob.body.replace(/^<rect[^>]*\/>/, '');
  const bm = bigList(mg, h.mob.h + 110, MOB - mg * 2, 84);
  let my = bm.y + 80, mc = '';
  COLS.forEach(([t, items], i) => {
    const col = i % 2, x = mg + col * ((MOB - mg * 2) / 2 + 16);
    if (col === 0) mc += `<path d="M${mg} ${my}H${MOB - mg}" stroke="${T.line}" stroke-width="1.5"/>`;
    const tl = wrap(t, (MOB - mg * 2) / 2 - 24, F.d6, 38, -0.03);
    tl.forEach((l, k) => { mc += text(l, x, my + 70 + k * 40, { font: F.d6, size: 38, track: -0.03, fill: T.ink }); });
    const iy = my + 70 + 40 + 56;
    items.forEach((it, j) => { mc += text(it, x, iy + j * 46, { size: 30, fill: T.ink2 }); });
    if (col === 1) { const n = Math.max(COLS[i - 1][1].length, items.length); my = iy + (n - 1) * 46 + 60; }
  });
  const mobH = Math.ceil(my + 20);
  const mob = { h: mobH, body: panel(MOB, mobH, 'paper') + mHead + bm.svg + mc };
  pair('stack', `Tecnologias. Principais: ${MAIN.join(', ')}. ${COLS.map(([t, i]) => `${t}: ${i.join(', ')}`).join('. ')}.`, desk, mob);
}

// ---------- Contato (.contact) ----------
// Título 700, entrelinha .84, tracking -0.065em; linha; à direita o e-mail em 600.
function contact() {
  const g = 70, size = 250, deskH = 760;
  const desk = {
    h: deskH,
    body: panel(DESK, deskH, 'dark') + mono('Contato', g, 112) +
      text('Contato.', g - 6, 120 + size * 0.78, { font: F.d7, size, track: -0.065 }) +
      `<path d="M${g} ${deskH - 250}H${DESK - g}" stroke="${T.lineDark}" stroke-width="1.5"/>` +
      text('Desenvolvedor Full Stack', g, deskH - 160, { font: F.d5, size: 46, track: -0.025 }) +
      text('Portfólio  ·  LinkedIn  ·  E-mail', g, deskH - 100, { size: 30, fill: T.onDark2 }) +
      text('matsant.dev@gmail.com', DESK - g, deskH - 130, { font: F.d6, size: 74, track: -0.035, anchor: 'end' }),
  };
  const mg = 40, mobH = 700;
  const mob = {
    h: mobH,
    body: panel(MOB, mobH, 'dark') + mono('Contato', mg, 100, { size: 24 }) +
      text('Contato.', mg - 4, 277, { font: F.d7, size: 150, track: -0.065 }) +
      `<path d="M${mg} ${mobH - 320}H${MOB - mg}" stroke="${T.lineDark}" stroke-width="1.5"/>` +
      text('Desenvolvedor Full Stack', mg, mobH - 240, { font: F.d5, size: 42, track: -0.025 }) +
      text('matsant.dev@gmail.com', mg, mobH - 150, { font: F.d6, size: 56, track: -0.035 }) +
      text('Portfólio  ·  LinkedIn  ·  E-mail', mg, mobH - 74, { size: 32, fill: T.onDark2 }),
  };
  pair('contato', 'Contato. Desenvolvedor Full Stack. E-mail: matsant.dev@gmail.com. Os links de portfólio, LinkedIn e e-mail estão logo abaixo.', desk, mob);
}

// ---------- Execução ----------
hero();
sobre();
{
  const h = sectionHead({ kicker: 'Trabalhos', title: ['Trabalhos', 'selecionados'], ghost: 'trabalhos', tone: 'dark',
    intro: 'Projetos pessoais e sistemas para pequenos negócios, com as telas reais de cada um.' });
  pair('trabalhos', 'Trabalhos selecionados. Projetos pessoais e sistemas para pequenos negócios, com as telas reais de cada um.', h.desk, h.mob);
}

// Cores de palco de cada projeto, como em index.html (--stage, --stage-light).
const fluxaStage = await stageImage({ stage: '#1c3a31', light: ['rgb(150,225,190)', 0.22] }, [sTallB('fluxa-cartoes.webp'), sTallA('fluxa-dashboard.webp')]);
const cebolaStage = await stageImage({ stage: '#2b2119', light: ['rgb(255,190,130)', 0.18] }, [sDesk('cebola-agenda.webp'), sPhone('cebola-booking-mobile.webp')]);
const numeroStage = await stageImage({ stage: '#0f1828', light: ['rgb(255,110,50)', 0.22] }, [sDesk('numero1-stock.webp'), sPhone('numero1-stock-mobile.webp')]);

workPanel('fluxa', fluxaStage, {
  meta: 'Projeto pessoal  ·  Publicado', title: 'Fluxa',
  desc: 'Finanças pessoais que separam a compra no cartão da saída de caixa. Receitas e despesas, cartões e parcelamentos, assinaturas e metas, com autenticação em duas etapas, sessões revogáveis e operações financeiras em transações no PostgreSQL.',
  tags: ['React', 'TypeScript', 'Node.js', 'Fastify', 'PostgreSQL', 'Knex', 'Zod', 'Vitest'],
  alt: 'Fluxa, projeto pessoal publicado. Telas reais do dashboard e dos cartões. Finanças pessoais que separam a compra no cartão da saída de caixa: receitas e despesas, cartões e parcelamentos, assinaturas e metas, com autenticação em duas etapas, sessões revogáveis e operações financeiras em transações no PostgreSQL. React, TypeScript, Node.js, Fastify, PostgreSQL, Knex, Zod e Vitest.',
}, 'left');
workPanel('cebola', cebolaStage, {
  meta: 'Sistema para cliente  ·  Em desenvolvimento', title: 'Cebola Barber',
  desc: 'Agendamentos e gestão de uma barbearia. O cliente reserva pelo celular em quatro etapas; a administração cuida da agenda, com bloqueios e recorrência, dos clientes, serviços e produtos, das cobranças e dos relatórios. Instalável como aplicativo (PWA).',
  tags: ['React', 'TypeScript', 'Vite', 'Tailwind CSS', 'Node.js', 'Fastify', 'Drizzle', 'PostgreSQL', 'Vitest'],
  note: 'Código privado e sem demonstração pública. As telas usam dados fictícios.',
  alt: 'Cebola Barber, sistema para cliente em desenvolvimento. Telas com dados fictícios: agenda administrativa e reserva pelo celular. Agendamentos e gestão de uma barbearia: o cliente reserva pelo celular em quatro etapas; a administração cuida da agenda, com bloqueios e recorrência, dos clientes, serviços e produtos, das cobranças e dos relatórios. Instalável como aplicativo (PWA). Código privado e sem demonstração pública.',
}, 'right');
workPanel('numero1', numeroStage, {
  meta: 'Sistema para cliente  ·  Em desenvolvimento', title: 'Número 1 Store',
  desc: 'Gestão comercial de uma loja. Estoque por categoria e tamanho, com custo, preço e alerta de saída, e funcionários com permissões próprias já têm interface e API. Caixa, PDV e relatórios são as próximas etapas.',
  tags: ['React', 'TypeScript', 'Vite', 'Tailwind CSS', 'Node.js', 'Fastify', 'Drizzle', 'PostgreSQL', 'Vitest'],
  note: 'Código privado e sem demonstração pública. As telas usam dados fictícios.',
  alt: 'Número 1 Store, sistema para cliente em desenvolvimento. Telas com dados fictícios: estoque no computador e no celular. Gestão comercial de uma loja: estoque por categoria e tamanho, com custo, preço e alerta de saída, e funcionários com permissões próprias já têm interface e API. Caixa, PDV e relatórios são as próximas etapas. Código privado e sem demonstração pública.',
}, 'left');
others([
  { name: 'Massa ao Ponto', status: ['Backend implementado', 'Interface em desenvolvimento'], desc: 'Gestão de pizzarias com foco em arquitetura de backend e regras de negócio, com testes em PostgreSQL real.' },
  { name: 'Quando Chega?', status: ['Pausado'], desc: 'API de rastreamento de encomendas validada com um provedor simulado.' },
]);
stack();
contact();
