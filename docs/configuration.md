---
title: Configuration
nav_order: 4
---

# Configuration
{: .no_toc }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Configuration hierarchy

deer merges configuration from multiple sources. Later sources override earlier ones:

```
1. Built-in defaults
        ↓
2. ~/.config/deer/config.toml   (global — applies to all repos)
        ↓
3. <repo>/deer.toml             (repo-local — committed to the repo)
        ↓
4. CLI flags                    (per-invocation overrides)
```

This means you can set sensible global defaults while letting individual repos add registries, env vars, or setup commands without touching your global config.

---

## Global config (`~/.config/deer/config.toml`)

Create this file to configure defaults that apply across all repos.

```toml
[defaults]
# Base branch for PRs created by agents in repos that don't override it.
# Default: detected from the repo (usually "main")
base_branch = "main"

# Maximum time (ms) an agent is allowed to run before deer considers it timed out.
# Default: 1800000 (30 minutes)
timeout_ms = 1800000

# Shell command to run inside each worktree before the agent starts.
# Runs as a blocking setup step. Example: install dependencies.
# Default: "" (none)
setup_command = ""

[network]
# Complete replacement of the built-in network allowlist.
# If set, only domains listed here are reachable from agents.
# Omit this section to keep the built-in allowlist.
# See "Default network allowlist" below.
allowlist = [
  "api.anthropic.com",
  "claude.ai",
  "statsig.anthropic.com",
  "sentry.io",
  "registry.npmjs.org",
]

[sandbox]
# Sandbox runtime. Only "srt" is supported.
# Default: "srt"
runtime = "srt"

# Host environment variable names to forward into the sandbox.
# Only these vars (plus PATH, HOME, TERM) reach the sandboxed process.
# Variables listed under proxyCredentials are NOT forwarded this way —
# they are kept on the host and injected by the auth proxy.
# Default: [] (none)
env_passthrough = []
```

### Default network allowlist

When no `[network]` section is present in any config, agents can reach:

| Domain | Purpose |
|--------|---------|
| `api.anthropic.com` | Claude API (proxied via auth proxy) |
| `claude.ai` | Claude web (for OAuth token refresh) |
| `statsig.anthropic.com` | Claude Code feature flags |
| `sentry.io` | Claude Code error reporting |
| `registry.npmjs.org` | npm package registry |

---

## Repo-local config (`deer.toml`)

Place `deer.toml` in your repository root. It is safe to commit — it contains no secrets.

You only need this file if the defaults are not sufficient for your project.

```toml
# Override the base branch for this repo.
# Useful when your repo uses "master" instead of "main".
base_branch = "master"

# Run this command inside the worktree before the agent starts.
# The command is executed with the worktree as the working directory.
# Agents start only after this command exits successfully.
setup_command = "pnpm install"

[network]
# Extend the network allowlist for this repo.
# These domains are added to (not a replacement of) the global allowlist.
allowlist_extra = [
  "npm.pkg.github.com",
  "your-registry.example.com",
]

[sandbox]
# Forward additional host environment variables into the sandbox.
# Only the named variables are passed through.
env_passthrough_extra = ["NODE_ENV", "CI", "MY_FEATURE_FLAG"]
```

### Proxy credentials

For private package registries, internal APIs, or any service that requires authentication, you can configure the host-side auth proxy to inject credentials without exposing them inside the sandbox.

```toml
# Add an authenticated private registry.
# The sandbox never sees MY_REGISTRY_TOKEN — the proxy injects it.
[[sandbox.proxy_credentials_extra]]
domain = "your-registry.example.com"
target = "https://your-registry.example.com"

[sandbox.proxy_credentials_extra.hostEnv]
key = "MY_REGISTRY_TOKEN"           # host env var that holds the real token

[sandbox.proxy_credentials_extra.headerTemplate]
authorization = "Bearer ${value}"   # header injected into matching requests

[sandbox.proxy_credentials_extra.sandboxEnv]
key = "NPM_CONFIG_REGISTRY"                         # var set inside the sandbox
value = "http://your-registry.example.com"          # HTTP (not HTTPS) — routed via SRT proxy
```

<div class="callout">
  <p>The <code>sandboxEnv.value</code> uses <code>http://</code> (not <code>https://</code>). Requests leave the sandbox as plain HTTP routed through the SRT proxy, which forwards them to your MITM proxy, which re-encrypts and forwards to the real upstream over HTTPS. The sandbox agent tool never sees the raw token.</p>
</div>

You can add multiple `[[sandbox.proxy_credentials_extra]]` blocks for different registries.

---

## Full annotated `deer.toml` example

This is the complete `deer.toml.example` file included in the repository:

```toml
# deer.toml — Repo-local configuration for deer
# Place this file in your repository root. It is safe to commit.

# Override the default base branch for PRs created by this repo's agents.
# base_branch = "master"

# Command to run inside the worktree before the agent starts (e.g. install deps).
# setup_command = "pnpm install"

# Extend the network allowlist for this repo (merged with the global allowlist).
# [network]
# allowlist_extra = ["npm.pkg.github.com", "your-registry.example.com"]

# Forward additional host environment variables into the sandbox.
# Only the named vars are passed through — host secrets not listed here
# are not visible to the agent.
# [sandbox]
# env_passthrough_extra = ["NODE_ENV", "CI"]

# Inject extra credentials via the host-side auth proxy.
# The sandbox never sees the real token — the proxy intercepts requests to
# the domain and injects the real auth header before forwarding to the
# upstream over HTTPS.
#
# [[sandbox.proxy_credentials_extra]]
# domain = "your-registry.example.com"
# target = "https://your-registry.example.com"
# [sandbox.proxy_credentials_extra.hostEnv]
# key = "MY_REGISTRY_TOKEN"
# [sandbox.proxy_credentials_extra.headerTemplate]
# authorization = "Bearer ${value}"
# [sandbox.proxy_credentials_extra.sandboxEnv]
# key = "NPM_CONFIG_REGISTRY"
# value = "http://your-registry.example.com"
```

---

## Common recipes

### npm private registry (GitHub Packages)

```toml
# deer.toml
[network]
allowlist_extra = ["npm.pkg.github.com"]

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

Then set `GITHUB_TOKEN` on your host and run `deer`. The sandbox gets an `NPM_CONFIG_REGISTRY` pointing to the HTTP proxy, and `GITHUB_TOKEN=proxy-managed` as a placeholder — your real token never enters the sandbox.

### Python package index with auth

```toml
# deer.toml
[network]
allowlist_extra = ["pypi.internal.example.com"]

[sandbox]
env_passthrough_extra = ["POETRY_HTTP_BASIC_INTERNAL_PASSWORD"]

[[sandbox.proxy_credentials_extra]]
domain = "pypi.internal.example.com"
target = "https://pypi.internal.example.com"

[sandbox.proxy_credentials_extra.hostEnv]
key = "PYPI_TOKEN"

[sandbox.proxy_credentials_extra.headerTemplate]
authorization = "Basic ${value}"

[sandbox.proxy_credentials_extra.sandboxEnv]
key = "PIP_INDEX_URL"
value = "http://pypi.internal.example.com/simple"
```

### Offline / air-gapped setup

To completely disable external network access and only allow your internal services:

```toml
# ~/.config/deer/config.toml
[network]
allowlist = [
  "api.anthropic.com",   # required for Claude
  "internal.example.com",
]
```

Setting `allowlist` (not `allowlist_extra`) in the global config replaces the built-in list entirely.
