#!/usr/bin/env tsx
/**
 * Build-time linter for Dean-facing strings.
 *
 * Enforces design.v6 §13 success criteria (forbidden literals) and v5/v6 §17
 * glossary substitutions against any file in content/ and any UI template in
 * src/ui/. Engine JSON keys (src/types.ts, src/engine.ts, etc.) and the
 * SCHEMA.md / glossary.json files themselves are exempt.
 *
 * Exit code 0 = clean; non-zero = violations (CI/build blocker).
 */

import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface ForbiddenEntry {
  term: string;
  reason: string;
  category: string;
}

interface SwapEntry {
  internal: string;
  dean_facing: string;
  category: string;
  notes?: string;
}

interface Glossary {
  forbidden_literals: ForbiddenEntry[];
  condescending_terms: ForbiddenEntry[];
  internal_to_dean_facing: SwapEntry[];
}

interface Violation {
  file: string;
  line: number;
  column: number;
  term: string;
  category: string;
  reason: string;
  context: string;
}

const PROJECT_ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");

/**
 * Files exempt from linting. The linter targets Dean-facing surfaces
 * (rendered HTML, panel templates, UI strings); engine internals and
 * the linter's own data files use internal vocabulary by design.
 */
const EXEMPT_FILES = new Set([
  "content/glossary.json",
  "content/glossary.schema.json",
  "content/mdocs/SCHEMA.md",
  "scripts/lint-glossary.ts",
  "scripts/lint-glossary.test.ts",
]);

const EXEMPT_PREFIXES = [
  "src/types.ts",
  "src/engine.ts",
  "src/rules.ts",
  "src/citations.ts",
  "src/verdict.ts",
  "src/index.ts",
  "src/cli/",
  "data/",
  "tests/",
  "node_modules/",
  ".git/",
  "dist/",
  "SPEC.md",
  "README.md",
];

/**
 * Default scan roots. Override with CLI args. Engine source is excluded
 * from defaults to keep the linter focused on Dean-facing content.
 */
const DEFAULT_ROOTS = ["content"];

const SCAN_EXTENSIONS = new Set([".html", ".mdx", ".md", ".tsx", ".jsx"]);

function isExempt(relPath: string): boolean {
  if (EXEMPT_FILES.has(relPath)) return true;
  return EXEMPT_PREFIXES.some((p) => relPath.startsWith(p));
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (st.isFile()) {
      const rel = relative(PROJECT_ROOT, full);
      if (isExempt(rel)) continue;
      const dot = entry.lastIndexOf(".");
      const ext = dot >= 0 ? entry.slice(dot) : "";
      if (SCAN_EXTENSIONS.has(ext)) out.push(full);
    }
  }
}

function loadGlossary(): Glossary {
  const path = join(PROJECT_ROOT, "content", "glossary.json");
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw);
}

/**
 * Match `term` as a whole-word, case-insensitive sequence. Skips matches
 * inside HTML comments, inside <code>/<pre> blocks, and inside data-cite
 * attribute values (citation keys are internal-namespace by design).
 */
function findMatches(content: string, term: string): Array<{ index: number; line: number; column: number }> {
  const matches: Array<{ index: number; line: number; column: number }> = [];
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Word boundary that respects punctuation but allows spaces inside multi-word terms.
  const hasSpaces = term.includes(" ");
  const pattern = hasSpaces
    ? new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, "gi")
    : new RegExp(`\\b${escaped}\\b`, "gi");

  // Strip HTML comments + <code>/<pre>/<script> + data-cite="..." values before scanning.
  const masked = content
    .replace(/<!--[\s\S]*?-->/g, (m) => " ".repeat(m.length))
    .replace(/<(code|pre|script|style)[^>]*>[\s\S]*?<\/\1>/gi, (m) => " ".repeat(m.length))
    .replace(/data-cite\s*=\s*"[^"]*"/g, (m) => " ".repeat(m.length))
    .replace(/data-cite\s*=\s*'[^']*'/g, (m) => " ".repeat(m.length));

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(masked)) !== null) {
    const before = content.slice(0, m.index);
    const lineNo = before.split("\n").length;
    const lastNl = before.lastIndexOf("\n");
    const col = m.index - (lastNl + 1) + 1;
    matches.push({ index: m.index, line: lineNo, column: col });
  }
  return matches;
}

function contextSnippet(content: string, index: number, term: string): string {
  const start = Math.max(0, index - 30);
  const end = Math.min(content.length, index + term.length + 30);
  return content.slice(start, end).replace(/\s+/g, " ").trim();
}

