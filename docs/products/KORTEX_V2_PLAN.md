# KORTEX v2 Plan

## Purpose

KORTEX v2 turns the current smart-link and campaign tooling into a tenant-owned portal platform. A tenant such as Parishram should be able to use a branded KORTEX space to log in, create links, run alumni or marketing campaigns, and track performance without seeing any other tenant's data.

The product should support three operating modes:

- Kaayko internal operators managing all tenants.
- Tenant admins managing their own campaigns and links.
- Public recipients clicking short links, voting, submitting interest, or visiting campaign destinations without login.

## Current Baseline

KORTEX currently has these pieces in place:

- Canonical backend namespace: `/kortex`, with `/smartlinks` retained as compatibility.
- Short-link CRUD in `short_links`, including destinations, UTM, metadata, expiry, enabled/paused state, click counts, install counts, unique visit fields, and tenant fields.
- Public redirects through `/l/:code`, `/kortex/r/:code`, and campaign route resolution through `/:campaignSlug/:code`.
- Tenant context helpers that scope authenticated requests by `X-Kaayko-Tenant-Id`, user profile tenant assignment, and default tenant fallback.
- Campaign API foundation under `/campaigns`: create/list/update, pause/resume/archive, members, campaign links, campaign-link pause/resume/delete, and audit logging.
- Campaign collections already used or planned: `campaigns`, `campaign_memberships`, `campaign_links`, `campaign_audit_logs`, with `short_links` mirrors for redirect compatibility.
- Admin frontend modules for dashboard, campaigns, create link, links table, QR codes, analytics, billing, and tenant onboarding.
- Alumni campaign flow through KORTEX link creation: source group, source batch, school metadata, channel, organizer role, sender, max uses, 7-day deadline, report-key generation, and zero-login report dashboard.
- Analytics frontend that derives campaign performance from links and exports campaign assignment in CSV.

Key gaps:

- Tenant onboarding is currently frontend-only pending provisioning; backend admin tenant provisioning APIs are not mounted yet.
- Tenant-specific login pages and branded tenant admin portals do not exist.
- Public external API-key routes exist conceptually but should remain unmounted until internal tenant safety is complete.
- Campaign analytics are partially derived from links rather than using a complete campaign event model.
- Campaign link creation exists in backend but needs a polished frontend workflow tied to campaign context.
- Domain verification and custom tenant domains are not complete.

## v2 Product Goals

KORTEX v2 should let Kaayko offer each tenant:

- A branded login page, for example `https://parishram.alumni.kaayko.com/login`.
- A branded admin workspace, for example `https://parishram.alumni.kaayko.com/admin`.
- A short Kaayko entry URL, for example `https://kaayko.com/a/parishram/admin`, that resolves to the tenant portal.
- Tenant-scoped link creation with safe defaults, templates, QR codes, and bulk generation.
- Campaign workspaces for alumni, school outreach, brand campaigns, creator campaigns, and custom link programs.
- Real-time and historical performance analytics at portfolio, campaign, link, channel, audience, batch, and source-group levels.
- Safe sharing of public report dashboards where appropriate, especially for alumni school admins.
- Role-based access so owners, editors, link operators, and viewers can do only what they should.

## Non-Negotiables

- Existing `/l/:code` links must keep working.
- Existing `short_links/{code}` documents must stay redirect-readable.
- `/smartlinks` remains backend compatibility, but new frontend and docs should use `/kortex`.
- Tenant isolation must be enforced server-side; frontend hiding is never enough.
- Client-supplied tenant/domain/path fields must never override authenticated tenant context unless a super-admin operation explicitly allows it.
- Report dashboards must strip sensitive fields such as IP hash, fingerprints, edit tokens, and raw private metadata.
- Alumni voting remains anonymous by default and token-gated.
- KORTEX v2 must be deployable incrementally.

## Target Tenant Experience

### Example: Parishram Alumni

