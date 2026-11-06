// Gera todos os SVGs de ../assets. O texto é convertido em curvas para renderizar igual
// em qualquer dispositivo: SVG carregado via <img> não acessa fontes web, e Android/iOS
// não têm as mesmas fontes de sistema. Para mudar um texto ou status, edite aqui e rode:
//   npm install && npm run build
//
// Fontes: Funnel Display e Geist (SIL Open Font License), as mesmas do portfólio.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import opentype from 'opentype.js';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'assets');
mkdirSync(OUT, { recursive: true });

// ---------- Paleta ----------
const C = {
  bg: '#0D0F12', bg2: '#111419', surface: '#171A20', surface2: '#1E222A',
  line: '#2B2F38', gold: '#C3A066', goldLight: '#E2BE77', goldDeep: '#8F6F35',
  text: '#F5F5F4', muted: '#A1A1AA', faint: '#71717A',
  warm: '#17130D', warm2: '#221B12', warmLine: '#3D3222', cream: '#F2E6D0',
  ink: '#1F2328',
};

// ---------- Tipografia ----------
const load = (pkg, file) => {
  const b = readFileSync(join(here, 'node_modules/@fontsource', pkg, 'files', file));
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const F = {
  d3: load('funnel-display', 'funnel-display-latin-300-normal.woff'),
  d4: load('funnel-display', 'funnel-display-latin-400-normal.woff'),
  s4: load('geist-sans', 'geist-sans-latin-400-normal.woff'),
  s5: load('geist-sans', 'geist-sans-latin-500-normal.woff'),
  m4: load('geist-mono', 'geist-mono-latin-400-normal.woff'),
  m5: load('geist-mono', 'geist-mono-latin-500-normal.woff'),
};
// Serializa em coordenadas relativas. Não usa path.toPathData(): a versão 2.0.0 do
// opentype.js às vezes escreve "NaN" e o navegador corta o texto a partir desse ponto.
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
const measure = (s, font, size, track = 0) =>
  font.getAdvanceWidth(s, size, { kerning: true, letterSpacing: track });
const text = (s, x, y, { font = F.s4, size = 30, fill = C.text, anchor = 'start', track = 0, opacity } = {}) => {
  const w = measure(s, font, size, track);
  const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  const d = pathData(font.getPath(s, x0, y, size, { kerning: true, letterSpacing: track }).commands);
  return `<path fill="${fill}"${opacity ? ` opacity="${opacity}"` : ''} d="${d}"/>`;
};
const wrap = (s, maxW, font, size) => {
  const lines = [''];
  for (const word of s.split(' ')) {
    const next = lines.at(-1) ? `${lines.at(-1)} ${word}` : word;
    if (measure(next, font, size) > maxW && lines.at(-1)) lines.push(word);
    else lines[lines.length - 1] = next;
  }
  return lines;
};
// Parágrafo: devolve o markup e o y logo abaixo da última linha.
const para = (s, x, y, maxW, { font = F.s4, size = 30, fill = C.muted, lh = 1.5 } = {}) => {
  const lines = wrap(s, maxW, font, size);
  return {
    svg: lines.map((l, i) => text(l, x, y + i * size * lh, { font, size, fill })).join(''),
    y: y + (lines.length - 1) * size * lh,
  };
};
const eyebrow = (s, x, y, { size = 24, fill = C.gold, anchor } = {}) =>
  text(s, x, y, { font: F.m5, size, fill, track: 0.08, anchor });

// ---------- Componentes ----------
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const svg = (w, h, title, body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>\n`;
// Variantes "-mobile": largura intrínseca de 430px. No celular o max-width: 100% do GitHub
// encolhe até caber; no tablet (coluna de até ~630px) o painel não estica além disso.
const write = (name, raw) => {
  const content = name.includes('-mobile')
    ? raw.replace(/width="640" height="([0-9]+)"/, (_, h) => `width="430" height="${Math.round((h * 430) / 640)}"`)
    : raw;
  writeFileSync(join(OUT, name), content);
  console.log(name.padEnd(30), `${(Buffer.byteLength(content) / 1024).toFixed(1)} KB`);
};

const panelDefs = (id = 'p', a = C.bg2, b = C.bg) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const panel = (w, h, { id = 'p', r = 28, stroke = C.line } = {}) =>
  `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="${r}" fill="url(#${id})" stroke="${stroke}" stroke-width="2"/>`;

const chips = (items, x, y, maxW, { size = 25, h = 50, fill = C.surface2, stroke = C.line, color = '#D4D4D8', gap = 12 } = {}) => {
  let cx = x, cy = y, out = '';
  for (const t of items) {
    const w = measure(t, F.m4, size) + 36;
    if (cx + w > x + maxW) { cx = x; cy += h + gap; }
    out += `<rect x="${cx}" y="${cy}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
    out += text(t, cx + 18, cy + h / 2 + size * 0.34, { font: F.m4, size, fill: color });
    cx += w + gap;
  }
  return { svg: out, y: cy + h };
};
const status = (label, x, y, { size = 25, color = C.goldLight, dashed = true } = {}) => {
  const w = measure(label, F.s5, size) + 66, h = size * 2;
  return {
    w,
    svg: `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${color}" fill-opacity=".08" stroke="${color}" stroke-opacity=".45" stroke-width="1.5"${dashed ? ' stroke-dasharray="6 5"' : ''}/>` +
      `<circle cx="${x + 26}" cy="${y + h / 2}" r="6" fill="${color}"/>` +
      text(label, x + 44, y + h / 2 + size * 0.35, { font: F.s5, size, fill: color }),
  };
};
const list = (items, x, y, { size = 30, gap = 50, fill = '#D4D4D8', mark = C.gold, maxW } = {}) => {
  let out = '', cy = y;
  for (const t of items) {
    out += `<rect x="${x}" y="${cy - size * 0.36}" width="16" height="2.5" fill="${mark}"/>`;
    const lines = maxW ? wrap(t, maxW - 34, F.s4, size) : [t];
    lines.forEach((l, i) => { out += text(l, x + 34, cy + i * size * 1.3, { size, fill }); });
    cy += gap + (lines.length - 1) * size * 1.3;
  }
  return { svg: out, y: cy - gap };
};

