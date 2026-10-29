# Dynabyt Technologies: Cloudflare Pages site

This repo is the ready-to-deploy static version of the Dynabyt website: pre-built pages in `static/` plus one Pages Function (`functions/api/contact.js`) that handles the contact form. The PHP source and the portfolio admin live in the main `dynabyt` repo.

## Create the project

Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick this repo, then:

| Setting | Value |
|---|---|
| Framework preset | None |
| Root directory | leave blank (repo root) |
| Build command | `node build.cjs` |
| Build output directory | `dist` |

Then add these under Settings → Variables and Secrets (Production):

| Name | Type | Purpose |
|---|---|---|
| `SITE_URL` | Text | Your public URL, e.g. `https://www.yourdomain.com`. Used for canonical links, sitemap and share tags. Required |
| `RESEND_API_KEY` | **Secret** | Turns on the email to `deepak.hubspot@gmail.com` (see below) |
| `MAIL_TO` | Text | Optional. Overrides the default recipient. Comma-separate for several |
| `MAIL_FROM` | Text | Optional sender, e.g. `Dynabyt <website@yourdomain.com>` once your domain is verified in Resend |
| `WEBHOOK_URL`, `WEBHOOK_SECRET` | Text / Secret | Optional. Also POST each enquiry to n8n, Make, Zapier or your CRM |
| `HUBSPOT_PORTAL_ID`, `HUBSPOT_FORM_GUID` | Text | Optional. Send enquiries to a HubSpot form (needs custom properties `service_required`, `project_budget_range`, `project_timeline`) |
| `TURNSTILE_SECRET_KEY` | Secret | Optional. Also set `TURNSTILE_SITE_KEY` in `.env` and re-export (below) |
| `DELIVERY_STRICT` | Text | `true` = visitor sees an error unless every configured channel succeeds |
| `RATE_LIMIT_PER_HOUR` | Text | Default 5 per IP (needs the KV binding) |

Settings → Bindings → add a **KV namespace** with the variable name `SUBMISSIONS`. Every enquiry is saved there, so nothing is lost if email fails. View them in Workers & Pages → KV → your namespace.

## Email to deepak.hubspot@gmail.com

1. Sign up at resend.com **using deepak.hubspot@gmail.com**.
2. Create an API key and save it as the `RESEND_API_KEY` secret.
3. That is enough to start: until you verify a domain, Resend only delivers from its test sender to the account owner's own address, which is exactly this inbox.
4. To send from your own domain (better deliverability), verify the domain in Resend and set `MAIL_FROM`.

Enquiry emails use the visitor as Reply-To, so you can reply straight from Gmail. Check Spam on the first test.

If no storage and no channel is configured, the form shows an error. It never claims success it cannot back up.

## Update the content

The files in `static/` are generated from the PHP project in the main `dynabyt` repo. After changing copy, projects (`app/data/projects.json`), contact details or links in that repo's `.env`, run `php tools/export-static.php` there, copy the regenerated `cloudflare/static/` and `cloudflare/functions/_lib/options.js` into this repo, then commit and push. Cloudflare rebuilds on every push.

## Local test

```bash
SITE_URL=http://127.0.0.1:8788 node build.cjs
npx wrangler pages dev dist --kv SUBMISSIONS
npm test          # form function tests
```

## Differences from the PHP version

- No `/admin`. Edit `projects.json` and re-export instead.
- The form token is a browser timestamp, not a signed token. Spam protection is the honeypot, minimum fill time, link limit, per-IP rate limit and optional Turnstile. For stronger protection, add a Cloudflare WAF rate-limiting rule for `/api/contact` and enable Turnstile.
