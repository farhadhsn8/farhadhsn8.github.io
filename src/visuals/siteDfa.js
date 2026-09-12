// ============================================================
// siteDfa.js — the site map rendered as a deterministic finite
// automaton.
//
// Desktop (>=1180px): a vertical DFA in the left sidebar.
// Phone / tablet: a compact horizontal DFA pinned to the bottom.
// Both follow the scroll context published by main.js.
// ============================================================

import { machine } from "../core/machine.js";

const NS = "http://www.w3.org/2000/svg";

const el = (tag, attrs = {}) => {
  const node = document.createElementNS(NS, tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  return node;
};

const SECTIONS = [
  { id: "about", num: "01", name: "About" },
  { id: "education", num: "02", name: "Education" },
  { id: "experience", num: "03", name: "Experience" },
  { id: "honors", num: "04", name: "Honors" },
  { id: "research", num: "05", name: "Research" },
  { id: "projects", num: "06", name: "Projects" }
];

const SIDEBAR_MIN = 1180;
const ARIA =
  "Deterministic finite automaton of the page sections: " +
  SECTIONS.map((s) => s.name).join(", ") + ".";

function makeDefs() {
  const defs = el("defs");
  const marker = (id, fill) => {
    const m = el("marker", {
      id,
      viewBox: "0 0 8 8",
      refX: "6.5",
      refY: "4",
      markerWidth: "6",
      markerHeight: "6",
      orient: "auto-start-reverse"
    });
    m.appendChild(el("path", { d: "M0,0.9 L6.4,4 L0,7.1 z", fill }));
    return m;
  };
  defs.append(
    marker("dfa-arrow", "rgba(150,175,210,0.45)"),
    marker("dfa-arrow-active", "rgba(103,212,255,0.95)")
  );
  return defs;
}

function makeNode(sec, i, x, y, r) {
  const a = el("a", { href: `#${sec.id}`, class: "dfa__link", "aria-label": sec.name });
  const g = el("g", { class: "dfa__node", transform: `translate(${x} ${y})` });

  g.appendChild(el("circle", { r, class: "dfa__ring" }));
  if (i === SECTIONS.length - 1) {
    g.appendChild(el("circle", { r: r - 3.5, class: "dfa__ring dfa__ring--inner" }));
  }
  const num = el("text", { class: "dfa__num", y: 3.2 });
  num.textContent = sec.num;
  g.appendChild(num);

  return { a, g };
}

// ---- desktop: vertical automaton -----------------------------
function buildVertical() {
  const W = 236;
  const cx = 42;
  const r = 14;
  const top = 32;
  const gap = 62;
  const H = top + (SECTIONS.length - 1) * gap + top;

  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "group", "aria-label": ARIA });
  svg.appendChild(makeDefs());
  const edgeLayer = el("g");
  const nodeLayer = el("g");
  svg.append(edgeLayer, nodeLayer);

  // initial arrow
  const firstY = top;
  edgeLayer.appendChild(
    el("path", {
      d: `M ${cx} 8 L ${cx} ${firstY - r - 1}`,
      class: "dfa__edge",
      "marker-end": "url(#dfa-arrow)"
    })
  );
  const startLabel = el("text", { x: cx + 8, y: 13, class: "dfa__sym" });
  startLabel.textContent = "start";
  edgeLayer.appendChild(startLabel);

  const nodes = [];
  const edges = [];

  SECTIONS.forEach((sec, i) => {
    const y = top + i * gap;

    if (i > 0) {
      const py = top + (i - 1) * gap;
      const path = el("path", {
        d: `M ${cx} ${py + r} L ${cx} ${y - r - 1}`,
        class: "dfa__edge",
        "marker-end": "url(#dfa-arrow)"
      });
      edgeLayer.appendChild(path);
      edges.push({ path, to: i });
    }

    const { a, g } = makeNode(sec, i, cx, y, r);
    const name = el("text", { class: "dfa__name", x: r + 12, y: 4 });
    name.textContent = sec.name;
    g.appendChild(name);
    a.appendChild(g);
    nodeLayer.appendChild(a);
    nodes.push({ g, i });
  });

  // cycle edge: accepting state back to the start
  const lastY = top + (SECTIONS.length - 1) * gap;
  const midY = (firstY + lastY) / 2;
  const cyclePath = el("path", {
    d: `M ${cx - r} ${lastY} C 6 ${lastY}, 6 ${firstY}, ${cx - r - 1} ${firstY}`,
    class: "dfa__edge dfa__edge--cycle",
    "marker-end": "url(#dfa-arrow)"
  });
  edgeLayer.appendChild(cyclePath);
  const cycleLabel = el("text", {
    class: "dfa__sym",
    x: 10,
    y: midY,
    transform: `rotate(-90 10 ${midY})`
  });
  cycleLabel.textContent = "restart";
  edgeLayer.appendChild(cycleLabel);

  return { svg, nodes, edges, cyclePath };
}

