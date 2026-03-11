---
title: Getting Started
nav_order: 2
---

# Getting Started
{: .no_toc }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Prerequisites

Before installing deer, make sure the following tools are installed:

| Tool | Required | Notes |
|------|----------|-------|
| [Bun](https://bun.sh) | Yes | Used for the install command |
| [Claude Code](https://claude.ai/code) (`claude`) | Yes | The agent that deer runs |
| [GitHub CLI](https://cli.github.com/) (`gh`) | Yes | For PR creation (`gh auth login` required) |
| [tmux](https://github.com/tmux/tmux) | Yes | Runs each agent in an isolated session |
| [Node.js](https://nodejs.org) | Yes | Powers the auth proxy subprocess |
| **macOS**: sandbox-exec | Yes | Built-in macOS sandbox (in `/usr/bin`) |
| **Linux**: bubblewrap (`bwrap`) | Yes | Install via your package manager |

### Installing bubblewrap on Linux

```sh
# Ubuntu / Debian
sudo apt install bubblewrap

# Fedora / RHEL
sudo dnf install bubblewrap

# Arch
sudo pacman -S bubblewrap
```

---

## Installation

```sh
bunx @zdavison/deer install
```

This single command:

1. Downloads the pre-built binary for your platform.
2. Places it at `~/.local/bin/deer` (or `/usr/local/bin/deer` if you have write access).
3. Installs the Anthropic Sandbox Runtime into `~/.local/share/deer/`.

### Supported platforms

| OS | Architecture |
|----|-------------|
| macOS | x64, arm64 |
| Linux | x64, arm64 |

### Verify the installation

```sh
deer --version
```

---

## Authentication

deer uses your Claude credentials to power agents. It checks for credentials in this priority order:

### 1. `CLAUDE_CODE_OAUTH_TOKEN` environment variable

```sh
export CLAUDE_CODE_OAUTH_TOKEN="sk-ant-oat01-..."
```

### 2. `~/.claude/agent-oauth-token` file

Create a plain-text file containing just the token:

```sh
echo "sk-ant-oat01-..." > ~/.claude/agent-oauth-token
chmod 600 ~/.claude/agent-oauth-token
```

### 3. macOS Keychain (automatic, no setup needed)

If you have Claude Code installed and logged in on macOS, deer will automatically extract your subscription token from the macOS Keychain. **No extra configuration required.**

### 4. `ANTHROPIC_API_KEY` environment variable (fallback)

```sh
export ANTHROPIC_API_KEY="sk-ant-api03-..."
```

<div class="callout callout-info">
  <p><strong>Subscriptions take priority over API keys.</strong> If both are present, deer uses OAuth (subscription). This means you will not incur API usage charges if you have a Claude subscription.</p>
</div>

---

## GitHub CLI authentication

deer uses `gh` to create pull requests. Make sure you are logged in:

```sh
gh auth login
```

Follow the prompts to authenticate via the browser or with a token.

---

## First run

Navigate to any git repository and launch deer:

```sh
cd your-project
deer
```

The dashboard opens. The prompt bar at the bottom is focused by default.

1. **Type a task description** — for example: `Fix the bug where the login page redirects to 404`
2. **Press Enter** — deer creates a git worktree and launches a sandboxed Claude agent
3. **Watch the progress** — the agent's last few output lines appear in the list
4. **Press Enter again** (with the agent selected) to attach to its tmux session and watch in real time
5. **Press `p`** when the agent finishes to create a pull request

---

## Troubleshooting

### "srt not found"

The Anthropic Sandbox Runtime was not installed. Re-run the install command:

```sh
bunx @zdavison/deer install
```

### "sandbox-exec not working" (macOS)

Ensure `/usr/bin` is on your `PATH`. This is the default on macOS but some custom shell setups remove it.

### "bwrap not available" (Linux)

Install bubblewrap for your distribution (see [Prerequisites](#prerequisites) above).

### "gh auth not configured"

Run `gh auth login` and follow the prompts.

### "No credentials"

Set one of:
- `CLAUDE_CODE_OAUTH_TOKEN` in your shell profile, or
- `ANTHROPIC_API_KEY` as a fallback

Or on macOS, make sure you are logged into Claude Code (`claude` → sign in).

### Agent starts then immediately exits

Check that `claude --version` works in your terminal. If Claude Code is installed but not on `PATH`, add its location to `PATH` in your shell profile.
