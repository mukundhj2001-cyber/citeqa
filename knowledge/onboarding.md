# Getting Started & Onboarding

Follow these steps to go from signup to your first dashboard in Cyberfield Analytics.

## Create your workspace

1. Sign up at app.cyberfield-analytics.example
2. Choose a workspace name (this can be changed later under Settings → General)
3. Invite teammates if ready (optional during onboarding)

Your 14-day Pro trial starts when the workspace is created.

## Install the tracking snippet

### Web (JavaScript)

Add the Cyberfield snippet to your site `<head>`:

```html
<script>
  (function(n,o){/* Cyberfield loader stub for demo docs */})(window, document);
  cyberfield.init('YOUR_WRITE_KEY');
</script>
```

Find your write key under Settings → Project → Write key.

### Mobile & server

Use the official SDKs for iOS, Android, Node, Python, and Ruby. Each SDK docs page lists `identify`, `track`, and `page` methods.

## Send your first events

Recommended starter events:

- `Signed Up` — when a user creates an account
- `Logged In` — successful authentication
- `Feature Used` — with property `feature_name`
- `Subscription Started` — with plan name

Always call `identify(userId, traits)` before or with the first track for that user so retention and funnels attribute correctly.

## Verify events are flowing

Open **Live view** (left nav). You should see events within 1–2 minutes of sending. If nothing appears:

1. Confirm the write key matches the project
2. Check ad blockers / CSP are not blocking the snippet domain
3. Use the Event debugger under Settings → Project

## Build your first funnel

1. Go to Funnels → New funnel
2. Add steps, e.g. `Signed Up` → `Feature Used` → `Subscription Started`
3. Set a conversion window (default 7 days)
4. Save and pin to a dashboard

## Create a starter dashboard

Use the template gallery: Dashboards → New from template → “Activation overview”. Customize widgets, then share with your team via dashboard sharing links (Pro+) or seat invites.

## Onboarding checklist

- [ ] Workspace created
- [ ] Tracking snippet or SDK installed
- [ ] At least one `identify` and three `track` events verified in Live view
- [ ] First funnel saved
- [ ] Starter dashboard created
- [ ] Teammates invited (optional)

## Need help during onboarding?

Pro trial users can use chat support. Free plan: email support@cyberfield-analytics.example with subject “Onboarding help” and your workspace ID.
