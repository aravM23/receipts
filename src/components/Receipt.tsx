/**
 * The STANLEY receipt — a printable "ticket" character read of a creator.
 * Pure presentation (no hooks) so it renders server-side on the share page
 * AND inside the client export/print wrapper.
 *
 * Black-on-white, fixed logical size so proportions stay identical whether
 * previewed, exported to PNG, or sent to the thermal printer.
 *
 * Sized to a true 4x6 label aspect (2:3) — 812 x 1218 logical px (4x6in at
 * ~203dpi) — so the printed image fills a MUNBYN 4x6 label edge-to-edge. The
 * on-screen card is scaled down to fit via <ReceiptFrame>; the PNG export /
 * print capture uses these native dimensions.
 *
 * Type set in the three brand fonts: Plus Jakarta Sans (UI), Inter (body),
 * Lora (serif accents — the archetype + cocktail).
 */

import type { ReceiptCard } from "@/lib/types";

export const RECEIPT_WIDTH = 812;
export const RECEIPT_HEIGHT = 1218;

const PAPER = "#ffffff";
const INK = "#16151a";
const MUTED = "#8b8a93";
const LINE = "#d8d7de";
const DASH = "#bcbbc4";
const BOX = "#f1f0f4";

type Props = {
  card: ReceiptCard;
  qrDataUrl: string;
  /** Adds the paper shadow + rounding for on-screen display. */
  framed?: boolean;
  /** Unused now, kept so existing callers compile. */
  dateLabel?: string;
  timeLabel?: string;
  relativeLabel?: string;
};

