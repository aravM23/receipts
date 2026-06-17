/**
 * The STANLEY+ receipt. Pure presentation (no hooks) so it renders
 * server-side on the share page AND inside the client export/print
 * wrapper. Monochrome, monospace, thermal-paper look — designed so the
 * same markup reads cleanly on screen and through a receipt printer.
 *
 * Fixed logical width (`WIDTH`) keeps proportions identical whether it's
 * previewed, exported to PNG, or sent to print.
 */

import type { ReceiptCard } from "@/lib/types";

export const RECEIPT_WIDTH = 360;

type Props = {
  card: ReceiptCard;
  qrDataUrl: string;
  dateLabel: string; // e.g. "MAY 19 2025"
  timeLabel: string; // e.g. "7:42 PM"
  relativeLabel: string; // e.g. "TODAY"
  /** Adds the paper shadow + rounding for on-screen display. */
  framed?: boolean;
};

export default function Receipt({
  card,
  qrDataUrl,
  dateLabel,
  timeLabel,
  relativeLabel,
  framed = true,
}: Props) {
  const name = (card.display_name || card.instagram_handle).toUpperCase();

  return (
    <div
      className="receipt-print-root font-mono text-ink"
      style={{
        width: RECEIPT_WIDTH,
        background: "var(--color-paper)",
        padding: "26px 24px 22px",
        borderRadius: framed ? 6 : 0,
        boxShadow: framed ? "0 24px 60px -20px rgba(0,0,0,0.65)" : "none",
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(0,0,0,0.012) 0px, rgba(0,0,0,0.012) 1px, transparent 1px, transparent 3px)",
      }}
    >
      {/* Brand */}
      <div
        className="font-display text-center"
        style={{ fontWeight: 800, fontSize: 26, letterSpacing: "0.12em" }}
      >
        STANLEY<span style={{ verticalAlign: "0.06em" }}>+</span>
      </div>

      <hr className="receipt-divider" style={{ margin: "16px 0" }} />

      {/* Ticket number */}
      <div
        className="font-display text-center"
        style={{ fontWeight: 900, fontSize: 80, lineHeight: 1, letterSpacing: "-0.02em" }}
      >
        {card.ticket}
      </div>

      <hr className="receipt-divider" style={{ margin: "16px 0" }} />

      {/* Subject */}
      <div
        style={{
          display: "flex",
          gap: 14,
          border: "1.5px solid var(--color-ink)",
          padding: 10,
        }}
      >
        <Avatar src={card.avatar_url} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div
            className="font-display"
            style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.1, letterSpacing: "0.01em" }}
          >
            {name}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-ink-soft)", marginTop: 2 }}>
            @{card.instagram_handle}
          </div>
          <div style={{ marginTop: "auto", paddingTop: 10, fontSize: 10.5, lineHeight: 1.5 }}>
            <div className="receipt-eyebrow" style={{ fontSize: 9 }}>
              {relativeLabel}
            </div>
            <div style={{ letterSpacing: "0.04em" }}>{dateLabel}</div>
            <div style={{ letterSpacing: "0.04em" }}>{timeLabel}</div>
          </div>
        </div>
      </div>

      {/* Stanley's Read */}
      <div className="receipt-eyebrow" style={{ fontSize: 10.5, marginTop: 20 }}>
        Stanley&rsquo;s Read
      </div>
      <ul style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        {card.insights.slice(0, 3).map((ins, i) => (
          <li key={i} style={{ display: "flex", gap: 9, fontSize: 13, lineHeight: 1.35 }}>
            <span style={{ fontWeight: 700 }}>&#9656;</span>
            <span>{ins.text}</span>
          </li>
        ))}
      </ul>

      <hr className="receipt-divider" style={{ margin: "20px 0 16px" }} />

      {/* Creator type */}
      <div className="receipt-eyebrow" style={{ fontSize: 10.5 }}>
        Creator Type
      </div>
      <div
        className="font-display"
        style={{
          fontWeight: 800,
          fontSize: 22,
          letterSpacing: "0.01em",
          marginTop: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span>{card.creator_type.toUpperCase()}</span>
        <Sparkle />
      </div>

      <hr className="receipt-divider" style={{ margin: "16px 0" }} />

      {/* Drink */}
      <div className="receipt-eyebrow" style={{ fontSize: 10.5 }}>
        Drink Recommendation
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginTop: 6,
        }}
      >
        <span className="font-display" style={{ fontWeight: 800, fontSize: 22, lineHeight: 1.05 }}>
          {card.drink.toUpperCase()}
        </span>
        <CocktailGlass />
      </div>

      <hr className="receipt-divider" style={{ margin: "18px 0 14px" }} />

      {/* Footer + QR */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div className="receipt-eyebrow" style={{ fontSize: 10, lineHeight: 1.5 }}>
          Show this
          <br />
          at the bar
        </div>
        <div style={{ textAlign: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="Scan for your card"
            width={92}
            height={92}
            style={{ width: 92, height: 92, display: "block" }}
          />
          <div className="receipt-eyebrow" style={{ fontSize: 8, marginTop: 4 }}>
            Scan for your card
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar({ src }: { src: string | null }) {
  const size = 92;
  if (!src) {
    return (
      <div
        style={{
          width: size,
          height: size,
          flex: "0 0 auto",
          border: "1.5px solid var(--color-ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
        }}
        className="font-display"
      >
        ?
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      crossOrigin="anonymous"
      style={{
        width: size,
        height: size,
        flex: "0 0 auto",
        objectFit: "cover",
        border: "1.5px solid var(--color-ink)",
        // Halftone-ish thermal look without true dithering.
        filter: "grayscale(1) contrast(1.15) brightness(1.02)",
      }}
    />
  );
}

function Sparkle() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0c.8 5.6 5.6 10.4 11.2 11.2C17.6 12 12.8 16.8 12 22.4 11.2 16.8 6.4 12 0.8 11.2 6.4 10.4 11.2 5.6 12 0z" />
    </svg>
  );
}

function CocktailGlass() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M14 18h36L36 38v16" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M26 54h20" strokeLinecap="round" />
      <path d="M18 22h28" strokeLinecap="round" opacity="0.5" />
      <circle cx="46" cy="16" r="3.2" />
      <path d="M46 16l4-5" strokeLinecap="round" />
    </svg>
  );
}
