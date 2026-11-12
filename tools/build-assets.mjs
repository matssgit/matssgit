// Gera os assets do README a partir das fontes e telas em tools/.
//   npm install && npm run build
//
// Identidade: a mesma do portfólio (matheusantanadev.vercel.app).
// Paper #f2f1ec, tinta #141415, grafite #1b1b1d, Funnel Display e Geist.
// O texto dos SVGs vira curva: imagens carregadas via <img> não acessam fontes web.
// Telas: as mesmas publicadas no portfólio (dados fictícios), em tools/screens.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import opentype from 'opentype.js';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'assets');
mkdirSync(OUT, { recursive: true });

// ---------- Tokens (de my-site/css/tokens.css) ----------
const T = {
  paper: '#f2f1ec', ink: '#141415', ink2: '#4a4a4c',
  graphite: '#1b1b1d', graphite2: '#232326',
  onDark: '#f2f1ec', onDark2: '#b9b8b2', onDark3: '#8d8c87',
  accent: '#3f5bd9', accentOnDark: '#8ea2ff',
  lineDark: 'rgba(242,241,236,.16)',
};
// Cores de texto por tema do GitHub (fundo branco / fundo #0d1117).
const THEME = {
  light: { fg: T.ink, dot: T.accent },
  dark: { fg: T.onDark, dot: T.accentOnDark },
};

