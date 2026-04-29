# KORTEX Delivery Plan And Definition Of Done

## Purpose

This document turns the KORTEX V2 tenant-link platform into an execution plan. The goal is to make `kortex.kaayko.com` the tenant-facing operating system where Kaayko SuperAdmins, tenant admins, and alumni-facing workflows can create links, route users, and measure performance.

The user should not need to perform implementation work. The only expected user action is to approve or press a button when an external system requires an account-holder action, such as a production deploy approval, DNS/custom-domain confirmation, Firebase domain verification, or payment-provider activation.

## Delivery Agreement

Codex owns:

- code changes across frontend and backend repositories
- schema and data-contract updates
- tests, static checks, smoke checks, and regressions
- documentation updates, file maps, and README updates
- local commits on `main`
- deployment commands when approval is available
- production smoke-test evidence after deployment
- rollback notes for each production-facing phase

The user owns only:

- approving an explicit deploy or external-service action when prompted
- pressing provider-console buttons that cannot be automated safely
- providing credentials or business decisions if they are not discoverable from the repository

Every manual action must be written as a button-only instruction with:

- exact system or console
- exact page or setting
- exact button or approval to press
- expected successful result
- fallback if the result is not observed

## Current Baseline

KORTEX V2 foundation is already present:

- `/kortex` is the canonical API namespace.
- `/smartlinks` remains backend compatibility.
- `/l/:code` remains the universal public short-link family.
- `/a/:code` and `/a/:tenantSlug/...` route through the tenant shell.
- `src/tenant.html` and `src/js/tenant-portal.js` resolve tenant paths and compact aliases.
- KORTEX link creation can create namespace aliases through `/kortex/tenant-links`.
- Backend KORTEX supports tenant bootstrap, link resolve, tenant analytics, events, and tenant registration.

This plan assumes that foundation remains backward compatible and is extended rather than replaced.

## North Star

KORTEX becomes the tenant-facing link and performance platform for Kaayko:

- `kortex.kaayko.com/login` is the KORTEX login entry.
- SuperAdmins can log in without choosing a tenant.
- Tenant admins must select or inherit an authorized tenant before entering tenant-scoped pages.
- Each tenant can create admin, alumni, registration, campaign, philanthropy, report, and QR links.
- Each link carries tenant, campaign, audience, source, intent, auth, return, and conversion metadata.
- Every click and conversion is attributable to tenant, campaign, link, source, and audience.
- Existing public links never break.

## Public URL Families

Keep and support:

- `https://kaayko.com/l/:code` for universal short links
- `https://kaayko.com/:namespace/:code` for compact tenant or campaign aliases
- `https://kaayko.com/a/:tenantSlug/admin` for tenant admin entry
- `https://kaayko.com/a/:tenantSlug/register` for tenant-scoped registration
- `https://kaayko.com/a/:tenantSlug/campaigns/:campaignSlug` for tenant campaign entry
- `https://kortex.kaayko.com/login` for KORTEX login
- `https://kortex.kaayko.com/select-tenant` for multi-tenant admins
- `https://kortex.kaayko.com/t/:tenantSlug/...` for tenant workspaces
- `https://kortex.kaayko.com/super-admin/...` for global SuperAdmin operations
- `https://:tenantSlug.alumni.kaayko.com/login` for branded tenant alumni login

Later custom-domain targets:

- `https://alumni.example.org/login`
- `https://give.example.org/:campaignSlug`
- `https://admin.example.org/login`

## Core Product Areas

### SuperAdmin

- Global login without tenant selection.
- Tenant directory and tenant health.
- Cross-tenant link and campaign oversight.
- Broken-link, expired-link, and event-ingestion monitoring.
- Tenant domain and DNS readiness.
- Tenant admin impersonation only if explicitly audited.

### Tenant Admin

- Tenant-scoped login or tenant selection.
- Tenant dashboard.
- Link creation and management.
- Campaign and philanthropy workspace.
- Alumni registration review.
- Analytics and export.
- QR and print-channel link generation.
- Domain and branding settings.

### Alumni And Public Users

- Tenant-branded login.
- Registration intake.
- Campaign landing page.
- Authenticated campaign/member view.
- Philanthropy campaign view.
- Donation or interest confirmation.
- Return-to-target behavior after login.

## Destination Types

KORTEX links should support:

