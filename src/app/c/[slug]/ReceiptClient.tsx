"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import Receipt, { RECEIPT_WIDTH } from "@/components/Receipt";
import StanleyHeader from "@/components/StanleyHeader";
import type { ReceiptCard } from "@/lib/types";

type Props = {
  card: ReceiptCard;
  qrDataUrl: string;
  shareUrl: string;
  dateLabel: string;
  timeLabel: string;
  relativeLabel: string;
};

export default function ReceiptClient({
  card,
  qrDataUrl,
  shareUrl,
  dateLabel,
  timeLabel,
  relativeLabel,
}: Props) {
  const router = useRouter();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<null | "png" | "queue">(null);
  const [toast, setToast] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  async function downloadPng() {
    if (!receiptRef.current || busy) return;
    setBusy("png");
    try {
      const dataUrl = await toPng(receiptRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: "#f3efe6",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `stanley-receipt-${card.ticket}.png`;
      a.click();
    } catch {
      flash("Couldn't export the image. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function printReceipt() {
    if (busy) return;
    setBusy("queue");
    try {
      const resp = await fetch("/api/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: card.slug }),
      });
      if (!resp.ok) throw new Error();
      flash("Printing your receipt…");
    } catch {
      flash("Couldn't reach the printer.");
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      flash("Link copied.");
    } catch {
      flash(shareUrl);
    }
  }

  return (
    <main className="flex-1 flex flex-col">
      <StanleyHeader />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-[940px] flex flex-col lg:flex-row items-center lg:items-start justify-center gap-10 lg:gap-16">
          {/* The receipt */}
          <div ref={receiptRef} style={{ width: RECEIPT_WIDTH }} className="shrink-0">
            <Receipt
              card={card}
              qrDataUrl={qrDataUrl}
              dateLabel={dateLabel}
              timeLabel={timeLabel}
              relativeLabel={relativeLabel}
            />
          </div>

          {/* Heading + actions */}
          <div className="w-full max-w-[380px] flex flex-col lg:pt-6">
            <p className="font-serif italic" style={{ fontSize: 26, lineHeight: 1.15, color: "#f3efe6" }}>
              Stanley read you.
              <br />
              <span style={{ color: "rgba(243,239,230,0.6)" }}>Here&rsquo;s your receipt.</span>
            </p>

            <div className="mt-8 flex flex-col gap-3">
              <button
                onClick={printReceipt}
                disabled={busy !== null}
                className="stan-gradient-bg font-sans text-white rounded-full h-14 flex items-center justify-center gap-2 disabled:opacity-60 transition-transform active:scale-[0.99]"
                style={{ fontWeight: 700, fontSize: 16, boxShadow: "0 12px 30px -10px rgba(168,86,232,0.55)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/stanley-mark.png" alt="" width={22} height={22} className="-ml-1" />
                {busy === "queue" ? "Printing…" : "Print my receipt"}
              </button>

              <div className="flex gap-3">
                <button
                  onClick={downloadPng}
                  disabled={busy !== null}
                  className="font-mono flex-1 rounded-full h-12 text-[13px] disabled:opacity-60"
                  style={{ border: "1px solid rgba(243,239,230,0.22)", color: "#f3efe6" }}
                >
                  {busy === "png" ? "Saving…" : "Download PNG"}
                </button>
                <button
                  onClick={copyLink}
                  className="font-mono flex-1 rounded-full h-12 text-[13px]"
                  style={{ border: "1px solid rgba(243,239,230,0.22)", color: "#f3efe6" }}
                >
                  Copy link
                </button>
              </div>

              <button
                onClick={() => router.push("/")}
                className="font-sans mt-2 h-12 text-[14px]"
                style={{ color: "rgba(243,239,230,0.55)" }}
              >
                Done · next guest →
              </button>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div
          className="font-sans fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full text-[14px]"
          style={{ background: "var(--color-paper)", color: "var(--color-ink)" }}
        >
          {toast}
        </div>
      )}
    </main>
  );
}
