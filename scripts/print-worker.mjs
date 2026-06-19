#!/usr/bin/env node
/**
 * STANLEY+ print worker.
 *
 * Polls the print queue and prints each receipt on the machine the printer
 * is physically wired to. The kiosk/browser never talks to the printer — it
 * just enqueues a job (no browser print dialog, ever). This worker drains the
 * queue and prints. Three modes, auto-selected by env:
 *
 *   1) LABEL  (PRINTER_NAME set)  ← MUNBYN 4x6 & friends
 *      Prints the exact on-screen receipt PNG (captured client-side and
 *      attached to the job) to a named OS printer queue. Silent — no dialog.
 *      The MUNBYN 4x6 connects over USB and installs via the vendor driver.
 *      Printing command per platform:
 *        - Windows:      `mspaint /pt <file> <printer>` (built-in, no install).
 *                        For reliable kiosk printing prefer SumatraPDF via
 *                        PRINT_CMD (see below) — set the driver's default paper
 *                        to 4x6. Find the printer name in Settings > Printers.
 *        - macOS/Linux:  CUPS `lp -d <printer>`. Find the name with `lpstat -p`.
 *        - PRINT_CMD:    overrides the above on any OS (see env).
 *
 *   2) ESC/POS raw   (PRINTER_DEVICE set, no PRINTER_NAME)
 *      Legacy 58/80mm thermal receipt printers. Writes ESC/POS bytes
 *      (native QR via GS ( k) straight to the device path.
 *
 *   3) DRY RUN       (neither set)
 *      Writes ./print-output/<ticket>.png (if the job carried an image),
 *      <ticket>.bin (raw ESC/POS) and <ticket>.txt (preview) so you can
 *      verify output with no hardware attached.
 *
 * Env:
 *   BASE_URL            default http://localhost:3000  (where the app/API lives)
 *   PUBLIC_BASE_URL     default = BASE_URL             (what the printed QR encodes —
 *                                                        must be reachable from a phone)
 *   PRINT_WORKER_TOKEN  must match the server's value
 *   PRINTER_NAME        printer/queue name (label mode). Windows: the name in
 *                       Settings > Printers. macOS/Linux: from `lpstat -p`.
 *   PRINT_CMD           optional full print command template; overrides the
 *                       per-OS default. Use {file} and {printer} placeholders,
 *                       e.g. (Windows + SumatraPDF):
 *                       "C:\\Tools\\SumatraPDF.exe" -print-to "{printer}" -silent -print-settings "fit" "{file}"
 *   PRINT_MEDIA         CUPS media for `lp` (macOS/Linux), e.g. Custom.4x6in
 *   PRINT_LP_OPTS       extra `lp` options (macOS/Linux, default "-o fit-to-page")
 *   PRINTER_DEVICE      raw device path (ESC/POS mode), e.g. /dev/usb/lp0
 *   RECEIPT_COLS        default 42 (80mm Font A). Use 32 for 58mm. (ESC/POS only)
 *   QR_SIZE             default 7  (ESC/POS QR module size, 1–16)        (ESC/POS only)
 *   POLL_MS             default 2000
 *
 * Run:  npm run print-worker
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile, exec } from "node:child_process";

/**
 * Minimal .env loader so the worker is configured by editing a file (no need
 * to set shell env vars — friendlier on Windows). Reads .env.local then .env
 * from the current directory. Real environment variables always win. Quotes
 * are stripped only when they wrap the whole value (so PRINT_CMD, which
 * contains its own quotes, is kept literal — write it WITHOUT outer quotes).
 */
function loadEnvFile() {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(process.cwd(), name);
    if (!fs.existsSync(p)) continue;
    for (const raw of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      if (!key || key in process.env) continue; // don't override real env
      let val = line.slice(eq + 1).trim();
      const q = val[0];
      if ((q === '"' || q === "'") && val[val.length - 1] === q && val.indexOf(q, 1) === val.length - 1) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}
loadEnvFile();

const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
// The QR must resolve on a phone — localhost won't. Falls back to BASE_URL.
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || BASE_URL).replace(/\/$/, "");
const TOKEN = process.env.PRINT_WORKER_TOKEN || "dev-print-token";
const PRINTER_NAME = process.env.PRINTER_NAME || null;
const PRINT_CMD = process.env.PRINT_CMD || null;
const PRINT_MEDIA = process.env.PRINT_MEDIA || null;
const PRINT_LP_OPTS = process.env.PRINT_LP_OPTS ?? "-o fit-to-page";
const PRINTER_DEVICE = process.env.PRINTER_DEVICE || null;
const IS_WIN = process.platform === "win32";
const POLL_MS = Number(process.env.POLL_MS || 2000);
const QR_SIZE = Math.min(16, Math.max(1, Number(process.env.QR_SIZE || 7)));
const OUT_DIR = path.join(process.cwd(), "print-output");

const MODE = PRINTER_NAME ? "label" : PRINTER_DEVICE ? "escpos" : "dryrun";

/** Absolute URL to the virtual card a scanned QR should open. */
function cardUrl(card) {
  return `${PUBLIC_BASE_URL}/c/${card.slug}`;
}