1. Kaayko provisions tenant `parishram`.
2. DNS points `parishram.alumni.kaayko.com` to the KORTEX tenant portal.
3. Parishram admin visits `https://kaayko.com/a/parishram/admin`.
4. Kaayko redirects them to `https://parishram.alumni.kaayko.com/login`.
5. Login page shows Parishram branding, alumni-specific copy, and allowed login methods.
6. Admin logs in.
7. Backend confirms their `admin_users/{uid}` record includes `tenantId: "parishram"` or `tenantIds: ["parishram"]`.
8. Admin lands on a tenant-scoped dashboard.
9. Admin creates an alumni campaign or opens an existing campaign.
10. Admin creates links for WhatsApp groups, batches, city chapters, faculty groups, or individual organizers.
11. Each link produces a tenant-owned URL and QR code.
12. Admin tracks clicks, unique visits, votes, source group performance, batch distribution, trust buckets, and conversion rate.
13. Admin can share a zero-login report URL with school leadership.

## URL And Routing Model

### Tenant Portal URLs

Support these URL forms:

```text
https://kaayko.com/a/:tenantSlug/admin
https://:tenantSlug.alumni.kaayko.com/login
https://:tenantSlug.alumni.kaayko.com/admin
https://:tenantSlug.alumni.kaayko.com/links
https://:tenantSlug.alumni.kaayko.com/campaigns
https://:tenantSlug.alumni.kaayko.com/analytics
```

The `/a/:tenantSlug/admin` route is the low-risk v2 entrypoint. Subdomains are the branded production experience.

### Public Link URLs

Keep current links:

```text
https://kaayko.com/l/:code
https://kaayko.com/:campaignSlug/:code
```

Add tenant-branded links:

```text
https://:tenantSlug.alumni.kaayko.com/l/:code
https://:tenantSlug.alumni.kaayko.com/:campaignSlug/:code
```

Later support custom domains:

```text
https://alumni.parishram.edu/l/:code
https://go.parishram.edu/a/:code
```

### Resolver Rules

For portal routes:

1. Resolve tenant by hostname or path slug.
2. Confirm tenant is enabled.
3. Load tenant branding and feature flags.
4. Serve shared tenant portal shell.
5. Frontend bootstraps with locked `tenantId`.

For public campaign routes:

1. Resolve host/domain to tenant.
2. Resolve campaign slug to campaign in that tenant.
3. Confirm campaign status is active and not expired.
4. Resolve campaign link by campaign ID and public code.
5. Enforce link status, max uses, expiry, and source rules.
6. Track event.
7. Redirect to platform-specific destination.

## Data Model

### `tenants/{tenantId}`

```json
{
  "id": "parishram",
  "slug": "parishram",
  "name": "Parishram Alumni",
  "type": "alumni",
  "status": "active",
  "enabled": true,
  "domain": "parishram.alumni.kaayko.com",
  "pathPrefix": "/l",
  "portal": {
    "defaultRoute": "/admin",
    "loginRoute": "/login",
    "supportEmail": "support@kaayko.com"
  },
  "branding": {
    "logoUrl": "",
    "primaryColor": "",
    "accentColor": "",
    "schoolName": "Parishram",
    "heroImageUrl": ""
  },
  "auth": {
    "allowedEmailDomains": [],
    "inviteOnly": true,
    "allowedProviders": ["google", "email"]
  },
  "features": {
    "links": true,
    "campaigns": true,
    "analytics": true,
    "alumniReports": true,
    "apiKeys": false,
    "webhooks": false,
    "customDomains": false
  },
  "limits": {
    "linksPerMonth": 5000,
    "campaigns": 50,
    "maxUsesPerLink": 500,
    "admins": 10
  },
  "billing": {
    "plan": "pilot",
    "status": "active"
  },
  "createdAt": "server timestamp",
  "updatedAt": "server timestamp"
}
```

### `tenant_domains/{domain}`

```json
{
  "domain": "parishram.alumni.kaayko.com",
  "tenantId": "parishram",
  "type": "kaayko-subdomain",
  "status": "verified",
  "verifiedAt": "server timestamp",
  "createdAt": "server timestamp"
}
```

For custom domains, add verification records:

```json
{
  "domain": "alumni.parishram.edu",
  "tenantId": "parishram",
  "type": "custom-domain",
  "status": "pending",
  "verificationToken": "kaayko-site-verification=...",
  "dns": {
    "cnameTarget": "kaaykostore.web.app",
    "txtName": "_kaayko-verify.alumni"
  }
}
```

