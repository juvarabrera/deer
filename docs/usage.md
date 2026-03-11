---
title: Usage
nav_order: 3
---

# Usage
{: .no_toc }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Starting the dashboard

```sh
cd your-project   # must be inside a git repository
deer
```

deer detects the git repository root automatically and opens the TUI dashboard. The prompt bar at the bottom is focused by default.

---

## Submitting a prompt

Type your task description in the prompt bar and press **Enter**. deer will:

1. Generate a unique task ID
2. Create a git worktree on a new branch (`deer/<taskId>`)
3. Launch a sandboxed Claude agent in a tmux session
4. Display the agent in the dashboard list

You can submit multiple prompts — each one creates an independent agent running in parallel.

### Prompt history

Use **↑** / **↓** in the prompt bar to navigate through previously submitted prompts, the same way you would in a shell.

---

## The dashboard

![deer dashboard](https://raw.githubusercontent.com/zdavison/deer/main/assets/demo-dashboard.png)

The dashboard shows all agents for the current repository. Each entry displays:

- **Status indicator** — current agent state (setup, running, idle, failed, etc.)
- **Prompt** — the task description you submitted
- **Branch** — the git branch the agent is working on
- **Recent output** — last two lines from the agent's tmux pane
- **PR link** — if a pull request has been created

---

## Keyboard shortcuts

There are three focus modes. The current mode determines which shortcuts are active.

### Input mode (default)

The prompt bar is active. You are typing a new prompt.

| Key | Action |
|-----|--------|
| `Enter` | Submit prompt and launch agent |
| `↑` / `↓` | Navigate prompt history |
| `Tab` | Switch focus to agent list |
{: .shortcuts }

### Agent list mode

Press `Tab` from input mode to enter agent list mode.

| Key | Action |
|-----|--------|
| `Tab` | Switch focus back to input |
| `j` / `↓` | Select next agent |
| `k` / `↑` | Select previous agent |
| `/` | Enter fuzzy search |
| `Enter` | Attach to agent's tmux session |
| `x` | Kill running agent |
| `r` | Retry (re-run agent from scratch) |
| `p` | Create PR (or open PR if one exists) |
| `u` | Update existing PR with latest changes |
| `s` | Open a shell in the agent's worktree |
| `l` | Toggle log detail panel |
| `c` | Copy logs to clipboard (log panel open) |
| `v` | Toggle verbose log mode (log panel open) |
| `Backspace` | Delete agent entry |
| `q` | Quit (confirms if agents are still running) |
{: .shortcuts }

### Search mode

Press `/` from agent list mode to fuzzy-search agents.

| Key | Action |
|-----|--------|
| `j` / `↓` | Next match |
| `k` / `↑` | Previous match |
| `Enter` | Select highlighted match |
| `Esc` | Cancel search |
{: .shortcuts }

<div class="callout">
  <p><strong>Confirmation prompts</strong>: Dangerous actions (kill, delete with uncommitted work, retry while running) prompt <code>(y/n)</code> before executing.</p>
</div>

---

## Agent states

Each agent moves through a defined set of states:

| State | Meaning |
|-------|---------|
| <span class="state-badge state-setup">setup</span> | Creating worktree, starting sandbox |
| <span class="state-badge state-running">running</span> | Claude agent is active |
| <span class="state-badge state-teardown">teardown</span> | Agent finished; cleaning up |
| <span class="state-badge state-failed">failed</span> | Agent exited with an error |
| <span class="state-badge state-cancelled">cancelled</span> | You killed the agent |
| <span class="state-badge state-interrupted">interrupted</span> | Session closed unexpectedly |
| <span class="state-badge state-pr_failed">pr_failed</span> | PR creation was attempted but failed |

### Available actions by state

Not all actions are available in every state. The shortcuts bar at the bottom of each agent entry shows only currently available actions.

When an agent is **idle** (Claude is at rest, waiting for input or finished), additional actions become available: **create PR**, **open PR**, **update PR**, and **retry**.

---

## Attaching to a running agent

Press **Enter** with an agent selected to attach to its tmux session and watch Claude work in real time. You can intervene, provide additional context, or just observe.

![deer tmux status bar](https://raw.githubusercontent.com/zdavison/deer/main/assets/deer-status-bar.png)

A status bar at the bottom of the session shows:

```
  🦌 deer | Ctrl+b d to detach
```

**To detach and return to the dashboard**: press `Ctrl+b`, then `d`.

---

## Opening a shell in a worktree

Press **s** with an agent selected to open an interactive shell inside the agent's git worktree. Useful for inspecting changes, running tests manually, or resolving issues before creating a PR.

The shell session is a regular tmux session. Type `exit` or press `Ctrl+d` to return to the dashboard.

---

## Creating a pull request

When an agent finishes and you are happy with its work:

1. Select the agent in the list
2. Press **p**

deer will:

1. Stage any uncommitted changes
2. Ask Claude to generate a branch name, PR title, and PR body from the diff
3. Rename the worktree branch to `deer/<generated-name>`
4. Push the branch to `origin`
5. Run `gh pr create` with the generated metadata

The PR URL appears in the agent entry. Press **p** again to open it in the browser.

<div class="callout callout-info">
  <p><strong>PR templates are respected.</strong> If your repo has a <code>.github/PULL_REQUEST_TEMPLATE.md</code>, deer will fill it in when generating the PR body.</p>
</div>

### Updating an existing PR

After creating a PR, if you make further changes (either via the agent or manually):

1. Select the agent
2. Press **u**

deer commits any new changes, pushes them, and regenerates the PR title and body from the updated diff.

---

## Viewing logs

Press **l** to toggle the log detail panel for the selected agent. The panel shows the agent's recent output in more detail.

With the panel open:
- Press **c** to copy the logs to your clipboard
- Press **v** to toggle verbose mode (shows internal deer log messages such as auth proxy activity and PR creation steps)

---

## Killing and retrying

**Kill** (`x`): Stops the sandbox and tmux session. The worktree is preserved so you can inspect the work done or create a PR from whatever was committed.

**Retry** (`r`): Kills the current session (if running) and relaunches the agent from scratch in the same worktree. Useful when an agent goes off track.

**Delete** (`Backspace`): Removes the agent entry from the dashboard and cleans up the worktree and branch. If a PR exists, the entry is removed without confirmation (the PR is on GitHub — nothing is lost). If the agent still has uncommitted work, deer asks for confirmation before discarding it.

---

## Quitting

Press **q**. If any agents are still running, deer asks:

```
Agents still running — quit anyway? (y/n)
```

Confirm with `y` to quit and leave the tmux sessions running in the background, or `n` to stay in the dashboard.
