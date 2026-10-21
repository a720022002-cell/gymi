/** What you typed on sign-up step 1, kept while you move between steps 1 and 2 (in memory only). */
export const form = { username: '', name: '', email: '', iso: 'SA', phone: '', password: '', password2: '' };

/** The username and email the code or link went to. Set once it's sent: the account exists from then on. */
export const sent: { to: { username: string; email: string } | null } = { to: null };

/** Start sign-up fresh (after it's finished, or on log out), so the next person doesn't see these details. */
export function resetSignupForm() {
  Object.assign(form, { username: '', name: '', email: '', iso: 'SA', phone: '', password: '', password2: '' });
  sent.to = null;
}
