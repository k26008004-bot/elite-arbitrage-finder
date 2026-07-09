# Elite Arbitrage Specialist Memory

## Core Workflows & Preferences
- **Design Aesthetic:** Premium, modern, dark-mode with glassmorphism effects (as implemented in the Chrome Extension). The user expects "elite specialist" level of quality that avoids generic AI aesthetics.
- **Arbitrage Math:** 
  - eBay Fee Framework: 13.25% eBay Final Value Fee + 2.9% Payment Processing + $0.30 fixed fee per transaction (Total effective cut ~16-17%).
  - Golden Rule: Target Amazon price should be ≤ 60% of the eBay sold price for sustainable 20%+ net margins.
- **Compliance Context (2026):** Direct Amazon-to-eBay dropshipping using Prime is highly risky and violates TOS. The focus is on Retail Arbitrage (buying to hold, then ship) or Wholesale.

## Project: Elite Arbitrage Finder (Chrome Extension)
- **Status:** V1 Completed and ready for local installation via `chrome://extensions/`.
- **Stack:** Manifest V3, Vanilla JS (Content Scripts), CSS (Glassmorphism).
- **Features:** 
  - Scrapes Amazon Product Title and Price automatically.
  - Injects a live ROI and Net Profit calculator into Amazon pages.
  - 1-Click deep link to eBay "Sold & Completed" listings.

## Known Pitfalls & High-Cost Errors to Avoid
- **Amazon DOM Changes:** The extension uses multiple fallback CSS selectors for Amazon prices (e.g., `#corePrice_desktop .a-price .a-offscreen`, `#priceblock_ourprice`) to prevent breakage when Amazon A/B tests their layouts.
- **Cross-Origin Scraping:** Avoided direct background scraping of eBay within the extension for V1 due to intense anti-bot protections; opted for a smart deep-link approach to ensure maximum reliability.
