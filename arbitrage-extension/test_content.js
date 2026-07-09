(function() {
  let CONFIG = { ebayFeeRate: 0.1325, paymentProcessingFee: 0.029, paymentFixedFee: 0.30, defaultShipping: 6.00, defaultPackaging: 1.00, targetMultiplier: 1.6 };

  function calculateMargin(amazonPrice) {
    const estimatedEbayPrice = amazonPrice * CONFIG.targetMultiplier;
    const totalPercentageFee = CONFIG.ebayFeeRate + CONFIG.paymentProcessingFee;
    const ebayFees = (estimatedEbayPrice * totalPercentageFee) + CONFIG.paymentFixedFee;
    const netProfit = estimatedEbayPrice - ebayFees - CONFIG.defaultShipping - CONFIG.defaultPackaging - amazonPrice;
    const roi = amazonPrice > 0 ? (netProfit / amazonPrice) * 100 : 0;
    return { estimatedEbayPrice, netProfit, roi };
  }

  const scannerBtn = document.createElement('button');
  scannerBtn.id = 'eap-scan-btn';
  scannerBtn.innerText = 'Scan Page for Arbitrage';
  scannerBtn.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; background: linear-gradient(135deg, #10b981, #059669); color: white;
    border: none; padding: 15px 25px; border-radius: 30px; font-weight: bold; font-size: 16px; z-index: 999999; cursor: pointer; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
  `;
  
  scannerBtn.addEventListener('click', () => {
    scannerBtn.innerText = 'Scanning...';
    const products = document.querySelectorAll('.s-result-item');
    let found = 0;

    products.forEach(item => {
      const priceWhole = item.querySelector('.a-price-whole');
      const priceFraction = item.querySelector('.a-price-fraction');
      if (!priceWhole || !priceFraction) return;

      const price = parseFloat(priceWhole.innerText.replace(/[^0-9]/g, '') + '.' + priceFraction.innerText);
      if (isNaN(price) || price <= 0) return;

      const { netProfit, roi } = calculateMargin(price);

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
        item.style.border = '2px solid #ef4444';
      }

      const priceParent = item.querySelector('.a-price');
      if (priceParent && priceParent.parentNode) {
        priceParent.parentNode.appendChild(badge);
      }
    });

    scannerBtn.innerText = `Found ${found} Winners!`;
  });

  document.body.appendChild(scannerBtn);
})();
