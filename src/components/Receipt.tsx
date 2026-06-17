/**
 * The STANLEY receipt — a printable "ticket" character read of a creator.
 * Pure presentation (no hooks) so it renders server-side on the share page
 * AND inside the client export/print wrapper.
 *
 * Black-on-white, fixed logical width so proportions stay identical whether
 * previewed, exported to PNG, or sent to the thermal printer.
 *
 * Type set in the three brand fonts: Plus Jakarta Sans (UI), Inter (body),
 * Lora (serif accents — the archetype + cocktail).
 */

import type { ReceiptCard } from "@/lib/types";

export const RECEIPT_WIDTH = 360;

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
        background: PAPER,
        color: INK,
        padding: "26px 24px 22px",
        borderRadius: framed ? 8 : 0,
        boxShadow: framed ? "0 24px 60px -20px rgba(0,0,0,0.55)" : "none",
      }}
    >
      {/* ── Brand ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/stanley-mark.png" alt="" style={{ display: "block", width: 9.388, height: 9.813 }} />
        <span
          className="font-sans"
          style={{ color: "#000", fontWeight: 700, fontSize: 17.025, lineHeight: 1, letterSpacing: "-0.426px" }}
        >
          Stanley
        </span>
      </div>
      <div className="font-sans" style={{ textAlign: "center", fontSize: 14, fontWeight: 400, color: "#000", marginTop: 5 }}>
        Your AI Head of Content
      </div>

      <Divider />

      {/* ── Profile ───────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Avatar src={card.avatar_url} />
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 12 }}>
          <span className="font-sans" style={{ fontWeight: 600, fontSize: 15.5 }}>{name}</span>
          {card.is_verified && <VerifiedBadge />}
        </div>
        <div style={{ display: "flex", gap: 26, marginTop: 12 }}>
          <Stat value={card.stats.posts} label="posts" />
          <Stat value={card.stats.followers} label="followers" />
          <Stat value={card.stats.following} label="following" />
        </div>
      </div>

      <Divider />

      {/* ── Stanley says ──────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <DollarBadge />
        <span
          className="font-sans"
          style={{ color: "#000", fontWeight: 700, fontSize: 18, lineHeight: 1, letterSpacing: "-0.45px" }}
        >
          Stanley says&hellip;
        </span>
      </div>
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12, textAlign: "center" }}>
        {card.insights.slice(0, 3).map((ins, i) => (
          <p
            key={i}
            className="font-sans"
            style={{ fontSize: 14, fontWeight: 400, lineHeight: 1, letterSpacing: "-0.35px", color: "#111118" }}
          >
            {ins.text}
          </p>
        ))}
      </div>

      <Divider />

      {/* ── Creator archetype ─────────────────────────────────── */}
      <div style={{ position: "relative", margin: "2px 0" }}>
        <div style={{ background: BOX, borderRadius: 18, padding: "18px 16px 20px", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <PlatformIcons />
            <span
              className="font-sans"
              style={{ color: "#000", fontWeight: 700, fontSize: 18, lineHeight: 1, letterSpacing: "-0.45px" }}
            >
              Your Creator archetype
            </span>
          </div>
          <div
            className="font-serif"
            style={{ color: "#000", fontSize: 42, fontStyle: "italic", fontWeight: 500, lineHeight: 1, letterSpacing: "-1.05px", marginTop: 12 }}
          >
            {card.creator_type}
          </div>
        </div>
        <Notch position="top" />
        <Notch position="bottom" />
      </div>

      <Divider />

      {/* ── Creator cocktail ──────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/cocktail-icon.png" alt="" width={18} height={18} style={{ display: "block" }} />
        <span
          className="font-sans"
          style={{ color: "#000", fontWeight: 700, fontSize: 18, lineHeight: 1, letterSpacing: "-0.45px" }}
        >
          Your Creator cocktail
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/cocktail.png" alt="" width={150} style={{ display: "block", height: "auto" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 6 }}>
        <Sparkle />
        <span
          className="font-serif"
          style={{ color: "#000", fontStyle: "italic", fontSize: 28.8, fontWeight: 500, lineHeight: 1, letterSpacing: "-0.72px" }}
        >
          {card.drink}
        </span>
        <Sparkle />
      </div>

      <Divider />

      {/* ── QR + footer ───────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="Scan for your card" width={108} height={108} style={{ width: 108, height: 108, display: "block" }} />
      </div>
      <div
        className="font-sans"
        style={{ textAlign: "center", fontSize: 14, fontWeight: 400, lineHeight: 1.4, letterSpacing: "-0.35px", color: "#000", marginTop: 16 }}
      >
        Learn more at <span style={{ fontWeight: 600 }}>getstanley.ai</span>
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
        height: 2,
        margin: "18px 0",
        backgroundImage: `repeating-linear-gradient(to right, ${DASH} 0 13px, transparent 13px 23px)`,
        backgroundRepeat: "repeat-x",
      }}
    />
  );
}

function Stat({ value, label }: { value: number | null; label: string }) {
  return (
    <div style={{ textAlign: "center", lineHeight: 1.2 }}>
      <div className="font-sans" style={{ color: "#111118", fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>{formatCount(value)}</div>
      <div className="font-inter" style={{ fontSize: 10.5, color: MUTED, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function formatCount(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function Avatar({ src }: { src: string | null }) {
  const size = 86;
  const common: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    border: `1px solid ${LINE}`,
    flex: "0 0 auto",
  };
  if (!src) {
    return (
      <div className="font-sans" style={{ ...common, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, color: MUTED, background: BOX }}>
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
    <svg width="15" height="15" viewBox="0 0 24 24" fill="#3a8df0" aria-hidden style={{ display: "block" }}>
      <path d="M12 1.8l2.4 1.8 3 .1 1 2.8 2.4 1.7-.9 2.9.9 2.9-2.4 1.7-1 2.8-3 .1L12 22.2l-2.4-1.8-3-.1-1-2.8-2.4-1.7.9-2.9-.9-2.9 2.4-1.7 1-2.8 3-.1z" />
      <path d="M8 12l2.6 2.6L16 9.2" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DollarBadge() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/icon-dollar.png" alt="" width={21} height={21} style={{ display: "block", flex: "0 0 auto" }} />
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
        [position]: -9,
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: PAPER,
      }}
    />
  );
}

function Sparkle() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/sparkle.png" alt="" width={18} height={18} style={{ display: "block", flex: "0 0 auto" }} />
  );
}

function PlatformIcons() {
  const sz = 21.058;
  const base: React.CSSProperties = { width: sz, height: sz, display: "block", position: "relative" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-instagram.png" alt="" style={{ ...base, transform: "rotate(13.19deg)", zIndex: 1 }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-x.png" alt="" style={{ ...base, zIndex: 2, marginLeft: -6, marginRight: -6 }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-linkedin.png" alt="" style={{ ...base, transform: "rotate(-7.163deg)", zIndex: 1 }} />
    </span>
  );
}
