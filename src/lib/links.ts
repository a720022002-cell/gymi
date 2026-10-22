/**
 * Where shared links point (invite codes, coach codes). One place to change when adro.sa goes live; the app
 * already opens links on both hosts (app.json associatedDomains / intentFilters, public/.well-known).
 */
export const LINK_BASE = 'https://gymi-inky.vercel.app';

/** The app's own scheme, for "Open in Adro" on the website. */
export const APP_SCHEME = 'adro';

export type InviteKind = 'friend' | 'coach';

const path = (code: string, kind: InviteKind) => `i/${encodeURIComponent(code)}${kind === 'coach' ? '?k=coach' : ''}`;

/** The link people share: opens Adro if it's installed, otherwise the invite page on the website. */
export const inviteUrl = (code: string, kind: InviteKind = 'friend') => `${LINK_BASE}/${path(code, kind)}`;

/** The same invite inside the app (adro://i/CODE). */
export const appInviteUrl = (code: string, kind: InviteKind = 'friend') => `${APP_SCHEME}://${path(code, kind)}`;

/** Friend codes (OMAR-7K2QXP, older ADRO-…/GYMI-… with 3-8 after the dash) or a username. */
export const FRIEND_CODE = /^[A-Za-z]{1,8}-[A-Za-z0-9]{3,8}$/;
export const USERNAME = /^[a-z][a-z0-9._]{2,19}$/;
/** Coach codes: ADRO-XXXXXXXX (older GYMI-…). */
export const COACH_CODE = /^(ADRO|GYMI)-[A-Z0-9]{8}$/;
