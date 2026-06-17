#!/usr/bin/env node
/**
 * STANLEY+ print worker.
 *
 * Polls the print queue and renders each receipt as generic ESC/POS
 * (works with most 58/80mm thermal printers). Because the exact printer
 * isn't decided yet, this worker is hardware-agnostic:
 *
 *   - If PRINTER_DEVICE is set (e.g. /dev/usb/lp0, or a path to a
 *     printer's raw spool), the ESC/POS bytes are written there.
 *   - Otherwise it writes ./print-output/<ticket>.bin (raw ESC/POS) and
 *     ./print-output/<ticket>.txt (human-readable preview), so you can
 *     verify the output and `cat file.bin > /dev/usb/lp0` later, or pipe
 *     to `lp -d <printer>`.
 *
 * Env:
 *   BASE_URL            default http://localhost:3000  (where the app/API lives — the worker calls this)
 *   PUBLIC_BASE_URL     default = BASE_URL             (what the printed QR encodes — must be reachable
 *                                                        from a guest's PHONE, e.g. the LAN IP or public domain)
 *   PRINT_WORKER_TOKEN  must match the server's value
 *   PRINTER_DEVICE      optional raw device path
 *   RECEIPT_COLS        default 42 (80mm Font A). Use 32 for 58mm.
 *   QR_SIZE             default 7 (ESC/POS QR module size, 1–16)
 *   POLL_MS             default 2000
 *
 * Run:  npm run print-worker
 */

import fs from "node:fs";
import path from "node:path";

const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
// The QR must resolve on a phone — localhost won't. Falls back to BASE_URL.
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || BASE_URL).replace(/\/$/, "");
const TOKEN = process.env.PRINT_WORKER_TOKEN || "dev-print-token";
const PRINTER_DEVICE = process.env.PRINTER_DEVICE || null;
const POLL_MS = Number(process.env.POLL_MS || 2000);
const QR_SIZE = Math.min(16, Math.max(1, Number(process.env.QR_SIZE || 7)));
const OUT_DIR = path.join(process.cwd(), "print-output");

/** Absolute URL to the virtual card a scanned QR should open. */
function cardUrl(card) {
  return `${PUBLIC_BASE_URL}/c/${card.slug}`;
}

// ── ESC/POS builder ────────────────────────────────────────────────
const ESC = 0x1b;
const GS = 0x1d;

