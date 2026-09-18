# Troubleshooting & Account Access

Common fixes for Northstar Analytics issues.

## Password reset

1. Go to app.northstar-analytics.example/login
2. Click **Forgot password**
3. Enter the email on your Northstar account
4. Open the reset link (valid for **60 minutes**)
5. Choose a new password (min 10 characters, at least one number and one symbol)

If you do not receive the email within 10 minutes, check spam/junk and confirm you are using the email tied to the workspace. SSO (Business) users reset passwords through their identity provider, not Northstar.

## Locked out after failed logins

After **10 failed password attempts** in 15 minutes, the account is locked for 30 minutes. Wait for the lockout to expire, or use Forgot password. Admins cannot unlock another user’s password lock from the UI; contact support if the lockout blocks a critical incident.

## Events not appearing in Live view

1. Confirm write key under Settings → Project
2. Disable browser extensions that block analytics scripts
3. Ensure `northstar.init` runs before `track` calls
4. Check that you are viewing the correct project (top-left switcher)
5. Allow up to 2 minutes for ingestion delay

Still stuck? Open Settings → Project → Event debugger and send a test event.

## Funnel shows zero conversions

- Step event names must match **exactly** (case-sensitive)
- Users must be `identify`’d consistently across steps
- Conversion window may be too short — try 14 or 30 days
- Date range filter may exclude the relevant period

## Dashboard widgets empty

Widgets respect the dashboard date range and any global filters. Clear filters and widen the range. If the underlying event volume is zero for that period, the widget stays empty by design.

## API authentication errors

Use a Bearer token from Settings → API keys. Keys are shown once at creation. Rotate compromised keys immediately. Free plan workspaces cannot create API keys.

Rate limit responses return HTTP 429 with a `Retry-After` header. Pro: 60 req/min; Business: 300 req/min.

## Billing page won’t load

Try an incognito window and disable ad blockers. If invoices fail to download, email billing@northstar-analytics.example with your workspace ID.

## Data deletion / GDPR request

Workspace admins can delete the workspace under Settings → Privacy → Delete workspace (irreversible after 7-day grace). For a subject access or erasure request for a specific user ID, email privacy@northstar-analytics.example.

## Known limitations

- Historical event reprocessing is not supported from the UI
- Calculated properties update on a 15-minute delay
- Maximum funnel steps: 8 on Free, 12 on Pro/Business
