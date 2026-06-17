import type { ReceiptCard } from "./types";

/** Static sample receipt for the /preview design check (no keys needed). */
export const MOCK_CARD: ReceiptCard = {
  slug: "preview",
  ticket: 93,
  instagram_handle: "lainabooth",
  display_name: null,
  avatar_url: null,
  is_verified: true,
  stats: { posts: 305, followers: 60000, following: 474 },
  insights: [
    { text: "You romanticize ordinary moments." },
    { text: "You care more than you admit." },
    { text: "You have 17 unfinished ideas." },
  ],
  creator_type: "Story Collector",
  drink: "Whisky Sour",
  generated_at: new Date().toISOString(),
  data_source: "mock",
  llm_used: false,
};
