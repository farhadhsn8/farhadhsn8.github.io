// ============================================================
// bitstream.js — the entropy-coded output.
//
// The density of the stream is the bitrate: stronger compression
// leaves fewer set bits and a shorter payload. Bits drift and flip
// deterministically, and react to the pointer's column.
// ============================================================

import { machine, bit } from "../core/machine.js";
import { fitCanvas } from "../core/canvas.js";
import { clamp, RGB, rgba, watch } from "../core/util.js";

export function initBitstream() {
  const canvas = document.getElementById("bitstream");
  if (!canvas) return;
  const view = fitCanvas(canvas, 2);
  const inView = watch(canvas);
  const ctx = view.ctx;

  machine.register((dt, d, s) => {
    if (!inView()) return;
    const w = view.w;
    const h = view.h;
    const pad = 8;
    const sizeW = 26;
    const cols = 48;
    const rows = 4;
    const gridW = w - pad * 2 - sizeW;
    const cellW = gridW / cols;
    const cellH = (h - 20) / rows;
    const top = 8;

    ctx.clearRect(0, 0, w, h);

    const density = clamp(d.bitrate * 0.92 + 0.05);
    const shift = Math.floor(s.time * (1 + density * 6));
    const hoverCol = Math.floor(s.fx * cols);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = c + r * cols + shift * (r + 1);
        const v = bit(idx, 5);
        const on = v < density;
        const near = clamp(1 - Math.abs(c - hoverCol) / 6) * s.focus;
        const x = pad + c * cellW;
        const y = top + r * cellH;

        if (on) {
          const a = 0.28 + near * 0.6;
          ctx.fillStyle = rgba(near > 0.1 ? RGB.ink : RGB.cyan, a);
          const bw = Math.max(1, cellW - 2.5);
          const bh = Math.max(1.5, cellH - 4);
          ctx.fillRect(x + 1, y + 2, bw, bh);
        } else {
          ctx.fillStyle = rgba(RGB.muted, 0.12 + near * 0.2);
          ctx.fillRect(x + 1, y + cellH / 2 - 0.5, Math.max(1, cellW - 2.5), 1);
        }
      }
    }

    // compactness meter
    const mx = w - pad - sizeW + 8;
    const mTop = top + 2;
    const mH = h - 20;
    ctx.strokeStyle = rgba(RGB.muted, 0.25);
    ctx.strokeRect(mx, mTop, 7, mH);
    const fillH = mH * density;
    ctx.fillStyle = rgba(RGB.cyan, 0.7);
    ctx.fillRect(mx, mTop + (mH - fillH), 7, fillH);
    ctx.font = `8px "JetBrains Mono", monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = rgba(RGB.muted, 0.8);
    ctx.fillText(d.bpp.toFixed(2), mx + 11, mTop + 1);
  });
}
