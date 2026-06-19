/**
 * Core data shapes for the STANLEY+ receipt.
 *
 * A "receipt" is what the printer spits out and what `/c/[slug]`
 * renders as the virtual card: a ticket number, three personal
 * insights, one creator-type verdict, and a drink recommendation —
 * generated from a creator's public Instagram via HikerAPI.
 */

/** One of the three "STANLEY'S READ" lines. */
export type Insight = {
  /** One short, polished, sentence-case observation. */
  text: string;
  /**
   * Engineering-only note on which real signal grounds this line
   * (e.g. "posts_per_week=4.2"). Never shown to the creator.
   */
  source?: string;
};

/**
 * The persisted receipt. Everything the share page + printer need.
 * Self-contained so a card renders identically months later even if
 * the upstream IG account changes.
 */
export type ReceiptCard = {
  /** Public URL slug — `/c/[slug]`. */
  slug: string;
  /** Sequential ticket number shown big at the top of the receipt. */
  ticket: number;

  // ---- subject ----
  instagram_handle: string;
  display_name: string | null;
  /** Proxied avatar path (`/api/avatar?u=...`) so html-to-image/print can inline it. */
  avatar_url: string | null;
  /** Whether the IG account carries a verified badge. */
  is_verified: boolean;
  /** Public profile counts shown under the avatar. */
  stats: {
    posts: number | null;
    followers: number | null;
    following: number | null;
  };

  // ---- the three things ----
  /** Exactly three "STANLEY'S READ" insights. */
  insights: Insight[];
  /** The creator-type verdict, e.g. "Story Collector". */
  creator_type: string;
  /** One-line drink recommendation, e.g. "Spicy Margarita". */
  drink: string;

  // ---- provenance / meta ----
  generated_at: string; // ISO
  /** "hiker" for live cards, "mock" for the static preview. */
  data_source: "hiker" | "mock";
  /** Whether the OpenAI pass succeeded (false = rule-based fallback copy). */
  llm_used: boolean;
};

/** A queued print job. The worker polls for these. */
export type PrintJob = {
  id: string;
  slug: string;
  status: "queued" | "printing" | "done" | "error";
  created_at: string; // ISO
  updated_at: string; // ISO
  /** Set when status === "error". */
  error?: string;
  /**
   * Optional PNG snapshot of the rendered receipt as a data URL
   * (`data:image/png;base64,...`), captured client-side at print time.
   * Label printers (e.g. MUNBYN 4x6) print this image via CUPS; ESC/POS
   * printers ignore it and render text instead.
   */
  image?: string;
};
