#!/usr/bin/env node
/**
 * Batch-warm pre-generated cards for the expected creator list.
 *
 * Reads handles from scripts/creators.txt (one per line, @ optional, blank
 * lines and #comments ignored), normalizes + de-dupes them, then POSTs them
 * in small batches to /api/admin/warm. Each warmed handle gets a pinned card
 * stored in the same backend the app reads from, so on-site a known creator
 * is served instantly (unknown handles still generate live).
 *
 * Resumable: progress is written to data/warm-results.json. Re-running skips
 * handles already warmed/reused (unless WARM_FORCE=1).
 *
 * Config (env or scripts/.env.local / .env.local):
 *   WARM_BASE_URL   target origin (default http://localhost:3000)
 *   WARM_TOKEN      bearer token; falls back to PRINT_WORKER_TOKEN
 *   WARM_BATCH      handles per request (default 6)
 *   WARM_FORCE      "1" to re-warm even if already pinned
 *   WARM_DELAY_MS   pause between batches (default 500)
 *
 * Usage:
 *   WARM_BASE_URL=https://<prod-url> WARM_TOKEN=<token> node scripts/warm-cards.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// --- minimal .env.local loader (so the token can live in a file) ----------
function loadEnv(file) {
  try {
    const txt = fs.readFileSync(file, "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!(m[1] in process.env)) process.env[m[1]] = v;
    }
  } catch {
    /* no file, fine */
  }
}
loadEnv(path.join(__dirname, ".env.local"));
loadEnv(path.join(ROOT, ".env.local"));

const BASE_URL = (process.env.WARM_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const TOKEN = process.env.WARM_TOKEN || process.env.PRINT_WORKER_TOKEN || "";
const BATCH = Math.max(1, Number(process.env.WARM_BATCH || 6));
const FORCE = process.env.WARM_FORCE === "1" || process.env.WARM_FORCE === "true";
const DELAY_MS = Number(process.env.WARM_DELAY_MS || 500);

const CREATORS_FILE = path.join(__dirname, "creators.txt");
const RESULTS_FILE = path.join(ROOT, "data", "warm-results.json");

function normalizeHandle(input) {
  if (!input) return null;
  let s = String(input).trim();
  if (!s) return null;
  const url = s.match(/instagram\.com\/([^/?#]+)/i);
  if (url) s = url[1];
  s = s.replace(/^@+/, "").replace(/[/\s]+/g, "").toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(s) ? s : null;
}

function readHandles() {
  if (!fs.existsSync(CREATORS_FILE)) {
    console.error(`Missing ${CREATORS_FILE}`);
    process.exit(1);
  }
  const lines = fs.readFileSync(CREATORS_FILE, "utf8").split(/\r?\n/);
  const seen = new Set();
  const out = [];
  let skipped = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const h = normalizeHandle(trimmed);
    if (!h) {
      skipped += 1;
      continue;
    }
    if (seen.has(h)) continue;
    seen.add(h);
    out.push(h);
  }
  return { handles: out, skipped };
}

function loadResults() {
  try {
    return JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveResults(map) {
  fs.mkdirSync(path.dirname(RESULTS_FILE), { recursive: true });
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(map, null, 2));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function postBatch(handles, attempt = 1) {
  try {
    const resp = await fetch(`${BASE_URL}/api/admin/warm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ handles, force: FORCE }),
    });
    if (resp.status === 401) {
      console.error("401 Unauthorized — check WARM_TOKEN matches the server's WARM_TOKEN/PRINT_WORKER_TOKEN.");
      process.exit(1);
    }
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    return await resp.json();
  } catch (e) {
    if (attempt >= 3) throw e;
    const backoff = 1500 * attempt;
    console.warn(`  batch failed (${e.message}); retrying in ${backoff}ms…`);
    await sleep(backoff);
    return postBatch(handles, attempt + 1);
  }
}

async function main() {
  if (!TOKEN) {
    console.error("No token. Set WARM_TOKEN (or PRINT_WORKER_TOKEN) in env or .env.local.");
    process.exit(1);
  }

  const { handles, skipped } = readHandles();
  const results = loadResults();

  const todo = FORCE
    ? handles
    : handles.filter((h) => {
        const r = results[h];
        return !(r && (r.status === "warmed" || r.status === "reused"));
      });

  console.log(`Target: ${BASE_URL}`);
  console.log(`Creators: ${handles.length} unique (${skipped} unparseable lines skipped)`);
  console.log(`To warm now: ${todo.length}  | batch=${BATCH} force=${FORCE}`);
  if (!todo.length) {
    console.log("Nothing to do. ✓");
    return;
  }

  const totals = { warmed: 0, reused: 0, invalid: 0, error: 0 };
  let done = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const data = await postBatch(batch);
    for (const r of data.results) {
      const key = r.handle || normalizeHandle(r.input) || r.input;
      results[key] = { status: r.status, slug: r.slug, ticket: r.ticket, error: r.error, at: new Date().toISOString() };
      if (totals[r.status] != null) totals[r.status] += 1;
    }
    saveResults(results);
    done += batch.length;
    const pct = ((done / todo.length) * 100).toFixed(0);
    console.log(
      `[${pct}%] ${done}/${todo.length}  +${data.counts.warmed}w ${data.counts.reused}r ${data.counts.error}e  ` +
        `(last: ${batch.join(", ")})`,
    );
    if (i + BATCH < todo.length && DELAY_MS) await sleep(DELAY_MS);
  }

  console.log("\nDone.");
  console.log(`  warmed: ${totals.warmed}`);
  console.log(`  reused: ${totals.reused}`);
  console.log(`  invalid: ${totals.invalid}`);
  console.log(`  error:  ${totals.error}`);
  const errors = Object.entries(results)
    .filter(([, r]) => r.status === "error")
    .map(([h, r]) => `${h} (${r.error})`);
  if (errors.length) {
    console.log(`\nFailed (${errors.length}) — safe to re-run to retry:`);
    for (const e of errors) console.log(`  - ${e}`);
  }
  console.log(`\nProgress saved to ${RESULTS_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
