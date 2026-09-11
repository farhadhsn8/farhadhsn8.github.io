// ============================================================
// machine.js — the shared computational state model.
//
// Every visualization on the page reads from this single
// deterministic model, so the Turing machine, FSM, codec,
// attention, bitstream and quality plots all represent the
// *same* underlying state rather than unrelated animations.
// ============================================================

export const STAGES = [
  "INPUT",
  "ENCODE",
  "LATENT",
  "QUANTIZE",
  "ENTROPY",
  "BITSTREAM",
  "DECODE",
  "RECONSTRUCT",
  "QUALITY"
];

export const N = STAGES.length;

// Phase anchors for narrative sections (0..1 along the pipeline).
export const SECTION_PHASE = {
  about: 0.25,        // LATENT
  research: 0.375,    // QUANTIZE
  education: 0.5,     // ENTROPY
  compression: 0.35,  // interactive ENCODE→BITSTREAM
  quality: 1.0,       // QUALITY
  transformers: 0.22, // LATENT
  projects: 0.875,    // RECONSTRUCT
  experience: 0.75,   // DECODE
  contact: 0.0        // INPUT
};

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export const machine = {
  s: {
    // pointer (normalized viewport coordinates)
    px: 0.5,
    py: 0.5,
    pointer: false,

    // smoothed focus point + activity
    fx: 0.5,
    fy: 0.5,
    focus: 0,

    // pipeline position and compression strength
    phase: 0.04,
    targetPhase: 0.04,
    rate: 0.5,
    targetRate: 0.5,
    rateUser: null,

    // discrete / control
    paused: false,
    step: 0,
    time: 0,
    context: "hero",
    sectionProgress: 0,
    reduced: false,
    visible: true,

    // transient overrides driven by direct manipulation
    hoverStage: null,
    hoverRate: null
  },

  renderers: new Set(),

  register(fn) {
    this.renderers.add(fn);
    return () => this.renderers.delete(fn);
  }
};

const reducedQuery =
  typeof matchMedia === "function"
    ? matchMedia("(prefers-reduced-motion: reduce)")
    : null;

if (reducedQuery) {
  machine.s.reduced = reducedQuery.matches;
  const onChange = (e) => {
    machine.s.reduced = e.matches;
  };
  if (reducedQuery.addEventListener) reducedQuery.addEventListener("change", onChange);
  else if (reducedQuery.addListener) reducedQuery.addListener(onChange);
}

// ------------------------------------------------------------
// derive() — pure projection of the current state. Visualizations
// should prefer this over reading raw fields directly.
// ------------------------------------------------------------
export function derive() {
  const s = machine.s;
  const p = clamp01(s.phase);
  const stageF = p * (N - 1);
  const stage = Math.max(0, Math.min(N - 1, Math.round(stageF)));
  const rate = clamp01(s.rate);

  const bitrate = 1 - rate;
  const distortion = rate;
  const quality = clamp01(1 - 0.82 * rate);
  const latentDim = Math.round(lerp(64, 6, rate));
  const bpp = lerp(2.4, 0.06, rate);
  const entropy = clamp01(0.12 + 0.86 * rate);

  return {
    s,
    p,
    stageF,
    stage,
    stageName: STAGES[stage],
    nextStage: STAGES[Math.min(N - 1, stage + 1)],
    rate,
    bitrate,
    distortion,
    quality,
    latentDim,
    bpp,
    entropy
  };
}

// ------------------------------------------------------------
// contextTargets() — maps pointer + scroll + context into the
// target phase / rate. Called once per frame; cheap.
// ------------------------------------------------------------
export function contextTargets() {
  const s = machine.s;

  // A directly-manipulated stage (e.g. hovering an FSM node) takes
  // precedence over the scroll context so the whole system follows it.
  if (s.hoverStage != null) {
    s.targetPhase = clamp01(s.hoverStage / (N - 1));
    if (s.hoverRate != null) s.targetRate = clamp01(s.hoverRate);
    return;
  }

  const ctx = s.context;

  if (ctx === "hero") {
    s.targetPhase = clamp01(0.03 + s.fx * 0.58);
    s.targetRate = clamp01(0.1 + (1 - s.fy) * 0.74);
    return;
  }

  if (ctx === "compression") {
    s.targetPhase = clamp01(0.1 + s.sectionProgress * 0.56);
    if (s.rateUser != null) {
      s.targetRate = clamp01(s.rateUser);
    } else {
      s.targetRate = clamp01(0.15 + s.fx * 0.75);
    }
    return;
  }

  const anchor = SECTION_PHASE[ctx] ?? 0.04;
  s.targetPhase = clamp01(anchor + (s.fx - 0.5) * 0.06);
  const baseRate = ctx === "quality" ? 0.62 : 0.42;
  s.targetRate = clamp01(baseRate + (s.fy - 0.5) * 0.34);
}

export function step(dt) {
  const s = machine.s;
  const fast = s.reduced;
  s.fx = damp(s.fx, s.px, fast ? 9 : 3.4, dt);
  s.fy = damp(s.fy, s.py, fast ? 9 : 3.4, dt);
  s.focus = damp(s.focus, s.pointer ? 1 : 0, 4, dt);
  s.phase = damp(s.phase, s.targetPhase, fast ? 9 : 2.6, dt);
  s.rate = damp(s.rate, s.targetRate, fast ? 9 : 2.0, dt);
  if (!s.paused) s.time += dt;
}

let running = false;
let last = 0;

export function start() {
  if (running) return;
  running = true;
  last = performance.now();

  const frame = (t) => {
    const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
    last = t;
    if (machine.s.visible) {
      contextTargets();
      step(dt);
      const d = derive();
      for (const r of machine.renderers) {
        try {
          r(dt, d, machine.s);
        } catch (err) {
          // keep the loop alive even if one visual fails
          console.error("[visual]", err);
        }
      }
    }
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}

export function setVisible(v) {
  machine.s.visible = v;
}

// Keyboard stepping: advance/retreat one pipeline stage.
export function stepStage(dir) {
  const s = machine.s;
  const d = derive();
  const next = Math.max(0, Math.min(N - 1, d.stage + dir));
  s.targetPhase = next / (N - 1);
  s.phase = s.targetPhase;
  s.step += dir;
}

export function setStage(index) {
  const s = machine.s;
  const i = Math.max(0, Math.min(N - 1, index));
  s.targetPhase = i / (N - 1);
  s.step = i;
}

export function togglePause() {
  machine.s.paused = !machine.s.paused;
  return machine.s.paused;
}

// deterministic hash used by several visuals for stable "data"
export function hash01(n, seed = 0) {
  let x = Math.imul((n | 0) + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(seed | 0, 0xc2b2ae35);
  x ^= x >>> 15;
  x = Math.imul(x, 0x2545f491);
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

export function bit(n, seed = 0) {
  return hash01(n, seed) > 0.5 ? 1 : 0;
}