// ---------- Banner: a mesma tipografia e a luz arquitetônica do portfólio,
// com três camadas (interface, API, dados) desenhadas em linhas finas ----------
const layers = (cx, cy, s = 1) => {
  // Três planos isométricos ligados por conectores verticais.
  const hw = 300 * s, hh = 112 * s, gap = 128 * s;
  const plane = (y, op, fillOp) => {
    const d = `M${cx} ${y - hh}L${cx + hw} ${y}L${cx} ${y + hh}L${cx - hw} ${y}Z`;
    return `<path d="${d}" fill="${C.goldLight}" fill-opacity="${fillOp}" stroke="${C.goldLight}" stroke-opacity="${op}" stroke-width="${1.6 * Math.max(s, 0.8)}"/>`;
  };
  const inner = (y, op) => {
    let o = '';
    for (const t of [0.25, 0.5, 0.75]) {
      const ax = cx - hw + hw * t, ay = y - hh * t;
      const bx = cx + hw * t, by = y + hh - hh * t;
      const ex = cx + hw * t, ey = y - hh + hh * t;
      const fx = cx - hw + hw * t, fy = y + hh * t;
      o += `<path d="M${ax} ${ay}L${bx} ${by}M${ex} ${ey}L${fx} ${fy}" stroke="${C.goldLight}" stroke-opacity="${op}" stroke-width="1"/>`;
    }
    return o;
  };
  const ys = [cy - gap, cy, cy + gap];
  const nodes = [
    [cx, ys[0] - hh * 0.5, cx, ys[1] - hh * 0.5, cx, ys[2] - hh * 0.5],
    [cx - hw * 0.5, ys[0], cx - hw * 0.5, ys[1], null, null],
    [cx + hw * 0.5, ys[0], cx + hw * 0.5, ys[1], cx + hw * 0.5, ys[2]],
  ];
  let wires = '', dots = '';
  for (const n of nodes) {
    for (let i = 0; i < 4; i += 2) {
      if (n[i + 2] !== null && n[i + 2] !== undefined) wires += `<path d="M${n[i]} ${n[i + 1]}V${n[i + 3]}" stroke="${C.goldLight}" stroke-opacity=".55" stroke-width="1.4" stroke-dasharray="3 5"/>`;
    }
    for (let i = 0; i < 6; i += 2) {
      if (n[i] !== null) dots += `<circle cx="${n[i]}" cy="${n[i + 1]}" r="${5 * Math.max(s, 0.8)}" fill="${C.bg}" stroke="${C.goldLight}" stroke-width="1.8"/>`;
    }
  }
  return plane(ys[2], 0.28, 0.02) + inner(ys[2], 0.09) + plane(ys[1], 0.42, 0.035) + inner(ys[1], 0.12) + wires + plane(ys[0], 0.8, 0.07) + inner(ys[0], 0.18) + dots;
};
const lightDefs = (w, h, id = 'l') =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.gold}" stop-opacity="0"/><stop offset=".55" stop-color="${C.gold}" stop-opacity=".2"/><stop offset="1" stop-color="${C.gold}" stop-opacity=".04"/></linearGradient>` +
  `<radialGradient id="${id}g" gradientUnits="userSpaceOnUse" cx="${w * 0.72}" cy="${h * 0.5}" r="${Math.max(w, h) * 0.5}"><stop stop-color="${C.goldLight}" stop-opacity=".17"/><stop offset="1" stop-color="${C.goldLight}" stop-opacity="0"/></radialGradient>`;

