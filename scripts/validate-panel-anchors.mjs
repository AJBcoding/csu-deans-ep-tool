#!/usr/bin/env node
// Cross-validation: every panel-anchor data-cite key in content/mdocs/*.html
// resolves to a key in content/citations.json mdoc_anchors after
// case-normalization to uppercase.
//
// Panel-anchor pattern: /^[mr]\d+#/i  (e.g. m01#expansion-logic, R12#five-reasons).
// Other data-cite namespaces (nprm:, obbba:, cfr:, fr:, gepa:) point to
// statutory references that resolve through a separate lookup mechanism and
// are out of scope here.
//
// Exit codes:
//   0 — all panel anchors resolve, OR content/mdocs/ does not exist on this
//       branch (validation runs in the integrated tree post-merge).
//   1 — at least one panel anchor in an HTML file lacks a citations.json entry.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const citationsPath = join(repoRoot, "content", "citations.json");
const mdocsDir = join(repoRoot, "content", "mdocs");

const PANEL_ANCHOR_RE = /^[mr]\d+#/i;
const DATA_CITE_RE = /data-cite="([^"]+)"/g;

const citations = JSON.parse(readFileSync(citationsPath, "utf8"));
const anchorKeys = new Set(
  Object.keys(citations.mdoc_anchors).map((k) => k.toUpperCase()),
);

if (!existsSync(mdocsDir)) {
  console.log(
    `[validate-panel-anchors] content/mdocs/ not present on this branch — skipping (validation runs in integrated tree).`,
  );
  process.exit(0);
}

const htmlFiles = readdirSync(mdocsDir)
  .filter((f) => f.endsWith(".html"))
  .map((f) => join(mdocsDir, f));

const misses = [];
let scannedKeys = 0;
let panelKeys = 0;

for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  for (const match of html.matchAll(DATA_CITE_RE)) {
    scannedKeys += 1;
    const key = match[1];
    if (!PANEL_ANCHOR_RE.test(key)) continue;
    panelKeys += 1;
    const normalized = key.toUpperCase();
    if (!anchorKeys.has(normalized)) {
      misses.push({ file: file.replace(`${repoRoot}/`, ""), key, normalized });
    }
  }
}

if (misses.length > 0) {
  console.error(
    `[validate-panel-anchors] FAIL: ${misses.length} panel anchor(s) in content/mdocs/*.html have no citations.json entry:\n`,
  );
  for (const m of misses) {
    console.error(`  ${m.file}: data-cite="${m.key}" → expected key ${m.normalized}`);
  }
  process.exit(1);
}

console.log(
  `[validate-panel-anchors] OK: scanned ${htmlFiles.length} panel file(s), ${scannedKeys} data-cite attribute(s), ${panelKeys} panel anchor(s); all resolve.`,
);
process.exit(0);