// ── ESC/POS builder (modes 2 & 3) ──────────────────────────────────
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
   */
  qr(data, size = 7) {
    const bytes = Buffer.from(data, "utf8");
    this.raw(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    this.raw(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size & 0xff);
    this.raw(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);
    const len = bytes.length + 3;
    this.raw(GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30);
    for (const b of bytes) this.bytes.push(b);
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

/** Decode a `data:image/png;base64,...` (or bare base64) job image to a Buffer. */
function decodeImage(image) {
  if (!image || typeof image !== "string") return null;
  const comma = image.indexOf(",");
  const b64 = image.startsWith("data:") && comma >= 0 ? image.slice(comma + 1) : image;
  try {
    const buf = Buffer.from(b64, "base64");
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

/**
 * Print a PNG file to the named printer, silently, on whatever OS we're on.
 *   - PRINT_CMD set → run that template ({file}/{printer} substituted).
 *   - Windows       → `mspaint /pt <file> <printer>` (built-in; uses the
 *                     driver's default paper — set it to 4x6).
 *   - macOS/Linux   → CUPS `lp -d <printer> [media/opts] <file>`.
 * Resolves with a short status string.
 */
function printFile(file) {
  return new Promise((resolve, reject) => {
    const done = (err, stdout, stderr, ok) =>
      err
        ? reject(new Error((stderr || stdout || err.message || "print failed").trim()))
        : resolve((stdout || ok || "").trim());

    if (PRINT_CMD) {
      const cmd = PRINT_CMD.split("{file}").join(file).split("{printer}").join(PRINTER_NAME || "");
      exec(cmd, (e, o, s) => done(e, o, s, "sent via PRINT_CMD"));
      return;
    }
    if (IS_WIN) {
      // mspaint /pt <file> <printer> prints to the named printer and exits.
      execFile("mspaint", ["/pt", file, PRINTER_NAME], (e, o, s) => done(e, o, s, "sent via mspaint"));
      return;
    }
    const args = ["-d", PRINTER_NAME];
    if (PRINT_MEDIA) args.push("-o", `media=${PRINT_MEDIA}`);
    // PRINT_LP_OPTS is a raw option string like "-o fit-to-page -o scaling=100".
    for (const tok of PRINT_LP_OPTS.split(/\s+/).filter(Boolean)) args.push(tok);
    args.push(file);
    execFile("lp", args, (e, o, s) => done(e, o, s));
  });
}

// ── Per-mode emit ──────────────────────────────────────────────────

async function emitLabel(card, job) {
  const png = decodeImage(job.image);
  if (!png) {
    throw new Error(
      "label/CUPS mode needs the receipt image, but this job has none " +
        "(open /c/<slug> and use the Print button so the receipt is captured).",
    );
  }
  const tmp = path.join(os.tmpdir(), `stanley-ticket-${card.ticket}-${job.id}.png`);
  fs.writeFileSync(tmp, png);
  try {
    const status = await printFile(tmp);
    console.log(`[worker] ticket #${card.ticket} → ${PRINTER_NAME} (${status || "queued"})`);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

function emitEscPos(card) {
  const escpos = buildEscPos(card);
  fs.writeFileSync(PRINTER_DEVICE, escpos);
  console.log(`[worker] sent ticket #${card.ticket} → ${PRINTER_DEVICE}`);
}

function emitDryRun(card, job) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const base = path.join(OUT_DIR, `ticket-${card.ticket}-${card.slug}`);
  const png = decodeImage(job.image);
  if (png) fs.writeFileSync(base + ".png", png);
  fs.writeFileSync(base + ".bin", buildEscPos(card));
  fs.writeFileSync(base + ".txt", previewText(card));
  console.log(
    `[worker] ticket #${card.ticket} → ${base}.{${png ? "png," : ""}bin,txt} (dry run)`,
  );
  console.log(previewText(card));
}

async function emitReceipt(card, job) {
  if (MODE === "label") return emitLabel(card, job);
  if (MODE === "escpos") return emitEscPos(card);
  return emitDryRun(card, job);
}

// ── Queue loop ─────────────────────────────────────────────────────

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

function describeTarget() {
  if (MODE === "label") {
    const via = PRINT_CMD ? "PRINT_CMD" : IS_WIN ? "mspaint" : "lp";
    return `printer "${PRINTER_NAME}" via ${via}${!IS_WIN && PRINT_MEDIA ? ` (media ${PRINT_MEDIA})` : ""}`;
  }
  if (MODE === "escpos") return `ESC/POS device ${PRINTER_DEVICE}`;
  return "./print-output/ (dry run — set PRINTER_NAME for a label printer)";
}

async function loop() {
  console.log(`[worker] polling ${BASE_URL} every ${POLL_MS}ms → ${describeTarget()}`);
  for (;;) {
    try {
      const { job, card } = await claim();
      if (job && card) {
        try {
          await emitReceipt(card, job);
          await complete(job.id, "done");
        } catch (err) {
          console.error(`[worker] print failed:`, err?.message || err);
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