- `tenant_admin_login`
- `tenant_alumni_login`
- `tenant_registration`
- `tenant_public_page`
- `tenant_dashboard`
- `campaign_landing`
- `campaign_member_view`
- `philanthropy_campaign`
- `donation_checkout`
- `campaign_report`
- `external_url`

Each link should carry:

- `tenantId`
- `tenantSlug`
- `campaignId` when applicable
- `campaignSlug` when applicable
- `destinationType`
- `requiresAuth`
- `audience`
- `source`
- `intent`
- `returnTo`
- `conversionGoal`
- `publicCode`
- `namespace`
- `createdBy`
- `status`
- `expiresAt`

## Execution Phases

### Phase 1: KORTEX App Hosting

Deliver `kortex.kaayko.com` as a first-class frontend surface.

Tasks:

- Decide final Firebase Hosting structure: dedicated site preferred, existing site rewrite acceptable only as a temporary bridge.
- Add hosting target and rewrites for `kortex.kaayko.com`.
- Add app entry pages for `/login`, `/select-tenant`, `/super-admin`, and `/t/:tenantSlug`.
- Keep `kaayko.com/a/**`, `kaayko.com/l/**`, and `kaayko.com/login` behavior backward compatible.
- Add deployment notes and rollback command.

Button-only moments:

- Approve Firebase custom domain connection if the console requires account-holder approval.
- Approve DNS record creation or verification if the domain provider requires it.

Done when:

- `https://kortex.kaayko.com/login` loads the KORTEX app.
- `https://kaayko.com/l/:code` behavior remains unchanged.
- `https://kaayko.com/a/:tenantSlug/admin` behavior remains unchanged.

### Phase 2: Auth And Tenant Session

Make login role-aware and tenant-aware.

Tasks:

- Add backend identity shape for SuperAdmin, tenant admin, and regular alumni/member.
- Add tenant membership lookup.
- Add active-tenant session selection.
- Add frontend route guards.
- Ensure frontend cannot grant tenant scope by local storage alone.
- Add API response for current user, roles, memberships, and active tenant.

Candidate APIs:

- `GET /kortex/me`
- `GET /kortex/tenants/memberships`
- `POST /kortex/session/tenant`
- `DELETE /kortex/session/tenant`

Done when:

- SuperAdmin reaches global workspace without tenant selection.
- One-tenant admin enters that tenant automatically.
- Multi-tenant admin must choose a tenant.
- Unauthorized tenant access returns a safe forbidden state.

### Phase 3: KORTEX App Shell

Build the actual tenant experience, not a landing page.

Tasks:

- Create shared app layout for KORTEX.
- Add navigation for Dashboard, Links, Campaigns, Alumni, Philanthropy, Analytics, QR, Settings.
- Add role-sensitive navigation.
- Wire tenant context into every request.
- Reuse existing admin modules where they fit.
- Move new KORTEX-specific shell code out of legacy admin assumptions.

Done when:

- Tenant admins can use KORTEX without entering the old admin portal.
- SuperAdmins can switch global and tenant views intentionally.
- No tenant-scoped API call is made without an authenticated tenant context.

### Phase 4: Tenant Link Management

Make tenant link creation complete.

Tasks:

- Add link templates for admin login, alumni login, registration, campaign landing, philanthropy, donation, report, and external URL.
- Add namespace alias creation such as `/a/adminP12`.
- Preserve QR/copy default as `/l/:code` unless namespace alias is explicitly selected.
- Add clone-across-channel flow for QR, email, SMS, social, print, and manual.
- Add bulk-create flow for campaigns and print runs.
- Add link health and broken-destination warnings.

Done when:

- Tenant admin can create `kaayko.com/a/adminP12` pointing to `parishram.alumni.kaayko.com/login`.
- Tenant admin can create `kaayko.com/s/adminS1` pointing to `somalwar.alumni.kaayko.com/login` or another tenant-approved destination.
- Tenant links are stored with tenant ownership and cannot be edited cross-tenant.

### Phase 5: Campaign And Philanthropy Workspaces

Bring campaign work under KORTEX ownership while preserving existing routes.

Tasks:

- Keep `/campaigns` backend routes working.
- Move frontend campaign management into the KORTEX app shell.
- Create campaign-to-link workflows.
- Add philanthropy campaign type and link destination.
- Track views, CTA clicks, donor intent, donation start, and donation completion hooks.
- Keep payment-provider integration as an explicit later step if credentials are not available.

Done when:

- A tenant admin can create a campaign and generate tracked KORTEX links from it.
- Alumni can open a public campaign link.
- Auth-required campaign links preserve `returnTo` through login.
- Campaign analytics include link, source, audience, and conversion rollups.

