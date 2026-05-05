// cp-j0gw.15 — plain-language standalone explainer pages structural test.
// Each explainer page must surface the same shared patterns: public-data
// badge, top-disclaimer, breadcrumb, verify-against-primary-sources callout,
// and a topic-specific anchor heading.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const EXPLAINER_DIR = resolve(__dirname, '..', '..', 'web', 'explainers');

function read(name: string): string {
  return readFileSync(resolve(EXPLAINER_DIR, name), 'utf8');
}

const PAGES = [
  {
    file: 'M01.html',
    title: /M01\s*—\s*How a program is counted/,
    topicAnchor: /four-step expansion/i,
    sourcesAnchor: /668\.403\(d\)|fail_obbb_cip2_wageb/,
  },
  {
    file: 'M03.html',
    title: /M03\s*—\s*How the benchmark is selected/,
    topicAnchor: /lowest of three/i,
    sourcesAnchor: /84001\(c\)\(3\)\(B\)|668\.402\(c\)\(3\)/,
  },
  {
    file: 'M18.html',
    title: /M18\s*—\s*When program failure could spread/,
    topicAnchor: /five[- ]?frame|five frames/i,
    sourcesAnchor: /668\.16\(t\)|Loper Bright|State Farm/,
  },
];

describe('cp-j0gw.15 — plain-language explainer pages', () => {
  for (const page of PAGES) {
    describe(page.file, () => {
      const html = read(page.file);

      it('has the public-data-badge', () => {
        expect(html).toMatch(/class="public-data-badge"/);
        expect(html).toMatch(/Public data only/);
      });

      it('has the top-disclaimer (not attorneys, not legislative analysts)', () => {
        expect(html).toMatch(/class="top-disclaimer"/);
        expect(html).toMatch(
          /not attorneys.{0,5}not legislative analysts/i,
        );
      });

      it('has a breadcrumb back to home and learn library', () => {
        expect(html).toMatch(/href="\.\.\/index\.html"/);
        expect(html).toMatch(/href="\.\.\/learn\.html"/);
      });

      it('has the topic-specific title and anchor', () => {
        expect(html).toMatch(page.title);
        expect(html).toMatch(page.topicAnchor);
      });

      it('has a verify-against-primary-sources callout linking to sources.html', () => {
        expect(html).toMatch(/class="verify-callout"/);
        expect(html).toMatch(/Verify against primary sources/);
        // The callout body must link to the public-sources page.
        const calloutMatch = html.match(
          /<aside class="verify-callout"[\s\S]*?<\/aside>/,
        );
        expect(calloutMatch).not.toBeNull();
        expect(calloutMatch![0]).toMatch(/href="\.\.\/sources\.html"/);
        expect(calloutMatch![0]).toMatch(page.sourcesAnchor);
      });

      it('loads main.css and explainers.css', () => {
        expect(html).toMatch(/href="\.\.\/css\/main\.css"/);
        expect(html).toMatch(/href="\.\.\/css\/explainers\.css"/);
      });

      it('has the primary-source-reminder footer', () => {
        expect(html).toMatch(
          /Re-derive against primary sources before any external submission/,
        );
      });
    });
  }
});
