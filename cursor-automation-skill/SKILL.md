---
name: cursor-tmux-automation
description: A comprehensive skill for using the Cursor CLI agent for software engineering tasks, including a robust 2026 tmux automation guide.
---

# Cursor CLI & Tmux Automation Skill (2026)

This skill outlines the elite-level workflow for automating your software engineering environment using Cursor's advanced 2026 CLI features combined with `tmux` session multiplexing.

## 1. Cursor CLI Fundamentals
Cursor's CLI (`cursor`) allows you to interact with the IDE and trigger agentic tasks directly from your terminal.

### Essential Commands
- `cursor .` : Open the current directory in Cursor.
- `cursor --agent "Build a React component"` : (2026 Feature) Instantly spin up a background agent to scaffold code before the IDE even opens.
- `cursor --diff <file>` : Review AI-generated micro-diffs directly in the terminal before accepting them into the project.

## 2. Tmux Environment Automation
When building complex projects (like the Arbitrage Extension + Vercel Landing Page), you need multiple services running simultaneously. Instead of opening 4 different terminal windows, use this `tmux` script to automate your setup.

### The Elite Startup Script (`start_env.sh`)

Create a script that bootstraps your entire engineering context:

```bash
#!/bin/bash
# start_env.sh

SESSION_NAME="elite-arbitrage"

# Create a new detached tmux session
tmux new-session -d -s $SESSION_NAME

# Window 1: Cursor IDE Context
tmux rename-window -t $SESSION_NAME:0 'Editor'
tmux send-keys -t $SESSION_NAME:0 'cursor .' C-m

# Window 2: Vercel Dev Server
tmux new-window -t $SESSION_NAME -n 'Frontend'
tmux send-keys -t $SESSION_NAME:1 'cd arbitrage-landing-page && npm run dev' C-m

# Window 3: Background Tasks / Git
tmux new-window -t $SESSION_NAME -n 'Git/Tasks'
tmux send-keys -t $SESSION_NAME:2 'git status' C-m

# Attach to the session
tmux attach-session -t $SESSION_NAME
```

## 3. High-Cost Pitfalls to Avoid
- **Orphaned Sessions:** Always check for running tmux sessions (`tmux ls`) before creating new ones to avoid resource bloat.
- **Context Loss:** If Cursor crashes or is closed, the tmux session keeps your servers running. Use `tmux attach -t elite-arbitrage` to instantly recover your exact terminal state.

## 4. Acceptance Contracts (Red/Green Loops)
When using the Cursor CLI agent, always define an acceptance contract. 
Example: `cursor --agent "Update index.css. Contract: 'npm run test' must pass (Green) and UI must match glassmorphism specs."`
This ensures deterministic handoff checkpoints where the AI only ships code once the tests pass.
