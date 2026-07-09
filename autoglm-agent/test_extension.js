const { chromium } = require('playwright-extra');
const fs = require('fs');
const path = require('path');

async function testExtension() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const htmlPath = path.join(__dirname, '../arbitrage-extension/test_amazon.html');
  await page.goto(`file://${htmlPath}`);
  
  await page.addScriptTag({ path: path.join(__dirname, '../arbitrage-extension/test_content.js') });
  
  await page.waitForTimeout(500);
  await page.click('#eap-scan-btn');
  await page.waitForTimeout(500);
  
  const screenshotPath = 'C:/Users/Administrator/.gemini/antigravity/brain/5c8672f4-a0cd-4635-b525-a7dc435a42e3/artifacts/scanner_preview.png';
  
  const dir = path.dirname(screenshotPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Saved screenshot to ${screenshotPath}`);
  
  await browser.close();
}

testExtension().catch(console.error);
