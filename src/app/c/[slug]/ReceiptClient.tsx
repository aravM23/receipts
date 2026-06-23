"use client";

import { useRef, useState } from "react";
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
 * Card screen. The guest's cocktail is shown first, and printing only
 * happens when they (or a host) tap "Print my drink ticket" — never
 * automatically, so the printer can't be spammed by reloads. Capture is
 * silent (no browser print dialog); the worker prints the queued PNG.
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
  const [status, setStatus] = useState<"idle" | "printing" | "printed" | "error">("idle");

  async function printReceipt() {
    if (status === "printing" || status === "printed") return;
    setStatus("printing");
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
  }

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

          <div className="w-full max-w-[400px] flex flex-col items-center gap-4">
            {status === "printed" ? (
              <>
                <p
                  className="font-sans text-center"
                  style={{ fontSize: 15, color: "rgba(243,239,230,0.7)", minHeight: 20 }}
                >
                  Your receipt is printing down below.
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
              </>
            ) : (
              <>
                {status === "error" && (
                  <p
                    className="font-sans text-center"
                    style={{ fontSize: 14, color: "#ffb4c4", minHeight: 18 }}
                  >
                    Couldn&apos;t reach the printer. Try again.
                  </p>
                )}
                <button
                  onClick={printReceipt}
                  disabled={status === "printing"}
                  className="font-sans w-full rounded-full h-14 flex items-center justify-center gap-2 text-white transition-transform active:scale-[0.99] disabled:opacity-70"
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    letterSpacing: "0.01em",
                    background: "linear-gradient(180deg, #7b68ff 0%, #6955ff 100%)",
                    boxShadow: "0 14px 34px -10px rgba(105,85,255,0.7)",
                  }}
                >
                  {status === "printing" ? (
                    <>
                      <span
                        className="inline-block w-4 h-4 rounded-full animate-spin"
                        style={{ border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff" }}
                      />
                      Printing…
                    </>
                  ) : status === "error" ? (
                    "Retry print"
                  ) : (
                    "Print my drink ticket"
                  )}
                </button>
                <button
                  onClick={() => router.push("/")}
                  className="font-sans text-center transition-opacity active:opacity-70"
                  style={{ fontSize: 14, fontWeight: 500, color: "rgba(243,239,230,0.55)" }}
                >
                  Start over
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * Wait for fonts + the receipt's images to finish loading so the captured
 * PNG isn't blank/partial.
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