### `admin_users/{uid}`

Extend the current admin user model:

```json
{
  "uid": "firebase-uid",
  "email": "admin@parishram.edu",
  "displayName": "Parishram Admin",
  "role": "admin",
  "tenantId": "parishram",
  "tenantIds": ["parishram"],
  "permissions": [
    "links:create",
    "links:read",
    "links:update",
    "analytics:read",
    "campaign:read"
  ],
  "enabled": true
}
```

### `tenant_invites/{inviteId}`

```json
{
  "tenantId": "parishram",
  "email": "admin@parishram.edu",
  "role": "admin",
  "status": "pending",
  "invitedBy": "super-admin-uid",
  "expiresAt": "timestamp",
  "acceptedAt": null
}
```

### `campaigns/{campaignId}`

Use the existing campaign foundation and expand it:

```json
{
  "tenantId": "parishram",
  "tenantName": "Parishram Alumni",
  "campaignId": "parishram-alumni-2026",
  "slug": "a",
  "type": "alumni",
  "name": "Alumni Interest 2026",
  "description": "",
  "status": "active",
  "domain": "parishram.alumni.kaayko.com",
  "pathPrefix": "/a",
  "defaultDestinations": {
    "web": "https://parishram.alumni.kaayko.com/alumni",
    "ios": null,
    "android": null
  },
  "settings": {
    "maxUsesPerLink": 50,
    "allowPublicStats": false,
    "expiresAt": null,
    "defaultVotingDeadlineDays": 7,
    "defaultUtmCampaign": "parishram-alumni-2026"
  },
  "templates": {
    "linkTitle": "{{sourceGroup}} {{sourceBatch}}",
    "messageTemplateId": "wa-alumni-interest-v1"
  },
  "ownerUids": ["uid"],
  "createdBy": "uid",
  "createdAt": "server timestamp",
  "updatedAt": "server timestamp"
}
```

### `campaign_links/{campaignId_code}`

Keep current backend shape and add richer audience/source fields:

```json
{
  "tenantId": "parishram",
  "campaignId": "parishram-alumni-2026",
  "code": "batch-2005-wa",
  "shortLinkCode": "a_batch-2005-wa",
  "status": "active",
  "title": "Batch 2005 WhatsApp",
  "destinations": {
    "web": "https://parishram.alumni.kaayko.com/alumni",
    "ios": null,
    "android": null
  },
  "utm": {
    "utm_source": "whatsapp",
    "utm_medium": "group",
    "utm_campaign": "parishram-alumni-2026",
    "utm_content": "batch-2005"
  },
  "metadata": {
    "campaign": "alumni",
    "sourceGroup": "Batch 2005 Alumni Group",
    "sourceBatch": "2005",
    "schoolName": "Parishram",
    "schoolId": "parishram",
    "channel": "whatsapp",
    "audienceType": "alumni",
    "organizerRole": "batch-representative",
    "sender": "Anita",
    "maxUses": 50,
    "votingDeadline": "iso date"
  },
  "usesCount": 0,
  "uniqueVisitCount": 0,
  "createdBy": "uid",
  "createdAt": "server timestamp",
  "updatedAt": "server timestamp"
}
```

### `short_links/{shortLinkCode}`

Continue using `short_links` as redirect mirror and compatibility read model:

```json
{
  "tenantId": "parishram",
  "tenantName": "Parishram Alumni",
  "campaignId": "parishram-alumni-2026",
  "campaignSlug": "a",
  "code": "a_batch-2005-wa",
  "publicCode": "batch-2005-wa",
  "shortUrl": "https://parishram.alumni.kaayko.com/a/batch-2005-wa",
  "domain": "parishram.alumni.kaayko.com",
  "pathPrefix": "/a",
  "destinations": {},
  "utm": {},
  "metadata": {},
  "enabled": true,
  "isCampaignLink": true,
  "clickCount": 0,
  "uniqueVisitCount": 0
}
```

### `link_events/{eventId}`

Add a unified event ledger for all links:

