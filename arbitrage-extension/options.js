// Saves options to chrome.storage
const saveOptions = () => {
  const ebayFeeRate = parseFloat(document.getElementById('ebayFeeRate').value) / 100;
  const shippingCost = parseFloat(document.getElementById('shippingCost').value);
  const packagingCost = parseFloat(document.getElementById('packagingCost').value);
  const targetMultiplier = parseFloat(document.getElementById('targetMultiplier').value);

  chrome.storage.sync.set(
    { ebayFeeRate, shippingCost, packagingCost, targetMultiplier },
    () => {
      const status = document.getElementById('status');
      status.textContent = 'Settings synchronized to Elite Database.';
      setTimeout(() => {
        status.textContent = '';
      }, 3000);
    }
  );
};

// Restores select box and checkbox state using the preferences stored in chrome.storage.
const restoreOptions = () => {
  chrome.storage.sync.get(
    {
      ebayFeeRate: 0.1325,
      shippingCost: 6.00,
      packagingCost: 1.00,
      targetMultiplier: 1.6
    },
    (items) => {
      document.getElementById('ebayFeeRate').value = (items.ebayFeeRate * 100).toFixed(2);
      document.getElementById('shippingCost').value = items.shippingCost.toFixed(2);
      document.getElementById('packagingCost').value = items.packagingCost.toFixed(2);
      document.getElementById('targetMultiplier').value = items.targetMultiplier.toFixed(1);
    }
  );
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveBtn').addEventListener('click', saveOptions);
