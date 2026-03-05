import type { DeerConfig } from "../config";
import type { SandboxRuntime } from "./runtime";
import { nonoRuntime } from "./nono";
import { createBwrapRuntime } from "./bwrap";

/**
 * Resolve a SandboxRuntime from the config's runtime name.
 *
 * Note: bwrap returns a new instance each time (each has its own proxy).
 * nono is a singleton (stateless).
 */
export function resolveRuntime(config: DeerConfig): SandboxRuntime {
  switch (config.sandbox.runtime) {
    case "bwrap":
      return createBwrapRuntime();
    case "nono":
      return nonoRuntime;
    default:
      throw new Error(`Unknown sandbox runtime: ${config.sandbox.runtime}`);
  }
}
