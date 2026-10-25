# Adro sign-in emails

Branded Arabic + English emails for Supabase Auth: the 6-digit code large and clear, the link as a backup.
Covers sign-up confirmation, sign-in code, password reset, email change and re-verification.

- `build.py` writes `templates.json` (run it in this folder: `python3 build.py`).
- `templates.json` is the body for `PATCH /v1/projects/{ref}/config/auth` (Supabase Management API).

Supabase only accepts template changes once a custom SMTP provider (Resend) is set up; on the built-in email
provider of a free project the request is refused.
