---
name: autoglm-browser-agent
description: >-
  Intelligent browser automation agent that can perform any task requiring a browser.
  Including but not limited to: opening web pages, searching information (Google/Bing/DuckDuckGo), browsing social media (Twitter/Reddit/YouTube/Instagram/TikTok),
  liking/commenting/sharing/bookmarking, posting/messaging, logging into websites, filling forms, taking screenshots, scraping web content,
  online shopping and price comparison, reading news, operating online documents (Google Docs/Notion, etc.).
  Use this skill when the user mentions any website name, URL, or needs to perform actions on a web page.
metadata:
  openclaw:
    emoji: "🌐"
---

# AutoGLM Browser Agent

The AutoGLM Browser Agent is an elite-level automation tool designed to handle all web-based interactions autonomously. It is capable of deeply navigating the DOM, parsing real-time data, and executing complex UI interactions across any modern web application.

## Core Capabilities
- **Web Navigation & Search:** Executes multi-step search workflows across search engines to aggregate research.
- **Social & Media Interaction:** Capable of authenticating, reading, liking, and posting on platforms like Twitter, Reddit, and YouTube.
- **Data Scraping & Arbitrage:** Extensively used for extracting hidden pricing data and stock levels from Amazon, eBay, and other e-commerce giants.
- **Form & Document Operations:** Can seamlessly interface with Google Docs, Notion, and fill out complex, multi-page web forms.

## Usage Guidelines (Acceptance Contracts)
When utilizing the AutoGLM Browser Agent in a workflow, you must enforce **deterministic handoff checkpoints** and **red/green loops**.

### Red/Green Validation Loop
Before the agent returns data from a web task, it must pass an internal contract:
1. **Red (Fail State):** Agent successfully opened the URL but the expected DOM element (e.g., `#corePrice_desktop`) was not found or the CAPTCHA blocked the scrape.
2. **Green (Pass State):** Agent successfully bypassed or resolved the DOM block, scraped the price, and verified the data format (e.g., float value > 0).

### Example Invocation
```json
{
  "command": "autoglm run --task \"act as professional elite specialist find me 5 winning products for amazon to ebay arbitrage\" --start-url \"https://www.amazon.com\""
}
```

## Anti-Bot Mitigation
- The agent utilizes rotating residential proxies and randomized user-agent strings.
- DOM interactions are padded with variable human-like delays (500ms - 2000ms) to prevent behavioral flagging on high-security sites like eBay.
