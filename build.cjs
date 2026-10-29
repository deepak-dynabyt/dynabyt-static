// Cloudflare Pages build step: copy static/ to dist/ and set the real site URL.
// Build command:  node build.js     Output directory: dist     Root directory: cloudflare
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, 'static'), dist = path.join(__dirname, 'dist');
const PLACE = 'SITE_URL_PLACEHOLDER';

let site = (process.env.SITE_URL || '').trim().replace(/\/+$/, '');
if (!site && process.env.CF_PAGES_URL) site = process.env.CF_PAGES_URL.replace(/\/+$/, '');
if (site && !/^https?:\/\//.test(site)) site = 'https://' + site;
const host = site.replace(/^https?:\/\//, '');
if (!site) console.warn('WARNING: SITE_URL is not set. Canonical links, sitemap and share tags will be relative until you set it\n(Build variables: SITE_URL=https://www.yourdomain.com) and redeploy.');

fs.rmSync(dist, { recursive: true, force: true });
const textExt = new Set(['.html', '.xml', '.txt', '.json', '.svg']);
(function copy(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) {
    const a = path.join(from, f), b = path.join(to, f);
    if (fs.statSync(a).isDirectory()) { copy(a, b); continue; }
    if (textExt.has(path.extname(f)) || f === '_headers') {
      fs.writeFileSync(b, fs.readFileSync(a, 'utf8').split('https://' + PLACE).join(site).split(PLACE).join(host));
    } else fs.copyFileSync(a, b);
  }
})(src, dist);
console.log('Built dist/ for ' + (site || '(no SITE_URL set)'));
