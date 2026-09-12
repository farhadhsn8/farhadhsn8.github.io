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

import { initTapeBar } from "./visuals/tapeBar.js";
import { initFSM } from "./visuals/fsm.js";
import { initSiteDfa } from "./visuals/siteDfa.js";
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

  // section labels (number + name) read from the nav
  const labels = new Map();
  navLinks.forEach((a) => {
    const id = a.getAttribute("data-nav");
    const i = a.querySelector("i");
    labels.set(id, {
      num: i ? i.textContent.trim() : "",
      name: a.textContent.replace(i ? i.textContent : "", "").trim()
    });
  });

  const hudNum = document.getElementById("nav-section-num");
  const hudName = document.getElementById("nav-section-name");
  const rail = document.getElementById("nav-rail");
  const railFill = document.getElementById("nav-rail-fill");

  let ticking = false;
  let lastContext = null;
  let ticks = [];

  const setSection = (id) => {
    if (id === lastContext) return;
    lastContext = id;

    const info = labels.get(id);
    if (info) {
      if (hudNum) hudNum.textContent = info.num;
      if (hudName) hudName.textContent = info.name;
    }
  };

  // boundary ticks on the rail mark where each section begins
  const measureRail = () => {
    if (!rail) return;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    for (const t of ticks) t.remove();
    ticks = [];
    for (const sec of sections) {
      const top = sec.getBoundingClientRect().top + window.scrollY;
      const t = document.createElement("span");
      t.className = "nav__rail-tick";
      t.style.left = `${(clamp(top / max, 0, 1) * 100).toFixed(2)}%`;
      rail.appendChild(t);
      ticks.push(t);
    }
  };

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

    setSection(best.id);
    if (best.id !== machine.s.context) machine.s.context = best.id;

    const r = best.getBoundingClientRect();
    machine.s.sectionProgress = clamp((mid - r.top) / Math.max(1, r.height));

    navLinks.forEach((a) => {
      a.classList.toggle("is-active", a.getAttribute("data-nav") === best.id);
    });

    if (railFill) {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      railFill.style.width = `${(clamp(window.scrollY / max, 0, 1) * 100).toFixed(2)}%`;
    }
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => {
    measureRail();
    onScroll();
  }, { passive: true });
  window.addEventListener("load", measureRail);
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(measureRail).observe(document.body);
  }

  measureRail();
  update();
}

// ------------------------------------------------------------
// controls + keyboard
// ------------------------------------------------------------
function initControls() {
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

}

// ------------------------------------------------------------
// live readouts (throttled to change-only writes)
// ------------------------------------------------------------
function initReadout() {
  const statLatent = document.getElementById("stat-latent");
  const statBpp = document.getElementById("stat-bpp");
  const statDist = document.getElementById("stat-dist");
  const statQuality = document.getElementById("stat-quality");

  let last = {};

  machine.register(() => {
    const d = derive();

    const key = `${d.stage}|${d.rate.toFixed(2)}|${d.latentDim}|${d.bpp.toFixed(2)}`;
    if (key === last.key) return;
    last.key = key;

    if (statLatent) statLatent.textContent = String(d.latentDim);
    if (statBpp) statBpp.textContent = formatFixed(d.bpp, 2);
    if (statDist) statDist.textContent = formatFixed(d.distortion, 2);
    if (statQuality) statQuality.textContent = formatFixed(d.quality, 2);
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
  initControls();

  initPointer();
  initTape();

  initTapeBar();
  initFSM();
  initSiteDfa();
  initBgStage();
  initProbability();
  initCodecMini();
  initBitstream();
  initCodec();
  initQuality();
  initAttention();
  initCollapse();

  initReadout();
  initVisibility();

  start();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}
