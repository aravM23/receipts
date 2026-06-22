"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import Receipt, { RECEIPT_WIDTH } from "@/components/Receipt";
import ReceiptFrame from "@/components/ReceiptFrame";
import type { ReceiptCard } from "@/lib/types";

type Props = {
  card: ReceiptCard;
  qrDataUrl: string;
  shareUrl: string;
  dateLabel: string;
  timeLabel: string;
  relativeLabel: string;
};

/**
 * Kiosk receipt screen. The guest already tapped "Print My Drink Ticket" on
 * the landing, so the moment this page is ready we silently capture the
 * receipt and send it to the print queue — no second button, no nav bar.
 * A single "Done — next guest" CTA resets the kiosk for the next person.
 */
export default function ReceiptClient({
  card,
  qrDataUrl,
  dateLabel,
  timeLabel,
  relativeLabel,
}: Props) {
  const router = useRouter();
  const receiptRef = useRef<HTMLDivElement>(null);
  const firedRef = useRef(false);
  const [status, setStatus] = useState<"printing" | "printed" | "error">("printing");

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    (async () => {
      try {
        await waitForReady(receiptRef.current);
        let image: string | undefined;
        if (receiptRef.current) {
          try {
            image = await toPng(receiptRef.current, {
              pixelRatio: 2,
              cacheBust: true,
              backgroundColor: "#ffffff",
            });
          } catch {
            image = undefined; // worker falls back to its text/ESC-POS path
          }
        }
        const resp = await fetch("/api/print", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: card.slug, image }),
        });
        if (!resp.ok) throw new Error();
        setStatus("printed");
      } catch {
        setStatus("error");
      }
    })();
  }, [card.slug]);

  return (
    <main className="flex-1 flex flex-col" style={{ background: "#000" }}>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div className="flex flex-col items-center gap-9">
          {/* The receipt — authored at native 4x6 size, scaled to fit on screen.
              The captured node (receiptRef) stays full-res for print. */}
          <ReceiptFrame maxDisplayWidth={400} className="shrink-0">
            <div ref={receiptRef} style={{ width: RECEIPT_WIDTH }}>
              <Receipt
                card={card}
                qrDataUrl={qrDataUrl}
                dateLabel={dateLabel}
                timeLabel={timeLabel}
                relativeLabel={relativeLabel}
              />
            </div>
          </ReceiptFrame>

          <div className="w-full max-w-[400px] flex flex-col items-center gap-5">
            <p
              className="font-sans text-center"
              style={{ fontSize: 15, color: "rgba(243,239,230,0.6)", minHeight: 20 }}
            >
              {status === "printing" && "Printing your drink ticket…"}
              {status === "printed" && "Your drink ticket is printing — grab it at the bar."}
              {status === "error" && "Couldn't reach the printer. Ask a host to retry."}
            </p>

            <button
              onClick={() => router.push("/")}
              className="font-sans w-full rounded-full h-14 flex items-center justify-center text-white transition-transform active:scale-[0.99]"
              style={{
                fontWeight: 700,
                fontSize: 16,
                letterSpacing: "0.01em",
                background: "linear-gradient(180deg, #7b68ff 0%, #6955ff 100%)",
                boxShadow: "0 14px 34px -10px rgba(105,85,255,0.7)",
              }}
            >
              Done — next guest
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * Wait for fonts + the receipt's images to finish loading so the captured
 * PNG isn't blank/partial on the auto-fire.
 */
async function waitForReady(node: HTMLElement | null): Promise<void> {
  try {
    await (document.fonts?.ready ?? Promise.resolve());
  } catch {
    /* ignore */
  }
  if (node) {
    const imgs = Array.from(node.querySelectorAll("img"));
    await Promise.all(
      imgs.map((img) =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>((res) => {
              img.addEventListener("load", () => res(), { once: true });
              img.addEventListener("error", () => res(), { once: true });
              setTimeout(res, 3000);
            }),
      ),
    );
  }
  await new Promise((r) => setTimeout(r, 150));
}
