// ── Centralized constants (deerbox core) ─────────────────────────────
// VERSION, HOME, DEFAULT_MODEL are duplicated in src/constants.ts — keep in sync

import pkg from "../package.json";

/** Package version, inlined at build time */
export const VERSION = pkg.version;

/** HOME directory fallback */
export const HOME = process.env.HOME ?? "/root";

/** Default Claude model to use */
export const DEFAULT_MODEL = "sonnet";

/** Max number of polls to wait for the bypass permissions dialog */
export const BYPASS_DIALOG_MAX_POLLS = 15;

/** Delay between polls when looking for the bypass dialog */
export const BYPASS_DIALOG_POLL_MS = 500;

/** Delay between keystrokes when dismissing the bypass dialog */
export const BYPASS_DIALOG_KEY_DELAY_MS = 200;