export default function Receipt({ card, qrDataUrl, framed = true }: Props) {
  const name = card.display_name || card.instagram_handle;

  return (
    <div
      className="receipt-print-root font-inter"
      style={{
        width: RECEIPT_WIDTH,
        height: RECEIPT_HEIGHT,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: PAPER,
        color: INK,
        padding: "40px 78px 34px",
        borderRadius: framed ? 14 : 0,
        boxShadow: framed ? "0 24px 60px -20px rgba(0,0,0,0.55)" : "none",
      }}
    >
      {/* ── Brand ─────────────────────────────────────────────── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/stanley-mark.png" alt="" style={{ display: "block", width: 32.5, height: 31.9 }} />
          <span
            className="font-sans"
            style={{ color: "#000", fontWeight: 700, fontSize: 24, lineHeight: 1, letterSpacing: "-0.6px" }}
          >
            Stanley
          </span>
        </div>
        <div className="font-sans" style={{ textAlign: "center", fontSize: 19.5, fontWeight: 400, color: "#000", marginTop: 9 }}>
          Your AI Head of Content
        </div>
      </div>

      <Divider />

      {/* ── Profile ───────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Avatar src={card.avatar_url} />
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 20 }}>
          <span className="font-sans" style={{ fontWeight: 600, fontSize: 21.5 }}>{name}</span>
          {card.is_verified && <VerifiedBadge />}
        </div>
        <div style={{ display: "flex", gap: 52, marginTop: 20 }}>
          <Stat value={card.stats.posts} label="posts" />
          <Stat value={card.stats.followers} label="followers" />
          <Stat value={card.stats.following} label="following" />
        </div>
      </div>

      <Divider />

      {/* ── Stanley says ──────────────────────────────────────── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 11 }}>
          <DollarBadge />
          <span
            className="font-sans"
            style={{ color: "#000", fontWeight: 700, fontSize: 25, lineHeight: 1, letterSpacing: "-0.62px" }}
          >
            Stanley says&hellip;
          </span>
        </div>
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16, textAlign: "center" }}>
          {card.insights.slice(0, 3).map((ins, i) => (
            <p
              key={i}
              className="font-sans"
              style={{ fontSize: 19.5, fontWeight: 400, lineHeight: 1.15, letterSpacing: "-0.49px", color: "#111118" }}
            >
              {ins.text}
            </p>
          ))}
        </div>
      </div>

      <Divider />

      {/* ── Creator archetype ─────────────────────────────────── */}
      <div style={{ position: "relative", width: 712, marginLeft: -26, marginRight: -26 }}>
        <div
          style={{
            background: BOX,
            borderRadius: 26,
            height: 152,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: "0 28px",
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 11 }}>
            <PlatformIcons />
            <span
              className="font-sans"
              style={{ color: "#000", fontWeight: 700, fontSize: 25, lineHeight: 1, letterSpacing: "-0.62px" }}
            >
              Your Creator archetype
            </span>
          </div>
          <div
            className="font-serif"
            style={{ color: "#000", fontSize: 56, fontStyle: "italic", fontWeight: 500, lineHeight: 1, letterSpacing: "-1.4px" }}
          >
            {card.creator_type}
          </div>
        </div>
        <Notch position="top" />
        <Notch position="bottom" />
      </div>

      <Divider />

      {/* ── Creator cocktail ──────────────────────────────────── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cocktail-icon.png" alt="" width={25} height={25} style={{ display: "block" }} />
          <span
            className="font-sans"
            style={{ color: "#000", fontWeight: 700, fontSize: 25, lineHeight: 1, letterSpacing: "-0.62px" }}
          >
            Your Creator cocktail
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cocktail.png" alt="" width={150} style={{ display: "block", height: "auto" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 12 }}>
          <Sparkle />
          <span
            className="font-serif"
            style={{ color: "#000", fontStyle: "italic", fontSize: 40, fontWeight: 500, lineHeight: 1, letterSpacing: "-1px" }}
          >
            {card.drink}
          </span>
          <Sparkle />
        </div>
      </div>

      <Divider />

      {/* ── QR + footer ───────────────────────────────────────── */}
      <div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Scan for your card" width={150} height={150} style={{ width: 150, height: 150, display: "block" }} />
        </div>
        <div
          className="font-sans"
          style={{ textAlign: "center", fontSize: 19.5, fontWeight: 400, lineHeight: 1.4, letterSpacing: "-0.49px", color: "#000", marginTop: 24 }}
        >
          Learn more at <span style={{ fontWeight: 600 }}>getstanley.ai</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Divider() {
  return (
    <div
      aria-hidden
      style={{
        height: 3,
        margin: 0,
        backgroundImage: `repeating-linear-gradient(to right, ${DASH} 0 17px, transparent 17px 31px)`,
        backgroundRepeat: "repeat-x",
      }}
    />
  );
}

function Stat({ value, label }: { value: number | null; label: string }) {
  return (
    <div style={{ textAlign: "center", lineHeight: 1.2 }}>
      <div className="font-sans" style={{ color: "#111118", fontWeight: 600, fontSize: 19.5, lineHeight: 1.2 }}>{formatCount(value)}</div>
      <div className="font-inter" style={{ fontSize: 14.5, color: MUTED, marginTop: 3 }}>{label}</div>
    </div>
  );
}

function formatCount(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function Avatar({ src }: { src: string | null }) {
  const size = 122;
  const common: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    border: `1.4px solid ${LINE}`,
    flex: "0 0 auto",
  };
  if (!src) {
    return (
      <div className="font-sans" style={{ ...common, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42, color: MUTED, background: BOX }}>
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
      style={{ ...common, objectFit: "cover", filter: "grayscale(1) contrast(1.08)" }}
    />
  );
}

function VerifiedBadge() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="#3a8df0" aria-hidden style={{ display: "block" }}>
      <path d="M12 1.8l2.4 1.8 3 .1 1 2.8 2.4 1.7-.9 2.9.9 2.9-2.4 1.7-1 2.8-3 .1L12 22.2l-2.4-1.8-3-.1-1-2.8-2.4-1.7.9-2.9-.9-2.9 2.4-1.7 1-2.8 3-.1z" />
      <path d="M8 12l2.6 2.6L16 9.2" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DollarBadge() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/icon-dollar.png" alt="" width={44} height={44} style={{ display: "block", flex: "0 0 auto" }} />
  );
}

function Notch({ position }: { position: "top" | "bottom" }) {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        [position]: -12,
        width: 24,
        height: 24,
        borderRadius: "50%",
        background: PAPER,
      }}
    />
  );
}

function Sparkle() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/sparkle.png" alt="" width={25} height={25} style={{ display: "block", flex: "0 0 auto" }} />
  );
}

function PlatformIcons() {
  const sz = 28.5;
  const base: React.CSSProperties = { width: sz, height: sz, display: "block", position: "relative" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-instagram.png" alt="" style={{ ...base, transform: "rotate(13.19deg)", zIndex: 1 }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-x.png" alt="" style={{ ...base, zIndex: 2, marginLeft: -8, marginRight: -8 }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-linkedin.png" alt="" style={{ ...base, transform: "rotate(-7.163deg)", zIndex: 1 }} />
    </span>
  );
}
