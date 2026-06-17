"use client";

/**
 * Kiosk behavior for the bar iPad:
 *  - After a stretch of inactivity on any page *other* than the landing
 *    screen, send the device back to "/" so the next guest starts clean.
 *  - The landing page itself never auto-navigates (someone may be mid-typing).
 *
 * This is intentionally lightweight — the real exit-proofing is iOS
 * Guided Access / Single App Mode at the OS level; this just keeps the
 * web app from getting "stuck" on one person's receipt.
 */

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const IDLE_MS = 90_000;

export default function KioskGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function clear() {
      if (timer.current) clearTimeout(timer.current);
    }

    function arm() {
      clear();
      if (pathname !== "/") {
        timer.current = setTimeout(() => router.push("/"), IDLE_MS);
      }
    }

    const events: Array<keyof WindowEventMap> = [
      "touchstart",
      "touchmove",
      "pointerdown",
      "mousedown",
      "keydown",
      "scroll",
    ];
    for (const e of events) window.addEventListener(e, arm, { passive: true });
    arm();

    return () => {
      for (const e of events) window.removeEventListener(e, arm);
      clear();
    };
  }, [pathname, router]);

  return null;
}
