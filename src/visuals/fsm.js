// ============================================================
// fsm.js — the finite-state machine that names the computation.
//
// Nine stages laid out as a serpentine: input flows left-to-right
// through the encoder, drops through the bitstream, and returns
// right-to-left through the decoder, with a cycle edge back to
// INPUT. The active state, flowing particles and edge illumination
// all read from the shared machine.
// ============================================================

import { machine, STAGES, N, setStage } from "../core/machine.js";

const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}) => {
  const node = document.createElementNS(NS, tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  return node;
};

const SECTION_FOR_STAGE = [
  "hero",
  "compression",
  "transformers",
  "research",
  "compression",
  "compression",
  "experience",
  "projects",
  "quality"
];

export function initFSM() {
  const host = document.getElementById("fsm-hero");
  if (!host) return;
  const transitionEl = document.getElementById("fsm-transition");

  const W = 1000;
  const H = 200;
  const svg = el("svg", {
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    "aria-label":
      "Finite state machine: " + STAGES.join(", ") + "."
  });

  const defs = el("defs");
  const marker = el("marker", {
    id: "fsm-arrow",
    viewBox: "0 0 8 8",
    refX: "6",
    refY: "4",
    markerWidth: "5",
    markerHeight: "5",
    orient: "auto-start-reverse"
  });
  marker.appendChild(el("path", { d: "M0,1 L6,4 L0,7 z", fill: "rgba(150,175,210,0.4)" }));
  const markerActive = el("marker", {
    id: "fsm-arrow-active",
    viewBox: "0 0 8 8",
    refX: "6",
    refY: "4",
    markerWidth: "5",
    markerHeight: "5",
    orient: "auto-start-reverse"
  });
  markerActive.appendChild(el("path", { d: "M0,1 L6,4 L0,7 z", fill: "rgba(103,212,255,0.9)" }));
  defs.append(marker, markerActive);
  svg.appendChild(defs);

  // ---- geometry -------------------------------------------------
  const row1y = 58;
  const row2y = 148;
  const pad = 64;
  const span = W - pad * 2;
  const row1x = [0, 1, 2, 3, 4].map((i) => pad + (span * i) / 4);
  const row2x = [0, 1, 2, 3].map((i) => pad + (span * (3 - i)) / 3);

  const pos = [];
  for (let i = 0; i < 5; i++) pos[i] = { x: row1x[i], y: row1y };
  for (let i = 0; i < 4; i++) pos[5 + i] = { x: row2x[i], y: row2y };

  const edgeLayer = el("g");
  const nodeLayer = el("g");
  svg.append(edgeLayer, nodeLayer);

  // edges: [from, to, curved]
  const edgeDefs = [
    [0, 1, false], [1, 2, false], [2, 3, false], [3, 4, false],
    [4, 5, false],
    [5, 6, false], [6, 7, false], [7, 8, false],
    [8, 0, true] // cycle back to input
  ];

  const edges = edgeDefs.map(([from, to, curved]) => {
    const a = pos[from];
    const b = pos[to];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const cp = curved ? { x: mx, y: my + 66 } : { x: mx, y: my };
    const d = `M ${a.x} ${a.y} Q ${cp.x} ${cp.y} ${b.x} ${b.y}`;
    const path = el("path", { d, class: "fsm__edge", "marker-end": "url(#fsm-arrow)" });
    edgeLayer.appendChild(path);

    const pulses = [0, 1].map(() => {
      const c = el("circle", { r: 2.4, class: "fsm__pulse" });
      edgeLayer.appendChild(c);
      return c;
    });
    return { from, to, a, b, cp, path, pulses, curved };
  });

  // ---- nodes ----------------------------------------------------
  const nodes = STAGES.map((name, i) => {
    const p = pos[i];
    const g = el("g", {
      class: "fsm__node",
      transform: `translate(${p.x} ${p.y})`,
      tabindex: "0",
      role: "button",
      "aria-label": `${name} stage — activate`
    });
    g.appendChild(el("circle", { r: 14 }));
    const t = el("text", {
      x: 0,
      y: i < 5 ? -24 : 28,
      "text-anchor": "middle"
    });
    t.textContent = name;
    g.appendChild(t);
    nodeLayer.appendChild(g);

    const activate = () => {
      machine.s.hoverStage = i;
      const sec = document.getElementById(SECTION_FOR_STAGE[i]);
      if (sec) sec.scrollIntoView({ behavior: machine.s.reduced ? "auto" : "smooth", block: "start" });
      setStage(i);
    };
    g.addEventListener("pointerenter", () => (machine.s.hoverStage = i));
    g.addEventListener("pointerleave", () => (machine.s.hoverStage = null));
    g.addEventListener("focus", () => (machine.s.hoverStage = i));
    g.addEventListener("blur", () => (machine.s.hoverStage = null));
    g.addEventListener("click", activate);
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    });
    return { g, i, name };
  });

  host.appendChild(svg);

  let lastTransition = "";

  machine.register((dt, d, s) => {
    const hovered = s.hoverStage;
    const activeStage = hovered != null ? hovered : d.stage;

    for (const e of edges) {
      const isActive = e.to === activeStage && e.from === activeStage - 1;
      const isCycle = e.from === 8 && e.to === 0;
      const active = isActive || (isCycle && activeStage === 0);
      const done = e.to <= activeStage;
      e.path.classList.toggle("is-active", active);
      e.path.classList.toggle("is-flow", active);
      e.path.classList.toggle("is-done", done && !active);
      e.path.setAttribute("marker-end", active ? "url(#fsm-arrow-active)" : "url(#fsm-arrow)");

      const speed = s.reduced || s.paused ? 0 : active ? 0.5 : 0.14;
      e.pulses.forEach((c, k) => {
        if (speed === 0) {
          c.setAttribute("opacity", "0");
          return;
        }
        const t = ((s.time * speed + k * 0.5) % 1 + 1) % 1;
        const it = 1 - t;
        const x = it * it * e.a.x + 2 * it * t * e.cp.x + t * t * e.b.x;
        const y = it * it * e.a.y + 2 * it * t * e.cp.y + t * t * e.b.y;
        c.setAttribute("cx", x.toFixed(1));
        c.setAttribute("cy", y.toFixed(1));
        c.setAttribute("opacity", active ? "0.95" : "0.3");
      });
    }

    for (const n of nodes) {
      n.g.classList.toggle("is-active", n.i === activeStage);
      n.g.classList.toggle("is-done", n.i < activeStage);
    }

    if (transitionEl) {
      const from = STAGES[activeStage];
      const to = activeStage < N - 1 ? STAGES[activeStage + 1] : "INPUT";
      const txt = `δ(${from}, ·) → ${to}`;
      if (txt !== lastTransition) {
        lastTransition = txt;
        transitionEl.textContent = txt;
      }
    }
  });
}