```json
{
  "tenantId": "parishram",
  "campaignId": "parishram-alumni-2026",
  "linkCode": "a_batch-2005-wa",
  "publicCode": "batch-2005-wa",
  "eventType": "click",
  "timestamp": "server timestamp",
  "host": "parishram.alumni.kaayko.com",
  "referrer": "",
  "platform": "web",
  "userAgentHash": "",
  "ipHash": "",
  "utm": {},
  "metadata": {
    "sourceGroup": "Batch 2005 Alumni Group",
    "sourceBatch": "2005"
  }
}
```

### `campaign_daily_metrics/{tenantId_campaignId_date}`

Pre-aggregate for fast dashboards:

```json
{
  "tenantId": "parishram",
  "campaignId": "parishram-alumni-2026",
  "date": "2026-04-26",
  "clicks": 220,
  "uniqueVisitors": 180,
  "conversions": 64,
  "conversionRate": 0.355,
  "topLinks": [],
  "topSources": []
}
```

## API Plan

### Tenant Resolution

```text
GET /kortex/tenant-resolve?host=parishram.alumni.kaayko.com
GET /kortex/tenant-resolve?slug=parishram
GET /kortex/tenant-bootstrap
```

`tenant-bootstrap` uses the request host and authenticated user when available. It returns tenant branding, allowed features, and the user's effective permissions.

### Super-Admin Provisioning

```text
POST /kortex/admin/tenants
GET /kortex/admin/tenants
GET /kortex/admin/tenants/:tenantId
PUT /kortex/admin/tenants/:tenantId
POST /kortex/admin/tenants/:tenantId/enable
POST /kortex/admin/tenants/:tenantId/disable
POST /kortex/admin/tenants/:tenantId/admin-users
GET /kortex/admin/tenants/:tenantId/admin-users
POST /kortex/admin/tenants/:tenantId/invites
POST /kortex/admin/tenants/:tenantId/api-keys
GET /kortex/admin/tenants/:tenantId/api-keys
POST /kortex/admin/tenants/:tenantId/webhooks
GET /kortex/admin/tenants/:tenantId/webhooks
GET /kortex/admin/tenants/:tenantId/dns-status
POST /kortex/admin/tenants/:tenantId/domains
POST /kortex/admin/tenants/:tenantId/domains/:domain/verify
```

These routes restore the tenant onboarding wizard from pending mode to real provisioning.

### Tenant Admin Routes

Use existing KORTEX route family:

```text
GET /kortex
POST /kortex
GET /kortex/:code
PUT /kortex/:code
DELETE /kortex/:code
GET /kortex/stats
```

Improve with:

```text
GET /kortex/links/:code/analytics
POST /kortex/links/bulk
POST /kortex/links/:code/duplicate
POST /kortex/links/:code/pause
POST /kortex/links/:code/resume
GET /kortex/templates
POST /kortex/templates
```

### Campaign Routes

Continue and harden:

```text
POST /campaigns
GET /campaigns
GET /campaigns/:campaignId
PUT /campaigns/:campaignId
POST /campaigns/:campaignId/pause
POST /campaigns/:campaignId/resume
POST /campaigns/:campaignId/archive
GET /campaigns/:campaignId/members
POST /campaigns/:campaignId/members
DELETE /campaigns/:campaignId/members/:uid
POST /campaigns/:campaignId/links
GET /campaigns/:campaignId/links
GET /campaigns/:campaignId/links/:code
PUT /campaigns/:campaignId/links/:code
POST /campaigns/:campaignId/links/:code/pause
POST /campaigns/:campaignId/links/:code/resume
DELETE /campaigns/:campaignId/links/:code
```

Add analytics and utilities:

```text
GET /campaigns/:campaignId/analytics
GET /campaigns/:campaignId/links/:code/analytics
POST /campaigns/:campaignId/links/bulk
POST /campaigns/:campaignId/links/import
GET /campaigns/:campaignId/export.csv
GET /campaigns/:campaignId/audit-log
POST /campaigns/:campaignId/report-keys
```

### Alumni Routes

Keep existing public and admin routes:

```text
GET /alumni/vote-count
POST /alumni/interest
GET /alumni/interest/:editToken
PUT /alumni/interest/:editToken
GET /alumni/report?rk=KEY
POST /alumni/report-key
GET /alumni/admin/leads
GET /alumni/admin/stats
POST /alumni/admin/report-key
```