function bannerDesktop() {
  const W = 1660, H = 640;
  const body =
    panel(W, H) +
    `<rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="27" fill="url(#lg)"/>` +
    `<path d="M1040 2H1370L1190 ${H - 2}H860Z" fill="url(#l)"/>` +
    layers(1240, 320, 1) +
    text('MATHEUS', 76, 212, { font: F.d3, size: 148, track: -0.015 }) +
    text('SANTANA', 164, 346, { font: F.d3, size: 148, track: -0.015 }) +
    `<rect x="76" y="412" width="64" height="3" fill="${C.goldLight}"/>` +
    text('Desenvolvedor Full Stack', 76, 482, { font: F.s5, size: 42, fill: C.goldLight }) +
    text('JavaScript · TypeScript · React · Node.js', 76, 540, { font: F.m4, size: 29, fill: C.muted });
  write('profile-banner.svg', svg(W, H, 'Matheus Santana, Desenvolvedor Full Stack. JavaScript, TypeScript, React e Node.js.', body, panelDefs() + lightDefs(W, H)));
}
function bannerMobile() {
  const W = 640, H = 720;
  const body =
    panel(W, H, { r: 24 }) +
    `<rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="23" fill="url(#lg)"/>` +
    `<path d="M300 2H560L470 ${H - 2}H210Z" fill="url(#l)" opacity=".8"/>` +
    layers(400, 182, 0.62) +
    text('MATHEUS', 38, 436, { font: F.d3, size: 100, track: -0.015 }) +
    text('SANTANA', 92, 530, { font: F.d3, size: 100, track: -0.015 }) +
    text('Desenvolvedor Full Stack', 38, 606, { font: F.s5, size: 40, fill: C.goldLight }) +
    text('JavaScript · TypeScript', 38, 654, { font: F.m4, size: 28, fill: C.muted }) +
    text('React · Node.js', 38, 692, { font: F.m4, size: 28, fill: C.muted });
  write('profile-banner-mobile.svg', svg(W, H, 'Matheus Santana, Desenvolvedor Full Stack. JavaScript, TypeScript, React e Node.js.', body, panelDefs() + lightDefs(W, H)));
}

// ---------- Botões ----------
const ICON = {
  globe: (c) => `<g fill="none" stroke="${c}" stroke-width="1.7"><circle cx="10" cy="10" r="8"/><path d="M2 10h16M10 2c2.6 2.4 3.6 5 3.6 8s-1 5.6-3.6 8c-2.6-2.4-3.6-5-3.6-8s1-5.6 3.6-8z"/></g>`,
  linkedin: (c) => `<g fill="${c}"><rect x="2.2" y="7.4" width="3.2" height="10.2"/><circle cx="3.8" cy="4" r="1.9"/><path d="M8.2 7.4h3.1v1.4c.5-.9 1.7-1.7 3.3-1.7 3.2 0 3.8 2.1 3.8 4.8v5.7h-3.2v-5c0-1.3 0-2.8-1.7-2.8s-2 1.3-2 2.7v5.1H8.2z"/></g>`,
  mail: (c) => `<g fill="none" stroke="${c}" stroke-width="1.7" stroke-linejoin="round"><rect x="2" y="4" width="16" height="12" rx="2"/><path d="M2.6 5.2 10 11l7.4-5.8"/></g>`,
  code: (c) => `<path d="M6.5 5 1.8 10l4.7 5M13.5 5l4.7 5-4.7 5M11.6 3.5 8.4 16.5" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  open: (c) => `<path d="M5 15 15 5M7 5h8v8" fill="none" stroke="${c}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
};
function button(file, label, icon, { primary = false, alt = label } = {}) {
  const size = 16, h = 44;
  const w = Math.ceil(measure(label, F.s5, size)) + 66;
  const bg = primary ? C.gold : C.surface;
  const stroke = primary ? C.goldLight : '#4A4030';
  const fg = primary ? '#16120B' : C.text;
  const ic = primary ? '#16120B' : C.goldLight;
  const body =
    `<rect x=".75" y=".75" width="${w - 1.5}" height="${h - 1.5}" rx="${(h - 1.5) / 2}" fill="${bg}" stroke="${stroke}" stroke-width="1.5"/>` +
    `<g transform="translate(19 12)">${ICON[icon](ic)}</g>` +
    text(label, 49, h / 2 + size * 0.35, { font: F.s5, size, fill: fg });
  write(`btn-${file}.svg`, svg(w, h, alt, body));
  return w;
}

// ---------- Títulos de seção e separador ----------
// Dourado único: contraste de pelo menos 3:1 (texto grande) no branco e no escuro do GitHub,
// sem depender de variantes por tema.
function sectionTitle(file, label) {
  const color = '#A8833F';
  const w = Math.ceil(measure(label, F.d4, 34)) + 44;
  const body =
    `<path d="M4 18 16 30 4 42" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` +
    text(label, 34, 42, { font: F.d4, size: 34, fill: color });
  write(`title-${file}.svg`, svg(w, 56, label, body));
}
function divider() {
  const W = 1660, H = 14;
  const defs = `<linearGradient id="d"><stop stop-color="${C.gold}"/><stop offset=".45" stop-color="${C.gold}" stop-opacity=".35"/><stop offset="1" stop-color="${C.gold}" stop-opacity="0"/></linearGradient>`;
  write('divider.svg', svg(W, H, '', `<rect y="6" width="${W}" height="2" fill="url(#d)"/><rect x="0" y="3" width="56" height="8" fill="${C.gold}"/>`, defs));
}