class Esc {
  constructor() {
    this.bytes = [];
  }
  raw(...b) {
    this.bytes.push(...b);
    return this;
  }
  text(s) {
    for (const ch of Buffer.from(s, "latin1")) this.bytes.push(ch);
    return this;
  }
  line(s = "") {
    return this.text(s).raw(0x0a);
  }
  init() {
    return this.raw(ESC, 0x40);
  }
  align(a) {
    return this.raw(ESC, 0x61, a === "center" ? 1 : a === "right" ? 2 : 0);
  }
  bold(on) {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }
  // n: width/height multiplier 0..7 via GS ! (size = (w<<4)|h)
  size(w, h) {
    return this.raw(GS, 0x21, ((w & 0x07) << 4) | (h & 0x07));
  }
  feed(n = 1) {
    return this.raw(ESC, 0x64, n);
  }
  cut() {
    return this.raw(GS, 0x56, 0x42, 0x00);
  }
  /**
   * Native ESC/POS QR code (GS ( k) — scannable, prints crisply on the
   * thermal head. `data` is the URL the QR resolves to.
   *   1) select model 2   2) module size   3) error correction (M)
   *   4) store data       5) print
   */
  qr(data, size = 7) {
    const bytes = Buffer.from(data, "utf8");
    // 1) model 2
    this.raw(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // 2) module size
    this.raw(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size & 0xff);
    // 3) error correction level M (0x31)
    this.raw(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);
    // 4) store the data (pL/pH cover data length + 3 for cn,fn,m)
    const len = bytes.length + 3;
    this.raw(GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30);
    for (const b of bytes) this.bytes.push(b);
    // 5) print the stored symbol
    this.raw(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    return this;
  }
  done() {
    return Buffer.from(this.bytes);
  }
}

const WIDTH = Math.max(24, Number(process.env.RECEIPT_COLS || 42)); // 80mm @ Font A ≈ 42 cols (32 for 58mm)
function divider() {
  return "-".repeat(WIDTH);
}
function center(s) {
  const t = s.slice(0, WIDTH);
  const pad = Math.max(0, Math.floor((WIDTH - t.length) / 2));
  return " ".repeat(pad) + t;
}
function wrap(s, w = WIDTH) {
  const words = String(s).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const word of words) {
    if ((cur + " " + word).trim().length > w) {
      if (cur) lines.push(cur.trim());
      cur = word;
    } else {
      cur = (cur + " " + word).trim();
    }
  }
  if (cur) lines.push(cur.trim());
  return lines;
}

function buildEscPos(card) {
  const e = new Esc().init();
  e.align("center").bold(true).size(1, 1).line("STANLEY+").size(0, 0).bold(false);
  e.line(divider());
  e.size(3, 3).bold(true).line(String(card.ticket)).size(0, 0).bold(false);
  e.line(divider());
  e.align("left");
  e.bold(true).line((card.display_name || card.instagram_handle).toUpperCase()).bold(false);
  e.line("@" + card.instagram_handle);
  e.line("");
  e.line("STANLEY'S READ");
  for (const ins of (card.insights || []).slice(0, 3)) {
    const lines = wrap(ins.text, WIDTH - 2);
    lines.forEach((l, i) => e.line((i === 0 ? "> " : "  ") + l));
  }
  e.line(divider());
  e.line("CREATOR TYPE");
  e.bold(true).line(card.creator_type.toUpperCase()).bold(false);
  e.line(divider());
  e.line("DRINK RECOMMENDATION");
  e.bold(true).line(card.drink.toUpperCase()).bold(false);
  e.line(divider());
  e.align("center").line("SHOW THIS AT THE BAR");
  e.line("");
  e.bold(true).line("SCAN FOR YOUR CARD").bold(false);
  e.line("");
  e.qr(cardUrl(card), QR_SIZE);
  e.line("");
  e.feed(4).cut();
  return e.done();
}

function previewText(card) {
  const L = [];
  L.push(center("STANLEY+"));
  L.push(divider());
  L.push(center(String(card.ticket)));
  L.push(divider());
  L.push((card.display_name || card.instagram_handle).toUpperCase());
  L.push("@" + card.instagram_handle);
  L.push("");
  L.push("STANLEY'S READ");
  for (const ins of (card.insights || []).slice(0, 3)) {
    wrap(ins.text, WIDTH - 2).forEach((l, i) => L.push((i === 0 ? "> " : "  ") + l));
  }
  L.push(divider());
  L.push("CREATOR TYPE");
  L.push(card.creator_type.toUpperCase());
  L.push(divider());
  L.push("DRINK RECOMMENDATION");
  L.push(card.drink.toUpperCase());
  L.push(divider());
  L.push(center("SHOW THIS AT THE BAR"));
  L.push(center("SCAN FOR YOUR CARD"));
  L.push("[QR → " + cardUrl(card) + "]");
  return L.join("\n") + "\n";
}

function emitReceipt(card) {
  const escpos = buildEscPos(card);
  if (PRINTER_DEVICE) {
    fs.writeFileSync(PRINTER_DEVICE, escpos);
    console.log(`[worker] sent ticket #${card.ticket} → ${PRINTER_DEVICE}`);
    return;
  }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const base = path.join(OUT_DIR, `ticket-${card.ticket}-${card.slug}`);
  fs.writeFileSync(base + ".bin", escpos);
  fs.writeFileSync(base + ".txt", previewText(card));
  console.log(`[worker] ticket #${card.ticket} → ${base}.bin (+ .txt preview)`);
  console.log(previewText(card));
}

async function claim() {
  const resp = await fetch(`${BASE_URL}/api/print/next`, {
    headers: { "x-print-token": TOKEN },
  });
  if (!resp.ok) throw new Error(`claim HTTP ${resp.status}`);
  return resp.json();
}

async function complete(id, status, error) {
  await fetch(`${BASE_URL}/api/print/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-print-token": TOKEN },
    body: JSON.stringify({ id, status, error }),
  });
}

async function loop() {
  console.log(`[worker] polling ${BASE_URL} every ${POLL_MS}ms` + (PRINTER_DEVICE ? ` → ${PRINTER_DEVICE}` : " → ./print-output/"));
  for (;;) {
    try {
      const { job, card } = await claim();
      if (job && card) {
        try {
          emitReceipt(card);
          await complete(job.id, "done");
        } catch (err) {
          console.error(`[worker] print failed:`, err);
          await complete(job.id, "error", String(err?.message || err));
        }
        continue; // immediately check for more
      }
    } catch (err) {
      console.error(`[worker] poll error:`, err.message || err);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

loop();
