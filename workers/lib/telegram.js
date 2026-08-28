// ── Telegram helpers ──────────────────────────────────────────
import { getEnv } from './cors.js';

export var APP_URL = 'https://collectiq-full.vercel.app';
export var ADMIN_ID = 1299079722;

export async function sendTgMessage(chatId, text) {
  await fetch('https://api.telegram.org/bot' + getEnv('TELEGRAM_BOT_TOKEN') + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'Markdown', disable_web_page_preview: false }),
  });
}

export async function generateToken() {
  var array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}