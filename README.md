# STANLEY+ — receipt cards

Drop an Instagram handle, and Stanley prints you a **receipt**: a ticket
number, three things we noticed about you, your **creator type**, and a
**drink recommendation** — with a QR that opens your virtual card.

Built for an in-person bar activation. Hiker-only ingestion (no login),
monochrome thermal-style receipt, JSON store, and a print-job queue with
a generic ESC/POS worker.

## Flow

```
/ (handle input)
  → POST /api/cards/generate
      normalize handle
      → ingestByHandle      (Hiker: /v1/user/by/username + /v1/user/medias/chunk)
      → buildDigest         (real signals: cadence, engagement, formats, vocab…)
      → generateReceipt     (LLM → 3 insights + creator type + drink; real numbers only)
      → assign ticket #, persist (JSON store)
      → { slug }
  → /c/[slug]               the virtual card (what the QR points to)
      • Send to printer  → POST /api/print  (enqueues a job)
      • Print here       → browser print (72mm @page)
      • Download PNG     → html-to-image export
```

The print worker drains the queue and renders ESC/POS:

```
/api/print/next      worker claims oldest queued job   (x-print-token)
/api/print/complete  worker reports done/error          (x-print-token)
```

## Run it

```bash
npm install
cp .env.example .env.local      # add HIKER_API_KEY + OPENAI_API_KEY
npm run dev                     # http://localhost:3000
```

- **Design check (no keys):** open `/preview`.
- **Real card:** type a public handle on `/`.
- Without `OPENAI_API_KEY`, generation still works — it falls back to
  rule-based copy. Without `HIKER_API_KEY`, generation returns a 503.

### Printing

In a second terminal:

```bash
PRINT_WORKER_TOKEN=dev-print-token npm run print-worker
```

By default the worker writes `./print-output/ticket-*.bin` (raw ESC/POS)
and a `.txt` preview. Point it at real hardware with
`PRINTER_DEVICE=/dev/usb/lp0` (or pipe the `.bin` to `lp`/`copy`).

## Config

| env | purpose |
|---|---|
| `HIKER_API_KEY` / `LAMADAVA_API_KEY` | HikerAPI access key |
| `OPENAI_API_KEY` | insight/type/drink generation |
| `OPENAI_MODEL` | model override (default `gpt-4o`) |
| `NEXT_PUBLIC_SITE_URL` | base URL for the QR target (else inferred) |
| `PRINT_WORKER_TOKEN` | shared secret for the print worker |

## Notes

- **Real-numbers-only:** the LLM may only cite numbers present in the
  digest facts; everything else is characterful but not fabricated.
- **Ticket number** is a simple monotonic counter in the store.
- **Storage** is a JSON file (`./data/store.json`). Swap `src/lib/store.ts`
  for Postgres/Redis for production; signatures stay the same.
