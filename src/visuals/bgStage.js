// ============================================================
// bgStage.js — the scroll-driven background visual stage.
//
// Every diagram lives in a fixed full-viewport layer. As the
// reader scrolls, the stage advances through the diagrams in
// order, cross-fading from one to the next so the whole set is
// seen over the length of the page. Only the visible layer keeps
// drawing, so the WebGL cost stays bounded.
// ============================================================

import { machine } from "../core/machine.js";

// the order diagrams appear as the page is scrolled
const ORDER = [
  "fsm",
  "codecMini",
  "codec",
  "probability",
  "attention",
  "quality",
  "bitstream",
  "collapse"
];

const FADE_MS = 850;

export function initBgStage() {
  const stage = document.getElementById("bg-stage");
  if (!stage) return;

  const layers = Array.from(stage.querySelectorAll("[data-viz]"));
  if (!layers.length) return;
  const byKey = new Map(layers.map((l) => [l.dataset.viz, l]));
  const keys = ORDER.filter((k) => byKey.has(k));
  if (!keys.length) return;

  // start hidden; the first frame reveals the active layer
  for (const layer of layers) layer.style.display = "none";

  let current = null;

  const show = (key) => {
    if (key === current) return;
    const prev = current ? byKey.get(current) : null;
    const next = byKey.get(key);
    current = key;

    if (prev && prev !== next) {
      prev.classList.remove("is-active");
      clearTimeout(prev.__hide);
      prev.__hide = setTimeout(() => {
        if (current !== prev.dataset.viz) prev.style.display = "none";
      }, FADE_MS);
    }

    if (next) {
      clearTimeout(next.__hide);
      next.style.display = "grid";
      // force a reflow so the opacity transition runs from 0
      void next.offsetWidth;
      next.classList.add("is-active");
    }
  };

  // page scroll length, refreshed whenever the document can resize
  let maxScroll = 1;
  const measure = () => {
    maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  };
  measure();
  window.addEventListener("resize", measure, { passive: true });
  window.addEventListener("load", measure);
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(measure).observe(document.body);
  }

  machine.register(() => {
    const p = Math.min(1, Math.max(0, window.scrollY / maxScroll));
    const idx = Math.min(keys.length - 1, Math.floor(p * keys.length));
    show(keys[idx]);
  });
}
