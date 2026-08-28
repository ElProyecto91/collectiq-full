// ── eBay helpers ──────────────────────────────────────────────
import { getEnv } from './cors.js';

export async function getEbayToken() {
  var credentials = btoa(getEnv('EBAY_APP_ID') + ':' + getEnv('EBAY_CERT_ID'));
  var res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + credentials, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
  });
  var data = await res.json();
  return data.access_token;
}

// Marketplace IDs: EBAY_ES, EBAY_US, EBAY_JP, EBAY_FR, EBAY_DE, EBAY_IT, EBAY_GB
export async function searchEbayPrices(query, marketplaceId, maxPrice) {
  if (!marketplaceId) marketplaceId = 'EBAY_ES';
  if (!maxPrice) maxPrice = 500;
  var token = await getEbayToken();
  var url = 'https://api.ebay.com/buy/browse/v1/item_summary/search'
    + '?q=' + encodeURIComponent(query)
    + '&filter=buyingOptions:{FIXED_PRICE}'
    + '&sort=price&limit=20'
    + '&marketplace_ids=' + marketplaceId;
  var res = await fetch(url, {
    headers: { 'Authorization': 'Bearer ' + token, 'X-EBAY-C-MARKETPLACE-ID': marketplaceId },
  });
  var data = await res.json();
  var prices = (data.itemSummaries || [])
    .map(function(i) { return parseFloat((i.price || {}).value || '0'); })
    .filter(function(p) { return p > 0 && p < maxPrice; })
    .sort(function(a, b) { return a - b; });
  if (!prices.length) return null;
  var median = prices[Math.floor(prices.length / 2)];
  var avg = prices.reduce(function(s, p) { return s + p; }, 0) / prices.length;
  return {
    price: Math.round(median * 100) / 100,
    avg: Math.round(avg * 100) / 100,
    min: prices[0],
    max: prices[prices.length - 1],
    count: prices.length,
    confidence: prices.length >= 10 ? 'high' : prices.length >= 5 ? 'medium' : 'low',
    currency: 'EUR',
  };
}