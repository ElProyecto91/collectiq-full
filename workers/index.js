// ============================================================
// CollectIQ API Worker v4.1 — Cloudflare Workers
// ============================================================
import { _ENV, getEnv, corsHeaders, jsonResponse } from './lib/cors.js';
import { sbFetch } from './lib/supabase.js';
import { handleAuthTelegram, handleAuthCode, handleBotWebhook, handleTelegramCallback, handleAdminVerify, handleAdminGiveGo, handleCreateInvoice, handleAnalytics } from './handlers/auth.js';
import { handleVision, handleScanner, handleCronPrices } from './handlers/pokemon.js';
import { handleFunkoImport, handleFunkoPrice } from './handlers/funko.js';
import { handleFunkoSync } from './handlers/funko-sync.js';
import { handleFunkoImages } from './handlers/funko-images.js';
import { handleOnePieceCards, handleOnePieceSets, handleOnePiecePrice, handleOnePieceScanner, handleOnePieceCronPrices } from './handlers/onepiece.js';
import { handleMagicCards, handleMagicSets, handleYugiohCards, handleYugiohSets, handleLorcanaCards, handleLorcanaSets } from './handlers/tcg.js';
import { handleMarketplaceList, handleMarketplaceCreate, handleMarketplaceUpdate, handleMarketplaceDelete, handleMarketplaceOffer, handleMarketplaceStats } from './handlers/marketplace.js';

async function handleRequest(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders() });

  var url = new URL(request.url);
  var route = url.pathname.replace(/^\//, '').split('/')[0] || url.searchParams.get('route') || '';

  if (route === 'auth-telegram')      return handleAuthTelegram(request);
  if (route === 'auth-code')          return handleAuthCode(request);
  if (route === 'bot-webhook')        return handleBotWebhook(request);
  if (route === 'telegram-callback')  return handleTelegramCallback(request);
  if (route === 'admin-verify')       return handleAdminVerify(request);
  if (route === 'admin-give-go')      return handleAdminGiveGo(request);
  if (route === 'create-invoice')     return handleCreateInvoice(request);
  if (route === 'analytics')          return handleAnalytics(request);
  if (route === 'vision')             return handleVision(request);
  if (route === 'scanner')            return handleScanner(request);
  if (route === 'funko-import')       return handleFunkoImport(request);
  if (route === 'funko-price')        return handleFunkoPrice(request);
  if (route === 'funko-sync')         return handleFunkoSync(request);
  if (route === 'funko-images')       return handleFunkoImages(request);
  if (route === 'onepiece-cards')     return handleOnePieceCards(request);
  if (route === 'onepiece-sets')      return handleOnePieceSets(request);
  if (route === 'onepiece-price')     return handleOnePiecePrice(request);
  if (route === 'onepiece-scanner')   return handleOnePieceScanner(request);
  if (route === 'magic-cards')        return handleMagicCards(request);
  if (route === 'magic-sets')         return handleMagicSets(request);
  if (route === 'yugioh-cards')       return handleYugiohCards(request);
  if (route === 'yugioh-sets')        return handleYugiohSets(request);
  if (route === 'lorcana-cards')      return handleLorcanaCards(request);
  if (route === 'lorcana-sets')       return handleLorcanaSets(request);
  if (route === 'marketplace-list')   return handleMarketplaceList(request);
  if (route === 'marketplace-create') return handleMarketplaceCreate(request);
  if (route === 'marketplace-update') return handleMarketplaceUpdate(request);
  if (route === 'marketplace-delete') return handleMarketplaceDelete(request);
  if (route === 'marketplace-offer')  return handleMarketplaceOffer(request);
  if (route === 'marketplace-stats')  return handleMarketplaceStats(request);

  if (route === 'cron-prices') {
    var cronSecret = url.searchParams.get('secret') || '';
    if (cronSecret !== getEnv('CRON_SECRET')) return jsonResponse({ error: 'Unauthorized' }, 401);
    var results = await handleCronPrices();
    return jsonResponse({ ok: true, results: results, ran_at: new Date().toISOString() });
  }

  return jsonResponse({
    ok: true, service: 'CollectIQ API', version: '4.1',
    routes: [
      'auth-telegram','auth-code','bot-webhook','telegram-callback',
      'admin-verify','admin-give-go','create-invoice','analytics',
      'vision','scanner',
      'funko-import','funko-price','funko-sync','funko-images',
      'onepiece-cards','onepiece-sets','onepiece-price','onepiece-scanner',
      'magic-cards','magic-sets','yugioh-cards','yugioh-sets',
      'lorcana-cards','lorcana-sets',
      'marketplace-list','marketplace-create','marketplace-update',
      'marketplace-delete','marketplace-offer','marketplace-stats',
      'cron-prices',
    ],
  });
}

export default {
  async fetch(request, env, ctx) {
    Object.assign(_ENV, env || {});
    return handleRequest(request);
  },
  async scheduled(event, env, ctx) {
    Object.assign(_ENV, env || {});

    // 3am diario — precios Pokémon + One Piece + expirar marketplace
    if (event.cron === '0 3 * * *') {
      var pokemonResults = await handleCronPrices();
      var onepieceResults = await handleOnePieceCronPrices(sbFetch);
      console.log('Cron 3am:', JSON.stringify(pokemonResults.concat(onepieceResults)));
    }

    // 4am cada domingo — sync catálogo Funko completo (páginas 0-7)
    if (event.cron === '0 4 * * SUN') {
      for (let p = 0; p < 8; p++) {
        var funkoResults = await handleFunkoSync(null, p);
        console.log(`Cron funko-sync page ${p}:`, JSON.stringify(funkoResults));
      }
    }

    // Cada hora — rellenar imágenes Funko pendientes (20 por ejecución)
    // Se detiene solo cuando done = true
    if (event.cron === '0 * * * *') {
      var imageResults = await handleFunkoImages(null);
      console.log('Cron funko-images:', JSON.stringify(imageResults));
    }
  },
};