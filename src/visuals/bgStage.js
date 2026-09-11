// ============================================================
// bgStage.js — the scroll-driven background visual stage.
//
// Every diagram lives in a fixed full-viewport layer. As the reader
// scrolls from one section to the next, the layer belonging to that
// section fades in and the previous one fades out. Only the visible
// layer keeps drawing, so the WebGL cost stays bounded.
// ============================================================

import { machine } from "../core/machine.js";

// section id → background visual key
const MAP = {
  hero: "fsm",
  about: "codecMini",
  research: "probability",
  compression: "codec",
  quality: "quality",
  transformers: "attention",
  projects: "bitstream",
  experience: "fsm",
  contact: "collapse"
};

const FADE_MS = 850;

export function initBgStage() {
  const stage = document.getElementById("bg-stage");
  if (!stage) return;

  const layers = Array.from(stage.querySelectorAll("[data-viz]"));
  if (!layers.length) return;
  const byKey = new Map(layers.map((l) => [l.dataset.viz, l]));

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

  machine.register(() => {
    show(MAP[machine.s.context] || "fsm");
  });
}