Improve by adding tenant and campaign filters:

```text
GET /alumni/admin/stats?tenantId=...&campaignId=...
GET /alumni/admin/leads?tenantId=...&campaignId=...
GET /alumni/report?rk=KEY&range=30d
```

## Link Creation Improvements

### Standard Link Creation

The current create-link form should become a guided builder:

- Destination section: web, iOS, Android.
- Link identity: title, optional custom code, description.
- Tracking: UTM builder with presets.
- Audience metadata: source, channel, region, batch, school, organizer.
- Expiration and caps: expiry date, max clicks/unique visits.
- QR: preview, download, copy.
- Review step: final URL, destination preview, tracking preview.

### Campaign Link Creation

When creating inside a campaign:

- Campaign supplies default destination, UTM campaign, max-use default, and domain/path.
- User supplies only link-specific fields such as source group, batch, sender, channel, and optional custom code.
- Backend creates `campaign_links` and `short_links` mirror atomically.
- UI displays public URL, QR code, copy button, and performance placeholder.

### Alumni Link Creation

Preserve the current one-link model:

- All alumni campaign links are the same type.
- Required: sourceGroup, sourceBatch.
- Optional: sender, schoolName, schoolId, campaignId, channel, chapterOrRegion, audienceType, organizerRole, messageTemplateId.
- Default maxUses: 50.
- Allowed maxUses range for UI: 1-500 unless tenant limit increases it.
- votingDeadline: 7 days from creation by default.
- Generate report key automatically after creation.
- Show share URL and report dashboard URL together.

Improve:

- Add preview of voter destination with token behavior explained in admin-only text.
- Add batch/source duplicate detection.
- Add suggested link code from sourceGroup + sourceBatch.
- Add bulk creation from CSV paste:
  - sourceGroup
  - sourceBatch
  - sender
  - channel
  - maxUses
- Add WhatsApp message template generator.
- Add QR sheet export for offline events.

### Bulk Link Creation

Support:

- CSV import.
- Paste table import.
- Template-based generation for batches 1990-2026.
- Duplicate-code prevention.
- Dry-run validation before creation.
- Partial success reporting.
- Downloadable result CSV with URLs, QR URLs, and errors.

### Link Templates

Templates should define:

- Link title pattern.
- Code pattern.
- UTM defaults.
- Metadata defaults.
- Destination defaults.
- Expiry and max-use defaults.
- Message copy.

Example:

```json
{
  "templateId": "alumni-whatsapp-batch",
  "name": "Alumni WhatsApp Batch",
  "type": "alumni",
  "titlePattern": "{{schoolName}} Batch {{sourceBatch}}",
  "codePattern": "{{sourceBatch}}-{{channel}}",
  "utm": {
    "utm_source": "whatsapp",
    "utm_medium": "group"
  }
}
```

## Campaign Features To Add

### Campaign Dashboard

Each campaign should show:

- Status: draft, active, paused, archived, expired.
- Public URL pattern.
- Total links.
- Active/paused/deleted links.
- Total clicks.
- Unique visitors.
- Conversion count.
- Conversion rate.
- Top source groups.
- Top batches.
- Top channels.
- Recent activity.
- Links needing attention.

### Campaign Lifecycle

Lifecycle behavior:

- Draft: editable, not publicly resolvable unless explicitly previewed.
- Active: links resolve and events track.
- Paused: links show unavailable page, mirrors disabled.
- Archived: hidden by default, mirrors disabled, audit preserved.
- Expired: automatically unavailable after `settings.expiresAt`.

### Members And Roles

Roles:

- owner: full campaign and member management.
- editor: edit campaign and links.
- link-operator: create and manage links only.
- viewer: read dashboards and export allowed analytics.

Permissions:

- `campaign:read`
- `campaign:update`
- `campaign:pause`
- `campaign:archive`
- `members:manage`
- `links:create`
- `links:update`
- `analytics:read`
- `reports:create`
- `exports:create`

### Audit Log

Show audit entries for:

- Campaign created/updated.
- Status changed.
- Member added/removed.
- Link created/updated/paused/resumed/deleted.
- Report key generated.
- Export generated.
- Tenant settings changed.

