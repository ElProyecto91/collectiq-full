// ============================================================
// CollectIQ API Worker v4.1 — Cloudflare Workers
// Arquitectura modular: handlers/ + lib/
// ============================================================
import { _ENV, getEnv, corsHeaders, jsonResponse } from './lib/cors.js';
import { handleAuthTelegram, handleAuthCode, handleBotWebhook, handleTelegramCallback, handleAdminVerify, handleAdminGiveGo, handleCreateInvoice, handleAnalytics } from './handlers/auth.js';
import { handleVision, handleScanner, handleCronPrices } from './handlers/pokemon.js';
import { handleFunkoImport, handleFunkoPrice } from './handlers/funko.js';
import { handleOnePieceCards, handleOnePieceSets, handleOnePiecePrice, handleOnePieceScanner } from './handlers/onepiece.js';
import { handleMagicCards, handleMagicSets, handleYugiohCards, handleYugiohSets, handleLorcanaCards, handleLorcanaSets } from './handlers/tcg.js';
import { handleMarketplaceList, handleMarketplaceCreate, handleMarketplaceUpdate, handleMarketplaceDelete, handleMarketplaceOffer, handleMarketplaceStats } from './handlers/marketplace.js';

// ── Router principal ──────────────────────────────────────────
async function handleRequest(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders() });

  var url = new URL(request.url);
  var route = url.pathname.replace(/^\//, '').split('/')[0] || url.searchParams.get('route') || '';

  // Auth
  if (route === 'auth-telegram')      return handleAuthTelegram(request);
  if (route === 'auth-code')          return handleAuthCode(request);
  if (route === 'bot-webhook')        return handleBotWebhook(request);
  if (route === 'telegram-callback')  return handleTelegramCallback(request);
  if (route === 'admin-verify')       return handleAdminVerify(request);
  if (route === 'admin-give-go')      return handleAdminGiveGo(request);
  if (route === 'create-invoice')     return handleCreateInvoice(request);
  if (route === 'analytics')          return handleAnalytics(request);

  // Pokémon / Scanner
  if (route === 'vision')             return handleVision(request);
  if (route === 'scanner')            return handleScanner(request);

  // Funko
  if (route === 'funko-import')       return handleFunkoImport(request);
  if (route === 'funko-price')        return handleFunkoPrice(request);

  // One Piece
  if (route === 'onepiece-cards')     return handleOnePieceCards(request);
  if (route === 'onepiece-sets')      return handleOnePieceSets(request);
  if (route === 'onepiece-price')     return handleOnePiecePrice(request);
  if (route === 'onepiece-scanner')   return handleOnePieceScanner(request); // nuevo: precio por región

  // Magic
  if (route === 'magic-cards')        return handleMagicCards(request);
  if (route === 'magic-sets')         return handleMagicSets(request);

  // Yu-Gi-Oh
  if (route === 'yugioh-cards')       return handleYugiohCards(request);
  if (route === 'yugioh-sets')        return handleYugiohSets(request);

  // Lorcana
  if (route === 'lorcana-cards')      return handleLorcanaCards(request);
  if (route === 'lorcana-sets')       return handleLorcanaSets(request);

  // Marketplace
  if (route === 'marketplace-list')   return handleMarketplaceList(request);
  if (route === 'marketplace-create') return handleMarketplaceCreate(request);
  if (route === 'marketplace-update') return handleMarketplaceUpdate(request);
  if (route === 'marketplace-delete') return handleMarketplaceDelete(request);
  if (route === 'marketplace-offer')  return handleMarketplaceOffer(request);
  if (route === 'marketplace-stats')  return handleMarketplaceStats(request);

  // Cron manual
  if (route === 'cron-prices') {
    var cronSecret = url.searchParams.get('secret') || '';
    if (cronSecret !== getEnv('CRON_SECRET')) return jsonResponse({ error: 'Unauthorized' }, 401);
    var results = await handleCronPrices();
    return jsonResponse({ ok: true, results: results, ran_at: new Date().toISOString() });
  }

  return jsonResponse({
    ok: true, service: 'CollectIQ API', version: '4.0',
    routes: ['auth-telegram','auth-code','bot-webhook','telegram-callback','admin-verify','admin-give-go','create-invoice','analytics','vision','scanner','funko-import','funko-price','onepiece-cards','onepiece-sets','onepiece-price','magic-cards','magic-sets','yugioh-cards','yugioh-sets','lorcana-cards','lorcana-sets','marketplace-list','marketplace-create','marketplace-update','marketplace-delete','marketplace-offer','marketplace-stats','cron-prices'],
  });
}

// ── Export default (ES modules) ───────────────────────────────
export default {
  async fetch(request, env, ctx) {
    // Poblar _ENV con las variables de Cloudflare
    Object.assign(_ENV, env || {});
    return handleRequest(request);
  },
  async scheduled(event, env, ctx) {
    Object.assign(_ENV, env || {});
    var results = await handleCronPrices();
    console.log('Cron ran:', JSON.stringify(results));
  },
};