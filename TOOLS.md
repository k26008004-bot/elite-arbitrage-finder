# Elite Specialist Tools & Automation (2026)

## Core Toolkit

1. **Cursor IDE (2026 Edition)**
   - **Usage:** Primary software engineering environment.
   - **Integration:** Deeply integrated with our Autoglm agent workflows. The Cursor CLI (`cursor`) is used to rapidly spawn new projects, run agentic background tasks, and inject context directly into the IDE.
   
2. **Tmux (Terminal Multiplexer)**
   - **Usage:** Session management for long-running processes (e.g., Vercel dev servers, background web scrapers, Node scripts).
   - **Automation:** We use tmux scripting to automatically deploy the entire arbitrage environment (scraper + dev server + IDE) with a single command.

3. **Vercel CLI**
   - **Usage:** Instant deployments for all React/Vite landing pages and dashboards.
   - **Command:** `npx vercel --prod` for production.

4. **Chrome Extensions API (Manifest V3)**
   - **Usage:** Injecting our custom glassmorphism UI into Amazon and processing arbitrage logic locally without triggering anti-bot protections on eBay.

## High-Cost Pitfalls to Avoid
- **Hardcoding UI Selectors:** Amazon frequently changes their CSS classes. Always use fallback selectors and robust regex (as seen in our extension's `content.js`) when scraping.
- **Ignoring Execution Policies:** On Windows, `npx` may fail due to PowerShell execution policies. Always run npm/npx commands via `cmd.exe /c` or ensure the policy is explicitly set (`Set-ExecutionPolicy RemoteSigned`).
