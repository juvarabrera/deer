export interface RepoInfo {
  repoPath: string;
  defaultBranch: string;
}

/**
 * Detect the git repository by walking up from `startDir`.
 * @duplicate packages/deerbox/src/git/worktree.ts detectRepo() — keep both in sync
 */
export async function detectRepo(startDir: string): Promise<RepoInfo> {
  const result =
    await Bun.$`git -C ${startDir} rev-parse --show-toplevel`.quiet().nothrow();

  if (result.exitCode !== 0) {
    throw new Error(`Not a git repository (searched from ${startDir})`);
  }

  const repoPath = result.stdout.toString().trim();

  const branchResult =
    await Bun.$`git -C ${repoPath} symbolic-ref refs/remotes/origin/HEAD`.quiet().nothrow();

  let defaultBranch: string;
  if (branchResult.exitCode === 0) {
    defaultBranch = branchResult.stdout
      .toString()
      .trim()
      .replace("refs/remotes/origin/", "");
  } else {
    const mainCheck =
      await Bun.$`git -C ${repoPath} show-ref --verify --quiet refs/heads/main`.quiet().nothrow();
    defaultBranch = mainCheck.exitCode === 0 ? "main" : "master";
  }

  return { repoPath, defaultBranch };
}
