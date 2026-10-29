// Cloudflare Pages Function: POST /api/contact
// Same rules as the PHP site. Success is returned only if the enquiry was really stored (KV) or delivered
// (webhook, HubSpot, Resend email). If nothing is configured the visitor gets an honest error.
import { SERVICES, BUDGETS, TIMELINES } from '../_lib/options.js';

const DEFAULT_MAIL_TO = 'deepak.hubspot@gmail.com'; // every enquiry is emailed here unless MAIL_TO is set

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const clean1 = (v, max) => String(v ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const flag = (v) => ['1', 'true', 'yes', 'on'].includes(String(v ?? '').toLowerCase());

export function validate(f) {
  const errors = {}, c = {};
  c.name = clean1(f.name, 100); if (c.name.length < 2) errors.name = 'Please enter your full name.';
  c.email = clean1(f.email, 190).toLowerCase();
  if (!/^[^\s@<>()\[\]\\,;:"]+@[^\s@<>()\[\]\\,;:"]+\.[a-z]{2,}$/i.test(c.email)) errors.email = 'Please enter a valid email address.';
  c.company = clean1(f.company, 120); if (c.company.length < 2) errors.company = 'Please enter your company name.';
  let site = clean1(f.website, 200);
  if (site) {
    if (!/^https?:\/\//i.test(site)) site = 'https://' + site;
    try { const u = new URL(site); if (!u.hostname.includes('.')) throw 0; } catch { errors.website = 'Please enter a valid website address, or leave it blank.'; site = ''; }
  }
  c.website = site;
  c.service = clean1(f.service, 80); if (!SERVICES.includes(c.service)) errors.service = 'Please choose the service you need.';
  c.budget = clean1(f.budget, 40); if (c.budget && !BUDGETS.includes(c.budget)) errors.budget = 'Please choose one of the listed budget ranges.';
  c.timeline = clean1(f.timeline, 40); if (c.timeline && !TIMELINES.includes(c.timeline)) errors.timeline = 'Please choose one of the listed timelines.';
  c.message = String(f.message ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
  if (c.message.length < 20) errors.message = 'Please tell us a little more about your project (at least 20 characters).';
  else if (c.message.length > 3000) errors.message = 'Please keep the description under 3,000 characters.';
  if (!f.consent) errors.consent = 'Please confirm that you agree to us contacting you about this enquiry.';
  return { clean: c, errors };
}

async function sha256Hex(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function hmacHex(secret, body) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(body));
  return [...new Uint8Array(s)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
// Returns true on a 2xx response. On failure it logs the status and the provider's reply (never secrets) to Workers Logs.
const tryFetch = async (url, init, label = 'request') => {
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(10000) });
    if (!r.ok) console.error(`[contact] ${label} failed: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
    return r.ok;
  } catch (e) { console.error(`[contact] ${label} error: ${e && e.message}`); return false; }
};

async function deliver(env, rec) {
  const f = rec.fields, out = {};
  if (env.WEBHOOK_URL) {
    const body = JSON.stringify(rec);
    const headers = { 'content-type': 'application/json' };
    if (env.WEBHOOK_SECRET) headers['X-Dynabyt-Signature'] = 'sha256=' + (await hmacHex(env.WEBHOOK_SECRET, body));
    out.webhook = await tryFetch(env.WEBHOOK_URL, { method: 'POST', headers, body }, 'webhook');
  }
  if (env.HUBSPOT_PORTAL_ID && env.HUBSPOT_FORM_GUID) {
    const [first, ...rest] = f.name.split(' ');
    const fields = [
      { name: 'firstname', value: first }, { name: 'lastname', value: rest.join(' ') }, { name: 'email', value: f.email },
      { name: 'company', value: f.company }, f.website && { name: 'website', value: f.website },
      { name: 'service_required', value: f.service }, f.budget && { name: 'project_budget_range', value: f.budget },
      f.timeline && { name: 'project_timeline', value: f.timeline }, { name: 'message', value: f.message },
    ].filter(Boolean);
    out.hubspot = await tryFetch(`https://api.hsforms.com/submissions/v3/integration/submit/${encodeURIComponent(env.HUBSPOT_PORTAL_ID)}/${encodeURIComponent(env.HUBSPOT_FORM_GUID)}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fields, context: { pageName: 'Contact', pageUri: rec.page }, legalConsentOptions: { consent: { consentToProcess: true, text: 'Visitor agreed to be contacted about this enquiry.' } } }),
    }, 'hubspot');
  }
  if (env.RESEND_API_KEY) {
    const to = (env.MAIL_TO || DEFAULT_MAIL_TO).split(',').map((x) => x.trim()).filter(Boolean);
    const from = env.MAIL_FROM || 'Dynabyt Website <onboarding@resend.dev>';
    const text = ['Name: ' + f.name, 'Email: ' + f.email, 'Company: ' + f.company, 'Website: ' + (f.website || '-'), 'Service: ' + f.service,
      'Budget: ' + (f.budget || '-'), 'Timeline: ' + (f.timeline || '-'), '', f.message].join('\n');
    out.email = await tryFetch('https://api.resend.com/emails', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.RESEND_API_KEY },
      body: JSON.stringify({ from, to, reply_to: f.email, subject: `New enquiry: ${f.service} — ${f.company}`, text }),
    }, 'resend email');
  }
  return out;
}