## Analytics Plan

### Dashboard Levels

1. Portfolio analytics: all tenant links and campaigns.
2. Campaign analytics: one campaign.
3. Link analytics: one link.
4. Alumni report analytics: public report-safe summary.

### Metrics

Core:

- Clicks.
- Unique visitors.
- Conversions.
- Conversion rate.
- Active links.
- New links.
- Dormant links.
- Top links.
- Top campaigns.

Attribution:

- UTM source, medium, campaign, content, term.
- sourceGroup.
- sourceBatch.
- channel.
- sender.
- audienceType.
- chapterOrRegion.
- schoolName/schoolId.

Alumni:

- votes submitted.
- token issued count.
- token consumed count.
- limit reached count.
- flagged/suspicious bucket.
- interest-chip breakdown.
- batch distribution.
- city distribution.
- volunteer/donation/mentor intent.

Time:

- 24h, 7d, 30d, 90d, all.
- Period-over-period delta.
- Daily trend.
- Link creation trend.
- Click-to-vote lag.

### Analytics API Shape

Campaign analytics response:

```json
{
  "success": true,
  "tenant": { "id": "parishram" },
  "campaign": { "campaignId": "parishram-alumni-2026" },
  "range": "30d",
  "summary": {
    "clicks": 1000,
    "uniqueVisitors": 720,
    "conversions": 280,
    "conversionRate": 0.389
  },
  "series": [],
  "links": [],
  "sources": [],
  "batches": [],
  "channels": []
}
```

### Privacy

Admin analytics may show operational metadata.

Public report analytics must never expose:

- IP hash.
- userAgent hash.
- edit tokens.
- raw visit token.
- raw email unless explicitly verified and permitted.
- internal fraud debug fields.
- admin-only sender notes if marked private.

## Tenant Portal UX

### Public Tenant Login

Route: `/:tenantSlug.alumni.kaayko.com/login`

Must include:

- Tenant logo/name.
- Kaayko powered-by footer.
- Google/email login options based on tenant settings.
- Clear error when user is authenticated but not assigned to tenant.
- Redirect back to tenant admin after login.

### Tenant Admin Shell

Navigation:

- Dashboard.
- Campaigns.
- Links.
- Create Link.
- Analytics.
- Reports.
- QR Codes.
- Settings.

Behavior:

- Tenant context is resolved before loading modules.
- `X-Kaayko-Tenant-Id` is always set.
- Tenant name and domain are visible in header.
- Super-admins can switch tenants.
- Tenant admins cannot switch outside their allowed tenant list.

### Tenant Settings

Tenant admins with permission can edit:

- Logo.
- Brand colors.
- Default link domain.
- Message templates.
- Public report visibility.
- Allowed admin invite domains.

Super-admin only:

- Enable/disable tenant.
- Billing plan.
- Feature flags.
- Domain verification.
- API keys/webhooks.

## Security And Abuse Controls

### Auth

- Firebase Auth remains the identity layer.
- Backend loads `admin_users/{uid}` on each protected request.
- Disabled admin users cannot access any tenant.
- Tenant assignment is checked server-side.

### Tenant Isolation

- Every query must include tenant context unless super-admin explicitly requests all tenants.
- `X-Kaayko-Tenant-Id` is honored only if user has access.
- Non-super-admin cannot set tenantId/domain/pathPrefix in writes.
- Campaign links cannot be created for campaigns outside tenant access.

### Link Abuse

- Validate destination URLs.
- Optional domain allowlist per tenant.
- Rate-limit link creation, redirect event writes, public token issue, and report access.
- Enforce maxUses atomically.
- Enforce expiry consistently in redirect and vote submission paths.
- Store event fingerprints as hashes only.

### Report Keys

- Report keys should be scoped to tenant + campaign + allowed report sections.
- Report key URLs should be revocable.
- Report key usage should be logged.
- Report keys should expire by default unless tenant setting allows persistent reports.

## Billing And Plans

Use billing to enforce:

- Number of active campaigns.
- Monthly tracked events.
- Admin seats.
- Branded subdomain.
- Custom domain.
- Public reports.
- Bulk link import.
- API keys/webhooks.
- Data export.

