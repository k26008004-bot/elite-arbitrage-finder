const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const fs = require('fs');

// Elite Arbitrage Configuration
const CONFIG = {
  ebayFeeRate: 0.1325, // 13.25%
  paymentProcessingFee: 0.029, // 2.9%
  paymentFixedFee: 0.30, // $0.30
  defaultShipping: 6.00,
  defaultPackaging: 1.00,
  // We estimate eBay sale price as exactly 1.6x the Amazon price to identify theoretical margins
  targetEbayMultiplier: 1.6 
};

// Random human-like delay
const delay = (min, max) => new Promise(r => setTimeout(r, Math.random() * (max - min) + min));

async function runAutoGLM() {
  console.log("🌐 Booting AutoGLM Browser Agent [STEALTH MODE]...");

  // Launch browser (headless for automated background execution)
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  });
  
  const page = await context.newPage();
  const searchTerms = ['logitech webcam', 'lego star wars clearance'];
  const winningProducts = [];

  for (const term of searchTerms) {
    console.log(`\n🔍 Searching Amazon for: "${term}"`);
    
    // Red/Green Validation Loop: Navigating to target
    try {
      await page.goto(`https://www.amazon.com/s?k=${encodeURIComponent(term)}`, { waitUntil: 'domcontentloaded' });
      await delay(2000, 4000); // Human-like padding
      
      // Scrape products
      const products = await page.$$eval('.s-result-item[data-asin]', items => {
        return items.map(item => {
          const asin = item.getAttribute('data-asin');
          if (!asin) return null;
          
          const titleEl = item.querySelector('h2 a span');
          const title = titleEl ? titleEl.innerText : null;
          
          const priceWhole = item.querySelector('.a-price-whole');
          const priceFraction = item.querySelector('.a-price-fraction');
          
          let price = 0;
          if (priceWhole && priceFraction) {
            price = parseFloat(priceWhole.innerText.replace(/[^0-9]/g, '') + '.' + priceFraction.innerText);
          }
          
          return { asin, title, price };
        }).filter(p => p !== null && p.price > 0 && p.title);
      });

      console.log(`✅ Green Loop: Successfully scraped ${products.length} products from search results.`);

      // Arbitrage Math Filter
      for (const product of products) {
        const estimatedEbayPrice = product.price * CONFIG.targetEbayMultiplier;
        const totalPercentageFee = CONFIG.ebayFeeRate + CONFIG.paymentProcessingFee;
        const ebayFees = (estimatedEbayPrice * totalPercentageFee) + CONFIG.paymentFixedFee;
        
        const netProfit = estimatedEbayPrice - ebayFees - CONFIG.defaultShipping - CONFIG.defaultPackaging - product.price;
        const roi = (netProfit / product.price) * 100;

        if (netProfit > 5 && roi > 20) {
          winningProducts.push({
            ...product,
            estimatedEbayPrice: estimatedEbayPrice.toFixed(2),
            netProfit: netProfit.toFixed(2),
            roi: roi.toFixed(2) + '%'
          });
        }
      }

    } catch (e) {
      console.log(`❌ Red Loop Failure: Amazon blocked the request or DOM changed. Error: ${e.message}`);
    }
  }

  // Deterministic Handoff: Output the data
  console.log(`\n🏆 AutoGLM found ${winningProducts.length} high-margin arbitrage opportunities.`);
  
  fs.writeFileSync('winning_products.json', JSON.stringify(winningProducts, null, 2));
  console.log("💾 Saved results to winning_products.json");

  // Elite Push Notifications
  if (winningProducts.length > 0 && process.env.DISCORD_WEBHOOK_URL) {
    console.log("🔔 Sending push notification to Discord...");
    try {
      await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🚨 **AutoGLM Found ${winningProducts.length} Arbitrage Deals!**\n\n` +
            winningProducts.map(p => `📦 **${p.title}**\n💰 Amazon: $${p.price} | Target eBay: $${p.estimatedEbayPrice}\n💸 Net Profit: $${p.netProfit} (${p.roi})`).join('\n\n')
        })
      });
      console.log("✅ Discord notification sent successfully!");
    } catch (err) {
      console.log("❌ Failed to send Discord notification.");
    }
  }

  await browser.close();
}

runAutoGLM().catch(console.error);
