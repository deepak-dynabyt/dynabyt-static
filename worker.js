// Cloudflare Worker entry (Workers + static assets). Serves ./dist and handles POST /api/contact.
import { onRequestPost } from './functions/api/contact.js';

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/contact') {
      if (request.method === 'POST') return onRequestPost({ request, env });
      return new Response(JSON.stringify({ ok: false, message: 'Method not allowed.' }), {
        status: 405, headers: { 'content-type': 'application/json; charset=utf-8', allow: 'POST', 'cache-control': 'no-store' },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
