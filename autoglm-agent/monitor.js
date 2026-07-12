const admin = require('firebase-admin');
const config = require('./config');
const amazonScraper = require('./amazon_scraper');
const antiDetection = require('./anti_detection');
const { chromium } = require('playwright-extra');

class StockMonitor {
  constructor() {
    this.db = admin.apps.length > 0 ? admin.firestore() : null;
  }

  async runMonitorCycle() {
    if (!this.db) {
      console.warn('[Monitor] ⚠️ Firebase not initialized. Cannot run monitor cycle.');
      return;
    }

    console.log('[Monitor] 🔄 Starting Stock & Price Monitoring Cycle...');
    const now = new Date();
    // Get all opportunities that are Elite or Strong
    const snapshot = await this.db.collection(config.FIREBASE.COLLECTIONS.OPPORTUNITIES)
      .where('tier', 'in', ['Elite', 'Strong'])
      .get();

    if (snapshot.empty) {
      console.log('[Monitor] No active Elite/Strong opportunities to monitor.');
      return;
    }

    const browser = await chromium.launch({ headless: true });

    for (const doc of snapshot.docs) {
      const opp = doc.data();
      console.log(`[Monitor] Checking ASIN: ${opp.asin}`);
      
      try {
        const freshData = await antiDetection.safeScrape(browser, 'amazon.com', async (page) => {
           // Direct navigate to product page to check stock and price
           const url = `https://www.amazon.com/dp/${opp.asin}`;
           await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
           
           // A quick extraction logic similar to amazon_scraper
           let priceText = await page.$eval(config.AMAZON_SELECTORS.PRICE, el => el.textContent).catch(() => null);
           let availability = await page.$eval(config.AMAZON_SELECTORS.AVAILABILITY, el => el.textContent).catch(() => 'In Stock');
           
           if (!priceText) throw new Error('Price not found');
           
           const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
           return { price, availability };
        });

        if (freshData) {
          const isOutOfStock = freshData.availability.toLowerCase().includes('currently unavailable');
          const priceChanged = Math.abs(freshData.price - opp.amazonPrice) > 0.01;

          if (isOutOfStock || priceChanged) {
            console.log(`[Monitor] 🚨 UPDATE for ${opp.asin}: Price ${opp.amazonPrice} -> ${freshData.price}, Stock: ${isOutOfStock ? 'OOS' : 'IN'}`);
            
            await doc.ref.update({
              amazonPrice: freshData.price,
              isOutOfStock,
              lastMonitoredAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Re-calculate ROI and downgrade if it dropped
            // In a full implementation, you would trigger the profit_calculator here
          } else {
             console.log(`[Monitor] ✅ ${opp.asin} is stable.`);
             await doc.ref.update({
                lastMonitoredAt: admin.firestore.FieldValue.serverTimestamp()
             });
          }
        }
      } catch (error) {
        console.error(`[Monitor] ❌ Failed to monitor ${opp.asin}: ${error.message}`);
      }
    }

    await browser.close();
    console.log('[Monitor] 🏁 Cycle Complete.');
  }
}

module.exports = new StockMonitor();
