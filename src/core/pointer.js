// ============================================================
// pointer.js — throttled pointer tracking feeding machine.s.
// ============================================================

import { machine } from "./machine.js";

export function initPointer() {
  const s = machine.s;
  let scheduled = false;

  const apply = (e) => {
    s.px = Math.min(1, Math.max(0, e.clientX / window.innerWidth));
    s.py = Math.min(1, Math.max(0, e.clientY / window.innerHeight));
    s.pointer = true;
  };

  const onMove = (e) => {
    if (scheduled) {
      // keep the latest event to apply on the next frame
      pending = e;
      return;
    }
    scheduled = true;
    apply(e);
    requestAnimationFrame(() => {
      scheduled = false;
      if (pending) {
        apply(pending);
        pending = null;
      }
    });
  };

  let pending = null;

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onMove, { passive: true });
  window.addEventListener("pointerleave", () => {
    s.pointer = false;
  });
  window.addEventListener("blur", () => {
    s.pointer = false;
  });

  // touch: a tap sets focus briefly
  window.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      if (t) apply(t);
    },
    { passive: true }
  );
}
