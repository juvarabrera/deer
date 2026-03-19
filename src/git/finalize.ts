/**
 * Re-export finalize functions from deerbox.
 * The implementation lives in packages/deerbox/src/git/finalize.ts.
 */
export {
  createPullRequest,
  updatePullRequest,
  pushBranchUpdates,
  hasChanges,
  findPRTemplate,
  ensureDeerEmojiPrefix,
  parsePRMetadataResponse,
  buildClaudeSubprocessEnv,
} from "deerbox";
export type {
  CreatePRResult,
  CreatePROptions,
  UpdatePROptions,
  PushBranchOptions,
} from "deerbox";