// Saves the enquiry as a row in the Supabase table "enquiries" (see supabase/enquiries.sql).
// Uses the service key, which only ever lives in Cloudflare as a secret.
const supabaseConfigured = (env) => !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY);
async function saveToSupabase(env, rec) {
  const f = rec.fields;
  return tryFetch(env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/enquiries', {
    method: 'POST',
    headers: {
      'content-type': 'application/json', apikey: env.SUPABASE_SERVICE_KEY, prefer: 'return=minimal',
      // Legacy service_role keys are JWTs and also go in Authorization. New sb_secret_ keys are not JWTs: apikey alone is correct.
      ...(env.SUPABASE_SERVICE_KEY.startsWith('eyJ') ? { authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY } : {}),
    },
    body: JSON.stringify({ id: rec.id, received_at: rec.received_at, name: f.name, email: f.email, company: f.company, website: f.website || null,
      service: f.service, budget: f.budget || null, timeline: f.timeline || null, message: f.message, consent: true, page: rec.page, ip_hash: rec.ip_hash, user_agent: rec.user_agent }),
  }, 'supabase');
}

async function rateLimited(env, ip) {
  if (!env.SUBMISSIONS) return false;
  const limit = parseInt(env.RATE_LIMIT_PER_HOUR || '5', 10);
  const key = 'rl:' + (await sha256Hex(ip)).slice(0, 24) + ':' + Math.floor(Date.now() / 3600000);
  const n = parseInt((await env.SUBMISSIONS.get(key)) || '0', 10);
  if (n >= limit) return true;
  await env.SUBMISSIONS.put(key, String(n + 1), { expirationTtl: 7200 });
  return false;
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const wantsJson = (request.headers.get('accept') || '').includes('application/json') || request.headers.get('x-requested-with') === 'fetch';
  const reply = (body, status) => {
    if (wantsJson) return json(body, status);
    const msg = (body.message || '').replace(/[<>&]/g, '');
    return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${body.ok ? 'Enquiry received' : 'Enquiry not sent'}</title><body style="font:18px/1.6 system-ui;max-width:36rem;margin:4rem auto;padding:0 1rem"><h1>${body.ok ? 'Thank you' : 'We could not send that'}</h1><p>${msg}</p><p><a href="/contact">Back to the contact page</a></p>`,
      { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  };

  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== url.host) return reply({ ok: false, message: 'We could not verify where this request came from. Please reload the page and try again.', errors: {} }, 400);

  let form;
  try { form = Object.fromEntries((await request.formData()).entries()); } catch { return reply({ ok: false, message: 'We could not read that form. Please try again.', errors: {} }, 400); }

  if (String(form.company_website || '').trim() !== '') return reply({ ok: true, message: 'Thank you.' }, 200); // honeypot: silent, nothing stored

  const age = Date.now() - Number(form.form_token);
  if (!Number.isFinite(age) || age < 0 || age > 2 * 3600 * 1000) return reply({ ok: false, message: 'Your form session has expired. Please reload the page and try again.', errors: {} }, 400);
  if (age < 3000) return reply({ ok: false, message: 'That was a little too quick. Please check your details and submit again.', errors: {} }, 400);

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (env.TURNSTILE_SECRET_KEY) {
    let ok = false;
    try {
      const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: String(form['cf-turnstile-response'] || ''), remoteip: ip }) });
      ok = !!(await r.json()).success;
    } catch {}
    if (!ok) return reply({ ok: false, message: 'Please complete the security check and try again.', errors: {} }, 400);
  }

  const { clean, errors } = validate(form);
  if (Object.keys(errors).length) return reply({ ok: false, message: 'Please check the highlighted fields.', errors }, 422);
  if ((clean.message.match(/https?:\/\//gi) || []).length > 3) return reply({ ok: false, message: 'Please remove some links from your message and try again.', errors: {} }, 400);

  if (await rateLimited(env, ip)) return reply({ ok: false, message: 'You have sent several enquiries recently. Please try again in an hour.', errors: {} }, 429);

  const idBytes = crypto.getRandomValues(new Uint8Array(5));
  const id = [...idBytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (!env.RESEND_API_KEY && !env.SUBMISSIONS && !supabaseConfigured(env) && !env.WEBHOOK_URL && !(env.HUBSPOT_PORTAL_ID && env.HUBSPOT_FORM_GUID)) console.error('[contact] No delivery channel configured: RESEND_API_KEY is not set on this Worker (add it as a runtime Secret, then redeploy). Variables this Worker can see: ' + (Object.keys(env).join(', ') || '(none)'));
  const rec = { id, received_at: new Date().toISOString(), page: url.origin + '/contact', fields: clean, consent: true, ip_hash: (await sha256Hex(ip)).slice(0, 16), user_agent: (request.headers.get('user-agent') || '').slice(0, 200) };

  let stored = false;
  if (env.SUBMISSIONS) { try { await env.SUBMISSIONS.put('sub:' + rec.received_at + ':' + id, JSON.stringify(rec)); stored = true; } catch {} }
  if (supabaseConfigured(env) && (await saveToSupabase(env, rec))) stored = true;
  const remote = await deliver(env, rec);
  const channels = Object.values(remote);
  const anyRemote = channels.some(Boolean);
  const strict = flag(env.DELIVERY_STRICT);
  const storageConfigured = !!env.SUBMISSIONS || supabaseConfigured(env);
  const configured = storageConfigured || channels.length > 0;
  const success = strict ? (!storageConfigured || stored) && channels.every(Boolean) && configured : stored || anyRemote;

  if (success) {
    const first = clean.name.split(' ')[0];
    return reply({ ok: true, message: `Thank you, ${first}. Your enquiry has been received. Your reference is ${id.toUpperCase()}.`, reference: id.toUpperCase() }, 200);
  }
  return reply({ ok: false, message: 'Sorry, we could not receive your enquiry just now.' + (env.CONTACT_EMAIL ? ` Please email us at ${env.CONTACT_EMAIL}.` : ' Please try again shortly.'), errors: {} }, 503);
}

export const onRequest = ({ request }) => request.method === 'POST' ? undefined : json({ ok: false, message: 'Method not allowed.' }, 405);
