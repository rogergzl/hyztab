#!/usr/bin/env node
/**
 * Extension ID utilities.
 *
 * Chrome derives an unpacked extension's ID from the absolute path of its
 * directory unless the manifest carries a `key` field. A path derived ID
 * changes whenever the folder moves, which orphans everything stored in
 * chrome.storage for that ID. Embedding a public key pins the ID instead.
 *
 * Chrome's derivation: SHA-256 the DER public key, keep the first 128 bits,
 * then map each hex digit 0-f onto the letters a-p.
 *
 * Usage:
 *   node scripts/extension-id.js show     print the pinned id
 *   node scripts/extension-id.js inject   write the key into the manifest
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const publicKeyPath = path.join(root, "keys", "chromium-pub.b64");
const manifestPath = path.join(root, "target", "chromium", "manifest.json");

/** Read the base64 DER public key, stripped of any whitespace. */
const readPublicKey = () => {
  if (!fs.existsSync(publicKeyPath)) {
    throw new Error(
      `Missing ${path.relative(root, publicKeyPath)}. ` +
        "Generate it first (see README, section on storage).",
    );
  }
  return fs.readFileSync(publicKeyPath, "utf8").replace(/\s+/g, "");
};

/** Derive the 32 character extension id Chrome will assign. */
const deriveId = (base64Key) => {
  const digest = crypto
    .createHash("sha256")
    .update(Buffer.from(base64Key, "base64"))
    .digest("hex")
    .slice(0, 32);

  return Array.from(digest)
    .map((char) => String.fromCharCode(parseInt(char, 16) + "a".charCodeAt(0)))
    .join("");
};

const key = readPublicKey();
const id = deriveId(key);

const command = process.argv[2] || "show";

if (command === "show") {
  console.log(id);
} else if (command === "inject") {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.key = key;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Pinned extension id: ${id}`);
  console.log(`Updated ${path.relative(root, manifestPath)}`);
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