// ---- phone / tablet: horizontal automaton --------------------
function buildHorizontal(hostWidth) {
  const n = SECTIONS.length;
  const W = Math.max(280, Math.round(hostWidth || 320));
  const H = 58;
  const padX = 20;
  const r = 11;
  const cy = 24;
  const step = (W - padX * 2) / (n - 1);
  const nameSize = Math.min(11, Math.max(8, step * 0.15));

  const svg = el("svg", {
    viewBox: `0 0 ${W} ${H}`,
    class: "dfa--bar",
    role: "group",
    "aria-label": ARIA
  });
  svg.style.setProperty("--dfa-name-size", `${nameSize.toFixed(2)}px`);
  svg.appendChild(makeDefs());
  const edgeLayer = el("g");
  const nodeLayer = el("g");
  svg.append(edgeLayer, nodeLayer);

  // initial arrow
  const x0 = padX;
  edgeLayer.appendChild(
    el("path", {
      d: `M ${x0 - 16} ${cy} L ${x0 - r - 1} ${cy}`,
      class: "dfa__edge",
      "marker-end": "url(#dfa-arrow)"
    })
  );

  const nodes = [];
  const edges = [];

  SECTIONS.forEach((sec, i) => {
    const x = padX + i * step;

    if (i > 0) {
      const px = padX + (i - 1) * step;
      const path = el("path", {
        d: `M ${px + r + 1} ${cy} L ${x - r - 1} ${cy}`,
        class: "dfa__edge",
        "marker-end": "url(#dfa-arrow)"
      });
      edgeLayer.appendChild(path);
      edges.push({ path, to: i });
    }

    const { a, g } = makeNode(sec, i, x, cy, r);
    const name = el("text", {
      class: "dfa__name",
      x: 0,
      y: r + 12,
      "text-anchor": "middle"
    });
    name.textContent = sec.name;
    g.appendChild(name);
    a.appendChild(g);
    nodeLayer.appendChild(a);
    nodes.push({ g, i });
  });

  // cycle edge arcs over the row
  const lastX = padX + (n - 1) * step;
  const cyclePath = el("path", {
    d: `M ${lastX} ${cy - r} C ${lastX} 2, ${x0} 2, ${x0} ${cy - r - 1}`,
    class: "dfa__edge dfa__edge--cycle",
    "marker-end": "url(#dfa-arrow)"
  });
  edgeLayer.appendChild(cyclePath);

  return { svg, nodes, edges, cyclePath };
}

export function initSiteDfa() {
  const host = document.getElementById("site-dfa");
  if (!host) return;
  const readout = document.getElementById("dfa-readout");

  let view = null;

  const update = () => {
    if (!view) return;
    const active = SECTIONS.findIndex((s) => s.id === machine.s.context);

    for (const n of view.nodes) {
      n.g.classList.toggle("is-active", n.i === active);
      n.g.classList.toggle("is-done", active > -1 && n.i < active);
    }

    for (const e of view.edges) {
      const on = active > -1 && e.to === active;
      e.path.classList.toggle("is-active", on);
      e.path.setAttribute("marker-end", on ? "url(#dfa-arrow-active)" : "url(#dfa-arrow)");
    }

    const cycleOn = active === 0;
    view.cyclePath.classList.toggle("is-active", cycleOn);
    view.cyclePath.setAttribute("marker-end", cycleOn ? "url(#dfa-arrow-active)" : "url(#dfa-arrow)");

    if (!readout) return;
    let text;
    if (active < 0) {
      text = `start → ${SECTIONS[0].name}`;
    } else {
      const next = SECTIONS[active + 1];
      text = next
        ? `δ(${SECTIONS[active].name}) → ${next.name}`
        : `δ(${SECTIONS[active].name}) → restart`;
    }
    if (readout.textContent !== text) readout.textContent = text;
  };

  const render = () => {
    const vertical = window.matchMedia(`(min-width: ${SIDEBAR_MIN}px)`).matches;
    view = vertical ? buildVertical() : buildHorizontal(host.clientWidth);
    host.replaceChildren(view.svg);
    update();
  };

  let raf = 0;
  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(render);
  };

  window.addEventListener("resize", schedule, { passive: true });
  if (typeof ResizeObserver !== "undefined") {
    let lastW = host.clientWidth;
    new ResizeObserver(() => {
      const w = host.clientWidth;
      if (Math.abs(w - lastW) > 1) {
        lastW = w;
        schedule();
      }
    }).observe(host);
  }

  machine.register(update);
  render();
}
