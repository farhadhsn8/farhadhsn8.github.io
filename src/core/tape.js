// ============================================================
// tape.js — the hidden Turing machine.
//
// A sparse, effectively unbounded tape that the reader writes to
// simply by hovering the portfolio's own text. The head is steered
// by horizontal pointer motion, the current state by vertical
// motion, and every read runs a deterministic transition that
// writes a symbol back onto the tape. It never halts and never
// resets — it just keeps accumulating the user's reading.
// ============================================================

import { machine, N } from "./machine.js";

export const BLANK = "·";

// The tape is addressed by integer cells. The head maps the full
// viewport width onto this span, so left/right mouse travel scrolls
// the ribbon while up/down travel selects one of the machine states.
const SPAN = 96;

// How long a held character is re-read before it is committed again,
// so resting on a word keeps the machine stepping.
const DWELL = 0.42;

export const TM = {
  tape: new Map(), // index -> symbol
  kind: new Map(), // index -> "read" | "write"
  glow: new Map(), // index -> write intensity (decays each frame)

  head: SPAN / 2,
  headTarget: SPAN / 2,
  headAtCommit: SPAN / 2,

  state: 0,
  stateTarget: 0,

  hoverChar: "",
  lastCommit: 0,

  lastRead: BLANK,
  lastWrite: BLANK,
  lastDir: "R",
  lastFrom: 0,
  lastTo: 1,

  steps: 0,
  span: SPAN
};

export function readCell(index) {
  return TM.tape.get(index) ?? BLANK;
}

function setCell(index, symbol, kind) {
  if (index < 0 || index >= TM.span) return;
  TM.tape.set(index, symbol);
  TM.kind.set(index, kind);
  TM.glow.set(index, 1);
}

// A deterministic substitution: the symbol the head writes back
// depends on both the symbol read and the machine's current state.
function encodeSymbol(ch, state) {
  const up = ch.toUpperCase();
  const code = up.charCodeAt(0);
  if (code >= 65 && code <= 90) {
    const shift = 1 + (state * 5) % 25;
    return String.fromCharCode(65 + ((code - 65 + shift) % 26));
  }
  if (code >= 48 && code <= 57) {
    return String.fromCharCode(48 + ((code - 48 + 1 + state) % 10));
  }
  return ch;
}

// δ(state, symbol) → (nextState, writeSymbol, direction)
export function delta(state, ch) {
  const code = ch.codePointAt(0) || 32;
  return {
    nextState: (state + 1 + (code % 3)) % N,
    writeSym: encodeSymbol(ch, state),
    dir: ((code + state) & 1) === 0 ? "R" : "L"
  };
}

function travelDir() {
  const head = Math.round(TM.head);
  if (head > TM.headAtCommit) return "R";
  if (head < TM.headAtCommit) return "L";
  return TM.lastDir;
}

// One machine step: read the hovered symbol into the current cell,
// then write the transformed symbol one cell in the travel direction.
export function commit(ch) {
  if (!ch) return;
  const head = Math.round(TM.head);
  const from = Math.round(TM.state);
  const { nextState, writeSym, dir } = delta(from, ch);
  const move = travelDir() || dir;

  setCell(head, ch, "read");
  setCell(head + (move === "R" ? 1 : -1), writeSym, "write");

  TM.lastRead = ch;
  TM.lastWrite = writeSym;
  TM.lastDir = move;
  TM.lastFrom = from;
  TM.lastTo = nextState;
  TM.steps += 1;
  TM.lastCommit = performance.now() / 1000;
  TM.headAtCommit = head;
}

// Called once per frame, before the sidebar draws: steer the head
// and state from the pointer, decay write glows and, if the reader
// is resting on a letter, keep the machine stepping.
export function tick(dt) {
  const s = machine.s;

  TM.headTarget = s.px * (TM.span - 1);
  TM.head += (TM.headTarget - TM.head) * (1 - Math.exp(-5 * dt));

  TM.stateTarget = s.py * (N - 1);
  TM.state += (TM.stateTarget - TM.state) * (1 - Math.exp(-5 * dt));

  for (const [i, v] of TM.glow) {
    const next = v * Math.exp(-3.6 * dt);
    if (next < 0.02) TM.glow.delete(i);
    else TM.glow.set(i, next);
  }

  if (TM.hoverChar && performance.now() / 1000 - TM.lastCommit > DWELL) {
    commit(TM.hoverChar);
  }
}

// ------------------------------------------------------------
// reading the portfolio — find the glyph under the pointer
// ------------------------------------------------------------
function isReadable(ch) {
  return /[\p{L}\p{N}]/u.test(ch);
}

function rectOf(node, index) {
  const range = document.createRange();
  range.setStart(node, index);
  range.setEnd(node, index + 1);
  return range.getBoundingClientRect();
}

function charAtPoint(x, y) {
  let node = null;
  let offset = 0;

  if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(x, y);
    if (range) {
      node = range.startContainer;
      offset = range.startOffset;
    }
  } else if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y);
    if (pos) {
      node = pos.offsetNode;
      offset = pos.offset;
    }
  }

  if (!node || node.nodeType !== 3) return "";
  const parent = node.parentElement;
  if (!parent || !parent.closest("main, footer")) return "";
  if (parent.closest(".nav, .tape-bar, .readout, .bg, noscript, input, textarea, select")) {
    return "";
  }

  const text = node.nodeValue || "";

  // the caret sits between glyphs — pick the glyph whose centre is
  // nearest the pointer, which is robust to the boundary offset
  let best = "";
  let bestDist = Infinity;
  for (const i of [offset - 1, offset]) {
    if (i < 0 || i >= text.length || !isReadable(text[i])) continue;
    const r = rectOf(node, i);
    if (!r.width) continue;
    const dist = Math.abs(x - (r.left + r.width * 0.5));
    if (dist < bestDist) {
      bestDist = dist;
      best = text[i];
    }
  }
  return best;
}

export function initTape() {
  let pending = null;
  let scheduled = false;

  const sample = () => {
    scheduled = false;
    if (!pending) return;
    const ch = charAtPoint(pending.x, pending.y);
    if (ch) {
      TM.hoverChar = ch;
      if (ch !== TM.lastRead || performance.now() / 1000 - TM.lastCommit > DWELL) {
        commit(ch);
      }
    } else {
      TM.hoverChar = "";
    }
    pending = null;
  };

  window.addEventListener(
    "pointermove",
    (e) => {
      pending = { x: e.clientX, y: e.clientY };
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(sample);
    },
    { passive: true }
  );

  window.addEventListener("pointerleave", () => {
    TM.hoverChar = "";
    pending = null;
  });

  // steering + dwell live on the shared animation loop, ahead of
  // the sidebar so the rail always renders the freshest machine.
  machine.register((dt) => tick(dt));
}