// ---------- Fluxa ----------
const browserFrame = (x, y, w, imgH, b64, id, { chrome = 62, urlSize = 25 } = {}) => {
  const r = 18, fade = Math.round(imgH * 0.06);
  return (
    `<rect x="${x - 1}" y="${y - 1}" width="${w + 2}" height="${chrome + imgH + 2}" rx="${r + 1}" fill="none" stroke="${C.gold}" stroke-opacity=".55" stroke-width="2"/>` +
    `<g clip-path="url(#${id})">` +
    `<rect x="${x}" y="${y}" width="${w}" height="${chrome}" fill="${C.surface2}"/>` +
    [0, 1, 2].map((i) => `<circle cx="${x + 34 + i * 26}" cy="${y + chrome / 2}" r="7" fill="#454A55"/>`).join('') +
    text('fluxa-core-app-five.vercel.app', x + w / 2 + 36, y + chrome / 2 + urlSize * 0.34, { font: F.m4, size: urlSize, fill: C.muted, anchor: 'middle' }) +
    `<image x="${x}" y="${y + chrome}" width="${w}" height="${imgH}" href="data:image/webp;base64,${b64}"/>` +
    `<rect x="${x}" y="${y + chrome + imgH - fade}" width="${w}" height="${fade}" fill="url(#${id}f)"/>` +
    `</g>`
  );
};
const frameDefs = (x, y, w, h, id, chrome = 62) =>
  `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${chrome + h}" rx="18"/></clipPath>` +
  `<linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${C.bg}" stop-opacity="0"/><stop offset="1" stop-color="${C.bg}" stop-opacity=".7"/></linearGradient>`;

const FLUXA = {
  title: 'Fluxa',
  kind: '01  ·  FINANÇAS PESSOAIS  ·  FULL STACK',
  desc: 'Aplicação para organizar receitas, despesas, cartões, parcelamentos, assinaturas e metas.',
  product: ['Gestão de receitas e despesas', 'Cartões e parcelamentos', 'Assinaturas e metas'],
  eng: ['Operações financeiras transacionais', 'Controle de concorrência', 'Sessões revogáveis', 'Autenticação em duas etapas', 'Testes de integração'],
  stack: ['React', 'TypeScript', 'Fastify', 'PostgreSQL', 'Knex'],
};
const CROP = { w: 772, h: 600 };

function fluxaDesktop(b64) {
  const W = 1660, pad = 60, fw = W - pad * 2, fh = Math.round((fw * CROP.h) / CROP.w), fy = 300;
  const by = fy + 62 + fh + 84;
  const H = by + 320;
  const d = para(FLUXA.desc, 620, 158, 960, { size: 34, fill: '#D4D4D8', lh: 1.45 });
  const col = (label, x) => eyebrow(label, x, by, { size: 23 });
  const body =
    panel(W, H) +
    `<rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="27" fill="url(#h)"/>` +
    eyebrow(FLUXA.kind, pad, 88) +
    text(FLUXA.title, pad - 4, 226, { font: F.d3, size: 148, track: -0.01 }) +
    d.svg +
    browserFrame(pad, fy, fw, fh, b64, 'fc') +
    col('PRODUTO', pad) + list(FLUXA.product, pad, by + 58, { size: 29, gap: 46 }).svg +
    col('ENGENHARIA', 560) + list(FLUXA.eng, 560, by + 58, { size: 29, gap: 46 }).svg +
    col('STACK', 1160) + chips(FLUXA.stack, 1160, by + 30, 440, { size: 26, h: 54 }).svg;
  const defs = panelDefs() + frameDefs(pad, fy, fw, fh, 'fc') +
    `<radialGradient id="h" gradientUnits="userSpaceOnUse" cx="1300" cy="0" r="900"><stop stop-color="${C.goldLight}" stop-opacity=".15"/><stop offset="1" stop-color="${C.goldLight}" stop-opacity="0"/></radialGradient>`;
  write('project-fluxa.svg', svg(W, H, 'Fluxa: aplicação de finanças pessoais, com captura real do dashboard.', body, defs));
}
function fluxaMobile(b64) {
  const W = 640, pad = 28, fw = W - pad * 2, fh = Math.round((fw * CROP.h) / CROP.w);
  let y = 66;
  let body = eyebrow('01  ·  FINANÇAS PESSOAIS', pad, y, { size: 24 });
  y += 106;
  body += text(FLUXA.title, pad - 3, y, { font: F.d3, size: 118 });
  y += 62;
  const d = para(FLUXA.desc, pad, y, fw, { size: 31, fill: '#D4D4D8', lh: 1.42 });
  body += d.svg;
  const fy = d.y + 42;
  body += browserFrame(pad, fy, fw, fh, b64, 'fc', { chrome: 54, urlSize: 22 });
  y = fy + 54 + fh + 66;
  body += eyebrow('PRODUTO', pad, y, { size: 24 });
  let l = list(FLUXA.product, pad, y + 52, { size: 30, gap: 48 });
  body += l.svg; y = l.y + 76;
  body += eyebrow('ENGENHARIA', pad, y, { size: 24 });
  l = list(FLUXA.eng, pad, y + 52, { size: 30, gap: 48 });
  body += l.svg; y = l.y + 76;
  body += eyebrow('STACK', pad, y, { size: 24 });
  const c = chips(FLUXA.stack, pad, y + 26, fw, { size: 26, h: 54 });
  body += c.svg;
  const H = Math.ceil(c.y + 44);
  const defs = panelDefs() + frameDefs(pad, fy, fw, fh, 'fc', 54);
  write('project-fluxa-mobile.svg', svg(W, H, 'Fluxa: aplicação de finanças pessoais, com captura real do dashboard.', panel(W, H, { r: 24 }) + body, defs));
}

