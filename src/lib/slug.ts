import { customAlphabet } from "nanoid";

// URL-safe alphabet, lowercase, no ambiguous chars (no 0/O, no 1/l).
const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
const make = customAlphabet(alphabet, 10);

export function newSlug(): string {
  return make();
}
