---
title: Home
layout: home
nav_order: 1
---

# deer
{: .fs-9 }

The simplest tool for running multiple Claude Code instances safely in parallel.
{: .fs-6 .fw-300 }

[![npm](https://img.shields.io/npm/v/@zdavison/deer?label=npm&color=e8a44a)](https://www.npmjs.com/package/@zdavison/deer)
[![license](https://img.shields.io/github/license/zdavison/deer?color=e8a44a)](https://github.com/zdavison/deer/blob/main/LICENSE)

[Get started]({% link getting-started.md %}){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[View on GitHub](https://github.com/zdavison/deer){: .btn .fs-5 .mb-4 .mb-md-0 }

---

![deer dashboard](https://raw.githubusercontent.com/zdavison/deer/main/assets/demo-dashboard.png)

---

## What is deer?

**deer** runs Claude Code agents in sandboxed tmux sessions — one per task, all visible in a single terminal dashboard. Each agent operates in its own isolated git worktree and cannot access your host filesystem, credentials, or network resources outside of an explicit allowlist.

If you want to parallelize Claude agents but find agent orchestrators like `multiclaude` or `claude-squad` too complex, deer may be for you.

---

## Key features

<div class="feature-grid">
  <div class="feature-card">
    <div class="feature-icon">🦌</div>
    <h3>Parallel agents</h3>
    <p>Submit multiple prompts and watch each agent run concurrently in the dashboard — no context switching required.</p>
  </div>
  <div class="feature-card">
    <div class="feature-icon">🔒</div>
    <h3>Sandboxed by default</h3>
    <p>Every agent runs in an isolated process with filesystem, network, and environment restrictions enforced by the Anthropic Sandbox Runtime.</p>
  </div>
  <div class="feature-card">
    <div class="feature-icon">🔑</div>
    <h3>No credential exposure</h3>
    <p>OAuth tokens and API keys never enter the sandbox. A host-side MITM proxy injects auth headers on demand.</p>
  </div>
  <div class="feature-card">
    <div class="feature-icon">🌿</div>
    <h3>Git worktrees</h3>
    <p>Each agent gets its own branch and worktree. No merge conflicts with your working directory.</p>
  </div>
  <div class="feature-card">
    <div class="feature-icon">📬</div>
    <h3>One-key PRs</h3>
    <p>Press <code>p</code> to create a pull request. deer generates the branch name, title, and body using Claude.</p>
  </div>
  <div class="feature-card">
    <div class="feature-icon">💳</div>
    <h3>Uses your subscription</h3>
    <p>No extra API costs if you already have a Claude subscription — deer reads your existing credentials automatically on macOS.</p>
  </div>
</div>

---

## Quick start

```sh
# Install
bunx @zdavison/deer install

# Run inside any git repo
cd your-project
deer
```

Then type a task at the prompt and press **Enter**. That's it — deer creates a worktree, launches a sandboxed Claude agent, and shows you its progress in the dashboard.

---

## Design goals

1. **Simple** — A single command to install, a single command to run.
2. **Safe** — `--dangerously-skip-permissions` without the danger, via OS-level sandboxing.
3. **Subscription-first** — Uses your Claude Code subscription, not a separate API key.
4. **Familiar** — Feels like using `claude` directly, just with more windows.
