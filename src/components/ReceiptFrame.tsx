"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { RECEIPT_WIDTH, RECEIPT_HEIGHT } from "@/components/Receipt";

/**
 * Responsive shell for the receipt. The receipt is authored at a fixed
 * 812 x 1218 (true 4x6 aspect) so the printed PNG fills the label. On screen
 * that's too wide for a phone, so we CSS-scale it down to the available width.
 *
 * The scale lives on a wrapper, NOT on the receipt node itself, so a
 * client-side PNG capture (`html-to-image`) of the inner node still renders at
 * full native resolution.
 */
export default function ReceiptFrame({
  children,
  maxDisplayWidth = RECEIPT_WIDTH,
  className,
}: {
  children: ReactNode;
  /** Cap the on-screen size (e.g. so it sits beside the actions on desktop). */
  maxDisplayWidth?: number;
  className?: string;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / RECEIPT_WIDTH));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={outerRef}
      className={className}
      style={{ width: "100%", maxWidth: maxDisplayWidth, height: RECEIPT_HEIGHT * scale }}
    >
      <div style={{ width: RECEIPT_WIDTH, height: RECEIPT_HEIGHT, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}
