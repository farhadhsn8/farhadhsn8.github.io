// ============================================================
// probability.js — p(x), the entropy source.
//
// The distribution of the latent variable. As compression
// strength rises the distribution concentrates (entropy falls),
// which is exactly what an entropy coder exploits.
// ============================================================

import { machine } from "../core/machine.js";
import { fitCanvas } from "../core/canvas.js";
import { clamp, RGB, rgba, watch } from "../core/util.js";

export function initProbability() {
  const canvas = document.getElementById("probability");
  if (!canvas) return;
  const view = fitCanvas(canvas, 2);
  const inView = watch(canvas);
  const ctx = view.ctx;

  machine.register((dt, d, s) => {
    if (!inView()) return;
    const w = view.w;
    const h = view.h;
    const pad = 8;
    const base = h - 14;
    const top = 10;
    const span = base - top;

    ctx.clearRect(0, 0, w, h);

    const sigma = 0.06 + (1 - d.rate) * 0.3;
    const center = 0.42 + (s.fx - 0.5) * 0.35;
    const second = 0.78 + (s.fy - 0.5) * 0.2;
    const secondW = 0.4 + d.rate * 0.55;

    const bins = 48;
    const vals = new Array(bins);
    let max = 0;
    for (let i = 0; i < bins; i++) {
      const x = i / (bins - 1);
      const g1 = Math.exp(-((x - center) ** 2) / (2 * sigma * sigma));
      const g2 = Math.exp(-((x - second) ** 2) / (2 * sigma * sigma * 0.7)) * secondW;
      const v = g1 + g2;
      vals[i] = v;
      if (v > max) max = v;
    }

    // filled distribution
    ctx.beginPath();
    ctx.moveTo(pad, base);
    for (let i = 0; i < bins; i++) {
      const x = pad + (i / (bins - 1)) * (w - pad * 2);
      const y = base - (vals[i] / max) * span;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w - pad, base);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, top, 0, base);
    grad.addColorStop(0, rgba(RGB.cyan, 0.22));
    grad.addColorStop(1, rgba(RGB.cyan, 0.01));
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < bins; i++) {
      const x = pad + (i / (bins - 1)) * (w - pad * 2);
      const y = base - (vals[i] / max) * span;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = rgba(RGB.cyan, 0.75);
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // entropy annotation
    ctx.font = `9px "JetBrains Mono", monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = rgba(RGB.muted, 0.8);
    ctx.fillText(`H ≈ ${(0.25 + d.entropy * 0.75).toFixed(2)}`, pad, 2);

    // pointer scan
    if (s.focus > 0.02) {
      const px = pad + s.fx * (w - pad * 2);
      ctx.strokeStyle = rgba(RGB.ink, 0.18 * s.focus);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, top);
      ctx.lineTo(px, base);
      ctx.stroke();
      const idx = Math.round(s.fx * (bins - 1));
      const y = base - (vals[clamp(idx, 0, bins - 1)] / max) * span;
      ctx.beginPath();
      ctx.arc(px, y, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = rgba(RGB.cyan, 0.9 * s.focus);
      ctx.fill();
    }

    // axis
    ctx.strokeStyle = rgba(RGB.muted, 0.18);
    ctx.beginPath();
    ctx.moveTo(pad, base + 0.5);
    ctx.lineTo(w - pad, base + 0.5);
    ctx.stroke();
  });
}
