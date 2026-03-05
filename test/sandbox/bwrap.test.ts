import { test, expect, describe, afterEach } from "bun:test";
import { createBwrapRuntime } from "../../src/sandbox/bwrap";
import type { SandboxRuntimeOptions, SandboxCleanup } from "../../src/sandbox/runtime";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("bwrapRuntime.buildCommand", () => {
  const defaults: SandboxRuntimeOptions = {
    worktreePath: "/home/user/project",
    allowlist: ["api.anthropic.com", "github.com"],
  };

  test("returns bwrap as first arg", () => {
    const runtime = createBwrapRuntime();
    const args = runtime.buildCommand(defaults, ["echo", "test"]);
    expect(args[0]).toBe("bwrap");
  });

  test("mounts worktree read-write", () => {
    const runtime = createBwrapRuntime();
    const args = runtime.buildCommand(defaults, ["echo", "test"]);
    const bindIdx = args.lastIndexOf("--bind");
    // The last --bind should be the worktree (must overlay any prior ro-bind)
    expect(args[bindIdx + 1]).toBe(defaults.worktreePath);
    expect(args[bindIdx + 2]).toBe(defaults.worktreePath);
  });

  test("includes --die-with-parent", () => {
    const runtime = createBwrapRuntime();
    const args = runtime.buildCommand(defaults, ["echo", "test"]);
    expect(args).toContain("--die-with-parent");
  });

  test("sets HOME env var", () => {
    const runtime = createBwrapRuntime();
    const args = runtime.buildCommand(defaults, ["echo", "test"]);
    const idx = args.indexOf("HOME");
    expect(idx).toBeGreaterThan(0);
    expect(args[idx - 1]).toBe("--setenv");
  });

  test("unsets CLAUDECODE", () => {
    const runtime = createBwrapRuntime();
    const args = runtime.buildCommand(defaults, ["echo", "test"]);
    const idx = args.indexOf("CLAUDECODE");
    expect(idx).toBeGreaterThan(0);
    expect(args[idx - 1]).toBe("--unsetenv");
  });

  test("uses tmpfs for /tmp", () => {
    const runtime = createBwrapRuntime();
    const args = runtime.buildCommand(defaults, ["echo", "test"]);
    const idx = args.indexOf("/tmp");
    expect(idx).toBeGreaterThan(0);
    expect(args[idx - 1]).toBe("--tmpfs");
  });

  test("mounts repoGitDir read-only when provided", () => {
    const runtime = createBwrapRuntime();
    const args = runtime.buildCommand(
      { ...defaults, repoGitDir: "/usr" },
      ["echo", "test"],
    );
    // Find --ro-bind /usr /usr
    const roBind = args.reduce<string[]>((acc, arg, i) => {
      if (arg === "--ro-bind" && args[i + 1] === "/usr") acc.push(args[i + 1]);
      return acc;
    }, []);
    expect(roBind.length).toBeGreaterThan(0);
  });

  test("passes env vars via --setenv", () => {
    const runtime = createBwrapRuntime();
    const args = runtime.buildCommand(
      { ...defaults, env: { MY_TOKEN: "secret123" } },
      ["echo", "test"],
    );
    const idx = args.indexOf("MY_TOKEN");
    expect(idx).toBeGreaterThan(0);
    expect(args[idx - 1]).toBe("--setenv");
    expect(args[idx + 1]).toBe("secret123");
  });

  test("inner command comes after -- separator", () => {
    const runtime = createBwrapRuntime();
    const args = runtime.buildCommand(defaults, ["claude", "--model", "sonnet"]);
    const sepIdx = args.indexOf("--");
    expect(sepIdx).toBeGreaterThan(0);
    expect(args.slice(sepIdx + 1)).toEqual(["claude", "--model", "sonnet"]);
  });
});

describe("bwrap integration", () => {
  const tmpDirs: string[] = [];
  const cleanups: SandboxCleanup[] = [];

  afterEach(async () => {
    for (const c of cleanups) c();
    cleanups.length = 0;
    for (const d of tmpDirs) {
      await rm(d, { recursive: true, force: true }).catch(() => {});
    }
    tmpDirs.length = 0;
  });

  async function makeTmpDir(): Promise<string> {
    const d = await mkdtemp(join(tmpdir(), "deer-bwrap-test-"));
    tmpDirs.push(d);
    return d;
  }

  test("bwrap can run a simple command in the sandbox", async () => {
    const dir = await makeTmpDir();
    await writeFile(join(dir, "test.txt"), "hello");

    const runtime = createBwrapRuntime();
    const cleanup = await runtime.prepare!({ worktreePath: dir, allowlist: [] });
    cleanups.push(cleanup);

    const args = runtime.buildCommand(
      { worktreePath: dir, allowlist: [] },
      ["cat", join(dir, "test.txt")],
    );

    const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
    const code = await proc.exited;
    const stdout = await new Response(proc.stdout).text();

    expect(code).toBe(0);
    expect(stdout).toContain("hello");
  });

  test("bwrap can write files inside the worktree", async () => {
    const dir = await makeTmpDir();
    const runtime = createBwrapRuntime();
    const cleanup = await runtime.prepare!({ worktreePath: dir, allowlist: [] });
    cleanups.push(cleanup);

    const args = runtime.buildCommand(
      { worktreePath: dir, allowlist: [] },
      ["sh", "-c", `echo "written" > ${dir}/output.txt`],
    );

    const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
    await proc.exited;

    const content = await readFile(join(dir, "output.txt"), "utf-8");
    expect(content.trim()).toBe("written");
  });

  test("bwrap has isolated /tmp", async () => {
    const dir = await makeTmpDir();
    // Write a marker to the host /tmp
    const marker = `deer-bwrap-test-${Date.now()}`;
    await writeFile(`/tmp/${marker}`, "host-side");

    const runtime = createBwrapRuntime();
    const cleanup = await runtime.prepare!({ worktreePath: dir, allowlist: [] });
    cleanups.push(cleanup);

    const args = runtime.buildCommand(
      { worktreePath: dir, allowlist: [] },
      ["sh", "-c", `ls /tmp/${marker} 2>&1; echo exit=$?`],
    );

    const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
    const stdout = await new Response(proc.stdout).text();
    await proc.exited;

    // Host /tmp file should NOT be visible inside the sandbox
    expect(stdout).toContain("No such file");

    // Clean up host marker
    await rm(`/tmp/${marker}`).catch(() => {});
  });

  test("bwrap cannot write to /etc", async () => {
    const dir = await makeTmpDir();
    const runtime = createBwrapRuntime();
    const cleanup = await runtime.prepare!({ worktreePath: dir, allowlist: [] });
    cleanups.push(cleanup);

    const args = runtime.buildCommand(
      { worktreePath: dir, allowlist: [] },
      ["sh", "-c", "echo pwned > /etc/deer-escape-test 2>&1; echo exit=$?"],
    );

    const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
    const stdout = await new Response(proc.stdout).text();
    await proc.exited;

    expect(stdout).toMatch(/exit=[12]/);
  });

  test("bwrap passes environment variables into sandbox", async () => {
    const dir = await makeTmpDir();
    const runtime = createBwrapRuntime();
    const cleanup = await runtime.prepare!({ worktreePath: dir, allowlist: [] });
    cleanups.push(cleanup);

    const args = runtime.buildCommand(
      { worktreePath: dir, allowlist: [], env: { DEER_TEST: "it_works" } },
      ["sh", "-c", "echo $DEER_TEST"],
    );

    const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
    const stdout = await new Response(proc.stdout).text();
    await proc.exited;

    expect(stdout.trim()).toBe("it_works");
  });
});
