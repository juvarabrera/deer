/**
 * Generate a unique, sortable, URL-safe task ID.
 *
 * Format: `deer_<base36-timestamp><random-suffix>`
 * @duplicate src/task.ts — keep both in sync
 */
export function generateTaskId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.getRandomValues(new Uint8Array(6));
  const suffix = Array.from(random)
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 8);
  return `deer_${timestamp}${suffix}`;
}

/**
 * Returns the base data directory for deer task storage.
 * @duplicate src/task.ts — keep both in sync
 * @example "/home/user/.local/share/deer"
 */
export function dataDir(): string {
  const home = process.env.HOME;
  return `${home}/.local/share/deer`;
}