Initial plans:

- Pilot: manually provisioned tenant, low limits.
- Growth: branded subdomain, campaigns, analytics, reports.
- Pro: custom domain, bulk import, API keys, webhooks, advanced exports.

## Deployment Architecture

### Phase 1: Path-Based Tenant Portal

Ship:

- `kaayko.com/a/:tenantSlug/admin`.
- Tenant resolver API.
- Shared tenant admin shell.
- Tenant-scoped dashboard, links, campaigns, analytics.

Avoid:

- wildcard DNS.
- custom domains.
- automatic DNS verification.

### Phase 2: Kaayko Subdomains

Ship:

- `:tenantSlug.alumni.kaayko.com`.
- Host-based tenant resolver.
- Branded login and admin.
- Tenant-branded public links.

### Phase 3: Custom Domains

Ship:

- custom domain records.
- DNS verification.
- domain conflict protection.
- custom-domain public redirects.

### Phase 4: Self-Serve Provisioning

Ship:

- tenant registration approval workflow.
- automatic tenant creation.
- admin invites.
- default campaign templates.
- billing checkout and plan activation.

## Implementation Phases

### Phase 0: Stabilize Current KORTEX

- Keep `/kortex` canonical across frontend.
- Keep `/smartlinks` compatibility.
- Keep KORTEX tests green.
- Document active API contracts.
- Ensure deploy checklist includes hosting and API.

Acceptance:

- Existing dashboard, links, analytics, create-link, QR, campaign, and redirect flows still work.
- `npm run test:kortex -- --runInBand --forceExit` passes.

### Phase 1: Tenant Bootstrap And Portal Shell

- Add tenant resolver API.
- Add tenant bootstrap API.
- Add path-based tenant admin route.
- Build tenant-aware login page.
- Build shared tenant admin shell that loads current KORTEX modules.
- Add tenant branding injection.

Acceptance:

- `kaayko.com/a/parishram/admin` resolves Parishram tenant context.
- Parishram admin logs in and sees only Parishram data.
- Unassigned user receives a clear forbidden state.

### Phase 2: Real Tenant Provisioning APIs

- Implement super-admin tenant CRUD.
- Implement admin invite creation.
- Implement admin user assignment.
- Implement domain status endpoint.
- Implement API-key and webhook provisioning endpoints behind feature flags.
- Convert tenant onboarding wizard from pending mode to real provisioning.

Acceptance:

- Super-admin creates tenant from UI.
- Tenant admin invite can be accepted.
- Tenant appears in switcher for super-admin.
- Tenant admins cannot see other tenants.

### Phase 3: Campaign Link Builder

- Add campaign-context create-link UI.
- Add campaign link bulk creation.
- Add alumni-specific campaign template.
- Add QR and result CSV export.
- Generate report keys from campaign context.

Acceptance:

- Tenant admin creates an alumni campaign.
- Tenant admin creates one link and bulk links inside it.
- Links resolve through campaign route and mirror into `short_links`.
- Report URL is generated and scoped correctly.

### Phase 4: Analytics v2

- Add unified event ledger.
- Add campaign analytics API.
- Add link analytics API.
- Add pre-aggregated daily metrics.
- Upgrade frontend campaign analytics to use APIs instead of only derived link data.
- Add CSV exports by campaign, source, batch, and link.

Acceptance:

- Campaign dashboard shows clicks, uniques, conversions, conversion rate, top sources, and time-series.
- Link detail shows per-link performance.
- Alumni report dashboard matches admin aggregate within privacy constraints.

### Phase 5: Branded Subdomains

- Add host-based tenant portal routing.
- Configure wildcard or managed subdomains.
- Add tenant-domain records.
- Serve login/admin shell under tenant subdomain.

Acceptance:

- `parishram.alumni.kaayko.com/login` loads Parishram branding.
- `parishram.alumni.kaayko.com/admin` loads Parishram-scoped KORTEX.
- Public links on Parishram subdomain redirect correctly.

### Phase 6: Custom Domains And External Integrations

- Add DNS verification.
- Add custom-domain routing.
- Mount external API-key routes only after tenant isolation tests.
- Enable webhooks for eligible plans.

Acceptance:

