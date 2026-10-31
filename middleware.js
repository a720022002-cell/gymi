// The public addresses show the company site, not the web app (Adro is a phone app):
// - adroapp.com and the old gymi-inky.vercel.app: /, /band, /privacy, /terms and /support show the site pages; any other app
//   page shows the site's home.
// - Still open, because the phone app needs them: invite links (/i/…), the sign-up email link (/signup) and password
//   reset (/reset-password), /.well-known (app links) and the site's own files.
// Vercel preview deployments (other hosts) keep the full web app for testing.
export const config = { matcher: ['/((?!_expo/|assets/|icons/|site|\\.well-known/|favicon|manifest).*)'] };

const PUBLIC = ['adroapp.com', 'gymi-inky.vercel.app'];
const SITE = { '/': '/site', '/band': '/site/band', '/privacy': '/site/privacy', '/terms': '/site/terms', '/support': '/site/support' };
const OPEN = /^\/(i\/|signup|reset-password)/;

export default function middleware(request) {
  const url = new URL(request.url);
  if (!PUBLIC.includes(url.hostname)) return;
  if (OPEN.test(url.pathname)) return;
  const to = SITE[url.pathname] ?? '/site';
  return new Response(null, { headers: { 'x-middleware-rewrite': new URL(to + url.search, url).toString() } });
}