export function lintFile(file: string, glossary: Glossary): Violation[] {
  const violations: Violation[] = [];
  const content = readFileSync(file, "utf8");
  const rel = relative(PROJECT_ROOT, file);

  for (const f of glossary.forbidden_literals) {
    for (const m of findMatches(content, f.term)) {
      violations.push({
        file: rel,
        line: m.line,
        column: m.column,
        term: f.term,
        category: f.category,
        reason: f.reason,
        context: contextSnippet(content, m.index, f.term),
      });
    }
  }

  for (const c of glossary.condescending_terms) {
    for (const m of findMatches(content, c.term)) {
      violations.push({
        file: rel,
        line: m.line,
        column: m.column,
        term: c.term,
        category: c.category,
        reason: c.reason,
        context: contextSnippet(content, m.index, c.term),
      });
    }
  }

  for (const swap of glossary.internal_to_dean_facing) {
    // Skip swaps whose internal token is a single common English word
    // unless explicitly marked Dean-facing-forbidden via category v5-§17-derived.
    // PPD release tokens etc. are caught by forbidden_literals.
    // We lint the cleanly-distinctive internal tokens.
    const lintable = isLintableSwap(swap);
    if (!lintable) continue;

    for (const m of findMatches(content, swap.internal)) {
      violations.push({
        file: rel,
        line: m.line,
        column: m.column,
        term: swap.internal,
        category: `glossary-${swap.category}`,
        reason: `Dean-facing surface should use "${swap.dean_facing}" instead of internal token "${swap.internal}".`,
        context: contextSnippet(content, m.index, swap.internal),
      });
    }
  }

  return violations;
}

/**
 * Some glossary swaps are common-English compounds ('advisory', 'parametric',
 * 'reliable') that the linter would over-flag. Lint only swaps whose internal
 * token is a tool-internal jargon string — distinctive enough that a hit is
 * almost certainly a Dean-facing leak.
 */
function isLintableSwap(swap: SwapEntry): boolean {
  const allowlist = new Set([
    "Cohort cascade",
    "Supergroup",
    "STATS dataset",
    "OPEID6",
    "Subpart Q",
    "Subpart R",
    "PrivacySuppressed",
    "Working-not-enrolled subset",
    "median earnings of working not enrolled",
    "2-of-3-year trigger",
    "EP gap",
    "ep_gap_pct",
    "Benchmark cell",
    "RIA Table 3.19",
    "irs_match_count",
    "t4enrl_inst_instate_p1819",
    "n_size",
    "Integrity envelope",
  ]);
  return allowlist.has(swap.internal);
}

function formatViolations(violations: Violation[]): string {
  if (violations.length === 0) return "";
  const lines: string[] = [];
  lines.push(`✗ ${violations.length} forbidden-string violation${violations.length === 1 ? "" : "s"}:`);
  lines.push("");
  for (const v of violations) {
    lines.push(`  ${v.file}:${v.line}:${v.column}  [${v.category}]`);
    lines.push(`    term:    "${v.term}"`);
    lines.push(`    reason:  ${v.reason}`);
    lines.push(`    context: …${v.context}…`);
    lines.push("");
  }
  return lines.join("\n");
}

export function lint(roots: string[] = DEFAULT_ROOTS): Violation[] {
  const glossary = loadGlossary();
  const files: string[] = [];
  for (const root of roots) {
    const abs = resolve(PROJECT_ROOT, root);
    try {
      const st = statSync(abs);
      if (st.isDirectory()) walk(abs, files);
      else if (st.isFile()) files.push(abs);
    } catch {
      // Root missing — skip silently.
    }
  }

  const violations: Violation[] = [];
  for (const f of files) {
    violations.push(...lintFile(f, glossary));
  }
  return violations;
}

function isMain(): boolean {
  const argvFile = process.argv[1];
  if (!argvFile) return false;
  // realpath both sides — macOS symlinks /tmp -> /private/tmp can otherwise mask a true match.
  try {
    return realpathSync(argvFile) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return resolve(argvFile) === resolve(fileURLToPath(import.meta.url));
  }
}

if (isMain()) {
  const args = process.argv.slice(2);
  const roots = args.length > 0 ? args : DEFAULT_ROOTS;
  const violations = lint(roots);

  if (violations.length === 0) {
    const checked = roots.join(", ");
    process.stdout.write(`✓ lint-glossary: no violations across [${checked}]\n`);
    process.exit(0);
  } else {
    process.stderr.write(formatViolations(violations));
    process.stderr.write(`\nDean-facing surface must use the v5/v6 §17 glossary substitutes.\n`);
    process.stderr.write(`See content/glossary.json and design.v6.md §13.\n`);
    process.exit(1);
  }
}
