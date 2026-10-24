// Company domain: adroapp.com shows the company site (public/site) at /, /privacy, /terms and /support, without a
// redirect. Everything else (the web app at /home, invite links at /i/…, /.well-known) is served as usual, and the
// vercel.app address keeps opening the app.
export const config = { matcher: ['/', '/privacy', '/terms', '/support'] };

const SITE = { '/': '/site', '/privacy': '/site/privacy', '/terms': '/site/terms', '/support': '/site/support' };

export default function middleware(request) {
  const url = new URL(request.url);
  if (url.hostname !== 'adroapp.com') return;
  const to = SITE[url.pathname];
  if (!to) return;
  return new Response(null, { headers: { 'x-middleware-rewrite': new URL(to + url.search, url).toString() } });
}
