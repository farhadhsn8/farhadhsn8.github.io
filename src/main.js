// ============================================================
// main.js — bootstrap and the shared interaction model.
//
// Wires pointer, scroll context, controls and keyboard into the
// single machine state, then starts the one animation loop that
// every visualization reads from.
// ============================================================

import {
  machine,
  derive,
  start,
  setVisible,
  stepStage,
  togglePause
} from "./core/machine.js";
import { initPointer } from "./core/pointer.js";
import { initTape } from "./core/tape.js";
import { clamp, formatFixed } from "./core/util.js";

import { initField } from "./visuals/field.js";
import { initTapeBar } from "./visuals/tapeBar.js";
import { initFSM } from "./visuals/fsm.js";
import { initBgStage } from "./visuals/bgStage.js";
import { initProbability } from "./visuals/probability.js";
import { initCodecMini } from "./visuals/codecMini.js";
import { initBitstream } from "./visuals/bitstream.js";
import { initCodec } from "./visuals/codec.js";
import { initQuality } from "./visuals/quality.js";
import { initAttention } from "./visuals/attention.js";
import { initCollapse } from "./visuals/collapse.js";

// ------------------------------------------------------------
// navigation
// ------------------------------------------------------------
function initNav() {
  const nav = document.getElementById("nav");
  const toggle = document.getElementById("nav-toggle");
  if (!nav || !toggle) return;

  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  nav.querySelectorAll(".nav__menu a").forEach((a) => {
    a.addEventListener("click", () => {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

// ------------------------------------------------------------
// reveal on scroll
// ------------------------------------------------------------
function initReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.14, rootMargin: "0px 0px -40px 0px" }
  );
  items.forEach((el) => io.observe(el));
}

// ------------------------------------------------------------
// scroll context: which section is the system "in"
// ------------------------------------------------------------
function initContext() {
  const sections = Array.from(document.querySelectorAll("section[id]"));
  const navLinks = Array.from(document.querySelectorAll("[data-nav]"));
  let ticking = false;

  const update = () => {
    ticking = false;
    const mid = window.innerHeight * 0.5;
    let best = null;
    // the section covering the viewport midpoint wins; this keeps the
    // nav state and the background diagram in step with what is read
    for (const sec of sections) {
      const r = sec.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) {
        best = sec;
        break;
      }
    }
    // fall back to the nearest centre when no section spans the middle
    if (!best) {
      let bestDist = Infinity;
      for (const sec of sections) {
        const r = sec.getBoundingClientRect();
        const dist = Math.abs(r.top + r.height / 2 - mid);
        if (dist < bestDist) {
          bestDist = dist;
          best = sec;
        }
      }
    }
    if (!best) return;

    if (best.id !== machine.s.context) machine.s.context = best.id;

    const r = best.getBoundingClientRect();
    machine.s.sectionProgress = clamp((mid - r.top) / Math.max(1, r.height));

    navLinks.forEach((a) => {
      a.classList.toggle("is-active", a.getAttribute("data-nav") === best.id);
    });
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  update();
}

// ------------------------------------------------------------
// controls + keyboard
// ------------------------------------------------------------
function initControls() {
  const slider = document.getElementById("rate");
  const output = document.getElementById("rate-value");

  if (slider) {
    slider.addEventListener("input", () => {
      machine.s.rateUser = clamp(Number(slider.value) / 100);
    });
  }

  // click the tape to halt / resume computation
  const turing = document.getElementById("turing");
  if (turing) {
    turing.addEventListener("click", () => togglePause());
    turing.style.cursor = "pointer";
  }

  window.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) || "";
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || e.target?.isContentEditable) return;

    if (e.key === "ArrowRight") {
      e.preventDefault();
      stepStage(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      stepStage(-1);
    } else if (e.key === " " || e.key.toLowerCase() === "p") {
      e.preventDefault();
      togglePause();
    }
  });

  // expose output for the renderer
  return { slider, output };
}

// ------------------------------------------------------------
// live readouts (throttled to change-only writes)
// ------------------------------------------------------------
function initReadout(controls) {
  const readout = document.getElementById("readout-text");
  const navStage = document.getElementById("nav-stage");
  const statLatent = document.getElementById("stat-latent");
  const statBpp = document.getElementById("stat-bpp");
  const statDist = document.getElementById("stat-dist");
  const statQuality = document.getElementById("stat-quality");
  const { slider, output } = controls || {};

  let last = {};

  machine.register(() => {
    const d = derive();

    const key = `${d.stage}|${d.rate.toFixed(2)}|${d.latentDim}|${d.bpp.toFixed(2)}`;
    if (key === last.key) return;
    last.key = key;

    if (navStage && navStage.textContent !== d.stageName) {
      navStage.textContent = d.stageName;
      navStage.dataset.state = d.stageName;
    }
    if (readout) {
      readout.textContent = `q=${d.stageName} · rate ${formatFixed(d.rate, 2)} · latent ${d.latentDim} · bpp ${formatFixed(d.bpp, 2)}`;
    }
    if (statLatent) statLatent.textContent = String(d.latentDim);
    if (statBpp) statBpp.textContent = formatFixed(d.bpp, 2);
    if (statDist) statDist.textContent = formatFixed(d.distortion, 2);
    if (statQuality) statQuality.textContent = formatFixed(d.quality, 2);
    if (output) output.textContent = formatFixed(d.rate, 2);

    // keep the slider in sync when the rate is driven by dragging
    if (slider && machine.s.rateUser != null) {
      const v = Math.round(machine.s.rateUser * 100);
      if (Number(slider.value) !== v) slider.value = String(v);
    }
  });
}

// ------------------------------------------------------------
// page visibility
// ------------------------------------------------------------
function initVisibility() {
  document.addEventListener("visibilitychange", () => {
    setVisible(!document.hidden);
  });
}

function main() {
  initNav();
  initReveal();
  initContext();
  const controls = initControls();

  initPointer();
  initTape();

  initField();
  initTapeBar();
  initFSM();
  initBgStage();
  initProbability();
  initCodecMini();
  initBitstream();
  initCodec();
  initQuality();
  initAttention();
  initCollapse();

  initReadout(controls);
  initVisibility();

  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  start();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}
