/**
 * The STANLEY receipt — a printable "ticket" character read of a creator.
 * Pure presentation (no hooks) so it renders server-side on the share page
 * AND inside the client export/print wrapper.
 *
 * Black-on-white, fixed logical size so proportions stay identical whether
 * previewed, exported to PNG, or sent to the label printer.
 *
 * Sized 1000 x 1500 (2:3) — fills a MUNBYN 4x6 label edge-to-edge. The
 * on-screen card is scaled down to fit via <ReceiptFrame>; the PNG export /
 * print capture uses these native dimensions.
 *
 * Type set in the brand fonts: Plus Jakarta Sans (UI/labels), Inter (body),
 * Lora (serif accents — the cocktail name + archetype).
 */

import type { ReceiptCard } from "@/lib/types";

export const RECEIPT_WIDTH = 1000;
export const RECEIPT_HEIGHT = 1500;

const PAPER = "#ffffff";
const INK = "#15141a";
const MUTED = "#6c6b75";
const BORDER = "#cfced6";
const DASH = "#b9b8c2";
const PAD_X = 66;

/**
 * Per-drink hero art. Each drink on the bar menu gets its own image; drinks
 * without bespoke art yet fall back to the default cocktail hero.
 */
const DRINK_IMAGES: Record<string, string> = {
  "Aperol Spritz": "/cocktail-hero.png",
  Margarita: "/drink-margarita.png",
  "French 75": "/drink-french-75.png",
  Wine: "/drink-wine.png",
  Beer: "/drink-beer.png",
};
const DEFAULT_DRINK_IMAGE = "/cocktail-hero.png";

function drinkImage(drink: string): string {
  return DRINK_IMAGES[drink] ?? DEFAULT_DRINK_IMAGE;
}

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

export default function Receipt({ card, framed = true }: Props) {
  return (
    <div
      className="receipt-print-root font-inter"
      style={{
        width: RECEIPT_WIDTH,
        height: RECEIPT_HEIGHT,
        display: "flex",
        flexDirection: "column",
        background: PAPER,
        color: INK,
        padding: `60px ${PAD_X}px 52px`,
        borderRadius: framed ? 16 : 0,
        boxShadow: framed ? "0 24px 60px -20px rgba(0,0,0,0.55)" : "none",
        overflow: "hidden",
      }}
    >
      {/* ── Creator cocktail (hero) ───────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={drinkImage(card.drink)}
          alt=""
          style={{ display: "block", height: 360, width: "auto", objectFit: "contain", filter: "grayscale(1)" }}
        />
        <div
          className="font-inter"
          style={{ marginTop: 26, fontSize: 24, fontWeight: 500, lineHeight: 1.4, letterSpacing: "1.5px", color: "#000", textTransform: "uppercase" }}
        >
          Your Creator Cocktail
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 26, marginTop: 10 }}>
          <Sparkle />
          <span
            className="font-serif"
            style={{ color: INK, fontStyle: "italic", fontSize: 84, fontWeight: 500, lineHeight: 1, letterSpacing: "-1.5px" }}
          >
            {card.drink}
          </span>
          <Sparkle />
        </div>
      </div>

      {/* ── Stanley says (full-bleed bar) ─────────────────────── */}
      <div
        className="font-sans"
        style={{
          margin: `52px -${PAD_X}px 0`,
          background: "#000",
          color: PAPER,
          height: 76,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 25,
          fontWeight: 600,
          letterSpacing: "3px",
          textTransform: "uppercase",
        }}
      >
        Stanley Says&hellip;
      </div>

      {/* ── Insights ──────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 18, marginTop: 44 }}>
        {card.insights.slice(0, 3).map((ins, i) => (
          <div
            key={i}
            className="font-sans"
            style={{
              flex: "1 1 0",
              border: `1.6px solid ${BORDER}`,
              borderRadius: 16,
              minHeight: 118,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "18px 16px",
              fontSize: 21,
              fontWeight: 400,
              lineHeight: 1.25,
              letterSpacing: "-0.3px",
              color: "#2c2b33",
            }}
          >
            {ins.text}
          </div>
        ))}
      </div>

      {/* ── Creator archetype ─────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          margin: "46px -8px 0",
          width: 884,
          height: 344,
          border: `1.6px solid ${BORDER}`,
          borderRadius: 28,
          display: "flex",
          alignItems: "center",
          gap: 30,
          padding: "0 48px",
        }}
      >
        <Avatar src={card.avatar_url} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="font-inter"
            style={{ fontSize: 24, fontWeight: 500, lineHeight: 1.4, letterSpacing: "1.2px", color: "#000", textTransform: "uppercase" }}
          >
            Your Creator Archetype
          </div>
          <div
            className="font-serif"
            style={{ marginTop: 12, color: INK, fontStyle: "italic", fontSize: 66, fontWeight: 500, lineHeight: 1.02, letterSpacing: "-1.4px" }}
          >
            {card.creator_type}
          </div>
        </div>

        {/* Social logos tucked inside the four corners (rotation baked into art) */}
        <SocialSticker kind="instagram" style={{ top: 18, left: 18 }} />
        <SocialSticker kind="linkedin" style={{ top: 18, right: 18 }} />
        <SocialSticker kind="x" style={{ bottom: 18, left: 18 }} />
        <SocialSticker kind="youtube" style={{ bottom: 18, right: 18 }} />
      </div>

      {/* ── Footer ────────────────────────────────────────────── */}
      <div style={{ marginTop: "auto" }}>
        <Divider />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/stanley-mark.png" alt="" style={{ display: "block", width: 30, height: 29.5, filter: "grayscale(1)" }} />
            <div>
              <div className="font-sans" style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.8px", color: "#000" }}>
                Stanley
              </div>
              <div className="font-inter" style={{ fontSize: 28, fontWeight: 400, lineHeight: "normal", color: "#000", marginTop: 8 }}>
                Your AI Head of Content
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div className="font-inter" style={{ textAlign: "right", fontSize: 28, fontWeight: 400, lineHeight: "42px", letterSpacing: "-0.14px", color: "#000" }}>
              Scan to
              <br />
              learn more
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/qr-code.png" alt="Scan to learn more" width={124} height={124} style={{ width: 124, height: 124, display: "block" }} />
          </div>
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
        margin: `0 -${PAD_X}px`,
        backgroundImage: `repeating-linear-gradient(to right, ${DASH} 0 16px, transparent 16px 30px)`,
        backgroundRepeat: "repeat-x",
      }}
    />
  );
}

function Avatar({ src }: { src: string | null }) {
  const size = 210;
  const common: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    border: `1.6px solid ${BORDER}`,
    flex: "0 0 auto",
  };
  if (!src) {
    return (
      <div className="font-sans" style={{ ...common, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52, color: MUTED, background: "#f1f0f4" }}>
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

function Sparkle() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/sparkle.png" alt="" width={54} height={54} style={{ display: "block", flex: "0 0 auto", filter: "grayscale(1)" }} />
  );
}

type SocialKind = "instagram" | "x" | "linkedin" | "youtube";

function SocialSticker({ kind, style }: { kind: SocialKind; style?: React.CSSProperties }) {
  const size = 54;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/icon-${kind}.png`}
      alt=""
      width={size}
      height={size}
      style={{ position: "absolute", width: size, height: size, display: "block", filter: "grayscale(1)", ...style }}
    />
  );
}
