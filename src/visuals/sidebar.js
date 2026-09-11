// ============================================================
// sidebar.js — the fixed instrument rail.
//
// Four compact 2D panels translate the shared machine state into
// the vocabulary of the site: a Turing tape, an encoder/decoder
// bottleneck, live quality metrics and an entropy bitstream. Canvas
// 2D keeps the rail cheap so it can render every frame.
// ============================================================

import { machine, bit } from "../core/machine.js";
import { fitCanvas } from "../core/canvas.js";
import { TM, readCell, BLANK } from "../core/tape.js";
import { clamp, RGB, rgba, roundRect, formatFixed, TAU } from "../core/util.js";

const METRICS = [
  { key: "PSNR", color: RGB.cyan, raw: (r) => 44 - 22 * r, min: 20, max: 44, fmt: (v) => v.toFixed(1) },
  { key: "SSIM", color: RGB.blue, raw: (r) => 0.99 - 0.5 * r, min: 0.4, max: 1, fmt: (v) => v.toFixed(3) },
  { key: "MS-SSIM", color: RGB.violet, raw: (r) => 0.995 - 0.45 * r, min: 0.5, max: 1, fmt: (v) => v.toFixed(3) },
  { key: "VMAF", color: RGB.good, raw: (r) => 98 - 68 * (0.4 * r + 0.6 * r * r), min: 20, max: 100, fmt: (v) => v.toFixed(1) }
];

const norm = (m, r) => clamp((m.raw(r) - m.min) / (m.max - m.min));

