// Phase 3 UI — citations.js lookup + hydration.

import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  setCitationsForTesting,
  loadCitations,
  lookupCitation,
  hydrateCitations,
} from '../../web/js/citations.js';

class FakeAnchor {
  attrs = new Map<string, string>();
  constructor(initial: Record<string, string>) {
    for (const [k, v] of Object.entries(initial)) this.attrs.set(k, v);
  }
  getAttribute(name: string): string | null {
    return this.attrs.has(name) ? this.attrs.get(name)! : null;
  }
  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }
}

class FakeRoot {
  constructor(private anchors: FakeAnchor[]) {}
  querySelectorAll(_selector: string): { forEach: (cb: (a: FakeAnchor) => void) => void } {
    return {
      forEach: (cb) => this.anchors.forEach(cb),
    };
  }
}

const realCitations = JSON.parse(
  readFileSync(resolve(__dirname, '..', '..', 'content', 'citations.json'), 'utf8'),
);

beforeEach(() => {
  setCitationsForTesting(null);
});

describe('citations — case-insensitive lookup', () => {
  it('resolves panel-theme uppercase keys against lowercase input', async () => {
    setCitationsForTesting({
      mdoc_anchors: {
        'M01#EXPANSION-LOGIC': {
          mdoc: 'M01',
          convention: 'panel-theme',
          title: 'Expansion-logic walk-through',
          file: 'content/mdocs/M01.html',
        },
      },
    });
    const cits = await loadCitations('cache-hit');
    expect(lookupCitation(cits, 'm01#expansion-logic')).toBeDefined();
    expect(lookupCitation(cits, 'M01#EXPANSION-LOGIC')).toBeDefined();
  });

  it('returns null for unknown keys', async () => {
    setCitationsForTesting({ mdoc_anchors: {} });
    const cits = await loadCitations('cache-hit');
    expect(lookupCitation(cits, 'M99#nope')).toBeNull();
  });

  it('every panel-anchor data-cite key (M##/R##) resolves against real citations.json', async () => {
    // Mirror scripts/validate-panel-anchors.mjs: filter to /^[mr]\d+#/i.
    // External document anchors (obbba:, nprm:, cfr:, irc:) hydrate from
    // `sources`, not `mdoc_anchors`, and are out of scope here.
    setCitationsForTesting(realCitations);
    const cits = await loadCitations('cache-hit');
    const panelHtmls = ['M01', 'M03', 'M04', 'M05', 'M07', 'M12', 'M13', 'M14', 'M18'].map(
      (id) => readFileSync(resolve(__dirname, '..', '..', 'content', 'mdocs', `${id}.html`), 'utf8'),
    );
    const panelAnchorKeys: string[] = [];
    for (const html of panelHtmls) {
      const re = /data-cite="([^"]+)"/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) !== null) {
        if (/^[mr]\d+#/i.test(m[1]!)) panelAnchorKeys.push(m[1]!);
      }
    }
    expect(panelAnchorKeys.length).toBeGreaterThan(0);
    const unresolved = panelAnchorKeys.filter((k) => lookupCitation(cits, k) === null);
    expect(unresolved).toEqual([]);
  });
});

describe('citations — hydrateCitations sets title attributes', () => {
  it('annotates a.cite[data-cite] with title from citations.json', async () => {
    setCitationsForTesting({
      mdoc_anchors: {
        'M01#EXPANSION-LOGIC': {
          mdoc: 'M01',
          title: 'Expansion-logic walk-through',
          section_heading: 'M01 — The rule',
          file: 'content/mdocs/M01.html',
        },
      },
    });
    const a = new FakeAnchor({ 'data-cite': 'm01#expansion-logic', href: '#' });
    const root = new FakeRoot([a]);
    const cits = await loadCitations('cache-hit');
    const resolved = hydrateCitations(root as unknown as Element, cits);
    expect(resolved).toBe(1);
    expect(a.getAttribute('title')).toContain('Expansion-logic walk-through');
  });

  it('does not throw on null citations or null root', () => {
    expect(() => hydrateCitations(null as unknown as Element, null)).not.toThrow();
  });
});