- Custom domain can be verified and assigned to one tenant only.
- API-key routes cannot escape tenant.
- Webhook deliveries are signed and logged.

## Testing Plan

### Backend Tests

Add or extend:

- Tenant resolver tests.
- Tenant bootstrap tests.
- Super-admin tenant provisioning tests.
- Tenant admin forbidden/access tests.
- Campaign link bulk create tests.
- Campaign analytics aggregation tests.
- Report-key scoping tests.
- Domain conflict tests.
- Max-use atomic enforcement tests.
- Expiry enforcement tests.
- Custom-domain resolver tests.

Keep:

- KORTEX API suite.
- Campaign suite.
- Campaign resolver suite.
- Hardening suite.

Command:

```bash
cd /Users/Rohan/Kaayko_v6/kaayko-api/functions
npm run test:kortex -- --runInBand --forceExit
```

### Frontend Tests

Minimum manual smoke:

- Login as super-admin.
- Login as tenant admin.
- Open path-based tenant admin.
- Open subdomain tenant admin.
- Create standard link.
- Create campaign.
- Create campaign link.
- Bulk create alumni links.
- Copy share URL.
- Copy report URL.
- Load analytics.
- Export CSV.
- Verify forbidden state for wrong tenant.

Automated checks:

- Static asset references.
- No active frontend `/smartlinks` calls except compatibility rewrite.
- No calls to unmounted tenant provisioning endpoints.
- KORTEX pages load without console module errors.

### Security Tests

- Non-admin cannot create campaign.
- Tenant admin cannot read another tenant campaign.
- Tenant admin cannot spoof `tenantId`.
- Tenant admin cannot spoof domain/pathPrefix.
- Disabled tenant cannot resolve portal or links.
- Paused campaign disables campaign links.
- Archived campaign disables campaign links.
- Report key from one tenant cannot access another tenant's report.

## Migration Plan

### Existing Links

- Leave existing `short_links` untouched.
- Ensure default tenant fields exist through migration.
- Treat links without `campaignId` as portfolio links.
- Derived campaigns in frontend remain fallback until campaign migration.

### Existing Alumni Links

- Preserve metadata fields.
- Backfill campaign IDs where `metadata.campaign === "alumni"`.
- Optionally create campaign records for recurring alumni groups.
- Keep report-key behavior unchanged during migration.

### Existing Frontend

- Keep current admin modules.
- Add tenant bootstrap before view load.
- Gradually replace derived campaign analytics with campaign APIs.

## Operational Runbooks

### Provision Tenant

1. Create tenant.
2. Assign domain.
3. Invite owner/admin.
4. Create default campaign template.
5. Verify login.
6. Create test link.
7. Click test link.
8. Verify analytics.
9. Share tenant portal URL.

### Launch Alumni Campaign

1. Create or select tenant.
2. Create alumni campaign.
3. Confirm default destination.
4. Bulk create source-group links.
5. Generate report key.
6. Export URL sheet.
7. Share links.
8. Monitor clicks and votes.
9. Export summary.

### Disable Tenant

1. Disable tenant.
2. Disable public portal.
3. Disable new link creation.
4. Leave existing audit logs.
5. Return clear unavailable pages for tenant campaign links.

## Open Decisions

- Whether tenant subdomains use Firebase Hosting wildcard support, Cloud Run, or explicit hosting domain mappings.
- Whether `alumni.kaayko.com` remains a separate static site or becomes the shared tenant portal host.
- Whether public report keys are permanent, expiring, or tenant-configurable.
- Whether custom domains are limited to Pro plans.
- Whether alumni reports can expose raw comments by default or require a separate permission.
- Whether campaign slugs are tenant-global or domain-specific.

## Recommended First Build

Start with Phase 1 and Phase 2 together:

1. Add tenant resolver/bootstrap.
2. Add path-based tenant admin route.
3. Add super-admin tenant provisioning APIs.
4. Convert onboarding wizard from pending to real provisioning.
5. Scope existing KORTEX modules by tenant bootstrap.

This gets real tenant portals working before taking on wildcard DNS and custom-domain complexity. After that, Phase 3 should make campaign link creation feel native instead of split between general link creation and campaign management.

