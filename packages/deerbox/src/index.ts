// Main entrypoint
export { prepare, taskWorktreePath } from "./session";
export type { PrepareOptions, PreparedSession } from "./session";

// Startup
export { detectRepo, createWorktree, removeWorktree, cleanupWorktree } from "./git/worktree";
export type { RepoInfo, WorktreeInfo } from "./git/worktree";
export { loadConfig, DEFAULT_CONFIG } from "./config";
export type { DeerConfig, ProxyCredential } from "./config";
export { runPreflight, resolveCredentials } from "./preflight";
export type { PreflightResult } from "./preflight";

// Sandbox primitives
export type { SandboxRuntime, SandboxRuntimeOptions, SandboxCleanup } from "./sandbox/runtime";
export { createSrtRuntime } from "./sandbox/srt";
export { resolveRuntime } from "./sandbox/resolve";
export { startAuthProxy } from "./sandbox/auth-proxy";
export { resolveProxyUpstreams } from "./proxy";
export type { ProxyUpstream, AuthProxy } from "./sandbox/auth-proxy";

// Ecosystems
export { applyEcosystems, BUILTIN_PLUGINS } from "./ecosystems";
export type { EcosystemPlugin, EcosystemResult } from "./ecosystems";

// Utilities
export { generateTaskId, dataDir } from "./task";
export { detectLang } from "./i18n";
export type { Lang } from "./i18n";
export { VERSION, HOME, DEFAULT_MODEL } from "./constants";