### Phase 6: Registration And Alumni Flows

Make tenant registration trackable from link to review.

Tasks:

- Wire tenant-scoped registration links.
- Capture attribution token from link resolve.
- Track registration started and submitted events.
- Add tenant admin registration review queue.
- Add state transitions for pending, approved, rejected, duplicate, and needs-info.

Done when:

- Registration opened from a KORTEX link is attributed to the link and tenant.
- Tenant admin can review submitted registrations.
- Cross-tenant registrations are impossible through forged client state.

### Phase 7: Analytics And Reporting

Turn click streams into tenant-facing performance dashboards.

Tasks:

- Normalize analytics events.
- Add rollups by tenant, link, campaign, source, audience, and conversion goal.
- Add dashboard cards for clicks, registrations, logins, campaign views, CTA clicks, donation intent, and completions.
- Add broken/expired link reports.
- Add CSV export.
- Add foundation for scheduled report delivery.

Events:

- `link_clicked`
- `redirect_completed`
- `login_started`
- `login_completed`
- `registration_started`
- `registration_submitted`
- `campaign_viewed`
- `campaign_cta_clicked`
- `donation_started`
- `donation_completed`
- `report_opened`
- `qr_scanned`

Done when:

- Tenant dashboards explain which links and campaigns are working.
- CSV export matches visible dashboard totals.
- SuperAdmin can inspect aggregate health without leaking private tenant data to other tenants.

### Phase 8: Branded Subdomains And Custom Domains

Support tenant-owned experiences.

Tasks:

- Resolve tenants by host and path.
- Support `:tenantSlug.alumni.kaayko.com`.
- Add tenant domain registry.
- Add domain status, DNS instructions, SSL readiness, and verification.
- Later support custom domains.

Candidate APIs:

- `GET /kortex/tenants/resolve?host=...&path=...`
- `GET /kortex/tenants/:tenantSlug/bootstrap`
- `GET /kortex/tenants/:tenantSlug/domains`
- `POST /kortex/tenants/:tenantSlug/domains`
- `GET /kortex/tenants/:tenantSlug/domains/:domainId/status`

Button-only moments:

- Add DNS records at the domain provider.
- Approve Firebase or hosting-provider domain verification.

Done when:

- `parishram.alumni.kaayko.com/login` resolves to Parishram tenant context.
- Tenant custom domains can be verified without breaking path-based fallback URLs.

## Backend Contracts

Required backend capabilities:

- role-aware KORTEX session
- tenant membership lookup
- tenant isolation middleware
- link intent resolver
- event ingestion
- analytics rollups
- tenant domain registry
- campaign ownership under KORTEX
- registration attribution

Existing KORTEX compatibility must remain:

- `/kortex/*` canonical routes
- `/smartlinks/*` backend compatibility
- `/l/:code` public short links
- campaign public resolvers
- existing KORTEX tests importing from `functions/api/kortex/*`

## Frontend Contracts

Required frontend capabilities:

- dedicated KORTEX app shell
- role-aware login flow
- tenant selector
- tenant workspace routes
- SuperAdmin workspace routes
- tenant-safe API client
- tenant link creation UI
- campaign and philanthropy workspaces
- registration review UI
- analytics dashboards
- domain settings UI

Frontend must not:

- trust tenant scope from URL or local storage alone
- call unmounted provisioning endpoints
- rewrite public copy/QR URLs away from `/l/:code` unless the user explicitly chooses a namespace alias
- use `/smartlinks` as an active first-choice API namespace

## Data Model Additions

Recommended collections or equivalent tables:

- `kortex_links`
- `kortex_events`
- `kortex_event_rollups`
- `kortex_tenant_memberships`
- `kortex_tenant_sessions`
- `kortex_tenant_domains`
- `kortex_campaigns`
- `kortex_campaign_members`
- `kortex_registration_intake`
- `kortex_audit_log`

Every tenant-owned record must include:

- `tenantId`
- `createdAt`
- `updatedAt`
- `createdBy`
- `status`

Every user action that changes tenant data should create an audit entry.

## Test Matrix

Unit tests:

- resolver handles `/l/:code`
- resolver handles `/:namespace/:code`
- resolver handles `/a/:tenantSlug/admin`
- resolver applies `requiresAuth`
- resolver records exactly one click event per request
- inactive, expired, missing, and cross-tenant links fail safely

API tests:

