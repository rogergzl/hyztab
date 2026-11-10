/**
 * Splitting oversized values across several storage items.
 *
 * `chrome.storage.sync` rejects a `set()` call outright when any single item
 * exceeds 8 KB, and the rejection loses every key in that call, not just the
 * offending one. A long enough link list is enough to trigger it, so values
 * larger than the limit are stored as a small manifest plus numbered parts and
 * reassembled on load. Small values keep their original single item shape.
 */

/** Byte budget per item, kept below the 8192 byte platform limit. */
export const ITEM_LIMIT = 7680;

/** Separates a part index from the key it belongs to. */
const PART_SEPARATOR = "#";

/** Marks a stored value as a manifest describing how many parts follow. */
export const PART_COUNT_KEY = "__parts";

/** Matches a stored part key such as `data/abc#2`. */
const PART_PATTERN = /^(.*)#(\d+)$/;

/** Bytes a string occupies once stored. */
export const byteLength = (text: string): number =>
  new TextEncoder().encode(text).length;

/**
 * Bytes a single character occupies once the platform JSON encodes it.
 *
 * A part holds raw JSON text, so every quote and backslash in it is escaped
 * again on the way into storage. Measuring the raw size instead is enough to
 * push a part back over the item limit.
 */
const escapedLength = (character: string): number =>
  byteLength(JSON.stringify(character)) - 2;

/** The part index of a stored key, or null when it is not a part. */
export const partIndexOf = (logical: string): number | null => {
  const match = PART_PATTERN.exec(logical);
  return match ? Number(match[2]) : null;
};

/** The key that a stored part belongs to. */
export const partOwner = (logical: string): string =>
  logical.slice(0, logical.lastIndexOf(PART_SEPARATOR));

/** How many parts a stored manifest declares, or 0 when it is not split. */
export const partCount = (value: unknown): number => {
  if (typeof value !== "object" || value === null) return 0;
  const count = (value as Record<string, unknown>)[PART_COUNT_KEY];
  return typeof count === "number" && count > 1 ? Math.floor(count) : 0;
};

/** The storage key of a single part. */
export const partKey = (fullKey: string, index: number): string =>
  `${fullKey}${PART_SEPARATOR}${index}`;

/** True when every declared part arrived. */
export const partsComplete = (parts: string[], count: number): boolean =>
  parts.length >= count &&
  Array.from({ length: count }, (_, index) => typeof parts[index] === "string")
    .every(Boolean);

/** Rebuild a value from its parts. */
export const joinParts = (parts: string[]): unknown =>
  JSON.parse(parts.join(""));

/** Cut a string into pieces no larger than the byte budget, measured as stored. */
const splitByBytes = (text: string, budget: number): string[] => {
  const parts: string[] = [];
  let current = "";
  let size = 0;

  // Iterating by code point keeps surrogate pairs intact.
  for (const character of text) {
    const bytes = escapedLength(character);
    if (size + bytes > budget && current) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += character;
    size += bytes;
  }

  if (current) parts.push(current);
  return parts;
};

/**
 * Turn one logical change into the items that should be written.
 *
 * Returns the writes to perform plus how many parts the value now occupies,
 * which the caller needs in order to clear parts left over from a larger
 * previous value.
 */
export const encodeValue = (
  fullKey: string,
  value: unknown,
): { updates: Record<string, unknown>; count: number } => {
  const json = JSON.stringify(value) ?? "null";

  // The platform counts the key towards the item size, so both must fit.
  if (byteLength(fullKey) + byteLength(json) <= ITEM_LIMIT) {
    return { updates: { [fullKey]: value }, count: 0 };
  }

  // A part is stored as a string, so its escaped size is what has to fit,
  // alongside its own key and the two surrounding quotes.
  const budget = Math.max(
    1024,
    ITEM_LIMIT - byteLength(partKey(fullKey, 0)) - 2,
  );
  const parts = splitByBytes(json, budget);

  const updates: Record<string, unknown> = {
    [fullKey]: { [PART_COUNT_KEY]: parts.length },
  };
  parts.forEach((part, index) => {
    updates[partKey(fullKey, index)] = part;
  });

  return { updates, count: parts.length };
};
