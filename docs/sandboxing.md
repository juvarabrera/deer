---
layout: default
title: Sandboxing
nav_order: 3
---

# Sandboxing

Each `deer` agent runs inside an isolated sandbox powered by the [Anthropic Sandbox Runtime (SRT)](https://github.com/anthropic-ai/sandbox-runtime). The sandbox gives agents enough access to do real work while protecting the rest of your system.

SRT handles cross-platform isolation automatically:

- **macOS** — `sandbox-exec` with dynamic [Seatbelt](https://www.chromium.org/developers/design-documents/sandbox/osx-sandboxing-design/) profiles
- **Linux** — [bubblewrap](https://github.com/containers/bubblewrap) with mount namespaces + seccomp

---

## Filesystem

The agent gets a strictly scoped view of the filesystem. Only two locations are writable:

| Path | Access |
|------|--------|
| `~/.local/share/deer/tasks/<taskId>/worktree/` | Read + **write** — the agent's git worktree |
| `~/.claude/`, `~/.claude.json`, `/tmp` | Read + **write** — Claude Code state |
| `~/.claude*` (config, settings) | Read-only |
| Main repo `.git/` directory | Read-only — needed for worktree operations |
| System binaries and libraries | Read-only |
| Everything else in `$HOME` | **Denied** |

### How home directory blocking works

At sandbox launch, deer enumerates every entry under `$HOME` and denies read access to all of them except:

1. Entries beginning with `.claude` (Claude Code config)
2. Entries that are ancestors of a required path (the worktree, the repo `.git` dir, deer's data dir)

This is done dynamically, so any new dotfiles or credential directories you add (`.ssh`, `.aws`, `.config`, `.docker`, `.npmrc`, etc.) are automatically blocked without needing an explicit deny list.

```
$HOME/
├── .claude/              ✅ readable (Claude Code config)
├── .claude.json          ✅ readable
├── .local/share/deer/    ✅ readable (deer data dir — contains the worktree)
│   └── tasks/<id>/
│       └── worktree/     ✅ writable
├── .ssh/                 ❌ denied
├── .aws/                 ❌ denied
├── .config/              ❌ denied
├── .npmrc                ❌ denied
└── my-other-project/     ❌ denied
```

### Environment variables

The tmux session is launched with `env -i` — a completely empty environment. Only an explicit allowlist of variables is forwarded into the sandbox:

- `PATH`, `HOME`, `TERM` — system essentials
- Variables listed in `env_passthrough` / `env_passthrough_extra` in your config

Host secrets (`AWS_SECRET_ACCESS_KEY`, `DATABASE_URL`, etc.) are never visible to the agent via `/proc/self/environ` or inherited env.

---

## Network

Outbound network access is filtered through an allowlist. Only domains you explicitly permit are reachable — everything else is blocked by the SRT proxy.

### Default allowlist

The built-in allowlist covers what Claude Code needs to function:

```
api.anthropic.com
statsig.anthropic.com
sentry.io
registry.npmjs.org
github.com
... (full list in src/constants.ts)
```

You can extend it per-repo in `deer.toml`:

```toml
[network]
allowlist_extra = ["npm.pkg.github.com", "pypi.org"]
```

Or replace it entirely in your global `~/.config/deer/config.toml`.

### The auth proxy (MITM)

Credentials never enter the sandbox. Instead, deer runs a **host-side authenticating proxy** that intercepts requests to credentialed domains and injects the real auth headers transparently.

```
┌─────────────────────────────────────────────────────────────────┐
│  Sandbox (SRT)                                                  │
│                                                                 │
│  ┌─────────────┐    HTTP (no token)    ┌────────────────────┐  │
│  │ Claude Code │ ──────────────────▶  │    SRT Proxy       │  │
│  │             │  http://api.         │  (domain filter)   │  │
│  │  ANTHROPIC_ │  anthropic.com/...   │                    │  │
│  │  BASE_URL=  │                      │  allowedDomains ✅  │  │
│  │  http://... │                      │  blockedDomains ❌  │  │
│  └─────────────┘                      └────────────────────┘  │
│                                                 │               │
└────────────────────────────────────────────────┼───────────────┘
                                                 │ forwarded to mitmProxy
                                                 │ (Unix socket)
                                    ┌────────────▼───────────────┐
                                    │  Auth Proxy (host process) │
                                    │                            │
                                    │  injects headers:          │
                                    │  Authorization: Bearer ••• │
                                    │  x-api-key: sk-ant-•••     │
                                    └────────────────────────────┘
                                                 │ HTTPS + real token
                                    ┌────────────▼───────────────┐
                                    │  api.anthropic.com         │
                                    │  (real upstream)           │
                                    └────────────────────────────┘
```

**How it works step by step:**

1. The sandbox sets `ANTHROPIC_BASE_URL=http://api.anthropic.com` (plain HTTP, no token).
2. Claude Code sends API requests without any auth header — it has no credentials.
3. The SRT proxy receives the request, checks `api.anthropic.com` against the domain allowlist — it matches.
4. Because `api.anthropic.com` is also in the `mitmProxy` config, SRT forwards the request to the auth proxy's Unix socket instead of making the request directly.
5. The auth proxy (a Node.js process running on the **host**, outside the sandbox) reads the real OAuth token or API key from the host environment.
6. It injects the `Authorization` / `x-api-key` header and makes the real HTTPS request to `api.anthropic.com`.
7. The response flows back through the chain to Claude Code.

The Unix socket is the only channel between sandbox and proxy. The sandbox can make requests through it, but it cannot read the token value — the socket only speaks HTTP.

### Adding credentials for private registries

You can configure additional upstreams in `deer.toml` to proxy private package registries or APIs without exposing tokens to the agent:

```toml
[[sandbox.proxy_credentials_extra]]
domain = "npm.pkg.github.com"
target = "https://npm.pkg.github.com"
[sandbox.proxy_credentials_extra.hostEnv]
key = "GITHUB_TOKEN"
[sandbox.proxy_credentials_extra.headerTemplate]
authorization = "Bearer ${value}"
[sandbox.proxy_credentials_extra.sandboxEnv]
key = "NPM_CONFIG_REGISTRY"
value = "http://npm.pkg.github.com"
```

With this config:
- `GITHUB_TOKEN` stays on the host — it is never passed into the sandbox.
- The sandbox's `npm` is pointed at `http://npm.pkg.github.com` (plain HTTP).
- The auth proxy intercepts those requests and injects `Authorization: Bearer <token>` before forwarding to the real registry over HTTPS.