// ---------- Massa ao Ponto ----------
const MASSA = {
  kind: '02  ·  GESTÃO DE PIZZARIA',
  name: 'Massa ao Ponto',
  note: 'Backend com implementação relevante. As telas operacionais do frontend ainda estão em desenvolvimento.',
  scope: ['Reservas e mesas', 'Catálogo e pedidos', 'Delivery', 'Atendimento presencial', 'Pagamentos simulados'],
  eng: ['Módulos separados por domínio', 'Controle de acesso por estabelecimento', 'Testes com PostgreSQL real'],
  stack: ['Node.js', 'React', 'Fastify', 'Drizzle', 'Vitest'],
};
// Diagrama conceitual. A camada de interface fica tracejada de propósito:
// mostra visualmente que as telas operacionais ainda estão em desenvolvimento.
function massaDiagram(x, y, w, { title = 30, body = 25, tag = 22 } = {}) {
  const pad = 26, ih = 128, gapV = 58;
  let out = '';
  const tier = (ty, h, label, tech, opts = {}) => {
    out += `<rect x="${x}" y="${ty}" width="${w}" height="${h}" rx="16" fill="${C.surface}" stroke="${opts.dashed ? C.gold : C.line}" stroke-opacity="${opts.dashed ? 0.75 : 1}" stroke-width="2"${opts.dashed ? ' stroke-dasharray="9 8"' : ''}/>`;
    out += eyebrow(label, x + pad, ty + 42, { size: tag });
    out += text(tech, x + pad, ty + 86, { font: F.s5, size: title });
  };
  const arrow = (ay) => {
    out += `<path d="M${x + w / 2} ${ay + 8}V${ay + gapV - 10}M${x + w / 2 - 7} ${ay + gapV - 17}L${x + w / 2} ${ay + gapV - 9}L${x + w / 2 + 7} ${ay + gapV - 17}" fill="none" stroke="${C.gold}" stroke-width="2"/>`;
  };
  let ty = y;
  tier(ty, ih + 22, 'INTERFACE', 'React · TypeScript · Vite', { dashed: true });
  const emDev = wrap('Telas operacionais em desenvolvimento', w - pad * 2, F.s4, body);
  out += text(emDev[0], x + pad, ty + 126, { size: body - 1, fill: C.goldLight });
  ty += ih + 22; arrow(ty); ty += gapV;

  // API e seus domínios
  const mods = ['Reservas', 'Mesas', 'Catálogo', 'Pedidos', 'Delivery', 'Atendimento', 'Pagamentos'];
  let mx = x + pad, my = ty + 170, rows = '';
  const mh = 48;
  for (const m of mods) {
    const mw = measure(m, F.m4, tag) + 28;
    if (mx + mw > x + w - pad) { mx = x + pad; my += mh + 10; }
    rows += `<rect x="${mx}" y="${my}" width="${mw}" height="${mh}" rx="9" fill="${C.bg}" stroke="${C.gold}" stroke-opacity=".42" stroke-width="1.5"/>`;
    rows += text(m, mx + 14, my + mh / 2 + tag * 0.34, { font: F.m4, size: tag, fill: C.cream });
    mx += mw + 10;
  }
  const apiH = my + mh + pad - ty;
  tier(ty, apiH, 'API', 'Fastify · Zod');
  out += `<rect x="${x + pad}" y="${ty + 108}" width="${w - pad * 2}" height="44" rx="9" fill="${C.gold}" fill-opacity=".1"/>`;
  out += text('Controle de acesso por estabelecimento', x + pad + 16, ty + 138, { font: F.s5, size: body - 2, fill: C.goldLight });
  out += rows;
  ty += apiH; arrow(ty); ty += gapV;

  tier(ty, ih - 22, 'DADOS', 'PostgreSQL · Drizzle');
  ty += ih - 22;
  return { svg: out, y: ty };
}
function massaDesktop() {
  const W = 1660, pad = 60, right = 860, rw = W - right - pad;
  const dia = massaDiagram(right, 60, rw);
  let body = eyebrow(MASSA.kind, pad, 88);
  body += text(MASSA.name, pad - 3, 192, { font: F.d3, size: 92, track: -0.01 });
  const st = status('Projeto pausado', pad, 228, { size: 26 });
  body += st.svg;
  const n = para(MASSA.note, pad, 332, 690, { size: 30, fill: C.muted, lh: 1.42 });
  body += n.svg;
  const ly = n.y + 76;
  body += eyebrow('ESCOPO', pad, ly, { size: 23 }) + list(MASSA.scope, pad, ly + 52, { size: 28, gap: 44 }).svg;
  body += eyebrow('ENGENHARIA', 430, ly, { size: 23 }) + list(MASSA.eng, 430, ly + 52, { size: 28, gap: 44, maxW: 370 }).svg;
  const cy = ly + 52 + 44 * 4 + 44;
  const c = chips(MASSA.stack, pad, cy, 740, { size: 25, h: 50 });
  body += c.svg;
  const H = Math.ceil(Math.max(c.y, dia.y) + 60);
  write('project-massa.svg', svg(W, H, 'Massa ao Ponto: sistema de gestão de pizzaria, projeto pausado.', panel(W, H) + body + dia.svg, panelDefs()));
}
function massaMobile() {
  const W = 640, pad = 28, fw = W - pad * 2;
  let y = 66;
  let body = eyebrow(MASSA.kind, pad, y, { size: 24 });
  y += 80;
  body += text(MASSA.name, pad - 2, y, { font: F.d3, size: 80 });
  y += 36;
  body += status('Projeto pausado', pad, y, { size: 27 }).svg;
  y += 108;
  const n = para(MASSA.note, pad, y, fw, { size: 30, lh: 1.42 });
  body += n.svg; y = n.y + 68;
  const dia = massaDiagram(pad, y - 18, fw, { title: 30, body: 25, tag: 23 });
  body += dia.svg; y = dia.y + 70;
  body += eyebrow('ESCOPO', pad, y, { size: 24 });
  let l = list(MASSA.scope, pad, y + 52, { size: 30, gap: 48 });
  body += l.svg; y = l.y + 76;
  body += eyebrow('ENGENHARIA', pad, y, { size: 24 });
  l = list(MASSA.eng, pad, y + 52, { size: 30, gap: 48, maxW: fw });
  body += l.svg; y = l.y + 44;
  const c = chips(MASSA.stack, pad, y, fw, { size: 26, h: 54 });
  body += c.svg;
  const H = Math.ceil(c.y + 44);
  write('project-massa-mobile.svg', svg(W, H, 'Massa ao Ponto: sistema de gestão de pizzaria, projeto pausado.', panel(W, H, { r: 24 }) + body, panelDefs()));
}

