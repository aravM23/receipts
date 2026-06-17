import type { ReceiptCard } from "./types";

/** Static sample receipt for the /preview design check (no keys needed). */
export const MOCK_CARD: ReceiptCard = {
  slug: "preview",
  ticket: 93,
  instagram_handle: "lainabooth",
  display_name: "Alaina Booth",
  avatar_url: null,
  insights: [
    { text: "You romanticize ordinary moments." },
    { text: "You care more than you admit." },
    { text: "You start more than you finish." },
  ],
  creator_type: "Story Collector",
  drink: "Spicy Margarita",
  generated_at: new Date().toISOString(),
  data_source: "mock",
  llm_used: false,
};
