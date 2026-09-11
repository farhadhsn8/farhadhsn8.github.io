// ============================================================
// tapeBar.js — the floating Turing-machine tape in the header bar.
//
// The machine's ribbon lives in a thin fixed bar just below the
// navigation. The head is steered by the pointer, the state by its
// vertical position, and every cell the machine writes glows.
// ============================================================

import { machine } from "../core/machine.js";
import { fitCanvas } from "../core/canvas.js";
import { TM, readCell, BLANK } from "../core/tape.js";
import { clamp, RGB, rgba, roundRect, watch } from "../core/util.js";

export function initTapeBar() {
  const canvas = document.getElementById("turing");
  if (!canvas) return;
  const view = fitCanvas(canvas, 2);
  const inView = watch(canvas);

  const els = {
    state: document.getElementById("tape-state"),
    note: document.getElementById("tape-status")
  };
  const last = { state: "", note: "" };

  machine.register((dt, d, s) => {
    if (!inView()) return;
    drawTape(view, els, last);
  });
}

// A scrolling ribbon of the symbols the reader has hovered. The
// head sits at the centre of the bar; committed writes glow.
function drawTape(view, els, last) {
  const ctx = view.ctx;
  const w = view.w;
  const h = view.h;
  ctx.clearRect(0, 0, w, h);

  const cellW = 22;
  const cellH = Math.min(30, h * 0.62);
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
  if (els.state) {
    const txt = `q${state} · h${active}`;
    if (txt !== last.state) {
      last.state = txt;
      els.state.textContent = txt;
    }
  }
  if (els.note) {
    const note = `δ(q${TM.lastFrom},'${TM.lastRead}')→(q${TM.lastTo},'${TM.lastWrite}',${TM.lastDir})`;
    if (note !== last.note) {
      last.note = note;
      els.note.textContent = note;
    }
  }
}