// ---------- Quando Chega? (secundário, sem brilho nem arte) ----------
const QC = {
  name: 'Quando Chega?',
  desc: 'API de rastreamento de encomendas',
  points: ['Arquitetura desacoplada de provedores', 'Scheduler', 'Deduplicação idempotente de eventos', 'Integração validada com provedor simulado'],
  note: 'Pausado pelas limitações das integrações externas avaliadas.',
};
function quandoDesktop() {
  const W = 1660, H = 322, pad = 56;
  const body =
    panel(W, H, { r: 24 }) +
    text(QC.name, pad, 104, { font: F.d4, size: 60 }) +
    text(QC.desc, pad, 158, { size: 30, fill: C.muted }) +
    status('Projeto pausado', pad, 192, { size: 24 }).svg +
    text(QC.note, pad, 288, { size: 25, fill: '#8F8F98' }) +
    list(QC.points, 900, 86, { size: 29, gap: 58, fill: C.muted, mark: C.faint }).svg;
  write('project-quando-chega.svg', svg(W, H, 'Quando Chega?: API de rastreamento de encomendas, projeto pausado.', body, panelDefs('p', C.surface, C.bg2)));
}
function quandoMobile() {
  const W = 640, pad = 28, fw = W - pad * 2;
  let body = text(QC.name, pad, 82, { font: F.d4, size: 54 });
  body += text(QC.desc, pad, 132, { size: 29, fill: C.muted });
  body += status('Projeto pausado', pad, 160, { size: 25 }).svg;
  const l = list(QC.points, pad, 262, { size: 28, gap: 50, fill: C.muted, mark: C.faint, maxW: fw });
  body += l.svg;
  const n = para(QC.note, pad, l.y + 62, fw, { size: 26, fill: '#8F8F98', lh: 1.35 });
  body += n.svg;
  const H = Math.ceil(n.y + 40);
  write('project-quando-chega-mobile.svg', svg(W, H, 'Quando Chega?: API de rastreamento de encomendas, projeto pausado.', panel(W, H, { r: 24 }) + body, panelDefs('p', C.surface, C.bg2)));
}

