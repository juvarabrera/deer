---
title: Security
nav_order: 5
---

# Security model
{: .no_toc }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

deer runs every agent with `--dangerously-skip-permissions`, which tells Claude Code to execute file operations, run shell commands, and make network requests without confirmation prompts. This mode is normally unsafe because it gives an AI unrestricted access to your system.

deer makes it safe by wrapping the agent in a multi-layer sandbox:

<div class="flow-diagram">
┌─────────────────────────────────────────────────────────────┐
│                         HOST                                │
│                                                             │
│  deer dashboard ────► tmux session ────► SRT sandbox        │
│                                              │              │
│  Auth proxy (Unix socket) ◄─────────────────┘              │
│       │                   (credentialed domains)            │
│       ▼                                                     │
│  Real HTTPS upstream                                        │
└─────────────────────────────────────────────────────────────┘
</div>

The four pillars of deer's security model are:

1. **Filesystem isolation** — agents can only write to their worktree
2. **Network isolation** — only allowlisted domains are reachable
3. **Credential isolation** — secrets never enter the sandbox
4. **Environment isolation** — host env vars are not leaked

---

## Filesystem isolation

Each agent's sandbox restricts filesystem access as follows:

**Writable paths** (agent can read and write):
- `~/.local/share/deer/tasks/<taskId>/worktree/` — the agent's git worktree
- `~/.claude/` — Claude Code's configuration and conversation history
- `~/.claude.json` — Claude Code's global settings file
- `/tmp` and `/private/tmp` — temporary files

**Readable paths** (agent can read but not write):
- `~/.claude*` — Claude Code credentials and settings
- The repo's `.git/` directory — so git worktree operations work
- System directories (`/usr`, `/etc`, etc.)

**Denied paths** (agent cannot access at all):
- `~/.ssh/` — SSH private keys
- `~/.aws/` — AWS credentials
- `~/.config/` — application config that may contain secrets
- `~/.docker/` — Docker credentials
- `~/.npmrc` — npm auth tokens
- `~/.git-credentials` — git credential store
- All other `~` entries not required for operation

The deny list is **dynamically built** by enumerating `$HOME` at runtime. Any new dotfile directories you create are automatically blocked — there is no manual list to maintain.

<div class="callout callout-warning">
  <p><strong>Exception:</strong> The <code>~/.claude*</code> directories are readable because Claude Code needs access to its own config and session history. This is intentional — Claude Code's data is not secret.</p>
</div>

---

## Network isolation

Outbound network traffic from agents is filtered through the SRT proxy. Only domains on the allowlist can be reached.

### Default allowlist

| Domain | Purpose |
|--------|---------|
| `api.anthropic.com` | Claude API |
| `claude.ai` | OAuth token refresh |
| `statsig.anthropic.com` | Feature flags |
| `sentry.io` | Error reporting |
| `registry.npmjs.org` | npm packages |

### How it works (SRT)

The Anthropic Sandbox Runtime (SRT) starts a local HTTP/SOCKS5 proxy that intercepts all outbound connections from the sandboxed process. Requests to non-allowlisted domains are dropped with a connection refused error.

On macOS, SRT uses `sandbox-exec` (Seatbelt profiles). On Linux, it uses `bwrap` (bubblewrap) with mount namespaces and a seccomp filter. In both cases, the proxy is the only path to the network.

### Extending the allowlist

Add domains in `deer.toml` for repo-specific needs:

```toml
[network]
allowlist_extra = ["registry.yarnpkg.com", "pkg.dev"]
```

This is **additive** — it extends the default list. To replace the list entirely, set `allowlist` (not `allowlist_extra`) in the global `~/.config/deer/config.toml`.

---

## Credential isolation

This is the most nuanced part of deer's security model.

### The problem

Claude Code needs credentials to call the Anthropic API. Normally these live in environment variables or config files that the agent process reads directly. In a sandboxed environment, we don't want to put real tokens inside the sandbox — a misbehaving agent could exfiltrate them.

### The solution: host-side MITM proxy

<div class="flow-diagram">
Agent (inside sandbox)
  │
  │  "I need to call the API"
  │  ANTHROPIC_BASE_URL = http://api.anthropic.com   ← HTTP (not HTTPS)
  │  CLAUDE_CODE_OAUTH_TOKEN = "proxy-managed"        ← placeholder, not real token
  ▼
SRT proxy (inside host process)
  │  Sees domain "api.anthropic.com" is in mitmProxy.domains
  ▼
