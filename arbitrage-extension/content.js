// Elite Arbitrage Finder - Content Script
// Active Scanning Engine for Amazon Search Pages

(function() {
  // Prevent multiple injections
  if (document.getElementById('elite-arbitrage-panel')) return;

  let CONFIG = {
    ebayFeeRate: 0.1325, // 13.25%
    paymentProcessingFee: 0.029, // 2.9%
    paymentFixedFee: 0.30, // $0.30
    defaultShipping: 6.00,
    defaultPackaging: 1.00,
    targetMultiplier: 1.6
  };

  function calculateMargin(amazonPrice) {
    const estimatedEbayPrice = amazonPrice * CONFIG.targetMultiplier;
    const totalPercentageFee = CONFIG.ebayFeeRate + CONFIG.paymentProcessingFee;
    const ebayFees = (estimatedEbayPrice * totalPercentageFee) + CONFIG.paymentFixedFee;
    
    const netProfit = estimatedEbayPrice - ebayFees - CONFIG.defaultShipping - CONFIG.defaultPackaging - amazonPrice;
    const roi = amazonPrice > 0 ? (netProfit / amazonPrice) * 100 : 0;
    
    return { estimatedEbayPrice, netProfit, roi };
  }

  // --- FEATURE 1: SEARCH PAGE SCANNER ---
  function injectScannerButton() {
    if (window.location.href.includes('/s?k=')) {
      const scannerBtn = document.createElement('button');
      scannerBtn.id = 'eap-scan-btn';
      scannerBtn.innerText = 'Scan Page for Arbitrage';
      scannerBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        border: none;
        padding: 15px 25px;
        border-radius: 30px;
        font-weight: bold;
        font-size: 16px;
        z-index: 999999;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
      `;
      
      scannerBtn.addEventListener('click', () => {
        scannerBtn.innerText = 'Scanning...';
        const products = document.querySelectorAll('.s-result-item[data-asin]');
        let found = 0;

        products.forEach(item => {
          const priceWhole = item.querySelector('.a-price-whole');
          const priceFraction = item.querySelector('.a-price-fraction');
          if (!priceWhole || !priceFraction) return;

          const price = parseFloat(priceWhole.innerText.replace(/[^0-9]/g, '') + '.' + priceFraction.innerText);
          if (isNaN(price) || price <= 0) return;

          const { estimatedEbayPrice, netProfit, roi } = calculateMargin(price);

          // Remove old badge if exists
          const oldBadge = item.querySelector('.eap-badge');
          if (oldBadge) oldBadge.remove();

          const badge = document.createElement('div');
          badge.className = 'eap-badge';
          
          if (netProfit > 5 && roi > 15) {
            badge.style.cssText = 'background: #10b981; color: white; padding: 5px 10px; border-radius: 4px; font-weight: bold; margin-top: 5px; display: inline-block;';
            badge.innerText = `WINNER! Profit: $${netProfit.toFixed(2)} (${roi.toFixed(1)}% ROI)`;
            item.style.border = '2px solid #10b981';
            found++;
          } else {
            badge.style.cssText = 'background: #ef4444; color: white; padding: 5px 10px; border-radius: 4px; font-weight: bold; margin-top: 5px; display: inline-block;';
            badge.innerText = `Loss: $${netProfit.toFixed(2)}`;
          }

          // Inject below the price
          const priceParent = item.querySelector('.a-price');
          if (priceParent && priceParent.parentNode) {
            priceParent.parentNode.appendChild(badge);
          }
        });

        scannerBtn.innerText = `Found ${found} Winners!`;
        setTimeout(() => scannerBtn.innerText = 'Scan Page for Arbitrage', 3000);
      });

      document.body.appendChild(scannerBtn);
    }
  }

  // --- FEATURE 2: INDIVIDUAL PRODUCT PANEL ---
  let productData = { title: '', price: 0, asin: '' };

  function scrapeAmazonData() {
    const titleEl = document.getElementById('productTitle');
    if (titleEl) productData.title = titleEl.innerText.trim();

    const priceSelectors = ['#corePrice_desktop .a-price .a-offscreen', '#priceblock_ourprice', '#priceblock_dealprice', '.a-price.a-text-price.a-size-medium .a-offscreen'];
    for (let selector of priceSelectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText) {
        const priceStr = el.innerText.replace(/[^0-9.]/g, '');
        const priceNum = parseFloat(priceStr);
        if (!isNaN(priceNum) && priceNum > 0) {
          productData.price = priceNum;
          break;
        }
      }
    }

    const asinInput = document.getElementById('ASIN');
    if (asinInput) {
      productData.asin = asinInput.value;
    } else {
      const match = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/);
      if (match) productData.asin = match[1];
    }
  }

  function injectPanel() {
    const panel = document.createElement('div');
    panel.id = 'elite-arbitrage-panel';
    let cleanTitle = productData.title.split('-')[0].split(',')[0].substring(0, 60);
    const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(cleanTitle)}&LH_Sold=1&LH_Complete=1`;

    panel.innerHTML = `
      <div class="eap-header">
        <div class="eap-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
          Elite Arbitrage
        </div>
        <button class="eap-close" id="eap-close-btn">&times;</button>
      </div>
      <div class="eap-content">
        <div class="eap-row">
          <span class="eap-label">Amazon Price:</span>
          <span class="eap-value">$${productData.price > 0 ? productData.price.toFixed(2) : '0.00'}</span>
        </div>
        <div class="eap-divider"></div>
        <div class="eap-input-group">
          <label class="eap-label">Target eBay Sale Price</label>
          <div class="eap-input-wrapper">
            <span class="eap-currency">$</span>
            <input type="number" id="eap-ebay-price" class="eap-input" placeholder="e.g. 50.00" step="0.01">
          </div>
        </div>
        <div class="eap-row" style="gap: 12px;">
          <div class="eap-input-group" style="flex: 1;">
            <label class="eap-label">Shipping Cost</label>
            <div class="eap-input-wrapper">
              <span class="eap-currency">$</span>
              <input type="number" id="eap-shipping" class="eap-input" value="${CONFIG.defaultShipping.toFixed(2)}" step="0.01">
            </div>
          </div>
          <div class="eap-input-group" style="flex: 1;">
            <label class="eap-label">Packaging</label>
            <div class="eap-input-wrapper">
              <span class="eap-currency">$</span>
              <input type="number" id="eap-packaging" class="eap-input" value="${CONFIG.defaultPackaging.toFixed(2)}" step="0.01">
            </div>
          </div>
        </div>
        <div class="eap-result">
          <div class="eap-label" style="color: rgba(255,255,255,0.7);">Estimated Net Profit</div>
          <div class="eap-profit-val" id="eap-profit-display">$0.00</div>
          <div class="eap-roi-val" id="eap-roi-display">ROI: 0.00%</div>
        </div>
        <a href="${ebayUrl}" target="_blank" class="eap-btn">Search eBay Sold Listings</a>
      </div>
    `;

    document.body.appendChild(panel);

    document.getElementById('eap-close-btn').addEventListener('click', () => panel.classList.add('hidden'));
    ['eap-ebay-price', 'eap-shipping', 'eap-packaging'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => {
        const ebayPrice = parseFloat(document.getElementById('eap-ebay-price').value) || 0;
        const shipping = parseFloat(document.getElementById('eap-shipping').value) || 0;
        const packaging = parseFloat(document.getElementById('eap-packaging').value) || 0;
        
        const totalPercentageFee = CONFIG.ebayFeeRate + CONFIG.paymentProcessingFee;
        const ebayFees = (ebayPrice * totalPercentageFee) + CONFIG.paymentFixedFee;
        const netProfit = ebayPrice - ebayFees - shipping - packaging - productData.price;
        const roi = productData.price > 0 ? (netProfit / productData.price) * 100 : 0;

        const profitDisplay = document.getElementById('eap-profit-display');
        const roiDisplay = document.getElementById('eap-roi-display');
        profitDisplay.innerText = `$${netProfit.toFixed(2)}`;
        roiDisplay.innerText = `ROI: ${roi.toFixed(2)}%`;

        if (netProfit < 0) {
          profitDisplay.classList.add('eap-negative');
          roiDisplay.classList.add('eap-negative-roi');
        } else {
          profitDisplay.classList.remove('eap-negative');
          roiDisplay.classList.remove('eap-negative-roi');
        }
      });
    });
  }

  // Initialize
  chrome.storage.sync.get(
    { ebayFeeRate: 0.1325, shippingCost: 6.00, packagingCost: 1.00, targetMultiplier: 1.6 },
    (items) => {
      CONFIG.ebayFeeRate = items.ebayFeeRate;
      CONFIG.defaultShipping = items.shippingCost;
      CONFIG.defaultPackaging = items.packagingCost;
      CONFIG.targetMultiplier = items.targetMultiplier;
      
      // Inject Search Scanner if on a search page
      injectScannerButton();

      // Inject Single Product Panel if on a product page
      if (document.getElementById('productTitle') || document.getElementById('dp')) {
        scrapeAmazonData();
        injectPanel();
      }
    }
  );

})();