// ---------- Clientes: superfície mais quente, com creme no lugar do dourado frio ----------
const artCebola = (W, h) => {
  // Agenda abstrata: colunas de dias e blocos de horário, sem dados reais.
  const cols = 6, cw = (W - 72) / cols, rows = 4, rh = (h - 72) / rows;
  const fill = [[0, 0, 2], [0, 3, 1], [1, 1, 2], [2, 0, 1], [2, 2, 2], [3, 1, 1], [3, 3, 1], [4, 0, 3], [5, 1, 2]];
  let o = '';
  for (let c = 0; c <= cols; c++) o += `<path d="M${36 + c * cw} 36V${h - 36}" stroke="${C.cream}" stroke-opacity=".1"/>`;
  for (let r = 0; r <= rows; r++) o += `<path d="M36 ${36 + r * rh}H${W - 36}" stroke="${C.cream}" stroke-opacity=".1"/>`;
  fill.forEach(([c, r, s], i) => {
    o += `<rect x="${36 + c * cw + 6}" y="${36 + r * rh + 6}" width="${cw - 12}" height="${s * rh - 12}" rx="9" fill="${C.goldLight}" fill-opacity="${[0.72, 0.2, 0.42, 0.14, 0.58, 0.26][i % 6]}"/>`;
  });
  return o;
};
const artStore = (W, h) => {
  // Grade de produtos em tablet + matriz de tamanhos + faixa de caixa, sem dados reais.
  let o = `<rect x="36" y="36" width="${W - 72}" height="${h - 72}" rx="16" fill="none" stroke="${C.cream}" stroke-opacity=".22" stroke-width="2"/>`;
  const gx = 60, gy = 60, s = (h - 120 - 20) / 2, gap = 20;
  const op = [0.5, 0.18, 0.3, 0.12, 0.66, 0.22];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++)
    o += `<rect x="${gx + c * (s + gap)}" y="${gy + r * (s + gap)}" width="${s}" height="${s}" rx="10" fill="${C.goldLight}" fill-opacity="${op[r * 3 + c]}"/>`;
  const rx = gx + 3 * (s + gap) + 14, rw = W - 60 - rx;
  o += `<path d="M${rx - 18} 60V${h - 60}" stroke="${C.cream}" stroke-opacity=".16"/>`;
  [0, 1, 2].forEach((i) => { o += `<rect x="${rx}" y="${64 + i * 34}" width="${rw * [0.86, 0.6, 0.74][i]}" height="12" rx="6" fill="${C.cream}" fill-opacity=".22"/>`; });
  o += `<rect x="${rx}" y="${h - 60 - 44}" width="${rw}" height="44" rx="10" fill="${C.goldLight}" fill-opacity=".85"/>`;
  return o;
};
function clientCard(file, { name, cat, desc, feats, tech, state, art, label }) {
  const W = 640, H = 968, pad = 36, artH = 262;
  const defs = panelDefs('p', C.warm2, C.warm) +
    `<linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#2C2317"/><stop offset="1" stop-color="#1A150E"/></linearGradient>` +
    `<clipPath id="c"><path d="M2 ${artH}V28a26 26 0 0 1 26-26H${W - 28}a26 26 0 0 1 26 26V${artH}Z"/></clipPath>`;
  let y = artH + 58;
  let body = panel(W, H, { stroke: C.warmLine }) +
    `<g clip-path="url(#c)"><rect width="${W}" height="${artH}" fill="url(#a)"/>${art(W, artH)}</g>` +
    `<path d="M2 ${artH}H${W - 2}" stroke="${C.warmLine}" stroke-width="2"/>`;
  body += eyebrow(cat.toUpperCase(), pad, y, { size: 22, fill: C.gold });
  y += 66;
  body += text(name, pad - 2, y, { font: F.d4, size: 58, fill: C.cream });
  y += 50;
  const d = para(desc, pad, y, W - pad * 2, { size: 26, fill: '#C9BFAE', lh: 1.4 });
  body += d.svg;
  y = d.y + 56;
  body += list(feats, pad, y, { size: 26, gap: 41, fill: '#E7DFD0', mark: C.goldLight, maxW: W - pad * 2 }).svg;
  const bottom = H - 158;
  body += `<path d="M${pad} ${bottom}H${W - pad}" stroke="${C.warmLine}" stroke-width="1.5"/>`;
  body += text(tech, pad, bottom + 50, { font: F.m4, size: 23, fill: '#B3A68F' });
  body += status(state, pad, bottom + 76, { size: 24, color: C.goldLight }).svg;
  write(`client-${file}.svg`, svg(W, H + 24, label, body, defs));
}

// ---------- Stack ----------
const GLYPH = {
  frontend: `<rect x="1" y="4" width="34" height="28" rx="4"/><path d="M1 12h34M6.500 8h.01M11 8h.01"/>`,
  backend: `<rect x="3" y="4" width="30" height="11" rx="3"/><rect x="3" y="21" width="30" height="11" rx="3"/><path d="M9 9.500h.01M9 26.500h.01M18 15v6"/>`,
  data: `<ellipse cx="18" cy="8" rx="14" ry="5"/><path d="M4 8v20c0 2.800 6.300 5 14 5s14-2.200 14-5V8M4 18c0 2.800 6.300 5 14 5s14-2.200 14-5"/>`,
  tests: `<path d="M18 2 32 7v11c0 8-6 13-14 16C10 31 4 26 4 18V7z"/><path d="m11 18 5 5 9-10"/>`,
  infra: `<path d="M18 2 33 10.500 18 19 3 10.500zM3 18l15 8.500L33 18M3 25.500 18 34l15-8.500"/>`,
  more: `<circle cx="18" cy="18" r="15"/><path d="M18 11v14M11 18h14"/>`,
};
const STACK = [
  ['frontend', 'Frontend', ['JavaScript', 'TypeScript', 'React', 'Vite', 'Tailwind CSS', 'HTML', 'CSS']],
  ['backend', 'Backend', ['Node.js', 'Fastify', 'Express', 'REST APIs', 'Zod']],
  ['data', 'Banco de dados', ['PostgreSQL', 'MySQL', 'SQLite', 'Knex', 'Drizzle ORM']],
  ['tests', 'Testes e qualidade', ['Vitest', 'Testes unitários', 'Integração', 'E2E', 'Git', 'GitHub Actions']],
  ['infra', 'Infraestrutura', ['Docker', 'Vercel', 'Render']],
  ['more', 'Complementares', ['Python', 'Fundamentos de Java', 'Arquitetura', 'Boas práticas']],
];
const stackCell = (x, y, w, [g, t, items], { titleSize = 36, size = 29 } = {}) => {
  let o = `<g transform="translate(${x} ${y})" fill="none" stroke="${C.goldLight}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${GLYPH[g]}</g>`;
  o += text(t, x + 54, y + 30, { font: F.d4, size: titleSize });
  const lines = [''];
  for (const it of items) {
    const next = lines.at(-1) ? `${lines.at(-1)} · ${it}` : it;
    if (measure(next, F.s4, size) > w && lines.at(-1)) lines.push(it);
    else lines[lines.length - 1] = next;
  }
  lines.forEach((l, i) => { o += text(l, x, y + 92 + i * size * 1.5, { size, fill: C.muted }); });
  return { svg: o, y: y + 92 + (lines.length - 1) * size * 1.5 };
};
function stackDesktop() {
  const W = 1660, pad = 60, gap = 56, cw = (W - pad * 2 - gap * 2) / 3, rowH = 282;
  let body = '';
  STACK.forEach((c, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = pad + col * (cw + gap), y = 68 + row * rowH;
    body += stackCell(x, y, cw, c).svg;
  });
  for (let c = 1; c < 3; c++) { const x = pad + c * (cw + gap) - gap / 2; body += `<path d="M${x} 60V${60 + rowH * 2 - 50}" stroke="${C.line}" stroke-width="1.5"/>`; }
  body += `<path d="M${pad} ${44 + rowH}H${W - pad}" stroke="${C.line}" stroke-width="1.5"/>`;
  const H = 60 + rowH * 2 - 10;
  write('stack.svg', svg(W, H, 'Stack e ferramentas por categoria.', panel(W, H) + body, panelDefs()));
}
function stackMobile() {
  const W = 640, pad = 32, fw = W - pad * 2;
  let y = 56, body = '';
  STACK.forEach((c, i) => {
    const r = stackCell(pad, y, fw, c, { titleSize: 36, size: 30 });
    body += r.svg;
    y = r.y + 48;
    if (i < STACK.length - 1) { body += `<path d="M${pad} ${y}H${W - pad}" stroke="${C.line}" stroke-width="1.5"/>`; y += 46; }
  });
  const H = Math.ceil(y + 4);
  write('stack-mobile.svg', svg(W, H, 'Stack e ferramentas por categoria.', panel(W, H, { r: 24 }) + body, panelDefs()));
}