Unix socket → Auth proxy (Node.js subprocess on host)
  │  Reads real token from host process.env
  │  Injects:  Authorization: Bearer sk-ant-oat01-...
  │  Forwards as HTTPS to api.anthropic.com
  ▼
Real Anthropic API ← HTTPS, authenticated
</div>

#### Step by step

1. **At startup**, deer resolves credentials from the host environment (`CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`).
2. A **Node.js auth proxy subprocess** is started on the host, listening on a Unix socket. It holds the real credentials in memory.
3. The sandbox is configured with:
   - `ANTHROPIC_BASE_URL=http://api.anthropic.com` — HTTP, routes through SRT's proxy
   - `CLAUDE_CODE_OAUTH_TOKEN=proxy-managed` — placeholder so Claude Code enters OAuth mode
4. When the agent calls the API, the request travels:
   - Agent → SRT proxy → Unix socket → Auth proxy → HTTPS → Anthropic
5. The auth proxy injects the real `Authorization` header before forwarding.
6. The agent never sees the real token. The real token never enters the sandbox.

#### Why Node.js for the proxy?

Bun's `node:http`/`node:https` polyfills break on long-lived streaming connections (Server-Sent Events), which Claude Code uses. The auth proxy runs as a real Node.js subprocess to avoid this.

### Multiple credential providers

When multiple credentials target the same domain (e.g., both an OAuth token and an API key could authenticate against `api.anthropic.com`), the **first one whose host env var is set wins**. By default, `CLAUDE_CODE_OAUTH_TOKEN` is checked before `ANTHROPIC_API_KEY`, so subscriptions take priority.

### Custom registries

You can add your own proxy credential entries in `deer.toml` to extend this mechanism to private npm registries, internal APIs, or any authenticated service. See [Configuration → Proxy credentials]({% link configuration.md %}#proxy-credentials) for details.

---

## Environment isolation

The tmux session for each agent is started with `env -i`, which clears the entire host environment. Only a minimal set of variables is re-exported:

| Variable | Value |
|----------|-------|
| `PATH` | Inherited from host |
| `HOME` | Host home directory |
| `TERM` | Inherited from host (or `xterm-256color`) |
| Variables in `env_passthrough` | Forwarded as-is from host |
| Proxy placeholder vars | `CLAUDE_CODE_OAUTH_TOKEN=proxy-managed`, etc. |
| Proxy base URL vars | `ANTHROPIC_BASE_URL=http://api.anthropic.com` |

This means AWS credentials, database URLs, GitHub tokens, and anything else in your shell environment are **not visible** to the agent unless you explicitly add them to `env_passthrough` or `env_passthrough_extra`.

<div class="callout callout-warning">
  <p><strong>Be careful with <code>env_passthrough</code>.</strong> Any variable you add is visible inside the sandbox and could be read by the agent. Only forward variables that are safe to expose.</p>
</div>

---

## Platform-specific details

### macOS (sandbox-exec / Seatbelt)

SRT generates a dynamic Seatbelt policy file (`.sb` format) from the settings JSON and passes it to `sandbox-exec`. Seatbelt is a macOS kernel-level sandbox — policy violations are blocked at the syscall level, not the libc level.

Requirements:
- `sandbox-exec` must be in `/usr/bin` (standard on all macOS versions)
- No additional packages needed

### Linux (bubblewrap / bwrap)

SRT uses `bwrap` to create a user namespace with custom mount points. The sandbox gets:
- A fresh `/` with bind mounts for allowed paths
- A network namespace (or network filtering via the proxy)
- A seccomp filter to block dangerous syscalls

Requirements:
- `bwrap` must be installed (see [Getting Started → Prerequisites]({% link getting-started.md %}#prerequisites))
- User namespaces must be enabled (enabled by default on most modern distributions)

---

## What the sandbox cannot prevent

deer's sandbox is strong, but not absolute. Be aware of these limitations:

1. **Prompt injection**: A malicious file in the repo could inject instructions into the agent's context. Review what you're asking the agent to process.
2. **Allowlisted domain abuse**: An agent can make arbitrary requests to any allowlisted domain (e.g., `registry.npmjs.org`). This could be used to exfiltrate data via package publish requests. The allowlist controls *which* domains are reachable, not *what* requests are made.
3. **Worktree content**: The agent can write anything to the worktree. Always review changes before creating a PR.
4. **`.claude/` access**: The agent can read and write Claude Code's own config directory, including conversation history. This is necessary for Claude Code to function.

For high-security environments, consider:
- Keeping the network allowlist minimal
- Using a dedicated machine or VM for deer
- Reviewing all agent output before merging PRs