// ---------- Tipografia ----------
const load = (pkg, file) => {
  const b = readFileSync(join(here, 'node_modules/@fontsource', pkg, 'files', file));
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const F = {
  d8: load('funnel-display', 'funnel-display-latin-800-normal.woff'),
  d7: load('funnel-display', 'funnel-display-latin-700-normal.woff'),
  s4: load('geist-sans', 'geist-sans-latin-400-normal.woff'),
  s5: load('geist-sans', 'geist-sans-latin-500-normal.woff'),
  m4: load('geist-mono', 'geist-mono-latin-400-normal.woff'),
};

// Serializa em coordenadas relativas. path.toPathData() do opentype.js 2.0.0
// às vezes escreve "NaN", e o navegador corta o texto nesse ponto.
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
const measure = (s, font, size, track = 0) => font.getAdvanceWidth(s, size, { kerning: true, letterSpacing: track });
const text = (s, x, y, { font = F.s4, size = 30, fill = T.onDark, track = 0, anchor = 'start' } = {}) => {
  const w = measure(s, font, size, track);
  const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  return `<path fill="${fill}" d="${pathData(font.getPath(s, x0, y, size, { kerning: true, letterSpacing: track }).commands)}"/>`;
};
// Bounding box real das curvas, para recortar o viewBox sem sobra.
const bbox = (s, x, y, font, size, track = 0) => font.getPath(s, x, y, size, { kerning: true, letterSpacing: track }).getBoundingBox();

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const svg = (w, h, title, body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>\n`;
const write = (name, content) => {
  writeFileSync(join(OUT, name), content);
  console.log(name.padEnd(28), `${(Buffer.byteLength(content) / 1024).toFixed(1)} KB`);
};

// ---------- Banner: o nome como protagonista, como no hero do portfólio ----------
// Funnel Display 800, entrelinha .82, tracking -0.065em, ponto final na cor de destaque.
function banner() {
  const size = 300, track = -0.065, lh = 0.82;
  const l1 = 'Matheus', l2 = 'Santana';
  const y1 = size * 0.78, y2 = y1 + size * lh;
  const w2 = measure(l2, F.d8, size, track);
  const dotX = w2 + size * 0.01;
  const b1 = bbox(l1, 0, y1, F.d8, size, track), b2 = bbox(l2 + '.', 0, y2, F.d8, size, track);
  const pad = 6;
  const minX = Math.min(b1.x1, b2.x1) - pad, minY = b1.y1 - pad;
  const W = Math.ceil(Math.max(b1.x2, b2.x2) - minX + pad), H = Math.ceil(b2.y2 - minY + pad);
  for (const [name, c] of Object.entries(THEME)) {
    const body = `<g transform="translate(${-minX} ${-minY})">` +
      text(l1, 0, y1, { font: F.d8, size, track, fill: c.fg }) +
      text(l2, 0, y2, { font: F.d8, size, track, fill: c.fg }) +
      text('.', dotX, y2, { font: F.d8, size, track, fill: c.dot }) + '</g>';
    write(`banner-${name}.svg`, svg(W, H, 'Matheus Santana.', body));
  }
}

// ---------- Títulos de seção ----------
function sectionTitle(file, label) {
  const size = 64, track = -0.03;
  const b = bbox(label, 0, size, F.d7, size, track);
  const pad = 4;
  const W = Math.ceil(b.x2 - b.x1 + pad * 2), H = 80;
  for (const [name, c] of Object.entries(THEME)) {
    const body = text(label, -b.x1 + pad, 62, { font: F.d7, size, track, fill: c.fg });
    write(`title-${file}-${name}.svg`, svg(W, H, label, body));
  }
}

// ---------- Palcos: telas reais sobre grafite, como na lista de projetos do portfólio ----------
// Composição raster com sharp: o librsvg não decodifica WebP embutido em SVG.
const STAGE = { w: 1680, h: 980, r: 36 };
const rounded = (w, h, r, fill = '#fff') =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" fill="${fill}"/></svg>`);
async function stage(name, shots) {
  const { w: W, h: H, r } = STAGE;
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>` +
    `<radialGradient id="g" cx=".22" cy="0" r="1.1"><stop stop-color="#2c2c30"/><stop offset="1" stop-color="${T.graphite}"/></radialGradient>` +
    `<filter id="s" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="26"/></filter></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#g)"/>` +
    // sombra de cada tela, desenhada no fundo
    shots.map(([, x, y, w, h, rr]) => `<rect x="${x}" y="${y + 26}" width="${w}" height="${h}" rx="${rr}" fill="#000" opacity=".5" filter="url(#s)"/>`).join('') +
    `</svg>`);
  const layers = [];
  for (const [file, x, y, w, h, rr] of shots) {
    const img = await sharp(join(here, 'screens', file))
      .resize(w, h, { fit: 'cover', position: 'top', kernel: 'lanczos3' })
      .composite([{ input: rounded(w, h, rr), blend: 'dest-in' }])
      .png().toBuffer();
    // borda fina clara, como no portfólio
    const edge = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x=".75" y=".75" width="${w - 1.5}" height="${h - 1.5}" rx="${rr}" fill="none" stroke="rgba(242,241,236,.16)" stroke-width="1.5"/></svg>`);
    layers.push({ input: img, left: x, top: y }, { input: edge, left: x, top: y });
  }
  // Telas que passam da borda inferior são cortadas pelo palco.
  const flat = await sharp(bg).composite(layers.map((l) => ({ ...l }))).png().toBuffer();
  const out = await sharp(flat)
    .composite([{ input: rounded(W, H, r), blend: 'dest-in' }])
    .webp({ quality: 86, effort: 6, smartSubsample: true, alphaQuality: 90 })
    .toBuffer();
  writeFileSync(join(OUT, `work-${name}.webp`), out);
  console.log(`work-${name}.webp`.padEnd(28), `${(out.length / 1024).toFixed(1)} KB`);
}

// ---------- Massa ao Ponto: diagrama em grafite, legível no celular ----------
function massaDiagram() {
  const W = 800, pad = 40, inner = W - pad * 2;
  const tag = (s, x, y) => text(s, x, y, { font: F.m4, size: 22, fill: T.onDark3, track: 0.08 });
  let y = 40, out = '';
  const box = (h, dashed) =>
    `<rect x="${pad}" y="${y}" width="${inner}" height="${h}" rx="18" fill="${T.graphite2}" stroke="${dashed ? T.onDark2 : T.lineDark}" stroke-width="2"${dashed ? ' stroke-dasharray="10 9"' : ''}/>`;
  const arrow = () => {
    const cx = W / 2;
    out += `<path d="M${cx} ${y + 8}V${y + 46}M${cx - 8} ${y + 37}L${cx} ${y + 46}L${cx + 8} ${y + 37}" fill="none" stroke="${T.onDark3}" stroke-width="2"/>`;
    y += 56;
  };

  // Tracejado: a interface ainda não cobre as telas operacionais.
  out += box(206, true) + tag('INTERFACE', pad + 32, y + 50) +
    text('React · TypeScript', pad + 32, y + 100, { font: F.s5, size: 36 }) +
    text('Login e navegação protegida.', pad + 32, y + 140, { size: 26, fill: T.onDark2 }) +
    text('Telas operacionais em desenvolvimento.', pad + 32, y + 176, { size: 26, fill: T.onDark2 });
  y += 206;
  arrow();

  const mods = ['Delivery', 'Atendimento no local', 'Catálogo', 'Mesas', 'Reservas', 'Pagamentos simulados'];
  let mx = pad + 32, my = y + 128, chips = '';
  for (const m of mods) {
    const mw = measure(m, F.m4, 24) + 32;
    if (mx + mw > W - pad - 32) { mx = pad + 32; my += 62; }
    chips += `<rect x="${mx}" y="${my}" width="${mw}" height="50" rx="25" fill="none" stroke="${T.onDark3}" stroke-width="1.5"/>` +
      text(m, mx + 16, my + 33, { font: F.m4, size: 24, fill: T.onDark });
    mx += mw + 12;
  }
  const apiH = my + 50 + 32 - y;
  out += box(apiH, false) + tag('API · MÓDULOS POR DOMÍNIO', pad + 32, y + 50) +
    text('Node.js · Fastify · Zod', pad + 32, y + 100, { font: F.s5, size: 36 }) + chips;
  y += apiH;
  arrow();

  out += box(150, false) + tag('DADOS', pad + 32, y + 50) +
    text('PostgreSQL · Drizzle', pad + 32, y + 100, { font: F.s5, size: 36 }) +
    text('Testes com Vitest em PostgreSQL real', pad + 32, y + 132, { size: 25, fill: T.onDark2 });
  y += 150 + 40;

  const H = Math.ceil(y);
  const body = `<rect width="${W}" height="${H}" rx="28" fill="${T.graphite}"/>` + out;
  write('massa-architecture.svg', svg(W, H, 'Arquitetura do Massa ao Ponto: interface React, API Fastify com módulos por domínio e PostgreSQL com Drizzle.', body));
}

// ---------- Execução ----------
banner();
sectionTitle('sobre', 'Sobre');
sectionTitle('trabalhos', 'Trabalhos selecionados');
sectionTitle('tecnologias', 'Tecnologias');
sectionTitle('contato', 'Contato');
massaDiagram();

// Fluxa: duas telas em retrato (772×1031), a segunda mais baixa, como no portfólio.
await stage('fluxa', [
  ['fluxa-dashboard.webp', 150, 90, 680, 908, 24],
  ['fluxa-cartoes.webp', 870, 170, 680, 908, 24],
]);
// Cebola Barber: agenda (1600×1244) e reserva no celular (600×1298).
await stage('cebola', [
  ['cebola-agenda.webp', 120, 96, 1080, 840, 20],
  ['cebola-booking-mobile.webp', 1150, 150, 360, 779, 40],
]);
// Número 1 Store: estoque (1600×1000) e estoque no celular (600×1298).
await stage('numero1', [
  ['numero1-stock.webp', 120, 110, 1120, 700, 20],
  ['numero1-stock-mobile.webp', 1180, 150, 360, 779, 40],
]);
