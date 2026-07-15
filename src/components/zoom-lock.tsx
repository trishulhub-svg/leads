// src/components/zoom-lock.tsx
"use client";

import * as React from "react";

/**
 * Extra zoom locks beyond the viewport meta:
 * - block iOS gesture zoom
 * - block Ctrl/Cmd + wheel zoom
 * - block Ctrl/Cmd + (+/-/0) keyboard zoom
 * Applies on every page via Providers.
 */
export function ZoomLock() {
  React.useEffect(() => {
    const preventGesture = (event: Event) => {
      event.preventDefault();
    };

    const preventWheelZoom = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    };

    const preventKeyZoom = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key;
      if (key === "+" || key === "=" || key === "-" || key === "_" || key === "0") {
        event.preventDefault();
      }
    };

    // iOS Safari pinch / gesture zoom
    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });
    document.addEventListener("gestureend", preventGesture, { passive: false });
    // Desktop browser zoom via trackpad / wheel
    document.addEventListener("wheel", preventWheelZoom, { passive: false });
    document.addEventListener("keydown", preventKeyZoom, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
      document.removeEventListener("wheel", preventWheelZoom);
      document.removeEventListener("keydown", preventKeyZoom);
    };
  }, []);

  return null;
}
