// ============================================================
// codecMini.js — the hero's compact x → E → ẑ → Q → bits → D → x̂
// schematic. A travelling token marks the current pipeline position.
// ============================================================

import { machine } from "../core/machine.js";
import { fitCanvas } from "../core/canvas.js";
import { clamp, RGB, rgba, roundRect, watch } from "../core/util.js";

const LABELS = ["x", "E", "ẑ", "Q", "bits", "D", "x̂"];
// map pipeline stage (0..8) onto the 7 mini stations
const STAGE_MAP = [0, 1, 2, 3, 4, 4, 5, 6, 6];

export function initCodecMini() {
  const canvas = document.getElementById("codec-mini");
  if (!canvas) return;
  const view = fitCanvas(canvas, 2);
  const inView = watch(canvas);
  const ctx = view.ctx;

  machine.register((dt, d, s) => {
    if (!inView()) return;
    const w = view.w;
    const h = view.h;
    const n = LABELS.length;
    const pad = 12;
    const gap = 10;
    const boxW = (w - pad * 2 - gap * (n - 1)) / n;
    const boxH = Math.min(46, h * 0.5);
    const cy = h * 0.42;

    ctx.clearRect(0, 0, w, h);

    const centers = [];
    for (let i = 0; i < n; i++) {
      const x = pad + i * (boxW + gap);
      centers.push(x + boxW / 2);
      const active = STAGE_MAP[d.stage] === i;
      const done = STAGE_MAP[d.stage] > i;

      // connector
      if (i > 0) {
        const x0 = pad + (i - 1) * (boxW + gap) + boxW;
        ctx.strokeStyle = rgba(RGB.muted, done ? 0.4 : 0.16);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0 + 2, cy);
        ctx.lineTo(x - 2, cy);
        ctx.stroke();
      }

      ctx.beginPath();
      roundRect(ctx, x, cy - boxH / 2, boxW, boxH, 5);
      ctx.fillStyle = active
        ? rgba(RGB.cyan, 0.12)
        : rgba(RGB.ink, 0.015);
      ctx.fill();
      ctx.strokeStyle = active ? rgba(RGB.cyan, 0.6) : rgba(RGB.muted, done ? 0.3 : 0.16);
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = `${Math.max(9, Math.round(boxH * 0.3))}px "JetBrains Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = active ? rgba(RGB.ink, 0.95) : rgba(RGB.muted, 0.7);
      ctx.fillText(LABELS[i], x + boxW / 2, cy + 0.5);

      // latent bars inside ẑ and Q
      if (i === 2 || i === 3) {
        const count = clamp(Math.round(d.latentDim / 6), 2, 7);
        const bw = Math.max(1, (boxW - 12) / count - 1.5);
        for (let b = 0; b < count; b++) {
          const bh = (0.25 + ((b * 37) % 10) / 10 * 0.7) * boxH * 0.42;
          const bx = x + 6 + b * (bw + 1.5);
          const q = i === 3 ? Math.round(bh / 4) * 4 : bh;
          ctx.fillStyle = rgba(i === 3 ? RGB.violet : RGB.cyan, 0.5);
          ctx.fillRect(bx, cy + boxH * 0.34 - q, bw, q);
        }
      }
    }

    // travelling token
    const t = d.p * (n - 1);
    const ti = Math.floor(t);
    const frac = t - ti;
    const x = centers[clamp(ti, 0, n - 1)] + (frac * (boxW + gap)) * (ti < n - 1 ? 1 : 0);
    ctx.beginPath();
    ctx.arc(x, cy - boxH / 2 - 8, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = rgba(RGB.cyan, 0.9);
    ctx.shadowColor = rgba(RGB.cyan, 0.8);
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
  });
}