- SuperAdmin session without tenant
- tenant admin session with one tenant
- tenant admin session with multiple tenants
- forbidden cross-tenant access
- tenant bootstrap by slug
- tenant bootstrap by subdomain
- tenant registration submission
- campaign link creation
- philanthropy link creation
- analytics aggregation by tenant, campaign, link, source, and audience

Frontend tests:

- `kortex.kaayko.com/login` login path
- tenant selection
- tenant dashboard load
- create/edit/delete link
- namespace alias creation
- QR copy still defaults to `/l/:code`
- registration link preserves tenant context
- campaign link preserves return target after login
- analytics views match API payloads

Production smoke tests:

- `https://kortex.kaayko.com/login`
- `https://kaayko.com/l/:code`
- `https://kaayko.com/a/adminP12`
- `https://kaayko.com/a/parishram/admin`
- `https://parishram.alumni.kaayko.com/login`
- tenant registration submit
- campaign landing view
- analytics event appears in tenant dashboard

## Definition Of Done

### Product Done

- Tenants can receive a KORTEX link and use it as their operational entry point.
- Tenant admins can create, manage, and measure links without Kaayko engineering help.
- SuperAdmins can inspect and support tenant activity globally.
- Alumni-facing links preserve tenant context and attribution.
- Existing public links continue to work.

### Frontend Done

- `kortex.kaayko.com` has a real app experience, not a marketing shell.
- Login, tenant selection, SuperAdmin workspace, and tenant workspace are routed.
- All tenant workspace requests carry server-validated tenant context.
- Tenant link, campaign, philanthropy, registration, analytics, QR, and settings pages exist at usable MVP depth.
- No active frontend fetches use `/smartlinks` except the compatibility rewrite.
- No active onboarding screens call unmounted provisioning APIs.

### Backend Done

- KORTEX APIs enforce tenant isolation.
- KORTEX session APIs distinguish SuperAdmin, tenant admin, and alumni/member users.
- Universal resolver records events and redirects safely.
- Analytics are queryable by tenant and campaign.
- Compatibility routes remain mounted and tested.
- New route contracts are documented in backend product docs.

### Data Done

- Tenant ownership exists on all tenant-scoped records.
- Link intent metadata is complete.
- Event records support attribution and rollups.
- Audit records exist for tenant-sensitive changes.
- Migration or backfill steps are documented and repeatable.

### Security Done

- Client-provided tenant identifiers are validated server-side.
- Cross-tenant access is covered by tests.
- SuperAdmin capabilities are explicit and auditable.
- Public event ingestion accepts only known event types and safe payloads.
- Auth-required links do not expose protected content before login.

### Deployment Done

- Frontend and backend deploys complete successfully.
- Production smoke tests pass after deploy.
- DNS/custom-domain checks are recorded when relevant.
- Rollback instructions exist for the shipped phase.
- Working trees are clean or all changes are intentionally committed.

### Documentation Done

- Product docs explain the shipped behavior.
- README and file maps point to the canonical KORTEX documents.
- API route lists are updated.
- Known gaps and future phases are explicitly called out.
- Button-only user actions are documented with exact instructions.

## Rollback Strategy

Each production phase must preserve existing public routes. Rollback should prefer disabling new entrypoints or reverting the latest deploy while leaving compatibility routes intact.

Rollback order:

- disable or remove new hosting rewrite for `kortex.kaayko.com`
- revert frontend deploy to previous release
- disable new backend routes behind feature flags if available
- redeploy previous backend version only if compatibility routes are affected
- verify `/l/:code`, `/kortex/health`, and tenant bootstrap still work

## Open Decisions

These decisions can be made during implementation if not already known:

- whether `kortex.kaayko.com` uses a separate Firebase Hosting site or a route on the existing site
- whether tenant admins are represented in existing admin auth or a new tenant membership collection
- whether alumni login is shared with tenant admin login or separated by role and surface
- whether scheduled reports are email-only at first or downloadable from dashboard first
- which payment or donation provider owns donation completion webhooks

## First Implementation Sprint

The first sprint should deliver:

- KORTEX app hosting for `kortex.kaayko.com`
- login route and app shell
- SuperAdmin versus tenant-admin routing
- tenant selector
- tenant dashboard skeleton
- tenant-safe API client
- smoke-testable production deploy

This sprint is complete only when production smoke tests prove that `kortex.kaayko.com/login` works and existing `kaayko.com/l/:code` and `kaayko.com/a/**` behavior still works.
