import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";

const PROJECT_ROOT = resolve(__dirname, "..");

interface RunResult {
  stdout: string;
  stderr: string;
  status: number;
}

function runLinter(targetDir: string, scanRoots: string[]): RunResult {
  // Run the linter against the given target dir by spawning tsx.
  // We simulate a project root by copying the script + glossary into targetDir.
  const cmd = `tsx "${join(targetDir, "scripts", "lint-glossary.ts")}" ${scanRoots
    .map((r) => `"${r}"`)
    .join(" ")}`;
  try {
    const stdout = execSync(cmd, { cwd: targetDir, encoding: "utf8" });
    return { stdout, stderr: "", status: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      status: e.status ?? 1,
    };
  }
}

let workspace: string;

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), "lint-glossary-"));
  mkdirSync(join(workspace, "scripts"), { recursive: true });
  mkdirSync(join(workspace, "content", "mdocs"), { recursive: true });

  cpSync(
    join(PROJECT_ROOT, "scripts", "lint-glossary.ts"),
    join(workspace, "scripts", "lint-glossary.ts")
  );
  cpSync(
    join(PROJECT_ROOT, "content", "glossary.json"),
    join(workspace, "content", "glossary.json")
  );
  cpSync(
    join(PROJECT_ROOT, "content", "mdocs", "SCHEMA.md"),
    join(workspace, "content", "mdocs", "SCHEMA.md")
  );
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

describe("lint-glossary", () => {
  it("passes on an empty content directory", () => {
    const result = runLinter(workspace, ["content"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("no violations");
  });

  it("passes on the production panels (regression: real corpus must lint clean)", () => {
    cpSync(
      join(PROJECT_ROOT, "content", "mdocs"),
      join(workspace, "content", "mdocs"),
      { recursive: true }
    );
    const result = runLinter(workspace, ["content"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("no violations");
  });

  it("flags forbidden literal 'cascade' in a panel body", () => {
    writeFileSync(
      join(workspace, "content", "mdocs", "M99.html"),
      `<article class="mdoc-panel"><p>The cascade fires here.</p></article>\n`
    );
    const result = runLinter(workspace, ["content"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("cascade");
    expect(result.stderr).toContain("M99.html");
  });

  it("flags forbidden literal 'OPEID6' even uppercase", () => {
    writeFileSync(
      join(workspace, "content", "mdocs", "M99.html"),
      `<p>Use OPEID6 to identify institutions.</p>\n`
    );
    const result = runLinter(workspace, ["content"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("OPEID6");
  });

  it("flags condescending 'simply' in Dean-facing prose", () => {
    writeFileSync(
      join(workspace, "content", "mdocs", "M99.html"),
      `<p>The rule simply applies the test.</p>\n`
    );
    const result = runLinter(workspace, ["content"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("simply");
  });

  it("flags glossary-internal 'Cohort cascade' as a label", () => {
    writeFileSync(
      join(workspace, "content", "mdocs", "M99.html"),
      `<p>The Cohort cascade runs in four steps.</p>\n`
    );
    const result = runLinter(workspace, ["content"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr.toLowerCase()).toContain("cohort cascade");
  });

  it("does NOT flag forbidden tokens inside data-cite attribute values", () => {
    // data-cite values are internal-namespace by design; the linter must skip them.
    writeFileSync(
      join(workspace, "content", "mdocs", "M99.html"),
      `<a data-cite="opeid6:001139" href="#">institution identifier</a>\n`
    );
    const result = runLinter(workspace, ["content"]);
    expect(result.status).toBe(0);
  });

  it("does NOT flag forbidden tokens inside <code> blocks", () => {
    writeFileSync(
      join(workspace, "content", "mdocs", "M99.html"),
      `<p>Source field: <code>t4enrl_inst_instate_p1819</code> on the federal data row.</p>\n`
    );
    const result = runLinter(workspace, ["content"]);
    expect(result.status).toBe(0);
  });

  it("does NOT flag forbidden tokens inside HTML comments", () => {
    writeFileSync(
      join(workspace, "content", "mdocs", "M99.html"),
      `<!-- internal note: cascade behavior -->\n<p>The rule's expansion runs in four steps.</p>\n`
    );
    const result = runLinter(workspace, ["content"]);
    expect(result.status).toBe(0);
  });

  it("returns non-zero with multiple violations counted in the header", () => {
    writeFileSync(
      join(workspace, "content", "mdocs", "M99.html"),
      `<p>The cascade is complex and easy to miss.</p>\n`
    );
    const result = runLinter(workspace, ["content"]);
    expect(result.status).not.toBe(0);
    // 3 violations: cascade, complex, easy
    expect(result.stderr).toMatch(/3 forbidden-string violations/);
  });
});
