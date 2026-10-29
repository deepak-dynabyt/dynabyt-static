# Dynabyt Technologies: Cloudflare site

This repo is the ready-to-deploy static version of the Dynabyt website: pre-built pages in `static/` plus a contact form handler (`functions/api/contact.js`, wired up by `worker.js`). The PHP source and the portfolio admin live in the main `dynabyt` repo.

## Create the project (Workers, as in the Cloudflare "Import a repository" flow)

Workers & Pages → Create → Import a repository → pick this repo. The defaults are right:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |

`wrangler.jsonc` and `worker.js` tell Cloudflare to serve `dist/` and run the contact form at `/api/contact`.

Then, in the project's Settings:

1. **Build → Variables and secrets (build variables):** add `SITE_URL` = `https://www.yourdomain.com` (your real domain, or the `*.workers.dev` address to start). Without it the build still works but canonical links and the sitemap stay relative. Save, then retry the build.
2. **Variables and Secrets (runtime):** add the ones you need. Use **Secrets** for keys, which persist across deploys.

| Name | Type | Purpose |
|---|---|---|
| `RESEND_API_KEY` | **Secret** | Turns on the email to `deepak.hubspot@gmail.com` (see below) |
| `MAIL_TO` | Secret or text | Optional. Overrides the default recipient. Comma-separate for several |
| `MAIL_FROM` | Text | Optional sender, e.g. `Dynabyt <website@yourdomain.com>` once your domain is verified in Resend |
| `WEBHOOK_URL`, `WEBHOOK_SECRET` | Secret | Optional. Also POST each enquiry to n8n, Make, Zapier or your CRM |
| `HUBSPOT_PORTAL_ID`, `HUBSPOT_FORM_GUID` | Text | Optional. Send enquiries to a HubSpot form (needs custom properties `service_required`, `project_budget_range`, `project_timeline`) |
| `TURNSTILE_SECRET_KEY` | Secret | Optional. Also set `TURNSTILE_SITE_KEY` in the PHP project's `.env` and re-export |
| `DELIVERY_STRICT` | Text | `true` = visitor sees an error unless every configured channel succeeds |
| `RATE_LIMIT_PER_HOUR` | Text | Default 5 per IP (needs the KV namespace) |

3. **Save every enquiry (recommended):** create a KV namespace (Storage & databases → KV → Create) named `SUBMISSIONS`. Open `wrangler.jsonc`, uncomment the `kv_namespaces` line and paste its id, then commit. Enquiries then appear in that namespace even if email fails.

Using Cloudflare Pages instead? Create a Pages project with build command `node build.cjs` and output directory `dist`. `functions/api/contact.js` is picked up automatically and `SUBMISSIONS` is added under Settings → Bindings.

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
cd cloudflare
SITE_URL=http://127.0.0.1:8788 npm run build
npx wrangler dev --local
npm test          # form function tests
```

## Differences from the PHP version

- No `/admin`. Edit `projects.json` and re-export instead.
- The form token is a browser timestamp, not a signed token. Spam protection is the honeypot, minimum fill time, link limit, per-IP rate limit and optional Turnstile. For stronger protection, add a Cloudflare WAF rate-limiting rule for `/api/contact` and enable Turnstile.