// ---------- Rodapé ----------
function footer() {
  const W = 1660, H = 210;
  const body = panel(W, H) +
    `<rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="27" fill="url(#lg)"/>` +
    layers(1400, 96, 0.3) +
    text('Matheus Santana', 60, 112, { font: F.d3, size: 60 }) +
    text('Desenvolvedor Full Stack', 60, 162, { font: F.s4, size: 30, fill: C.goldLight });
  write('footer.svg', svg(W, H, 'Matheus Santana, Desenvolvedor Full Stack.', body, panelDefs() + lightDefs(W, H)));
  const Wm = 640, Hm = 220;
  const bodyM = panel(Wm, Hm, { r: 24 }) +
    text('Matheus Santana', 34, 100, { font: F.d3, size: 62 }) +
    text('Desenvolvedor Full Stack', 34, 158, { font: F.s4, size: 32, fill: C.goldLight });
  write('footer-mobile.svg', svg(Wm, Hm, 'Matheus Santana, Desenvolvedor Full Stack.', bodyM, panelDefs()));
}

// ---------- Execução ----------
const shot = await sharp(join(here, 'fluxa-dashboard.png'))
  .extract({ left: 0, top: 0, width: CROP.w, height: CROP.h })
  .webp({ quality: 88, effort: 6, smartSubsample: true })
  .toBuffer();
const b64 = shot.toString('base64');

bannerDesktop(); bannerMobile();
fluxaDesktop(b64); fluxaMobile(b64);
massaDesktop(); massaMobile();
quandoDesktop(); quandoMobile();
clientCard('cebola', {
  name: 'Cebola Barber', cat: 'Sistema de gestão para barbearia',
  desc: 'Agenda, clientes e atendimentos de uma barbearia, com agendamento online.',
  feats: ['Agendamento online', 'Cadastro de clientes e serviços', 'Horários e disponibilidade', 'Agenda administrativa', 'Acompanhamento dos atendimentos', 'Celular, tablet e desktop', 'Aplicação instalável (PWA)'],
  tech: 'React · TypeScript · Fastify · PostgreSQL',
  state: 'Em testes e evolução', art: artCebola,
  label: 'Cebola Barber: sistema de gestão para barbearia, em testes e evolução. Arte abstrata, não é uma tela do produto.',
});
clientCard('numero1', {
  name: 'Número 1 Store', cat: 'PDV e gestão comercial',
  desc: 'Vendas, estoque e caixa de uma loja, com registro de vendas em tablet.',
  feats: ['Registro de vendas em tablet', 'Estoque por categorias e tamanhos', 'Abertura e fechamento de caixa', 'Cadastro e gestão de funcionários', 'Relatórios de vendas', 'Movimentações de estoque'],
  tech: 'React · TypeScript · Fastify · PostgreSQL',
  state: 'Em desenvolvimento', art: artStore,
  label: 'Número 1 Store: PDV e gestão comercial, em desenvolvimento. Arte abstrata, não é uma tela do produto.',
});
stackDesktop(); stackMobile();
footer();
divider();
sectionTitle('sobre', 'Sobre');
sectionTitle('projetos', 'Projetos selecionados');
sectionTitle('clientes', 'Projetos para clientes');
sectionTitle('stack', 'Stack e ferramentas');
button('portfolio', 'Portfólio', 'globe', { primary: true });
button('linkedin', 'LinkedIn', 'linkedin');
button('email', 'E-mail', 'mail');
button('app', 'Abrir aplicação', 'open', { primary: true });
button('code', 'Ver código', 'code');
