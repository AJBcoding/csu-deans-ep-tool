// Type declarations for web/js/panels.js.

export function setPanelForTesting(id: string, html: string | null): void;
export function autoTriggeredIds(): string[];
export function learnMoreIds(): string[];
export function isAutoTriggered(id: string): boolean;
export function loadPanel(id: string, basePath?: string): Promise<string>;
export function loadAllLearnMore(basePath?: string): Promise<string[]>;