export function initSidebar() {
  const root = document.getElementById("sidebar");
  if (!root) return;

  const pick = (id) => {
    const c = document.getElementById(id);
    return c ? fitCanvas(c, 2) : null;
  };

  const views = {
    turing: pick("side-turing"),
    codec: pick("side-codec"),
    quality: pick("side-quality"),
    entropy: pick("side-entropy")
  };
  if (!views.turing && !views.codec && !views.quality && !views.entropy) return;

  const els = {
    turingState: document.getElementById("side-turing-state"),
    turingNote: document.getElementById("side-turing-note"),
    qualityState: document.getElementById("side-quality-state"),
    bpp: document.getElementById("side-bpp")
  };

  const last = { turing: "", note: "", quality: "", bpp: "" };
  const isVisible = () => {
    const r = root.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  machine.register((dt, d, s) => {
    if (!isVisible()) return;

    drawTuring(views.turing, d, s, els, last);
    drawCodec(views.codec, d, s);
    drawQuality(views.quality, d, els, last);
    drawEntropy(views.entropy, d, s, els, last);
  });
}

// ------------------------------------------------------------
// Turing tape — a scrolling ribbon of the symbols the reader has
// hovered. The head is steered by the pointer, the state by its
// vertical position, and every cell the machine writes glows.
// ------------------------------------------------------------
function drawTuring(view, d, s, els, last) {
  if (!view) return;
  const ctx = view.ctx;
  const w = view.w;
  const h = view.h;
  ctx.clearRect(0, 0, w, h);

  const cellW = 22;
  const cellH = Math.min(30, h * 0.5);
  const cy = h * 0.54;
  const head = TM.head;
  const active = Math.round(head);
  const n = Math.ceil(w / cellW) + 2;
  const base = active - Math.floor(n / 2);

  ctx.font = `500 ${Math.round(cellH * 0.46)}px "JetBrains Mono", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let j = 0; j < n; j++) {
    const idx = base + j;
    const x = (idx - head) * cellW + w * 0.5 - cellW * 0.5;
    const isHead = idx === active;
    const glow = TM.glow.get(idx) || 0;
    const sym = readCell(idx);
    const kind = TM.kind.get(idx);
    const near = clamp(1 - Math.abs(x + cellW * 0.5 - w * 0.5) / (cellW * 4));

    ctx.beginPath();
    roundRect(ctx, x + 1.5, cy - cellH / 2, cellW - 3, cellH, 4);
    ctx.fillStyle = isHead
      ? rgba(RGB.cyan, 0.13 + glow * 0.16)
      : rgba(RGB.ink, 0.02 + near * 0.03 + glow * 0.1);
    ctx.fill();
    ctx.strokeStyle = isHead
      ? rgba(RGB.cyan, 0.7)
      : rgba(RGB.muted, 0.1 + near * 0.18 + glow * 0.4);
    ctx.lineWidth = 1;
    ctx.stroke();

    if (sym === BLANK) {
      ctx.fillStyle = rgba(RGB.muted, 0.18 + near * 0.22);
    } else if (kind === "write") {
      ctx.fillStyle = rgba(RGB.violet, 0.55 + glow * 0.4);
    } else {
      ctx.fillStyle = isHead ? rgba(RGB.ink, 0.98) : rgba(RGB.ink, 0.66);
    }
    ctx.fillText(sym, x + cellW / 2, cy + 0.5);
  }

  // read/write head
  const hx = w * 0.5;
  const hy = cy - cellH / 2 - 8;
  ctx.beginPath();
  ctx.moveTo(hx, hy + 6);
  ctx.lineTo(hx - 4, hy);
  ctx.lineTo(hx + 4, hy);
  ctx.closePath();
  ctx.fillStyle = rgba(RGB.cyan, 0.95);
  ctx.shadowColor = rgba(RGB.cyan, 0.85);
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;

  const state = Math.round(TM.state);
  if (els.turingState) {
    const txt = `q${state} · h${active}`;
    if (txt !== last.turing) {
      last.turing = txt;
      els.turingState.textContent = txt;
    }
  }
  if (els.turingNote) {
    const note = `δ(q${TM.lastFrom},'${TM.lastRead}')→(q${TM.lastTo},'${TM.lastWrite}',${TM.lastDir})`;
    if (note !== last.note) {
      last.note = note;
      els.turingNote.textContent = note;
    }
  }
}

// ------------------------------------------------------------
// Encoder / decoder — an hourglass bottleneck with a scan line.
// ------------------------------------------------------------
function drawCodec(view, d, s) {
  if (!view) return;
  const ctx = view.ctx;
  const w = view.w;
  const h = view.h;
  ctx.clearRect(0, 0, w, h);

  const cy = h * 0.46;
  const x0 = 10;
  const x1 = w - 10;
  const xm = w * 0.5;
  const halfH = h * 0.3;
  const waist = halfH * 0.2;

  ctx.strokeStyle = rgba(RGB.muted, 0.28);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, cy - halfH);
  ctx.lineTo(xm, cy - waist);
  ctx.lineTo(x1, cy - halfH);
  ctx.moveTo(x0, cy + halfH);
  ctx.lineTo(xm, cy + waist);
  ctx.lineTo(x1, cy + halfH);
  ctx.stroke();

  // latent codes at the waist
  const count = clamp(Math.round(d.latentDim / 8), 3, 9);
  const bw = 2;
  const gap = (waist * 2) / count;
  for (let i = 0; i < count; i++) {
    const bh = (0.3 + ((i * 53) % 10) / 10 * 0.7) * waist * 1.4;
    const y = cy - bh / 2 + (i - (count - 1) / 2) * (gap * 0.18);
    ctx.fillStyle = rgba(RGB.cyan, 0.25 + (i / count) * 0.35);
    ctx.fillRect(xm - bw / 2, y, bw, bh);
  }

  // encode / decode split
  ctx.strokeStyle = rgba(RGB.muted, 0.16);
  ctx.beginPath();
  ctx.moveTo(xm, cy - halfH);
  ctx.lineTo(xm, cy + halfH);
  ctx.stroke();

  // travelling scan line
  const sx = x0 + d.p * (x1 - x0);
  ctx.strokeStyle = rgba(RGB.cyan, 0.85);
  ctx.shadowColor = rgba(RGB.cyan, 0.8);
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(sx, cy - halfH * 0.92);
  ctx.lineTo(sx, cy + halfH * 0.92);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.font = '8px "JetBrains Mono", monospace';
  ctx.textBaseline = "middle";
  ctx.fillStyle = rgba(RGB.muted, 0.85);
  ctx.textAlign = "left";
  ctx.fillText("x", x0, cy + halfH + 11);
  ctx.textAlign = "center";
  ctx.fillText("ẑ", xm, cy - halfH - 10);
  ctx.textAlign = "right";
  ctx.fillText("x̂", x1, cy + halfH + 11);
}

// ------------------------------------------------------------
// Quality — live PSNR / SSIM / MS-SSIM / VMAF bars.
// ------------------------------------------------------------
function drawQuality(view, d, els, last) {
  if (!view) return;
  const ctx = view.ctx;
  const w = view.w;
  const h = view.h;
  ctx.clearRect(0, 0, w, h);

  const pad = 8;
  const rowH = (h - pad * 2) / METRICS.length;
  const tw = w - pad * 2;

  METRICS.forEach((m, i) => {
    const y = pad + i * rowH;
    const val = m.raw(d.rate);
    const q = norm(m, d.rate);

    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = rgba(RGB.muted, 0.9);
    ctx.fillText(m.key, pad, y + rowH * 0.28);
    ctx.textAlign = "right";
    ctx.fillStyle = rgba(RGB.ink, 0.85);
    ctx.fillText(m.fmt(val), w - pad, y + rowH * 0.28);

    const ty = y + rowH * 0.62;
    ctx.fillStyle = rgba(RGB.muted, 0.14);
    roundRect(ctx, pad, ty, tw, 4, 2);
    ctx.fill();

    const fw = Math.max(3, tw * q);
    ctx.fillStyle = rgba(m.color, 0.85);
    roundRect(ctx, pad, ty, fw, 4, 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(pad + fw, ty + 2, 2.2, 0, TAU);
    ctx.fillStyle = rgba(m.color, 1);
    ctx.shadowColor = rgba(m.color, 0.8);
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  if (els.qualityState) {
    const txt = `PSNR ${METRICS[0].fmt(METRICS[0].raw(d.rate))}`;
    if (txt !== last.quality) {
      last.quality = txt;
      els.qualityState.textContent = txt;
    }
  }
}

// ------------------------------------------------------------
// Entropy — a scrolling bitstream whose energy tracks the rate.
// ------------------------------------------------------------
function drawEntropy(view, d, s, els, last) {
  if (!view) return;
  const ctx = view.ctx;
  const w = view.w;
  const h = view.h;
  ctx.clearRect(0, 0, w, h);

  const baseline = h * 0.82;
  const step = 8;
  const n = Math.ceil(w / step) + 1;
  const scroll = s.time * 5;
  const frac = scroll - Math.floor(scroll);
  const energy = clamp(0.45 + d.entropy * 0.55);

  for (let i = 0; i < n; i++) {
    const idx = Math.floor(scroll) + i;
    const b = bit(idx, 29);
    const x = (i - frac) * step;
    const bh = (b ? 0.62 : 0.24) * baseline * energy;
    ctx.fillStyle = b ? rgba(RGB.cyan, 0.3 + energy * 0.45) : rgba(RGB.muted, 0.2);
    ctx.fillRect(x + 1.5, baseline - bh, 4, bh);
  }

  ctx.strokeStyle = rgba(RGB.muted, 0.28);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, baseline + 0.5);
  ctx.lineTo(w, baseline + 0.5);
  ctx.stroke();

  if (els.bpp) {
    const txt = `${formatFixed(d.bpp, 2)} bpp`;
    if (txt !== last.bpp) {
      last.bpp = txt;
      els.bpp.textContent = txt;
    }
  }
}
