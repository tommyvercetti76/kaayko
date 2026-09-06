# Kreator Program Full Feature Audit

Date: 2026-09-05
Audited surfaces: `https://kaayko.com/kreator` and every nested page, the `/api/kreators/*` routes, the kreator auth/session stack, the application review console, kreator-owned products in the shared catalogue, and the Firestore rules and email paths behind all of it.

## Executive Verdict

**The Kreator program does not work in production, and never has.** This is not a
polish problem or a set of rough edges. Four independent, individually fatal
blockers sit in series across the one path a seller must walk:

1. **`SESSION_SECRET` is absent from the deployed function.** Verified directly
   against Cloud Run: 17 environment/secret names are bound to the `api` service
   and `SESSION_SECRET` is not among them. `getSessionSecret()` therefore throws on
   every call, so no kreator session token can be minted and none can be verified.
2. **There is no login endpoint.** `kreator-api.js:200` posts to
   `/kreators/auth/login`. No such route is defined in `kreatorRoutes.js`. The sign-in
   form has always posted into a 404.
3. **The activation email cannot be sent.** It goes through SendGrid.
   `@sendgrid/mail` is not in `package.json` and is not installed, and
   `SENDGRID_API_KEY` is not bound to the function. The send falls through to a
   `console.log` branch that returns `{success: true}`, so the admin UI reports
   "Onboarding email sent" and nothing was sent.
4. **The review console cannot authenticate.** It ships a hardcoded
   `X-Admin-Key: kaayko2026admin` in the served page. Sent against production that
   key returns **401**. No application can be approved or rejected by any UI in this
   repository.

The consequence is exact: a person can apply, will never be emailed anything, cannot
be approved, could not log in if they were, could not receive an activation link, and
after 30 days their application expires permanently. Zero kreator-authored products
exist in the catalogue, which is consistent with all of the above.

Two further findings matter beyond the program itself:

- **`ADMIN_PASSPHRASE` and `KORTEX_SYNC_KEY` are deployed with identical values.**
  Verified by comparing SHA-256 hashes without reading the secrets. The code-level
  fallback that made a shared sync secret into a master admin credential was removed
  on 5 Sep 2026 — but the environment re-creates it exactly.
- **Every `/kreators/admin/*` route is guarded by `requireAdmin`, not
  `requirePlatformAdmin`.** `role: 'admin'` is self-serve via
  `POST /kortex/tenants/provision`, so any Google account can read every applicant's
  PII and approve sellers into the shared catalogue that `kaay.store` sells from.

The backend service layer is genuinely good — approval is transactional, guards
against double-approval and expiry, and writes an audit log. The failure is
everywhere around it.

## Live Evidence

Pages (all on `kaayko.com`):

- `/kreator` -> 200.
- `/kreator/apply` -> 200.
- `/kreator/check-status` -> 200.
- `/kreator/onboarding` -> 200.
- `/kreator/kreator-login` -> 200.
- `/kreator/forgot-password` -> 200.
- `/kreator/dashboard` -> 200.
- `/kreator/add-product` -> 200.
- `/kreator/admin` -> 200, serves "Kreator Admin - Application Management" to an unauthenticated browser.
- `kaay.store/kreator` -> 200 but serves the **store** page. The hosting exclusion works; the kreator portal is correctly absent from the store domain.

APIs (unauthenticated, against `api-vwcc5j4qda-uc.a.run.app`):

- `GET /kreators/me`, `/kreators/products`, `/kreators/admin/applications`, `/kreators/admin/list`, `/kreators/admin/stats` -> **401** each. No data leak.
- `POST /kreators/products` -> 401.
- `POST /kreators/apply` with an empty body -> 400. Validation runs.
- `GET /kreators/admin/applications` **with the console's own hardcoded key** -> **401**.
- `/kreators/test`, `/kreators/test/reset` -> 404. The emulator-only router is correctly gated behind `FUNCTIONS_EMULATOR` and is unreachable in production.

Deployed configuration (Cloud Run `api`, verified directly):

- `SESSION_SECRET` — **ABSENT**
- `SENDGRID_API_KEY` — **ABSENT**
- `MAIL_SMTP_URL` — **ABSENT** (this is also the store's outstanding mail blocker; now empirically confirmed)
- `ADMIN_PASSPHRASE` — present
- `KORTEX_SYNC_KEY` — present, **identical value to `ADMIN_PASSPHRASE`**

Firestore rules:

- `kreator_applications` — `allow read, write: if false`. API-only. Correct.
- `kreators/{kreatorId}` — readable by a matching **Firebase** uid, writes denied. Note the mismatch: kreator sessions are HMAC tokens, not Firebase identities, so this rule governs a different identity than the one the program uses.

Backend tests: `kreator-api.test.js` — **21 passed**. Every test asserts a 401 on an
unauthenticated admin route, which is exactly why they pass while the program is dead:
nothing in the suite exercises a successful login, approval or product create.

## Feature Inventory And Connectivity

| Feature | Frontend | Backend | State | Notes |
|---|---|---|---|---|
| Submit application (public form) | `/Users/Rohan/Kaayko_v6/kaayko/src/kreator/apply.html + src/kreator/js/kreator-api.js:144` | `POST /kreators/apply -> kreatorRoutes.js:144 -> kreatorApplicationService.submitApplication:166` | **Partly broken** | Writes a full application doc to kreator_applications. Validates 15 fields against closed sets for businessType and productCategories. But: no CAPTCHA, rate limit is a per-instance map keyed on the proxy IP, no confirmation email, no length caps on businessName/location/additionalInfo, and the recorded consent IP is the attacker-controlled leftmost X-Forwarded-For. |
| Application ID issuance | `apply.html:1274 (rendered once on the success screen)` | `kreatorApplicationService.generateApplicationId:35 + .set() at :279` | **Partly broken** | Math.random-derived, not crypto. Written with set() rather than create(), so an ID collision silently overwrites. The ID is never emailed or stored client-side, and there is no lookup-by-email route, so losing it is terminal. |
| Check application status | `/Users/Rohan/Kaayko_v6/kaayko/src/kreator/check-status.html` | `GET /kreators/applications/:id/status -> kreatorRoutes.js:193 -> getApplicationStatus:348` | **Partly broken** | Not enumerable in the useful sense: it requires both the id and a matching email, and returns an identical null (404) for not-found and email-mismatch, so it leaks no membership. But it never applies the expiry check, so it reports 'pending' forever; it renders data.applicationId which the API does not return ('undefined'); and 'expired' falls into a 'Status Unknown' branch. Global 10/min rate limit for all callers. |
| Duplicate-application guard | `none` | `kreatorApplicationService.js:177-193` | **Partly broken** | Blocks a second application while an existing one is pending or approved, and the 409 message distinguishes the two states. Non-transactional, so simultaneous submissions both pass. Never consults the kreators collection. Combined with expiry never being written, it permanently blocks re-application after a stale pending row ages out. |
| Application expiry (30 days) | `none` | `kreatorApplicationService.js:320-330 (lazy, admin detail read only) + approve guard at :473` | **Partly broken** | No scheduled job exists (functions/scheduled/ has no kreator entry). Status flips to 'expired' only if an admin happens to open that one application's detail view. Approve independently refuses expired applications with 410. Result is a deadlock with no admin reset route. |
| Admin: list / view applications | `/Users/Rohan/Kaayko_v6/kaayko/src/kreator/admin/index.html:705,858` | `GET /kreators/admin/applications (kreatorRoutes.js:718), GET .../:id (:751)` | **Not connected** | The page sends X-Admin-Key: 'kaayko2026admin' (index.html:661), which does not match the deployed ADMIN_PASSPHRASE, so every call 401s. This is the only UI in kaayko/src that calls these routes. Server side, they are guarded by requireAdmin — the self-serve role — and return whole documents including applicant IP, user agent and consent record. |
| Admin: approve application | `admin/index.html:954` | `PUT /kreators/admin/applications/:id/approve -> approveApplication:447` | **Not connected** | Service logic is sound and transactional (creates the Auth user, kreators doc, crypto-random magic link in short_links, audit log, then sends the magic-link email out of band). Unreachable because the console cannot authenticate. Also guarded by requireAdmin rather than requirePlatformAdmin, and the kreators write at :568 is an unconditional set() that overwrites an existing kreator. |
| Admin: reject application | `admin/index.html:976 (reason via prompt())` | `PUT /kreators/admin/applications/:id/reject -> rejectApplication:692` | **Not connected** | Unreachable for the same auth reason. Even when reached, it sends no email — the required rejectionReason is only visible if the applicant still has their ID and manually visits check-status. |
| Admin: application stats | `admin/index.html:748-751 (computed client-side from the list, not from the stats route)` | `GET /kreators/admin/stats -> kreatorRoutes.js:934 -> getApplicationStats:758` | **Backend only** | getApplicationStats does four Firestore count() aggregations and works, but the admin page derives its counters from the applications array instead and never calls it. Its 'total' therefore counts only the current page (default limit 50), not all applications. |
| Sanitization of applicant free text | `admin/index.html:771-827, 858-920 (innerHTML), :889 (raw href)` | `kreatorApplicationService.js:208-235 (trim only)` | **Not connected** | Nothing escapes at either end. Every applicant-controlled string is interpolated into innerHTML in the reviewer's page, and website passes new URL() so 'javascript:' survives into an href. Latent only because the console currently 401s; fixing auth without fixing this arms a stored XSS that steals the admin credential. |
| Applicant email notifications | `apply.html:1024 promises status by email` | `none for submit or reject; sendMagicLinkEmail only on approve (kreatorApplicationService.js:672)` | **Not connected** | No submission acknowledgement, no reviewer alert, no rejection email. The only mail the pipeline ever sends is the post-approval magic link. |
| Firestore direct access to kreator_applications | `none` | `kaayko-api/firestore.rules:91-95` | **Connected** | allow read, write: if false — correctly API-only. Clean; no client can read applications directly. |
| Kreator email/password sign-in | `/Users/Rohan/Kaayko_v6/kaayko/src/kreator/kreator-login.html:621 → js/kreator-api.js:199` | `none — POST /kreators/auth/login does not exist` | **Frontend only** | Verified live: 404 HTML `Cannot POST /kreators/auth/login`. Onboarding sets a Firebase Auth password and then tells the kreator to log in, with nothing to log in to. |
| Forgot password / password reset | `/Users/Rohan/Kaayko_v6/kaayko/src/kreator/forgot-password.html:261 → kreator-api.js:361,375` | `none — /kreators/auth/forgot-password and /auth/reset-password do not exist` | **Frontend only** | Live 404. The page swallows the error and always shows 'Check Your Email'. consumeMagicLinkAndSetPassword would reject an active kreator anyway (kreatorService.js:461). |
| Change password while signed in | `kreator-api.js:346 (no page calls it)` | `none — PUT /kreators/auth/password does not exist` | **Not connected** | Dead client function. |
| Google sign-in | `kreator-login.html:573 → kreator-api.js:218` | `POST /kreators/auth/google/signin — kreatorRoutes.js:491` | **Partly broken** | Fails at createSessionToken because SESSION_SECRET is unset in prod; and the pending_password activation write at line 537 is discarded by updateKreatorProfile's allowlist. |
| Google account connect / disconnect | `kreator-api.js:317, 331` | `POST /kreators/auth/google/connect|disconnect — kreatorRoutes.js:614, 666` | **Partly broken** | Client sends { googleIdToken }; server requires { googleUid, googleProfile } → always 400. Server verifies no token on the connect path. |
| Magic-link verify (onboarding landing) | `onboarding.html:510 → kreator-api.js:167` | `POST /kreators/onboarding/verify — kreatorRoutes.js:242` | **Partly broken** | Endpoint works; the page checks result.data.valid, which the response never contains, so every valid link renders as expired. |
| Magic-link complete (set password, activate) | `onboarding.html:634 → kreator-api.js:182` | `POST /kreators/onboarding/complete — kreatorRoutes.js:305` | **Partly broken** | Transactional and correct server-side. Client checklist omits the special character the server requires, and surfaces only the bare code 'INVALID_PASSWORD'. |
| Session token mint / verify | `kreator-api.js AUTH (lines 27-86)` | `kreatorService.createSessionToken:190 / verifySessionToken:212; requireKreatorAuth — kreatorAuthMiddleware.js:19` | **Partly broken** | SESSION_SECRET absent from the deployed Cloud Run env, so getSessionSecret() throws: no token can be minted and none can verify. |
| Session storage and logout | `kreator-api.js:48-60, dashboard.html:1572` | `none` | **Frontend only** | 7-day token in localStorage, client-side clear only. No jti or token-version, so nothing can invalidate an issued token — known open item. |
| Account status gating (pending/suspended/deactivated) | `none` | `requireActiveKreator — kreatorAuthMiddleware.js:108` | **Partly broken** | Applied to PUT /me and all product writes. Absent on GET /me, DELETE /me, POST /auth/google/connect, and product GETs — a suspended kreator can still read and self-delete. |
| Rate limiting on public kreator auth routes | `none` | `kreatorRateLimit — kreatorAuthMiddleware.js:247, used at kreatorRoutes.js:144,193,242,305` | **Partly broken** | Keys on req.ip with trust proxy unset, so all callers share one bucket; req.clientInfo.ip is already computed and ignored. Counters are per-instance. |
| Application review console (approve/reject) | `/Users/Rohan/Kaayko_v6/kaayko/src/kreator/admin/index.html:661,681,707` | `GET/PUT /kreators/admin/applications* — kreatorRoutes.js:718-890` | **Partly broken** | Publicly served, gated by a hardcoded client-side passphrase that does not match the deployed ADMIN_PASSPHRASE — every API call 401s, so nobody can be approved through the UI. |
| Authorization for kreator admin routes | `kreator/admin/index.html` | `optionalAuthForAdmin + requireAdmin — kreatorRoutes.js:718,751,786,836,900,934,964,999` | **Partly broken** | requireAdmin accepts the self-serve role 'admin' from POST /kortex/tenants/provision. Should be requirePlatformAdmin — these routes expose applicant PII and grant catalogue write access. |
| Optional kreator auth | `none` | `optionalKreatorAuth — kreatorAuthMiddleware.js:200; used at kreatorRoutes.js:106 (emulator-only)` | **Partly broken** | Verifies a Firebase ID token instead of the HMAC session token and applies no status check. Currently unreachable in prod, but a live trap for the next route that uses it. |
| Permission checks (products:create etc.) | `none` | `requireKreatorPermission — kreatorAuthMiddleware.js:165` | **Not connected** | Exported and correct, but no route uses it; the permissions array written at kreatorApplicationService.js:525 is never consulted. |
| Dashboard home (Total Products / Orders / Revenue / Rating stats, Recent Orders, Activity, Your Products overview, setup checklist) | `kaayko/src/kreator/dashboard.html:838-1014` | `none` | **Frontend only** | Every id (stat-total-products, stat-orders, stat-revenue, stat-rating, recent-orders, recent-activity, products-overview, setup-payment, setup-products, setup-shipping) occurs exactly once in the file — pure markup. Product count is already fetched but never written to the stat card. 'Complete Setup' anchor carries data-view but matches none of the three click selectors at 1443-1445, so it is dead. |
| Products list view | `kaayko/src/kreator/dashboard.html:1490-1548 (loadProducts / renderProductsList)` | `GET /kreators/products — kreatorProductRoutes.js:122` | **Connected** | The only genuinely working data view. Renders title/price/status and sets the nav badge. Cards carry data-id but bind no handler. |
| Product create | `kaayko/src/kreator/add-product.html:530-598` | `POST /kreators/products — kreatorProductRoutes.js:167` | **Partly broken** | multer over a body the Functions runtime already consumed; plus the category select offers 5 values the API rejects and a price ceiling 20x the API's. |
| Product edit | `none — no edit page exists in kaayko/src/kreator/` | `PUT /kreators/products/:id — kreatorProductRoutes.js:360` | **Backend only** | Unreachable from the UI. Also the least-validated write path in the program: no price range check at all. |
| Product delete / unpublish | `none` | `DELETE /kreators/products/:id — kreatorProductRoutes.js:453` | **Backend only** | Soft delete works correctly when called: sets isAvailable:false + deletedAt, which products.js:75 and pricing.js isPurchasable both honour. But no button anywhere invokes it. |
| Single product fetch | `none` | `GET /kreators/products/:id — kreatorProductRoutes.js:313` | **Backend only** | Ownership check at 328 is correct — a kreator cannot read another kreator's product. |
| Orders view (4 status tiles + list) | `kaayko/src/kreator/dashboard.html:1043-1088` | `none` | **Frontend only** | Known open item. No orders endpoint filters by kreatorId anywhere in the API. |
| Earnings / payouts view | `kaayko/src/kreator/dashboard.html:1090-1152` | `none` | **Frontend only** | Known open item, but the copy actively promises 'Payouts are processed weekly' (line 1141) and 'Ready to withdraw' with no payout system in existence. |
| Profile view + save | `kaayko/src/kreator/dashboard.html:1154-1210, 1577-1601` | `PUT /kreators/me — kreatorRoutes.js:415` | **Connected** | Works. Protected-field list at kreatorRoutes.js:420 correctly blocks uid/email/status/permissions. |
| Settings > Shipping Settings form | `kaayko/src/kreator/dashboard.html:1239-1269` | `none` | **Frontend only** | Submit button inside a form with no listener and no input name attributes — clicking Save navigates away and discards the data. |
| Settings > Payment Information (Connect Bank) | `kaayko/src/kreator/dashboard.html:1218-1231` | `none` | **Frontend only** | Button has no id and no handler. |
| Settings > Security (Change Password, Enable 2FA) | `kaayko/src/kreator/dashboard.html:1275-1295` | `none` | **Frontend only** | Both buttons are inert markup. |
| Settings > Disconnect Google | `kaayko/src/kreator/dashboard.html:1603-1629` | `POST /kreators/auth/google/disconnect — kreatorRoutes.js:666` | **Connected** | Works. |
| Settings > Delete Account | `kaayko/src/kreator/dashboard.html:1631-1666` | `DELETE /kreators/me — kreatorRoutes.js:449` | **Partly broken** | Anonymises the kreator doc but leaves every one of their products live and purchasable. |
| 'View My Store' quick action | `kaayko/src/kreator/dashboard.html:1420-1436` | `GET /api/products, filtered client-side at js/kaayko-main.js:56` | **Partly broken** | Builds the slug without the '-{uid6}' suffix the API stamps at kreatorProductRoutes.js:238, so the link always lands on an empty storefront. |
| Product image upload | `kaayko/src/kreator/add-product.html:492-521, 565-567` | `uploadProductImage — kreatorProductRoutes.js:94-112` | **Partly broken** | Objects land at kaaykoStoreTShirtImages/{productID}/ where productID = kreator uid prefix + uuid, and PUT reuses the owned document's productID — one kreator CANNOT overwrite another's images. But file type is trusted from the client-declared MIME header and makePublic() is used nowhere else in the repo. |
| Product moderation / review before going live | `none` | `none` | **Not connected** | POST writes isAvailable:true directly into the shared kaaykoproducts collection. The only takedown is PATCH /admin/products/:id (index.js:136), one product at a time. |
| Admin console page shell (/kreator/admin) | `/Users/Rohan/Kaayko_v6/kaayko/src/kreator/admin/index.html` | `none (static hosting)` | **Partly broken** | Returns 200 to anyone; noindex is set (line 9). Before the fake login it makes zero API calls and embeds no applicant data — fails cleanly, leaks only the stat/table labels and the hardcoded passphrase at line 661. |
| Admin login gate | `index.html:588-595, 661-700` | `none` | **Frontend only** | Pure client-side compare against an in-page constant, persisted as a localStorage boolean. No server session exists. 'Logout' clears the boolean only. |
| List applications | `index.html:703-731 (loadApplications)` | `kreatorRoutes.js:718 GET /kreators/admin/applications → kreatorApplicationService.listApplications:376` | **Partly broken** | Guard is requireAdmin (self-serve role), not requirePlatformAdmin. Hardcoded X-Admin-Key does not match production — verified 401. Response spreads the whole document including magicLinkCode and ipAddress. No pagination; capped at the first 50. |
| Application stats tiles | `index.html:600-617, 743-752` | `kreatorRoutes.js:934 GET /kreators/admin/stats (never called)` | **Backend only** | Real count() aggregations exist server-side; the page instead counts the 50-row page client-side, so totals are wrong past 50 applications. |
| Status filter chips | `index.html:620-625, 842-850` | `listApplications supports ?status= (kreatorRoutes.js:720)` | **Partly broken** | Filters in memory over the loaded page rather than server-side. No 'expired' chip and no .status-badge.expired CSS rule, though 'expired' is a real status. |
| Application detail modal | `index.html:853-943 (viewApplication)` | `kreatorRoutes.js:751 GET /admin/applications/:id (never called)` | **Frontend only** | Renders from the already-loaded array, so the per-id endpoint and its lazy expiry transition are never exercised. All fields interpolated into innerHTML unescaped; website goes into an href. |
| Approve application | `index.html:950-969` | `kreatorRoutes.js:786 PUT /admin/applications/:id/approve → approveApplication:447` | **Partly broken** | Service side is solid: transactional, double-approval guarded, expiry checked, creates the Firebase user + kreators doc + magic link + audit log. Client side cannot authenticate, discards the returned magicLinkUrl, and asserts the email was sent when the send is fire-and-forget. |
| Reject application | `index.html:971-992` | `kreatorRoutes.js:836 PUT /admin/applications/:id/reject → rejectApplication:692` | **Partly broken** | UI calls the reason optional; route requires non-empty, service requires 10+ chars. Server error message is discarded and replaced with 'Failed to reject'. The reason is surfaced to the applicant via the public status endpoint. |
| Audit trail of approvals/rejections | `none` | `admin_audit_logs writes at kreatorApplicationService.js:636 and 728` | **Backend only** | Exists and is transactional. actorUid is 'admin-key-user' for every key-authenticated action; ipAddress/userAgent are null despite the comment; approve audit stores the live magicLinkCode. No UI reads it. |
| List kreators | `none` | `kreatorRoutes.js:900 GET /kreators/admin/list` | **Backend only** | No console screen. The owner cannot see active kreators, their plan, or their status from any UI. |
| Get kreator detail | `none` | `kreatorRoutes.js:964 GET /kreators/admin/:uid` | **Backend only** | No console screen. Route ordering is correct — /admin/stats is registered before /admin/:uid (comment at line 932). |
| Resend magic link | `none` | `kreatorRoutes.js:999 POST /kreators/admin/:uid/resend-link` | **Backend only** | The only recovery path when an activation email fails, and it has no button anywhere. The kreator would be stuck in pending_password with no self-serve route. |
| Kortex SPA cross-over | `/Users/Rohan/Kaayko_v6/kaayko/src/kortex.html` | `kortex routers` | **Not connected** | Kortex has no kreator applications view; grep for 'kreators/admin' across kaayko/src matches only kreator/admin/index.html. Two admin surfaces, two auth models, no link between them. |
| Application received — receipt to applicant | `/Users/Rohan/Kaayko_v6/kaayko/src/kreator/apply.html` | `POST /kreators/apply -> kreatorApplicationService.submitApplication (kreatorApplicationService.js:166)` | **Not connected** | submitApplication writes the Firestore doc at line 279 and returns. Zero mail calls. apply.html:1026 promises "Email Confirmation — You'll receive your application status via email" and the API response message (line 292) says "we will ... contact you at <email>". |
| Application received — alert to owner | `none` | `none` | **Not connected** | No mail, no Firestore trigger on kreator_applications (the only trigger in the repo is mailSender on mail/{docId}, index.js:201). Owner discovery is manual: open /kreator/admin and enter the passphrase. Applications auto-expire after 30 days (APPLICATION_EXPIRY_DAYS). |
| Application approved — magic-link activation email | `/Users/Rohan/Kaayko_v6/kaayko/src/kreator/admin/index.html:950` | `PUT /kreators/admin/applications/:id/approve (kreatorRoutes.js:786) -> approveApplication (kreatorApplicationService.js:672) -> sendMagicLinkEmail (emailNotificationService.js:350)` | **Partly broken** | Code exists and is fire-and-forget (.catch logs). Delivery is impossible: @sendgrid/mail is not installed and SENDGRID_API_KEY is unset, so sendEmail() takes the console-log branch (emailNotificationService.js:269) and reports success. Does NOT use queueMailOnce/`mail`. |
| Magic-link resend email | `none (no resend button in the admin UI)` | `POST /kreators/admin/:uid/resend-link (kreatorRoutes.js:999) -> resendMagicLink (kreatorService.js:743, mail at 865)` | **Partly broken** | Same dead SendGrid path. The route is reachable but no admin UI calls it, so even the manual recovery for a lost activation link has no button. |
| Application rejected — notice to applicant | `/Users/Rohan/Kaayko_v6/kaayko/src/kreator/check-status.html (pull only)` | `rejectApplication (kreatorApplicationService.js:692)` | **Not connected** | Transaction updates status + rejectionReason and writes an audit log. No mail. Applicant can only learn the outcome by re-entering the application ID that was shown once on screen (apply.html:1274) and never emailed. |
| Password reset / forgot password | `/Users/Rohan/Kaayko_v6/kaayko/src/kreator/forgot-password.html:261 -> kreator-api.js:361` | `none — POST /kreators/auth/forgot-password and /auth/reset-password do not exist in kreatorRoutes.js` | **Frontend only** | The page shows "Check Your Email" from BOTH the try and the catch branch (lines 260-268), so the 404 is invisible. MAGIC_LINK_EXPIRY_HOURS.password_reset (kreatorService.js:54) is defined but never used by any caller. |
| New order — notification to the selling kreator | `none` | `stripeWebhook.sendOrderConfirmationEmails (stripeWebhook.js:1148)` | **Not connected** | Mails only the buyer (line 1171) and resolveNotifyEmail(paymentIntent) (line 1197). `sellerEmail`/`kreatorId` stamped on the product (kreatorProductRoutes.js:279-283) are never read by anything in api/checkout or api/admin. |
| Kreator listed a product — alert to owner | `/Users/Rohan/Kaayko_v6/kaayko/src/kreator/add-product.html` | `POST /kreators/products (kreatorProductRoutes.js:167)` | **Not connected** | Product is written to the shared kaaykoproducts collection with isAvailable:true (line 277) and is immediately purchasable. No mail, no review queue, no audit log entry. |
| Store email pipeline (the working reference) | `n/a` | `queueMailOnce (api/email/render.js:106) -> Firestore `mail` -> triggers/mailSender.js:269` | **Connected** | Deterministic doc ids, MAIL_SMTP_URL Secret-Manager binding, delivery.state written back, mailHealth.js scans the collection, MAIL_RETENTION_DAYS prunes it. Deployed (index.js:201, package.json deploy:store). No kreator code path touches it. |
| Kortex email delivery (second reference) | `n/a` | `services/emailDelivery.js:73` | **Connected** | Also SendGrid, but honest: returns {status:'not_configured'} or queues to pending_emails when no key is present, and never claims success it did not achieve. Contrast with emailNotificationService.js:281 which returns success:true after only printing to the log. |
| Application submission (kreator_applications document) | `/Users/Rohan/Kaayko_v6/kaayko/src/kreator/apply.html` | `POST /kreators/apply -> kreatorApplicationService.submitApplication (kreatorApplicationService.js:165-289)` | **Connected** | Writes a ~40-field document at line 279. Rate limited 5/hour. Field validation is presence-and-minimum only: no max length and no charset limit on firstName, lastName, businessName, location, otherPlatforms, additionalInfo. Stores ipAddress, userAgent and consent.consentIp. |
| Application review and approval | `/Users/Rohan/Kaayko_v6/kaayko/src/kreator/admin/index.html` | `GET/PUT /kreators/admin/applications* (kreatorRoutes.js:718,751,786,836)` | **Partly broken** | The page authenticates with a hardcoded X-Admin-Key ('kaayko2026admin', line 661) that does not match ADMIN_PASSPHRASE in functions/.env, so every call fails. Routes are guarded by requireAdmin (self-serve role), not requirePlatformAdmin. No other UI reads this collection. |
| kreators document creation | `none (server-side, on approval)` | `kreatorApplicationService.approveApplication (kreatorApplicationService.js:498-568)` | **Connected** | Transactional: Firebase Auth user + kreators/{uid} + short_links magic link + application status + audit log. admin.auth().createUser at line 484 is a non-idempotent external call inside runTransaction; a permanently failing transaction orphans the Auth user. |
| kreator.permissions[] and planLimits | `none` | `written at kreatorApplicationService.js:538-552; requireKreatorPermission at kreatorAuthMiddleware.js:165` | **Backend only** | requireKreatorPermission is exported and used by zero routes. productsAllowed:50 and monthlyOrders:100 are read by nothing. Both fields are decorative. |
| Kreator product write onto shared kaaykoproducts | `/Users/Rohan/Kaayko_v6/kaayko/src/kreator/add-product.html` | `POST /kreators/products (kreatorProductRoutes.js:174-300)` | **Connected** | Stamps kreatorId, storeName, storeSlug, sellerEmail. Create validates price 0.99-500, category and productType against closed sets, and arrays via parseStringArray. PUT (line 360) skips the price and quantity validation entirely. |
| Store identity (storeName / storeSlug) | `kaayko-main.js:54-90 (?store= client-side filter)` | `derived per product write at kreatorProductRoutes.js:239` | **Partly broken** | No stores collection anywhere in the repo. The slug is recomputed on each create and never reconciled on update or rename. storeName reaches an innerHTML sink at kaayko-main.js:68. |
| Order line -> owning kreator | `none` | `none` | **Not connected** | pricing.js:351 builds items without kreatorId; stripeWebhook.js:512 writes orders without it. The only link is a mutable join through orders.productId. |
| Commission, payout, earnings | `/Users/Rohan/Kaayko_v6/kaayko/src/kreator/dashboard.html (hardcoded zeros)` | `none` | **Not connected** | Zero hits repo-wide for commission, payout, stripeAccountId, transfer_data, application_fee, taxId. kreator.stats.totalRevenue and totalOrders are initialised to 0 and written by nothing. |
| Kreator suspension / offboarding | `none` | `none` | **Not connected** | KREATOR_STATUS.SUSPENDED exists (kreatorService.js:40) and is enforced on write by requireActiveKreator, but no route can set it. No admin route can take a kreator's products down. |
| Product visibility vs kreator status | `none` | `products.js:72-75` | **Not connected** | The public filter tests only isAvailable !== false && !deletedAt. A suspended or self-deleted kreator's products stay on sale. |
| Account self-deletion (GDPR erasure) | `none surfaced` | `DELETE /kreators/me (kreatorRoutes.js:449-470)` | **Partly broken** | Anonymises the kreators document only. Products keep storeName, storeSlug and sellerEmail set to the original address, and stay purchasable. |
| kreator.stats counters | `dashboard.html` | `kreatorProductRoutes.js:281 (+1), 486 (-1)` | **Partly broken** | Delete decrements without checking deletedAt, so repeat deletes go negative; PUT isAvailable:false never decrements; totalOrders/totalRevenue never written. |
| Firestore rules and indexes for kreator collections | `n/a` | `firestore.rules:50-101, firestore.indexes.json:236-305` | **Partly broken** | Rules correctly deny direct client access to kaaykoproducts, kreator_applications and kreator writes. Indexes cover the filtered admin queries but not the default listKreators query (deletedAt + createdAt). |
| Firestore rules — kreator_applications | `none` | `/Users/Rohan/Kaayko_v6/kaayko-api/firestore.rules:91-95` | **Connected** | allow read, write: if false. Client SDK cannot touch applications at all; the API's Admin SDK is the only path. Correct. |
| Firestore rules — kreators | `none` | `/Users/Rohan/Kaayko_v6/kaayko-api/firestore.rules:98-103` | **Connected** | Write denied; read allowed only for request.auth.uid == kreatorId, i.e. own document. No cross-kreator read. Note this rule is effectively dead for the real flow — kreators authenticate with an HMAC session token, not a Firebase ID token — but it leaks nothing. |
| Firestore rules — kaaykoproducts | `none` | `/Users/Rohan/Kaayko_v6/kaayko-api/firestore.rules:50-53` | **Connected** | read and write both false, with an inline comment naming sellerEmail/kreatorId as the reason. The public Firebase web config cannot be used to read past the API's field allowlist. |
| Public catalogue API field allowlist | `/Users/Rohan/Kaayko_v6/kaayko/src/js/kaayko-main.js` | `/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/products/products.js:80-106, 146-172` | **Connected** | GET /api/products and /api/products/:id build an explicit object. sellerEmail and kreatorId are not in it; storeName/storeSlug are, deliberately. Hidden and soft-deleted products are filtered server-side. |
| Public animal pages API | `/Users/Rohan/Kaayko_v6/kaayko/src/js (animal pages)` | `/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/products/animals.js:34-59` | **Connected** | shapeProduct is an explicit allowlist; no kreatorId, no sellerEmail. It also omits storeName/storeSlug, so kreator products on an animal page carry no seller attribution — a gap for the storefront surface, not a leak. |
| Kreator storefront filter (?store=) | `/Users/Rohan/Kaayko_v6/kaayko/src/js/kaayko-main.js:54-91` | `GET /api/products` | **Partly broken** | Client-side filter on storeSlug over the public payload — no PII involved. But the banner injects storeName via innerHTML (line 68) with no escaping, and storeName originates in unvalidated applicant input. See finding. |
| Kreator product CRUD ownership scoping | `/Users/Rohan/Kaayko_v6/kaayko/src/kreator/add-product.html, dashboard.html` | `/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorProductRoutes.js:122-504` | **Connected** | List filters `where('kreatorId','==',req.kreator.uid)` (line 128); GET/:id, PUT/:id and DELETE/:id each re-read the doc and 403 unless product.kreatorId === req.kreator.uid (lines 328, 376, 469). No kreator endpoint returns another kreator's data. |
| GET /kreators/me profile | `/Users/Rohan/Kaayko_v6/kaayko/src/kreator/js/kreator-api.js` | `/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorRoutes.js:385-409` | **Connected** | Returns the caller's own kreators document with tokenHash and tokenSalt deleted (lines 392-393). Own data only. |
| Public application status lookup | `/Users/Rohan/Kaayko_v6/kaayko/src/kreator/check-status.html` | `/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorRoutes.js:193-232 → kreatorApplicationService.js:348-369` | **Connected** | Requires both the application id AND a matching email (line 358), returns only id/status/submittedAt/reviewedAt/rejectionReason, and is rate-limited 10/min. An id alone reveals nothing. |
| Kreator admin application review API | `/Users/Rohan/Kaayko_v6/kaayko/src/kreator/admin/index.html` | `/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorRoutes.js:718-1037` | **Partly broken** | Correctly 401s unauthenticated and is inside the /kreators/admin CORS privileged prefix (index.js:32). But it is gated by requireAdmin, which a self-serve Kortex tenant admin satisfies, and it returns unfiltered application/kreator documents plus the one-time magic-link code. Two P0s. |
| Kreator admin review UI | `/Users/Rohan/Kaayko_v6/kaayko/src/kreator/admin/index.html:661-981` | `X-Admin-Key against ADMIN_PASSPHRASE` | **Partly broken** | Publicly reachable at kaayko.com/kreator/admin, gated only by a localStorage flag, and sends a hardcoded key that production rejects (verified 401 read-only probe). It is the only approval UI, so nothing can be approved. |
| Emulator-only test router | `none` | `/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/testRoutes.js, mounted at kreatorRoutes.js:52-57` | **Connected** | Double-gated: the mount is inside `if (process.env.FUNCTIONS_EMULATOR === 'true')`, and every one of the five handlers re-checks isEmulator and 404s. Verified live — /kreators/test/list-all, /kreators/test/setup and /kreators/debug all 404 in production while /kreators/health returns 200. Definitely unreachable. No change needed. |
| PII in Cloud Logging | `none` | `kreatorApplicationService.js:281,679,744; kreatorService.js:515,851,872; kreatorRoutes.js:333,546,575; kreatorProductRoutes.js:285` | **Partly broken** | Ten statements print applicant or kreator email (and business name) into logs with no redaction and no retention job covering them. |

## Surface Summaries

### application-pipeline

The application pipeline is a well-built intake form bolted to a review console that cannot authenticate. Submission works: apply.html posts 20-odd fields to POST /kreators/apply, kreatorApplicationService.validateApplication checks them against closed sets for business type and product categories, and the document lands in kreator_applications behind correctly locked-down Firestore rules. Everything after that is broken. The only UI anywhere in kaayko/src that reviews applications, /kreator/admin, sends a hardcoded X-Admin-Key of 'kaayko2026admin' that does not match the deployed ADMIN_PASSPHRASE, so every list, approve and reject call 401s — no application can be actioned by anyone, and the server routes behind them are guarded by requireAdmin, the self-serve role, rather than requirePlatformAdmin. The status endpoint is genuinely not enumerable (it needs both a random id and a matching email, and returns an indistinguishable 404 for both failure modes), but rate limiting on apply and status is a per-instance in-memory map keyed on the proxy IP, which this repo's own clientIp.js documents as collapsing to a single global bucket. The single most important thing: an applicant can apply, will never receive any email, cannot be approved or rejected, and after 30 days is permanently locked out — the expiry flag is only ever written by an admin detail view that itself cannot load.

### auth-session

Kreator authentication is not merely defective, it is entirely non-functional in production, and for a reason no code review would have found: SESSION_SECRET is absent from the deployed Cloud Run environment for the `api` function, so getSessionSecret() throws on every call — no session token can be minted and none can be verified. Even with that fixed, three independent blockers remain in series: there is no POST /kreators/auth/login endpoint at all (the sign-in form 404s against a route that was never written), the onboarding page gates on a `valid` field the verify endpoint does not return so every good magic link renders as expired, and the application review console is gated by a hardcoded passphrase that does not match the deployed ADMIN_PASSPHRASE, so no application can be approved through the UI. On the security side, the eight kreator admin routes — including the applicant PII list and approve/reject — are guarded by requireAdmin rather than requirePlatformAdmin, which any self-provisioned Kortex tenant admin satisfies, and ADMIN_PASSPHRASE and KORTEX_SYNC_KEY are deployed with the identical value, re-creating in the environment the exact master-credential bug the middleware comment says was fixed in code. The single most important thing about this surface: no kreator has ever been able to complete onboarding or log in, and nothing in the deploy pipeline detects it — predeploy-check.js forces emulator mode, which suppresses the very secret assertion that would have caught the root cause.

### dashboard-products

The kreator dashboard is a mostly decorative shell around one working endpoint. Of six sidebar views, only Products (GET /kreators/products) and Profile (PUT /kreators/me) are backed by real calls; Dashboard home, Orders, Earnings and every Settings card except Google-disconnect are static markup whose ids appear exactly once in the file — never touched by JS. Product management is worse than "partly connected": the create path posts multipart/form-data to a route using multer, but the Firebase Functions runtime consumes and buffers the request body before Express sees it (the repo already documents this for the Stripe webhook), so `req.body` is a Buffer and every field arrives undefined — POST /kreators/products should be returning 400 on every real submission, which is consistent with there being zero kreator-authored products in the catalogue. Edit and delete exist on the server but have no UI at all, so a kreator cannot change or unpublish anything they list. The single most important thing: nothing about this surface is gated — no review before a third party's product goes live on kaayko.com, no price validation on update, and no way for anyone to pull a seller's whole catalogue when their account is suspended or deleted.

### admin-console

The admin review console is a single standalone static page (kaayko/src/kreator/admin/index.html) sitting in front of eight well-built backend routes — the service layer is genuinely good: approval is transactional, guards against double-approval and expiry, creates the Firebase user, kreator doc, magic link and an admin_audit_logs entry atomically. The frontend is where it falls apart, and it is not connected end to end: its only credential is a hardcoded 'kaayko2026admin' sent as X-Admin-Key, which I verified against production returns 401, and because the page always sends that header the middleware's optionalAuthForAdmin skips Firebase auth entirely — so even a legitimate super-admin cannot use it, and no kreator application can be approved by any UI that exists in this repo. Compounding that, all eight /kreators/admin/* routes are guarded by requireAdmin rather than requirePlatformAdmin, and role 'admin' is self-serve via POST /kortex/tenants/provision, so any Google user can read every applicant's PII and approve sellers into the shared kaaykoproducts catalogue. A third latent problem waits behind the auth fix: applicant free text (including a website field that accepts javascript: URLs) is interpolated raw into innerHTML in the reviewer's browser. The single most important thing: the approval pipeline is dead in production today, and the two fixes that revive it (real auth) must ship together with output escaping, or reviving it arms a stored XSS aimed at the owner.

### email-notifications

The kreator program has essentially no working email. Exactly one kreator email is even written in code — the approval "activate your seller account" magic link — and it cannot be delivered in production: it is sent through `services/emailNotificationService.js`, which requires `@sendgrid/mail` (not a dependency and not installed) behind a `SENDGRID_API_KEY` param that is unset and unbound, so every call falls through to a console.log branch that returns `{success: true}`. Nothing else exists: no application-received receipt, no rejection notice, no password reset (the frontend calls two endpoints that were never written), no order notification to the seller, and — critically — nothing at all tells the owner that a new application arrived, so the pending queue can only be found by manually opening /kreator/admin. None of these paths touch the store's proven `queueMailOnce` → Firestore `mail` → `mailSender` SMTP pipeline, which is deployed, secret-bound and idempotent; the kreator flow was built on a second, dead mail stack instead. The single most important fact: an approved kreator is never emailed their activation link, the admin UI tells the owner "Onboarding email sent", and the link is never displayed anywhere — so no kreator can ever finish onboarding.

### data-model

The kreator data model is a well-shaped seller profile bolted onto a single-vendor catalogue, and it stops exactly where multi-vendor operation begins. Applications and kreator documents are written carefully and transactionally, and products correctly carry kreatorId/storeName/storeSlug/sellerEmail into the shared kaaykoproducts collection — but nothing downstream of the sale knows any of it: pricing.js does not copy ownership onto the line item, the Stripe webhook does not write it onto the order, and there is no commission, payout, or earnings field anywhere in the API. The single most important fact about this surface is that Kaayko cannot pay a kreator and cannot even reconstruct what it owes one, because the only link from money to seller is a mutable join through the live product document. Beneath that, the program is not currently operable at all: the one admin console that reviews applications authenticates with a hardcoded key that does not match the deployed ADMIN_PASSPHRASE, so approvals cannot happen from any UI, and the same admin routes are guarded by the self-serve `admin` role rather than requirePlatformAdmin, exposing every applicant's email, phone, location and IP. There is also no way to suspend or offboard a seller — deleting the account leaves their products on sale — and store identity is a slug recomputed per product write with no registry behind it.

### no-leak

The no-leak boundary is solid everywhere it is enforced by data shaping, and broken where it is enforced by authorization. Firestore rules deny client-SDK access to kreator_applications, kaaykoproducts and (for writes) kreators, and the public read paths — GET /api/products, GET /api/products/:id and /api/animals — all build explicit field allowlists that exclude sellerEmail and kreatorId, so no unauthenticated caller reaches kreator PII through the catalogue or the ?store= storefront. No kreator endpoint returns another kreator's data: every product route re-reads the document and 403s unless kreatorId matches the session, and /kreators/me strips tokenHash/tokenSalt. Applications need both an id and a matching email to read, so they are applicant-only. The emulator test router is genuinely unreachable in production — it is double-gated on FUNCTIONS_EMULATOR at the mount and in every handler, and I confirmed 404s live. The single most important thing about this surface: the leak is not in the response shapes, it is in the gate — all eight /kreators/admin/* routes use requireAdmin rather than requirePlatformAdmin, so any user who self-provisions a Kortex tenant gets role 'admin' and can dump every seller applicant's name, email, phone, location and IP, and can read the one-time magic-link code out of the approve/resend responses and take over a pending seller account.


## Adversarially Verified Findings

Three findings were put to an independent skeptic instructed to refute them. **All three survived; none were refuted.** Verification was capped at 3 agents by the cost rules in `CLAUDE.md`; everything below this section is reported unverified and labelled as such.

### P0 — The only application-review console cannot authenticate — no application can ever be approved or rejected

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/admin/index.html:661` · surface: application-pipeline

**What is wrong.** admin/index.html:661 hardcodes `const ADMIN_PASS = 'kaayko2026admin'` and sends it as the `X-Admin-Key` header on every admin call (line 707 list, 958 approve, 980 reject). The server compares that header against `process.env.ADMIN_PASSPHRASE` with `timingSafeEqualStr` (middleware/authMiddleware.js:147). The deployed value in kaayko-api/functions/.env is `b1Qp9AdG3gm28O0ji5_lp3sskt36xC6TmZB-7NMi-OA` — it does not match. `optionalAuthForAdmin` sees an X-Admin-Key header and skips Firebase auth entirely (authMiddleware.js:393-397), so `requireAdmin` then falls through to `if (!req.user)` and returns 401. This matches the live evidence that /kreators/admin/applications returns 401. Grepping kaayko/src, this page is the ONLY frontend anywhere that calls /kreators/admin/applications — Kortex has no kreator-applications view. So there is no working path from a submitted application to an approved kreator. Separately, the client-side gate `if (pass === ADMIN_PASS)` at line 679 is defeated by anyone who views source of a page that returns 200 unauthenticated.

**Impact.** The kreator program is dead end-to-end. A stranger can submit an application and the record lands in Firestore, but no one — including Rohan — can list, view, approve or reject it through any shipped UI. Every approved-kreator story downstream (onboarding, magic link, dashboard, product listing) is unreachable in production.

**Fix.** Two changes. (1) Delete `ADMIN_PASS`, the `auth-form` handler and the `kreator_admin_auth` localStorage gate from admin/index.html; replace them with the same Firebase ID-token sign-in the Kortex SPA uses, and send `Authorization: Bearer <idToken>` instead of `X-Admin-Key` on all four fetches (lines 705, 954, 976, and the stats call). (2) On the server, change the four routes in api/kreators/kreatorRoutes.js (718, 751, 786, 836) from `optionalAuthForAdmin, requireAdmin` to `requireAuth, requirePlatformAdmin` — see the next finding. Also set API_BASE to `https://kaayko.com/api` rather than the raw Cloud Run host so the privileged-prefix CORS allowlist in functions/index.js:32 actually applies.

> CONFIRMED: Every load-bearing claim checks out against the code as written, and I confirmed the failure live rather than by inference.

Code verified:
- /Users/Rohan/Kaayko_v6/kaayko/src/kreator/admin/index.html:661 — `const ADMIN_PASS = 'kaayko2026admin'; // Change this!`. It is sent verbatim as the `X-Admin-Key` header at :707 (list), :958 (approve), :980 (reject). The page never performs a Firebase sign-in, so no Bearer token is ever attached — the admin-key path is the only credential it has.
- /Users/Rohan/Kaayko_v6/kaayko-api/functions/middleware/authMiddleware.js:147 — `if (adminKey && ADMIN_PASSPHRASE && timingSafeEqualStr(adminKey, ADMIN_PASSPHRASE))`. Passphrase resolves from `process.env.ADMIN_PASSPHRASE` outside the emulator (:129-135), with no KORTEX_SYNC_KEY fallback any more.
- /Users/Rohan/Kaayko_v6/kaayko-api/functions/.env:4 — `ADMIN_PASSPHRASE=b1Qp9AdG3gm28O0ji5_lp3sskt36xC6TmZB-7NMi-OA`, which is not `kaayko2026admin`. No `defineSecret`/`secrets:` override for ADMIN_PASSPHRASE exists in index.js (only STRIPE_* are declared as secrets at index.js:172), so .env is the deployed value.
- authMiddleware.js:391-397 — `optionalAuthForAdmin` returns `next()` the moment an `x-admin-key` header is present, bypassing `requireAuth`; `requireAdmin` then hits `if (!req.user)` and 401s. All six admin routes use this exact pair (kreatorRoutes.js:718, 751, 786, 836, 900, 934, 964).

Searched for a guard or alternate path the auditor might have missed, and found none that rescues it:
- `grep` over /Users/Rohan/Kaayko_v6/kaayko/src for `admin/applications`, `X-Admin-Key`, `ADMIN_PASS` returns hits in exactly one file: src/kreator/admin/index.html. Kortex has no kreator-application view (no file under src/kortex mentions kreator at all).
- api/kreators/testRoutes.js does expose setup/approve helpers and IS mounted (kreatorRoutes.js:54-55), but every handler 404s unless `FUNCTIONS_EMULATOR === 'true'` (testRoutes.js:21, :27-30), so it is not a production approval path.

Live confirmation against the deployed API:
- `curl -H "X-Admin-Key: kaayko2026admin" .../kreators/admin/applications` → 401 `AUTH_REQUIRED`.
- `curl -H "X-Admin-Key: b1Qp9AdG3gm28O0ji5_lp3sskt36xC6TmZB-7NMi-OA" .../kreators/admin/stats` → 200.
- `curl https://kaayko.com/kreator/admin` returns the hardcoded `kaayko2026admin` at line 661 of the *deployed* HTML, so prod matches the repo.

So the shipped console authenticates with a string the server rejects, and it is the only shipped UI for the endpoint. P0 stands under the stated bar ("blocks the program working at all"): applications land in `kreator_applications` and no shipped interface can list, view, approve or reject them.

Two calibration notes, neither of which refutes the finding:
1. The impact line "Every approved-kreator story downstream is unreachable in production" is slightly overstated — `requireAdmin` still accepts the real passphrase or a Firebase admin Bearer token, so Rohan can approve by curl or by writing Firestore directly, and any kreator approved that way onboards normally. The accurate framing is the one in the Description: there is no working *UI* path from submitted application to approved kreator.
2. The secondary point — that `if (pass === ADMIN_PASS)` at :679 is defeated by viewing source of a page that serves 200 unauthenticated — is factually true but grants an attacker nothing on its own: setting `localStorage.kreator_admin_auth = 'true'` reveals only a chrome shell whose every API call 401s, and the leaked constant is not the real credential. That sub-issue is P2 on its own; the P0 rests entirely on the console being non-functional.

Fix: delete the hardcoded constant and the localStorage gate, and authenticate the page the way the rest of admin does — Firebase sign-in, then send `Authorization: Bearer <idToken>` on the six /kreators/admin/* calls so `optionalAuthForAdmin` routes into `requireAuth` and `requireAdmin` reads the role from `admin_users/{uid}`. Given these routes approve a seller who then controls `actualPrice` on shared `kaaykoproducts` documents (pricing.js re-prices from the product doc), the approve/reject routes should move from `requireAdmin` to `requirePlatformAdmin` — `role: 'admin'` is self-serve via POST /kortex/tenants/provision, so today any self-provisioned admin could approve kreators into the catalogue. Do not "fix" this by pasting the real ADMIN_PASSPHRASE into the client; that would ship the master admin key to every visitor of a page that already returns 200 unauthenticated.

### P0 — Applicant PII and the approve button are guarded by requireAdmin, which is the self-serve role

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorRoutes.js:718` · surface: application-pipeline

**What is wrong.** All four kreator-application admin routes use `optionalAuthForAdmin, requireAdmin`: GET /kreators/admin/applications (718), GET /kreators/admin/applications/:id (751), PUT .../approve (786), PUT .../reject (836). `requireAdmin` (middleware/authMiddleware.js:126) passes for role `super-admin` OR `admin`. CLAUDE.md and the comment on `requirePlatformAdmin` (authMiddleware.js:298-310) state that `role: 'admin'` is self-serve — anyone can obtain it from POST /kortex/tenants/provision with open Google sign-up. The list route returns whole Firestore documents (kreatorApplicationService.js:418-429 spreads `...data`), so it hands back firstName, lastName, email, phone, location, businessName, website, the full productDescription, plus `ipAddress`, `userAgent` and the `consent` block including `consentIp`. Note this is worse than a read: the same self-serve role can call approve, which creates a Firebase Auth user and a `kreators/{uid}` doc with `products:create` (kreatorApplicationService.js:483-531).

**Impact.** Any person who signs up for a Kortex tenant can dump every seller applicant's name, email, phone, physical location and IP address — and can approve themselves as a kreator, which grants write access into the shared `kaaykoproducts` catalogue where they control `actualPrice`, the field checkout/pricing.js re-prices orders from.

**Fix.** In api/kreators/kreatorRoutes.js replace `optionalAuthForAdmin, requireAdmin` with `requireAuth, requirePlatformAdmin` on lines 718, 751, 786, 836 (and on 900, 934, 964, 998 for the kreator list/stats/detail/resend-link routes, which expose the same class of data). `requirePlatformAdmin` already fails closed for tenant-scoped admins and still honours the X-Admin-Key operator path. Additionally, in kreatorApplicationService.js:418-429 stop spreading `...data` and project an explicit field list, dropping `ipAddress`, `userAgent` and `consent.consentIp` from the list response.

> CONFIRMED: Every link in the chain checks out against the code as written; I could not find a guard the auditor missed.

1. Route guards are exactly as claimed. `/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorRoutes.js:718` (list), `:751` (detail), `:786` (approve), `:836` (reject) all read `optionalAuthForAdmin, requireAdmin`. The same pair also guards `/admin/list` (:900), `/admin/stats` (:934), `/admin/:uid` (:964) and `/admin/:uid/resend-link` (:999) — four more than the finding names. No `requirePlatformAdmin`, no `requireVerifiedEmail`, no `requireSuperAdmin` anywhere on these routes.

2. `optionalAuthForAdmin` (authMiddleware.js:391-402) is not a second gate: with no `X-Admin-Key` it simply delegates to `requireAuth`, which verifies any Firebase ID token in the project and sets `req.user.role` from `admin_users/{uid}` (authMiddleware.js:66-79, including `req.user.scope`).

3. `requireAdmin` (authMiddleware.js:126) accepts `const adminRoles = ['super-admin', 'admin']` with no scope check — in explicit contrast to `requirePlatformAdmin` (authMiddleware.js:313-329), whose own comment block at :298-311 states `role: 'admin'` is self-serve and must not guard "store orders, customer PII, catalogue prices".

4. The self-serve path is live and reachable. `POST /kortex/tenants/provision` (api/kortex/smartLinks.js:622) is guarded by `rateLimiter` + `requireAuth` only — any signed-up Firebase user. It calls `provisionSelfServeTenant`, which writes `admin_users/{uid}` with `role: 'admin', scope: 'tenant'` (api/kortex/provisioning.js:97, 137-144). `scope:'tenant'` blocks `requirePlatformAdmin` but is invisible to `requireAdmin`. The kreator router is mounted at index.js:105.

Refutations I tested and rejected:
- The `PRIVILEGED_PREFIXES` CORS block at index.js:32-51 does cover `/kreators/admin`, but it only strips `Access-Control-Allow-Origin` for browsers. A direct curl with a Bearer token sends no Origin and is unaffected. Defence in depth, not a control — the comment says so itself.
- The `ADMIN_PASSPHRASE`-missing 503 at authMiddleware.js:133-141 would have killed the path, but the key is configured (`functions/.env:4`), so requireAdmin falls through to the role check.
- No tenant/scope filter exists in `listApplications` (kreatorApplicationService.js:381-437) — the query is on `kreator_applications` with optional `status`/`email` filters only, and the mapper at :418-429 spreads `...data` wholesale.
- Firestore rules are irrelevant here; all reads go through the Admin SDK.

Payload confirmed: the application document is written with `phone` (:212), `productDescription` (:223), `location` (:226), a `consent` block including `consentIp` (:256-263), plus `ipAddress` and `userAgent` (:269-270) — all of it returned verbatim by the list route.

Escalation confirmed: `approveApplication` (kreatorApplicationService.js:445+) creates a Firebase Auth user (:483-497) and a `kreators/{uid}` doc with `permissions: ['products:create', ...]` (:521-531). That permission reaches `kreatorProductRoutes.js:245-246`, which writes `actualPrice: parsedPrice` into `kaaykoproducts` (and :392 on update) — the exact field checkout re-prices from.

P0 stands on the PII read alone (name, email, phone, physical location, IP of every seller applicant, to anyone who can complete an open Google sign-up). The self-approval into a catalogue write path with attacker-controlled `actualPrice` is a second, independent P0 consequence. Fix: swap `requireAdmin` for `requirePlatformAdmin` on all eight `/kreators/admin/*` routes in kreatorRoutes.js (718, 751, 786, 836, 900, 934, 964, 999); the same audit should check paddlingout.js:681/711/799, which uses the identical weak pair.

### P0 — SESSION_SECRET is not set on the deployed function — every kreator session token operation fails in production

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/services/kreatorService.js:30` · surface: auth-session

**What is wrong.** getSessionSecret() throws `SESSION_SECRET environment variable must be configured` whenever process.env.SESSION_SECRET is absent and FUNCTIONS_EMULATOR !== 'true' (kreatorService.js:26-34). I enumerated the live Cloud Run env for the `api` service (project kaaykostore, region us-central1): it carries WEATHER_API_KEY, ML_SERVICE_URL, KORTEX_SYNC_KEY, ADMIN_PASSPHRASE, ANTHROPIC_API_KEY, ALUMNI_TOKEN_SECRET, KORTEX_ACCESS_PEPPER, KORTEX_GUEST_SESSION_SECRET, KORTEX_LINK_SIGNING_SECRET, KORTEX_IP_SALT and the two Stripe secret refs. There is no SESSION_SECRET. functions/.env does not define it either — only .env.example does (.env.example:11), and Firebase deploys functions/.env, not the example. So createSessionToken (kreatorService.js:200) throws on every call and verifySessionToken (kreatorService.js:220) throws inside its try, is swallowed at line 239, and returns null. functions/scripts/predeploy-check.js forces FUNCTIONS_EMULATOR='true' at line 5, so the predeploy gate cannot catch this.

**Impact.** No kreator can hold a session. POST /kreators/auth/google/signin returns 500 'Failed to sign in with Google' because createSessionToken throws before the response is built. Every kreator route (GET/PUT /kreators/me, all of /kreators/products) returns 401 AUTH_TOKEN_INVALID for any token, indistinguishable from a bad signature. The entire kreator program is inoperable in production right now, and the failure mode is silent — nothing logs beyond a startup console.error at kreatorService.js:24.

**Fix.** Set SESSION_SECRET on the api function as a Secret Manager secret, not a plain env var: `firebase functions:secrets:set SESSION_SECRET` (32+ random bytes), then add "SESSION_SECRET" to the `secrets:` array in functions/index.js:172 alongside the Stripe entries and redeploy. Second, make the deploy fail loudly instead of at runtime: in functions/scripts/predeploy-check.js, before the FUNCTIONS_EMULATOR override at line 5, assert that each of SESSION_SECRET and ADMIN_PASSPHRASE is present in the resolved deploy env and exit non-zero if not.

> CONFIRMED: Substantiated on every axis I could attack it on.

CODE: kreatorService.js:22-33 — getSessionSecret() returns 'dev-only-secret-not-for-production' only when FUNCTIONS_EMULATOR === 'true'; otherwise it throws 'SESSION_SECRET environment variable must be configured' (line 31) when process.env.SESSION_SECRET is unset. A repo-wide grep excluding node_modules finds no other assignment, default, or fallback for SESSION_SECRET — only .env.example:11 and the unrelated KORTEX_GUEST_SESSION_SECRET.

DEPLOYMENT (re-enumerated myself, not copied from the finding): functions/.env — the file Firebase actually deploys — holds WEATHER_API_KEY, ML_SERVICE_URL, KORTEX_SYNC_KEY, ADMIN_PASSPHRASE, ANTHROPIC_API_KEY, ALUMNI_TOKEN_SECRET, KORTEX_ACCESS_PEPPER, KORTEX_GUEST_SESSION_SECRET, KORTEX_LINK_SIGNING_SECRET, KORTEX_IP_SALT. No SESSION_SECRET. functions/index.js:172 binds only secrets: ["STRIPE_SECRET_KEY","STRIPE_WEBHOOK_SECRET"], so it is not arriving via Secret Manager either. `gcloud run services describe api --region us-central1 --project kaaykostore` returns those 10 plus FIREBASE_CONFIG, GCLOUD_PROJECT, EVENTARC_CLOUD_EVENT_SOURCE, FUNCTION_TARGET, LOG_EXECUTION_ID and the two Stripe secretKeyRefs — 17 entries, none named SESSION_SECRET.

STALENESS (the best refutation angle, and it fails): the throw landed in commit c85bd88, 5 Feb 2026 ("Remove hardcoded secret fallbacks - require env vars in production"). The live revision api-00178-car was last modified 2026-09-05T17:04:45Z by service-87383373015@gcf-admin-robot — deployed today from current source. The deployed bundle contains the throw.

REACHABILITY: createSessionToken has exactly one caller in the whole codebase — kreatorRoutes.js:567, inside POST /kreators/auth/google/signin, which is the only session-minting path in the kreator surface (onboarding/complete at :305 does not mint one). The throw is caught by that handler's catch at :598 and returned as 500 'Failed to sign in with Google'. verifySessionToken (:212) calls getSessionSecret inside its own try at :224, the catch at :241 returns null, and kreatorAuthMiddleware.js:39-48 converts null into 401 AUTH_TOKEN_INVALID — so every /kreators/me, /kreators/products request 401s regardless of the token presented. No middleware, Firestore rule, or earlier validation intercepts this; the route is mounted (predeploy-check.js requires apiApp.use("/kreators") and the endpoints answer live). predeploy-check.js:5 does force FUNCTIONS_EMULATOR='true', so the gate genuinely cannot catch the missing var.

SEVERITY: P0 as claimed — no kreator can obtain or hold a session, so no kreator can log in, edit a profile, or list a product. The program is inoperable in production.

Two immaterial inaccuracies in the write-up, corrected for the record: line numbers drift by 8-10 (the throw is at :31 not :30; the createHmac calls are at :200 and :224), and the failure is not entirely silent — verifySessionToken logs '[Kreator] Token verification error:' at :241 on every request and the signin handler logs at :599. Neither weakens the finding.

FIX: add SESSION_SECRET to functions/.env with a high-entropy value (e.g. `openssl rand -hex 32`), or better, move it to Secret Manager (`firebase functions:secrets:set SESSION_SECRET`) and add "SESSION_SECRET" to the secrets array at index.js:172 alongside the Stripe keys, then redeploy. Separately, make predeploy-check.js assert the presence of each production-required env key by reading functions/.env directly rather than through process.env — it sets FUNCTIONS_EMULATOR='true' at line 5, which structurally blinds it to exactly this class of failure.


## P0 Findings — unverified (19)

Reported by a surface auditor with a file:line citation, but **not** put through adversarial verification (3-verifier cap). Treat as high-quality leads, not confirmed defects — the store audit refuted 18 of 38 similar candidates.

### P0 — Kreator email/password login has no backend — POST /kreators/auth/login returns a 404 HTML page

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/js/kreator-api.js:200` · surface: auth-session

**What is wrong.** kreator-api.js login() POSTs to /kreators/auth/login (line 200). No such route exists: kreatorRoutes.js registers only /apply, /applications/:id/status, /onboarding/verify, /onboarding/complete, /me (GET/PUT/DELETE), /auth/google/signin, /auth/google/connect, /auth/google/disconnect and the /admin/* set. A grep across functions/ for 'auth/login' matches nothing outside the frontend. Verified live: `POST https://api-vwcc5j4qda-uc.a.run.app/kreators/auth/login` returns 404 with Express's HTML body `Cannot POST /kreators/auth/login`. Three more client functions hit the same void: changePassword → /kreators/auth/password (kreator-api.js:349), getEarnings → /kreators/earnings (line 412), getMyLinks → /kreators/links (line 390). All 404.

**Impact.** The documented primary onboarding path sets a Firebase Auth password (kreatorService.js:474) and then tells the kreator 'You can now log in.' (kreatorRoutes.js:341). There is nothing to log in to. The sign-in form at kreator-login.html:621 calls login(), parseResponse does response.json() on an HTML body, and the SyntaxError propagates to kreator-login.html:633, so the kreator sees a raw JSON-parse error rather than any usable message. Password sign-in is 100% dead; Google is the only path, and that one is broken too (see the SESSION_SECRET and Google-signin findings).

**Fix.** Add `POST /kreators/auth/login` to kreatorRoutes.js next to the Google handler. It cannot verify a password with the Admin SDK, so it must take the Firebase ID token the client obtains from signInWithEmailAndPassword and exchange it: verify the ID token, require decoded.email_verified and decoded.firebase.sign_in_provider === 'password', look the kreator up by decoded.uid (not by email), reject unless status === 'active' and deletedAt is null, then kreatorService.createSessionToken(uid). Change kreator-login.html's submit handler to do the Firebase signInWithEmailAndPassword call and pass the ID token, and change kreator-api.js login() to POST { idToken }. Delete or implement changePassword/getEarnings/getMyLinks rather than leaving dead callers.

> not verified — 3-verifier cap

### P0 — Onboarding page reads a `valid` field the verify endpoint never returns — every good magic link renders as expired

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/onboarding.html:510` · surface: auth-session

**What is wrong.** onboarding.html:510 gates the password-setup form on `if (result.success && result.data.valid)`. The endpoint that produces that response, POST /kreators/onboarding/verify, returns `data: { email, purpose, expiresAt }` (kreatorRoutes.js:281-288) — there is no `valid` key and no `reason` key on the success path (validateMagicLink's `valid`/`reason` fields are consumed and discarded in the route's failure branch at kreatorRoutes.js:257-279). So on a perfectly good link, result.data.valid is undefined, the condition is false, and control falls to the else at onboarding.html:512 which calls showError(result.data?.reason || 'This invitation link is invalid or has expired.'). The page also reads result.data.fullName (onboarding.html:511-513 area), which the endpoint likewise never returns.

**Impact.** An approved kreator clicks the magic link in their approval email and is told the invitation is invalid or expired, on a link that the server just confirmed is valid and unused. There is no retry that helps — a resend produces the same result. No kreator can ever set a password through the shipped UI, so no kreator account can ever reach status 'active' via the magic-link route. This blocks the program even after SESSION_SECRET is fixed.

**Fix.** Two-line fix, do both halves. Server: in kreatorRoutes.js:281-288 return `data: { valid: true, email: result.email, fullName: <first+last from the kreator doc>, purpose: result.purpose, expiresAt: result.expiresAt }`. Client: change onboarding.html:510 to `if (result.success && result.data)`. Keep the server change even after the client fix so the two sides stop disagreeing about the contract.

> not verified — 3-verifier cap

### P0 — Kreator application list and approve/reject are guarded by requireAdmin, which any self-provisioned tenant admin satisfies

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorRoutes.js:718` · surface: auth-session

**What is wrong.** All eight kreator admin routes use `optionalAuthForAdmin, requireAdmin`: GET /admin/applications (line 718), GET /admin/applications/:id (751), PUT /admin/applications/:id/approve (786), PUT /admin/applications/:id/reject (836), GET /admin/list (900), GET /admin/stats (934), GET /admin/:uid (964), POST /admin/:uid/resend-link (999). requireAdmin accepts any admin_users role in ['super-admin','admin'] (authMiddleware.js, adminRoles check) and never looks at scope. api/kortex/provisioning.js:143-147 writes an admin_users profile with `role: 'admin', scope: 'tenant'` from an unauthenticated provisioning call. requirePlatformAdmin (authMiddleware.js:304-322) exists precisely for this and requires super-admin or admin+scope:'platform'; requireAuth already loads scope onto req.user at authMiddleware.js:78. None of the kreator routes use it.

**Impact.** Anyone who self-provisions a Kortex tenant can (a) read every kreator application — GET /admin/applications returns the full application docs, which carry applicant email, phone, business name, website and location, i.e. third-party PII; (b) approve an application, which creates a Firebase Auth user and a kreators/{uid} doc with permissions products:create/update (kreatorApplicationService.js:498-529), giving that account write access to the shared kaaykoproducts catalogue and therefore control of actualPrice, which pricing.js re-derives every charge from; and (c) reject legitimate applicants. This is the exact failure the project rule was written for: never guard money, customer PII or the catalogue with requireAdmin.

**Fix.** Replace `requireAdmin` with `requirePlatformAdmin` on all eight routes in kreatorRoutes.js (lines 718, 751, 786, 836, 900, 934, 964, 999), keeping `optionalAuthForAdmin` in front so the X-Admin-Key operator path still resolves. requirePlatformAdmin already short-circuits for authMethod === 'admin-key', so the internal-tool path is preserved with no other change.

> not verified — 3-verifier cap

### P0 — ADMIN_PASSPHRASE and KORTEX_SYNC_KEY are deployed with the identical value, re-creating the master-credential bug the code comment says was fixed

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/middleware/authMiddleware.js:246` · surface: auth-session

**What is wrong.** requireAdmin carries an explicit comment that KORTEX_SYNC_KEY used to be the fallback for ADMIN_PASSPHRASE and that this 'quietly promoted a shared sync/HMAC secret into a master admin credential', so 'Admin access now requires its own secret'. The code change landed. The deployment defeats it: reading the live Cloud Run env for the api service, ADMIN_PASSPHRASE and KORTEX_SYNC_KEY are set to byte-identical values. requireAdmin does timingSafeEqualStr(adminKey, ADMIN_PASSPHRASE) and on a match sets req.user.authMethod = 'admin-key'; requirePlatformAdmin then returns next() unconditionally for that authMethod (authMiddleware.js:310).

**Impact.** Every holder or leak-path of the Kortex sync key — a key handed to sync tooling and CI, not to people — is a full platform administrator. Presented as X-Admin-Key it passes requireAdmin and requirePlatformAdmin everywhere, including kreator application approve/reject, the applicant PII list, and every catalogue and money route those guards protect. The audit trail records the actor as the literal string 'admin-key-user' (authMiddleware.js:246), so such actions are unattributable.

**Fix.** Rotate ADMIN_PASSPHRASE to a fresh independent value distinct from KORTEX_SYNC_KEY and redeploy, then rotate KORTEX_SYNC_KEY as well since it has been serving as an admin credential. Move both into Secret Manager (`firebase functions:secrets:set`) and add them to the `secrets:` array in functions/index.js:172 instead of shipping them as plain env values. Add a startup assertion in functions/index.js that ADMIN_PASSPHRASE !== KORTEX_SYNC_KEY and refuses to serve otherwise — the code comment's intent needs an enforcement point, not just prose.

> not verified — 3-verifier cap

### P0 — multer cannot work under Firebase Functions — product create takes a body the runtime already consumed

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorProductRoutes.js:167` · surface: dashboard-products

**What is wrong.** POST /kreators/products and PUT /kreators/products/:id parse multipart/form-data with multer (configured at lines 19-32, applied at 167 and 360). multer reads the request stream via busboy. The Cloud Functions Node runtime installs a catch-all body parser ahead of the Express app and hands the original bytes back on req.rawBody — this repo has already been bitten by it and documented it in api/checkout/stripeWebhook.js:80-87: 'Firebase Functions parses the request body before our Express app ever sees it and hands the original bytes back on req.rawBody, so by the time express.raw() would run, req.body is already a parsed object.' The same is true for multipart: by the time upload.array('images', 5) runs the stream has ended, so no fields and no files are parsed. The destructure at line 169 then yields undefined for title/description/price/category and line 181 returns 400. Nothing in the codebase uses busboy or req.rawBody for uploads, and functions/__tests__/kreator-api.test.js (per api/kreators/SKILL.md:262-271) only asserts the 401/403 auth failures — a successful multipart create has never been exercised.

**Impact.** An approved kreator fills in the whole add-product form, waits through the image reads, and gets 'Title, description, price, and category are required'. The seller-facing half of the program does not function at all, which is consistent with the shared catalogue containing zero kreator-authored products.

**Fix.** Drop multer from this router. Add a small parser that feeds busboy from the buffered body: `const bb = Busboy({ headers: req.headers, limits: { files: 5, fileSize: 5*1024*1024 } }); bb.on('field'...); bb.on('file', ...collect to Buffer); bb.on('close', next); bb.end(Buffer.isBuffer(req.rawBody) ? req.rawBody : req.body);` mounted in place of upload.array on both POST (line 167) and PUT (line 360), populating req.body and req.files with the same shape the handlers already expect. Enforce the 5-file / 5MB caps in the handler since busboy's limits fire on truncation rather than rejecting. Verify with one authenticated `curl -F title=... -F images=@a.jpg` against the deployed function before calling this closed.

> not verified — 3-verifier cap

### P0 — A kreator's products stay live and purchasable after their account is deleted, and nothing can suspend a kreator

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorRoutes.js:449` · surface: dashboard-products

**What is wrong.** DELETE /kreators/me (lines 449-465) writes status:'deleted', deletedAt and an anonymised email onto kreators/{uid} and touches nothing else. Every kaaykoproducts document carrying that kreatorId keeps isAvailable:true and no deletedAt, so products.js:75 still lists it and pricing.js isPurchasable still sells it — that function reads only the product document and never looks at the seller. Separately, kreatorService.js:40-41 defines SUSPENDED and DEACTIVATED statuses and kreatorAuthMiddleware.js:126-140 checks for them, but no route in the API ever writes them: the full router list in kreatorRoutes.js ends at POST /admin/:uid/resend-link, with no suspend, deactivate or status endpoint. And because DELETE /kreators/products/:id sits behind requireActiveKreator (kreatorProductRoutes.js:453), a deleted or suspended kreator cannot pull their own listings either.

**Impact.** Customers keep buying, paying and being charged for goods from a seller who has closed their account or been thrown off the platform, with nobody to fulfil them. The only remedy is an admin flipping isAvailable one product at a time via PATCH /admin/products/:id. There is no kill switch for a fraudulent seller at all.

**Fix.** In DELETE /kreators/me, before returning, run a batched update over `db.collection('kaaykoproducts').where('kreatorId','==',req.kreator.uid)` setting isAvailable:false, deletedAt and deletedBy:'account-deleted'. Add POST /kreators/admin/:uid/suspend and /reinstate (guarded by requireAuth + requirePlatformAdmin, not requireAdmin, since this is catalogue control) that set kreators/{uid}.status and run the same hide/unhide batch. As a backstop, have pricing.js isPurchasable reject a line whose product carries a kreatorId whose kreators doc is not status:'active'.

> not verified — 3-verifier cap

### P0 — PUT /kreators/products/:id writes actualPrice with no validation — NaN, negative and out-of-range prices all accepted

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorProductRoutes.js:389` · surface: dashboard-products

**What is wrong.** The create path validates price at lines 189-196 (finite, 0.99-500). The update path does not: lines 389-393 are `if (price) { const parsedPrice = parseFloat(price); updates.price = priceToSymbol(parsedPrice); updates.actualPrice = parsedPrice; }` with no isNaN, no range, no sign check. parseFloat('abc') is NaN, and NaN is a storable Firestore double. pricing.js resolveUnitPriceCents (lines 71-75) then rejects the non-finite actualPrice and falls through to the price symbol, which priceToSymbol(NaN) computed as '$' because every `cents >= tierCents` comparison against NaN is false — mapping to 1999 cents. Lines 394-397 have the same hole for quantity: parseInt('x') writes NaN to stockQuantity and maxQuantity.

**Impact.** A kreator (or anything replaying their non-revocable session token) can set a $200 product's actualPrice to NaN or a negative number and the checkout will silently charge the buyer $19.99 for it, while the seller dashboard still displays the intended price. It also bypasses the $0.99 floor and the $500 ceiling that the create path enforces.

**Fix.** Extract the create-path check into `function validatePrice(raw) { const n = parseFloat(raw); return Number.isFinite(n) && n >= 0.99 && n <= 500 ? n : null; }` at the top of the file, use it at line 189, and in PUT replace lines 389-393 with a call that returns 400 'Price must be between $0.99 and $500' when it yields null. Do the same for quantity: `const q = parseInt(quantity, 10); if (!Number.isInteger(q) || q < 1 || q > 9999) return 400`.

> not verified — 3-verifier cap

### P0 — The kreator admin console cannot authenticate against production — no application can ever be approved

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/admin/index.html:661` · surface: admin-console

**What is wrong.** The console's only credential is a hardcoded constant `const ADMIN_PASS = 'kaayko2026admin'` (line 661), sent as the `X-Admin-Key` header on every call (lines 707, 958, 980). I verified against production: `curl -H 'X-Admin-Key: kaayko2026admin' https://api-vwcc5j4qda-uc.a.run.app/kreators/admin/applications` returns 401 AUTH_REQUIRED, so the string does not match the deployed `ADMIN_PASSPHRASE`. Worse, the page ALWAYS sends the header, and `optionalAuthForAdmin` (/Users/Rohan/Kaayko_v6/kaayko-api/functions/middleware/authMiddleware.js:392-397) short-circuits and skips `requireAuth` entirely whenever `x-admin-key` is present — so even a signed-in super-admin loading this page gets 401, because `req.user` is never populated. This page is the ONLY frontend in the repo that calls /kreators/admin/* (grep over kaayko/src returns exactly one file); the Kortex SPA has no applications view.

**Impact.** The approve/reject pipeline is completely dead in production. Every applicant who submits the form sits in `kreator_applications` forever: no kreator account is created, no magic link is sent, and the applicant's check-status page shows 'pending' indefinitely. The whole kreator program is un-launchable until this is fixed.

**Fix.** Two changes. (1) In index.html, delete ADMIN_PASS and the X-Admin-Key header; authenticate with Firebase Auth (the same signInWithPopup flow kortex.html uses) and send `Authorization: Bearer <idToken>` instead — that path goes through requireAuth and reads the role from admin_users/{uid}. (2) In authMiddleware.js optionalAuthForAdmin (line 392), do not skip requireAuth when x-admin-key is present unless the key actually validates: check the key against ADMIN_PASSPHRASE there, and fall through to requireAuth when it does not match, so a Bearer token plus a stale key still works.

> not verified — 3-verifier cap

### P0 — Every /kreators/admin/* route is guarded by requireAdmin, which any self-provisioned Kortex tenant satisfies

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorRoutes.js:718` · surface: admin-console

**What is wrong.** All eight admin routes use `optionalAuthForAdmin, requireAdmin` — lines 718 (list applications), 751 (get application), 786 (approve), 836 (reject), 900 (list kreators), 934 (stats), 964 (get kreator), 999 (resend magic link). `requireAdmin` (middleware/authMiddleware.js:165-173) passes for role `super-admin` OR `admin`, with no scope check. `role: 'admin'` is self-serve: POST /kortex/tenants/provision is guarded only by `rateLimiter + requireAuth` (api/kortex/smartLinks.js:622) and writes `role: 'admin', scope: 'tenant'` into admin_users/{uid} for the caller (api/kortex/provisioning.js:143-147); the guest upgrade path does the same (api/kortex/guestRouter.js:614-616). `requirePlatformAdmin` exists in the same file for exactly this reason and is not used here.

**Impact.** Any person with a Google account can sign in to Kortex, provision a tenant, and then read every kreator applicant's full record — legal name, email, phone, business name, physical location, submission IP and user agent, and consent IP — approve arbitrary applications (which mints a Firebase Auth user and a kreators/{uid} doc with `products:create`, giving that account write access to the shared kaaykoproducts catalogue where it controls actualPrice), reject legitimate applicants, and resend magic links. This is both a PII breach and a path into the money-critical catalogue.

**Fix.** Replace `requireAdmin` with `requirePlatformAdmin` on all eight routes in kreatorRoutes.js (718, 751, 786, 836, 900, 934, 964, 999), keeping `optionalAuthForAdmin` first so the operator X-Admin-Key path still works. requirePlatformAdmin fails closed for `scope: 'tenant'` profiles, which is what self-provisioning writes.

> not verified — 3-verifier cap

### P0 — Stored XSS in the admin console: applicant free text is interpolated into innerHTML, and website goes straight into href

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/admin/index.html:889` · surface: admin-console

**What is wrong.** renderApplications() and viewApplication() build markup by template literal and assign it with innerHTML (lines 827 and 858). Applicant-controlled values are interpolated raw: firstName/lastName (788, 869), email (789, 874), businessName (794, 882), businessType (795), productCategories (800, 895), productDescription (909), location (913), phone (877). No escaping anywhere. The server does not sanitize either — validateApplication (services/kreatorApplicationService.js:60-140) only checks presence, type and length; it never rejects angle brackets, and the values are stored with a bare `.trim()` (lines 209-231). The email regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (line 74) accepts `<img/src=x/onerror=...>@a.bc` because that payload contains no whitespace and no second @. Worst of all, line 889 emits `<a href="${app.website}">` and the website check at line 91-96 is `new URL(data.website)` inside try/catch — the WHATWG URL parser accepts `javascript:alert(1)` as a valid URL, so a javascript: scheme passes validation, is stored, and becomes a clickable link in the reviewer's console.

**Impact.** A hostile applicant plants script in a public, unauthenticated form (POST /kreators/apply) and it executes in the owner's browser the moment the applications list is opened — in a page whose JS scope holds the admin key and whose session is the approval authority. The payload can silently approve its own application, reject competitors, or exfiltrate every applicant's PII. It is currently latent only because the console 401s (finding 1); fixing auth without fixing this arms it.

**Fix.** In index.html, stop building rows with innerHTML. Add `const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))` and wrap every `${app.*}` interpolation at lines 788-810 and 861-925, or build rows with document.createElement + textContent. For line 889, render the website as plain text unless `new URL(app.website).protocol` is exactly 'http:' or 'https:'. Server side, add the same scheme allowlist to validateApplication (kreatorApplicationService.js:91) and reject `<` or `>` in firstName, lastName, businessName, location and productDescription with explicit max lengths (firstName/lastName 80, businessName 120, location 200).

> not verified — 3-verifier cap

### P0 — The kreator activation email cannot be sent at all — @sendgrid/mail is not installed and the key is unset, and the sender reports success anyway

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/services/emailNotificationService.js:235` · surface: email-notifications

**What is wrong.** sendMagicLinkEmail() (line 350) is the only kreator email in the codebase, and it delivers through sendEmail() (line 231). That function reads SENDGRID_API_KEY via defineString(..., {default: ''}) — the key is absent from functions/.env, absent from .env.example, and not listed in the `secrets:` array of exports.api (index.js:167-172); docs/KORTEX_PHASE1_TRUST.md:238 records it as unset in production. So the SendGrid branch is never entered, and control falls to line 269, which console.logs the message and returns {success: true, messageId: 'dev-...', provider: 'console-log'}. Even if the key were set, line 237 `require('@sendgrid/mail')` would throw MODULE_NOT_FOUND: @sendgrid/mail is not in functions/package.json dependencies (only nodemailer is) and is not present in node_modules. The caller in kreatorApplicationService.js:672 is fire-and-forget with a .catch that only logs, so nothing anywhere surfaces the failure. Meanwhile the admin UI hard-codes the opposite claim: kreator/admin/index.html:951 warns "An onboarding email will be sent to the applicant" and line 964 reports "Application approved! Onboarding email sent." The magic link URL is returned in the approve response but the admin page never renders or copies it.

**Impact.** Every approved kreator is stranded. The kreators/{uid} doc is created with status pending_password, a short_links magic-link doc is created, the application flips to approved — and the person is never told, has no link, and cannot log in (kreator-login requires a password that only the magic link can set). The owner is affirmatively told the email went out. The kreator program cannot produce a single working seller.

**Fix.** Delete the SendGrid path for kreator mail and route it through the store's proven pipeline: in services/kreatorApplicationService.js and services/kreatorService.js, replace the sendMagicLinkEmail import with `const { renderEmail, queueMailOnce } = require('../api/email/render')`, add api/email/templates/kreatorActivation.html, and call `await queueMailOnce(db, `kreator_activate_${token.code}`, { to: appData.email, message: { subject, html } })` — awaited, inside the approve route's error path, so a failure to queue returns a non-200 instead of silently approving. That gets Secret-Manager SMTP (MAIL_SMTP_URL), delivery.state write-back, mailHealth visibility and idempotency for free. Until that ships, add the magicLinkUrl from the approve response to kreator/admin/index.html:964 as a copyable field so the owner can hand it over manually, and change the confirm/alert copy to stop claiming an email was sent.

> not verified — 3-verifier cap

### P0 — Nothing notifies the owner that a kreator application arrived — the queue is poll-only and applications self-expire in 30 days

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/services/kreatorApplicationService.js:279` · surface: email-notifications

**What is wrong.** submitApplication() validates, checks for a duplicate, writes the kreator_applications document at line 279, logs a line, and returns. There is no mail call, no queueMailOnce, and no Firestore trigger on kreator_applications — the only trigger exported by the codebase is mailSender on mail/{docId} (index.js:201), and grepping kreator_applications outside the service finds only testRoutes.js and a resend update. The store has an owner-alert mechanism for exactly this shape of event (notifyOwner + ownerAlert.html, stripeWebhook.js:1113) and the kreator flow does not use it. Meanwhile getApplication() (line 320) flips any pending application older than APPLICATION_EXPIRY_DAYS (30) to `expired`, and approveApplication() refuses an expired application at line 474.

**Impact.** A seller fills in a long four-step application and it lands in a collection nobody is watching. The owner's only discovery mechanism is remembering to open /kreator/admin and type a passphrase. Anything not reviewed inside 30 days becomes permanently un-approvable, and the applicant is never told that either. In practice the intake funnel is a dead-letter box.

**Fix.** At the end of submitApplication (after the .set at line 279, before the return), queue an owner alert through the store's pipeline: `await queueMailOnce(db, `kreator_app_${applicationId}`, { to: resolveNotifyEmail(), message: { subject: `New seller application — ${application.businessName}`, html: renderEmail('ownerAlert.html', { alertTitle, alertText, rows: [...], stripeUrl: `https://kaayko.com/kreator/admin`, stripeLabel: 'Review in Kreator Admin →' }) } })` using resolveNotifyEmail from api/email/notifyAddress.js so the address is the same one order alerts use. The deterministic id makes a resubmit or replay safe. Separately, either stop auto-expiring pending applications or send a reminder alert at day 21.

> not verified — 3-verifier cap

### P0 — There is no payout model at all — nothing links an order line to the kreator who owns the product

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/checkout/stripeWebhook.js:512` · surface: data-model

**What is wrong.** The order document written by the webhook carries productId, productTitle, size, gender, quantity, unitPriceCents, lineTotalCents — and nothing else about ownership (stripeWebhook.js:512-527). pricing.js builds that item shape at pricing.js:351-364 and never reads kreatorId/storeName/sellerEmail from the product document it just loaded. A grep for commission|payout|stripeAccountId|connectedAccount|transfer_data|application_fee|taxId across the entire functions tree returns zero hits. The kreator document created at approval (kreatorApplicationService.js:552-561) has stats.totalOrders and stats.totalRevenue, both initialised to 0 and written by nothing — the only stats writes in the codebase are the totalProducts increment/decrement at kreatorProductRoutes.js:281 and 486. The only surviving ownership link is orders.productId -> kaaykoproducts/{id}.kreatorId, a live mutable lookup, which contradicts the stated invariant that orders snapshot the product at purchase time: soft-delete the product and the join still works, but nothing prevents a future edit from changing what the historical order resolves to.

**Impact.** Kaayko cannot pay a kreator. There is no query that answers 'what do I owe this seller for September'. Reconstructing it requires joining every order to the current product document, which is mutable and does not exist for a hard-deleted product. Every kreator sale is money the platform has collected with no recorded liability.

**Fix.** Three changes. (1) In pricing.js resolveCart, add kreatorId, storeName and storeSlug to the object pushed at pricing.js:351 (read from product.data, default null) so they flow into payment_intents/{id}.items. (2) In stripeWebhook.js normalizeItem (line 226) pass those three fields through, and add them to the batch.set at line 512 so each orders doc carries frozen ownership. (3) Add commissionRate (number) and payoutStatus/payoutAccountId to the kreator document in kreatorApplicationService.js:552, and derive a commissionCents per order line at webhook time from the rate on the kreator doc as it stood at purchase — snapshot it on the order like the price is snapshotted.

> not verified — 3-verifier cap

### P0 — The only kreator-application admin console cannot authenticate against the API — approvals are impossible from the UI

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/admin/index.html:661` · surface: data-model

**What is wrong.** kreator/admin/index.html:661 hardcodes `const ADMIN_PASS = 'kaayko2026admin'; // Change this!` and sends it as the `X-Admin-Key` header on every admin call (lines 707, 958, 980). authMiddleware.js:126-153 compares that header, constant-time, against process.env.ADMIN_PASSPHRASE. I checked kaayko-api/functions/.env: ADMIN_PASSPHRASE is set to a different value (I did not print it; the equality test against the literal fails). So loadApplications() at line 704 always fails and renders the 'Failed to load applications' empty state at line 723. The same header is used for approve (line 954) and reject (line 976). No other frontend reads kreator_applications — a grep across kaayko/src for 'kreator' outside kreator/ returns only kaayko_ui.js and admin/views/create-link. There is also no kreator listing in the Kortex SPA.

**Impact.** Applications submitted at /kreator/apply are written to kreator_applications and nobody can see or act on them from any UI. The pipeline dead-ends at the approval step: an applicant gets 'we will review within 2-3 business days' (kreatorApplicationService.js:284) and no human can approve them without hand-crafting a curl request with the production passphrase. The whole kreator program is non-operational.

**Fix.** Delete ADMIN_PASS from admin/index.html and the client-side `if (pass === ADMIN_PASS)` gate at line 681. Replace the four fetch calls with Firebase ID-token auth (signInWithEmailAndPassword + getIdToken, `Authorization: Bearer <token>`), matching the pattern the Kortex admin SPA already uses, and change the six kreator admin routes to `requireAuth, requirePlatformAdmin`. Keep the X-Admin-Key path in the middleware for CLI tooling only, never in a page served from kaayko.com.

> not verified — 3-verifier cap

### P0 — Kreator admin routes use requireAdmin, which is a self-serve role — any tenant admin reads every applicant's PII and can approve kreators

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorRoutes.js:718` · surface: data-model

**What is wrong.** All six kreator admin routes are guarded by `optionalAuthForAdmin, requireAdmin` — kreatorRoutes.js:718 (list applications), 751 (application detail), 786 (approve), 836 (reject), 900 (list kreators), 964 (kreator detail), 999 (resend magic link). Per the project's own rule, `role: 'admin'` is self-serve via POST /kortex/tenants/provision, and requirePlatformAdmin exists precisely for money, customer PII and the catalogue (authMiddleware.js:300-330). listApplications returns the raw document with a full spread — `{ id: doc.id, ...data, ... }` at kreatorApplicationService.js:417-425 — so the response includes email, phone, business location, ipAddress, userAgent and consent.consentIp for every applicant. Approving also mints a Firebase Auth user and a magic link (kreatorApplicationService.js:485-622).

**Impact.** Anyone who self-provisions a tenant admin account reads the name, email, phone, physical business location and IP address of every person who has ever applied to sell on Kaayko, and can approve themselves or a confederate into the shared catalogue — which then lets them set prices customers are actually charged.

**Fix.** Change all seven route definitions listed above from `requireAdmin` to `requireAuth, requirePlatformAdmin`. Separately, narrow the projection in kreatorApplicationService.listApplications (line 417) from `...data` to an explicit field list that omits ipAddress, userAgent and consent.consentIp — the review UI at admin/index.html only renders firstName, lastName, email, businessName, businessType, productCategories and status.

> not verified — 3-verifier cap

### P0 — PUT /kreators/products/:id applies no price bounds and no NaN check — a malformed update silently reprices a product to $19.99

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorProductRoutes.js:389` · surface: data-model

**What is wrong.** POST enforces a price band at kreatorProductRoutes.js:190 (`isNaN(parsedPrice) || parsedPrice < 0.99 || parsedPrice > 500`). The update path at line 389-393 does none of it: `if (price) { const parsedPrice = parseFloat(price); updates.price = priceToSymbol(parsedPrice); updates.actualPrice = parsedPrice; }`. parseFloat('abc') is NaN; Firestore stores NaN as a double. priceSymbolFor(NaN) (pricing.js:134-140) compares `NaN >= tierCents` which is false for every tier, so it returns the lowest symbol '$'. On the next checkout resolveUnitPriceCents (pricing.js:74-77) rejects the non-finite actualPrice and falls through to the symbol branch at line 83-86, resolving '$' to 1999 cents. The same missing check lets a kreator set actualPrice to 0.01 (charged 1 cent) or 4999.

**Impact.** A kreator editing a $450 art print and fat-fingering the price field turns it into a $19.99 product that customers are actually charged $19.99 for — pricing.js is the sole pricing authority and it will honour that. The kreator ships a $450 item for $19.99 and the platform has no signal that anything went wrong. A deliberate one-cent update is the same bug used on purpose.

**Fix.** Extract the POST validation at kreatorProductRoutes.js:189-195 into `function validatePrice(raw)` returning `{ok, cents}` and call it from both handlers. In the PUT branch, replace lines 389-393 with a call that rejects with 400 when the value is not finite or falls outside 0.99-500, exactly as create does. Also guard the quantity branch at line 394 the same way — `parseInt('abc')` currently writes NaN to stockQuantity and maxQuantity.

> not verified — 3-verifier cap

### P0 — Kreator admin routes use requireAdmin, so any self-serve Kortex tenant admin can read every applicant's and every kreator's PII

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorRoutes.js:718` · surface: no-leak

**What is wrong.** Every /kreators/admin/* route is guarded by `optionalAuthForAdmin, requireAdmin` (lines 718, 751, 786, 836, 900, 934, 964, 999). requireAdmin (/Users/Rohan/Kaayko_v6/kaayko-api/functions/middleware/authMiddleware.js:174) accepts role 'super-admin' OR 'admin' with no scope check. `role:'admin'` is self-serve: POST /kortex/tenants/provision is guarded only by requireAuth (smartLinks.js:622) and writes `role:'admin', scope:'tenant'` into admin_users/{uid} for the caller (provisioning.js:143-147); the guest-upgrade path does the same (guestRouter.js:614). The handlers return unfiltered documents — listApplications spreads `...data` (kreatorApplicationService.js:418-429) and listKreators spreads `...data` (kreatorService.js:333-340). This is exactly the case requirePlatformAdmin was written for; its own docblock (authMiddleware.js:298-311) names customer PII as the reason, and index.js applies it to every /admin/* store route, but the kreator router was never converted.

**Impact.** Anyone who can sign in with Google and call the open Kortex self-serve provision endpoint can then GET /api/kreators/admin/applications and read every seller applicant's full name, email, phone, business name, business location, website, IP address and consent record; GET /api/kreators/admin/list dumps the same for every active kreator. They can also approve or reject applications, i.e. mint sellers into the shared kaaykoproducts catalogue.

**Fix.** In /Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorRoutes.js replace `requireAdmin` with `requirePlatformAdmin` on all eight /admin/* routes (718, 751, 786, 836, 900, 934, 964, 999) and change the import on line 40 to pull requirePlatformAdmin from ../../middleware/authMiddleware. Keep optionalAuthForAdmin so the X-Admin-Key operator path still works (requirePlatformAdmin honours authMethod==='admin-key' at authMiddleware.js:319).

> not verified — 3-verifier cap

### P0 — Approve and resend-link return the one-time magic-link code in the HTTP response body

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorRoutes.js:799` · surface: no-leak

**What is wrong.** PUT /kreators/admin/applications/:id/approve returns `data: result` verbatim (lines 799-802), and approveApplication's result includes `magicLinkCode` and `magicLinkUrl` (kreatorApplicationService.js:659-668). POST /kreators/admin/:uid/resend-link does the same (kreatorRoutes.js:1007-1010; kreatorService.js:853-861). That code is the sole credential accepted by the unauthenticated POST /kreators/onboarding/complete, which sets the kreator's password and activates the account. resendMagicLink works on any kreator still in pending_password status (kreatorService.js:757). Combined with the requireAdmin weakness above, the caller never needs access to the target's mailbox.

**Impact.** A self-provisioned tenant admin can approve an application, read the magic-link code straight out of the JSON response, and complete onboarding as that seller — or resend a link for any not-yet-onboarded kreator and take the account over. The hijacked seller account can then write products into the shared kaaykoproducts collection with attacker-chosen actualPrice, which pricing.js re-derives as the amount charged.

**Fix.** Strip the secret from both response bodies: in kreatorRoutes.js:799 and 1007 return only `{ applicationId/kreatorId, kreatorEmail, status, expiresAt }` and drop magicLinkCode/magicLinkUrl. The link is already emailed by sendMagicLinkEmail (kreatorApplicationService.js:672, kreatorService.js:865). If an operator break-glass copy is genuinely needed, gate it behind requireSuperAdmin and an explicit `?includeLink=1`, and remove the raw code from the admin_audit_logs `after` block (kreatorApplicationService.js:646) and metadata (kreatorService.js:844) too.

> not verified — 3-verifier cap

### P0 — The only kreator application review UI authenticates with a hardcoded key that production rejects — no application can be approved

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/admin/index.html:661` · surface: no-leak

**What is wrong.** /kreator/admin/index.html is the only page in kaayko/src that calls the kreator admin API (it is the sole caller of /kreators/admin/applications, .../approve and .../reject at lines 705, 954, 976). It sends `X-Admin-Key: ADMIN_PASS` where ADMIN_PASS is the literal `'kaayko2026admin'` on line 661, with the comment "Change this!". I probed production read-only: GET https://api-vwcc5j4qda-uc.a.run.app/kreators/admin/stats returns 401 with that key, the same as with no key and with a junk key — so prod ADMIN_PASSPHRASE does not match, and requireAdmin (authMiddleware.js:147) falls through to the Firebase path with no req.user and 401s. The page's own gate is client-side only: it compares the typed passphrase to the same constant (line 681) and persists `kreator_admin_auth=true` in localStorage (line 672), so the login screen is decorative.

**Impact.** Every seller application submitted through /kreator/apply sits in kreator_applications forever: the review console loads, the applicant list always fails with "Failed to load applications", and Approve/Reject 401. The kreator program cannot onboard anyone. Separately, a credential-shaped constant is published in view-source on kaayko.com; if anyone ever sets ADMIN_PASSPHRASE to that value the X-Admin-Key path bypasses requirePlatformAdmin outright (authMiddleware.js:319) and also seeds the Kortex access/guest peppers (api/kortex/guestAccess.js:97,106).

**Fix.** Delete the ADMIN_PASS constant and the client-side passphrase gate from /Users/Rohan/Kaayko_v6/kaayko/src/kreator/admin/index.html, and move this page onto the same Firebase ID-token flow the Kortex admin SPA uses: sign in with Firebase Auth, send `Authorization: Bearer <idToken>`, and let the server's requirePlatformAdmin decide. Never ship ADMIN_PASSPHRASE to a browser. Confirm afterwards that a platform admin can actually load and approve an application in production — that path has never worked.

> not verified — 3-verifier cap


## P1 Findings — unverified (32)

Reported by a surface auditor with a file:line citation, but **not** put through adversarial verification (3-verifier cap). Treat as high-quality leads, not confirmed defects — the store audit refuted 18 of 38 similar candidates.

### P1 — Stored XSS in the admin console: every applicant free-text field is interpolated into innerHTML, and website becomes a raw href

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/admin/index.html:858` · surface: application-pipeline

**What is wrong.** The application table (built at 771, injected at 827) and the detail modal (858) build HTML by template-literal interpolation and assign via innerHTML. Applicant-controlled values go in unescaped: `${app.firstName} ${app.lastName}` (788, 869), `${app.email}` (791), `${app.businessName}` (795), `${app.productDescription}` (909), `${app.location}` (913), `${app.phone}` (881). Nothing on the server escapes them either — kreatorApplicationService.js:208-226 only calls `.trim()`. Worse, line 889 emits `<a href="${app.website}">`; the server's only website check is `new URL(data.website)` (kreatorApplicationService.js:94-100), and `new URL('javascript:alert(1)')` succeeds, so a `javascript:` URL is stored and rendered as a clickable link in the reviewer's page. This is latent today only because the console's fetches 401 (previous finding) so no data reaches innerHTML — fixing the auth without fixing this arms it.

**Impact.** Once the console authenticates, any stranger who submits the public application form runs script in the reviewer's browser on kaayko.com: they can read the admin's Firebase ID token / X-Admin-Key from the page, self-approve their own application, and pivot to the catalogue. Fix this in the same change as the auth fix, not after.

**Fix.** Add an `esc()` helper (`String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))`) at the top of the script block and wrap every `${app.*}` interpolation in the 771-827 table template and the 858 modal template. For the website link at 889, only emit an `<a>` when `new URL(app.website).protocol` is `http:` or `https:`, otherwise render escaped text. Also harden the source: in kreatorApplicationService.js:94-100 reject any website whose parsed protocol is not http/https.

> not verified — 3-verifier cap

### P1 — An unreviewed application deadlocks after 30 days — cannot be approved, cannot be re-submitted

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/services/kreatorApplicationService.js:320` · surface: application-pipeline

**What is wrong.** Expiry is written to Firestore in exactly one place: `getApplication` (320-330), the admin single-record fetch. Neither `getApplicationStatus` (348-369, the public status check) nor `listApplications` (376-438) performs the check, and there is no scheduled job (functions/scheduled/ holds only enrichmentFreshness, orderRetention, paddleScoreWarmer; grep for `kreator_applications` finds no cron). So a 31-day-old application still reads `status: 'pending'`. `approveApplication` compares `expiresAt < new Date()` independently at 473-478 and throws EXPIRED (410). The duplicate guard at 177-193 blocks a new submission whenever an existing row is `pending` or `approved`. There is no route anywhere in kreatorRoutes.js to delete, reset or extend an application.

**Impact.** A serious seller applies, nobody reviews within 30 days, and they are permanently locked out: check-status keeps saying "Application Pending — typically 2-3 business days" forever, approve returns 410, and re-applying returns 409 "An application with this email is already pending review". The admin has no remedy short of editing Firestore by hand.

**Fix.** Three parts. (1) Add the same lazy-expiry block from lines 320-330 to `getApplicationStatus` so the public page tells the truth, and add a `scheduled/kreatorApplicationExpiry.js` that batch-updates `where('status','==','pending').where('expiresAt','<', now)` to `expired` daily. (2) In `submitApplication`'s duplicate query at 177-181, additionally treat a `pending` row whose `expiresAt` is in the past as non-blocking (fetch it and check, or rely on the cron plus an `expiresAt >= now` guard). (3) Add `PUT /kreators/admin/applications/:id/reopen` behind `requirePlatformAdmin` that resets an expired row to pending with a fresh `expiresAt`.

> not verified — 3-verifier cap

### P1 — The application pipeline sends zero email — the applicant is told they will get one, and a rejection is never delivered

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/services/kreatorApplicationService.js:279` · surface: application-pipeline

**What is wrong.** `submitApplication` writes the doc at line 279 and returns; it sends no acknowledgement to the applicant and no notification to any reviewer — the module's only email import is `sendMagicLinkEmail` (line 16), used solely by `approveApplication` (672-680). `rejectApplication` (692-753) updates the doc and writes an audit log; it never emails the applicant, even though it forces a >=10-character `rejectionReason` (693-697) that is clearly written to be read by them. Meanwhile apply.html:1024 promises "Email Confirmation — You'll receive your application status via email", and the API's own success message (kreatorApplicationService.js:292) says "we will... contact you at <email>". The application ID is rendered once on screen (apply.html:1274) and stored nowhere — no localStorage, no email — while check-status.html:249 makes it a required input and hints "You received this when you submitted your application". The API has no lookup-by-email route, so a lost ID is unrecoverable.

**Impact.** A rejected applicant is never told; they wait indefinitely for an email that does not exist. Anyone who closes the tab loses their application ID and can never check status again, and cannot re-apply either because the duplicate guard blocks them. On the other side, nobody is alerted that an application arrived, which is what lets the 30-day expiry deadlock above actually happen.

**Fix.** In kreatorApplicationService.js, use the already-exported `sendRawEmail` from services/emailNotificationService.js: (a) after the `set()` at line 279, send the applicant a confirmation containing the application ID and the direct link `https://kaayko.com/kreator/check-status?id=<id>&email=<email>` (check-status.html:314-319 already reads those query params), and send a notification to the reviewer address; (b) at the end of the `rejectApplication` transaction (after 725), send the applicant the `rejectionReason`. Escape all interpolated applicant values with the service's existing `escapeHtml` (emailNotificationService.js:302).

> not verified — 3-verifier cap

### P1 — Apply/status rate limiting is a per-instance in-memory map keyed on the proxy IP — it blocks real applicants and stops no spam

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/middleware/kreatorAuthMiddleware.js:251` · surface: application-pipeline

**What is wrong.** `kreatorRateLimit` (247-286) keys on `req.kreator?.uid || req.ip`. On the public apply route there is no kreator, so it is `req.ip`. This repo's own clientIp.js documents the consequence at api/kortex/clientIp.js:5-8: "`req.ip` and `req.connection.remoteAddress` resolve to the proxy... so every visitor collapses to one address... made per-IP rate limits behave as a single global bucket." So `kreatorRateLimit('apply', 5, 3600000)` (kreatorRoutes.js:144) is 5 applications per hour for the entire internet, per warm Cloud Function instance — and `kreatorRateLimit('status', 10, 60000)` (line 193) is 10 status checks per minute globally. The counter also lives in a per-instance `Map` (248), so it resets on cold start and does not exist across the autoscaled fleet. There is no CAPTCHA, honeypot or Turnstile in apply.html (grepped: zero matches). Separately, `attachClientInfo` (292-303) takes the LEFTMOST `x-forwarded-for` entry — attacker-supplied, per the same clientIp.js comment at lines 10-14 — and that value is persisted as the application's `ipAddress` and `consent.consentIp` (kreatorApplicationService.js:262, 269).

**Impact.** Two failures at once. Legitimate applicants get a 429 "Rate limit exceeded" because five unrelated strangers applied that hour on the same instance. And a spammer who rotates instances or simply waits out a cold start floods `kreator_applications` freely, while the IP recorded against each spam application — the only forensic field there is — is whatever value they put in the X-Forwarded-For header, so abuse triage chases the wrong address and the GDPR consent record is forged.

**Fix.** Replace the in-memory limiter on the two public routes with the existing distributed one: `const { ipRateLimit } = require('../kortex/rateLimitService')` — it is Firestore-bucketed, atomic and already resolves the caller with `getClientIp`. In middleware/kreatorAuthMiddleware.js, change line 251 to `req.kreator?.uid || require('../api/kortex/clientIp').getClientIp(req) || 'unknown'` for the remaining authenticated uses, and change `attachClientInfo`'s ip resolution (294-297) to call `getClientIp(req)` instead of parsing the leftmost X-Forwarded-For. Add a Cloudflare Turnstile or reCAPTCHA token to apply.html and verify it in the POST /kreators/apply handler before calling `submitApplication`.

> not verified — 3-verifier cap

### P1 — Approving a second application for the same email overwrites the live kreator document and locks the seller out

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/services/kreatorApplicationService.js:568` · surface: application-pipeline

**What is wrong.** The duplicate guard in `submitApplication` (177-193) is a plain query executed outside any transaction, so two submissions with the same email in the same moment both pass and both write. It also never consults the `kreators` collection. In `approveApplication`, the state guard at 465-470 only prevents re-approving the SAME application; for a second application, `admin.auth().createUser` throws `auth/email-already-exists`, is caught at 489, and `getUserByEmail` returns the existing uid (491). Line 568 then does `transaction.set(kreatorRef, kreatorDoc)` — a full document replacement, not a merge — with `status: 'pending_password'` (521), `authProviders: []` (516), `passwordSetAt: null` (517) and `stats` zeroed (541-546).

**Impact.** An admin who sees two near-identical pending applications and approves both — or approves a stale duplicate weeks later — silently resets an active seller's account to 'pending_password'. That seller's password and Google link are erased, their session is refused by `requireActiveKreator`, their product and revenue counters go to zero, and they have to be re-onboarded by magic link.

**Fix.** In `approveApplication`, before line 568, `transaction.get(kreatorRef)` and if the document already exists, either throw a `KREATOR_EXISTS` error (mapped to 409 in the route's errorMap at kreatorRoutes.js:808) or switch to `transaction.set(kreatorRef, kreatorDoc, { merge: true })` with `status`, `authProviders`, `passwordSetAt` and `stats` removed from the payload. Additionally, in `submitApplication` extend the guard at 177-193 to also reject when a `kreators` document exists for that email.

> not verified — 3-verifier cap

### P1 — Google sign-in's activation and account-link writes are silently discarded by updateKreatorProfile's field allowlist

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorRoutes.js:537` · surface: auth-session

**What is wrong.** On a pending_password kreator, /auth/google/signin calls kreatorService.updateKreatorProfile(kreator.uid, { status:'active', googleUid, googleConnectedAt, authProviders:['google'], activatedAt, activatedVia }) at kreatorRoutes.js:537-544. updateKreatorProfile copies only fields in its allowlist — displayName, brandName, bio, phone, website, socialLinks, avatarUrl (kreatorService.js:542-550). None of the six fields passed is in that list, so updateData ends up as `{ updatedAt }` only (kreatorService.js:552-560) and the Firestore write is a no-op. The route then mutates the in-memory copy at line 545 (`kreator.status = 'active'`), which is what the 403 check at line 549 reads, so the handler proceeds and mints a session. The same silent drop hits the link write at lines 559-563: googleUid never persists, so `if (!kreator.googleUid)` is true on every subsequent sign-in and writes nothing, forever.

**Impact.** A kreator signing in with Google appears to succeed — they get a token, the dashboard loads from the cached kreator object at dashboard.html:1354 — but their Firestore doc still says status 'pending_password'. requireActiveKreator (kreatorAuthMiddleware.js:120-127) then 403s KREATOR_PENDING_PASSWORD on every write route: POST/PUT/DELETE /kreators/products and PUT /kreators/me. They are logged in and can list products but cannot create or edit one, with an error telling them to complete a setup they just completed. authProviders stays [], so Google shows as not connected and disconnectGoogleAccount would return NOT_CONNECTED.

**Fix.** Do not route lifecycle changes through the profile allowlist. Add a dedicated kreatorService.activateViaGoogle(uid, googleUid, clientInfo) that writes status, googleUid, googleConnectedAt, authProviders (FieldValue.arrayUnion('google')), activatedAt and activatedVia in a transaction and appends an admin_audit_logs entry, and call it from kreatorRoutes.js:537. Then re-read the kreator from Firestore after that call instead of mutating the local object at line 545, so the status check at line 549 reflects what was actually persisted. Separately, make updateKreatorProfile throw on a field outside the allowlist rather than dropping it — a silent no-op is what let this ship.

> not verified — 3-verifier cap

### P1 — Forgot-password has no endpoint, and the page reports success no matter what happens

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/forgot-password.html:261` · surface: auth-session

**What is wrong.** forgot-password.html:261 calls requestPasswordReset(email), which POSTs /kreators/auth/forgot-password (kreator-api.js:362). No such route exists in kreatorRoutes.js; verified live, it returns 404 `Cannot POST /kreators/auth/forgot-password`. The reset half, /kreators/auth/reset-password (kreator-api.js:376), does not exist either and has no page calling it. The catch block at forgot-password.html:266-270 discards the error and shows the same 'Check Your Email' success panel as the try path — the comment says this is to avoid disclosing whether an email exists, but the effect is that a total backend absence is indistinguishable from success. The service does have a password_reset expiry constant (kreatorService.js:54) and MAGIC_LINK_EXPIRY_HOURS entry, but generateMagicLinkToken is only ever called with 'onboarding', and consumeMagicLinkAndSetPassword hard-requires status === PENDING_PASSWORD (kreatorService.js:461-471), so it would throw ALREADY_SETUP for any active kreator. There is no reachable reset path at all.

**Impact.** A kreator who forgets their password submits the form, is told to check their inbox, and no email ever arrives. With password login also 404 and Google sign-in broken, a kreator in this state is permanently locked out with no signal that anything failed and nothing in logs beyond a 404. The dishonest success panel means the failure is invisible to support too.

**Fix.** Implement the pair: POST /kreators/auth/forgot-password (kreatorRateLimit('forgot', 5, 3600000)) resolves the kreator by email, and for status 'active' issues a magic link via generateMagicLinkToken('password_reset') with metadata.purpose 'kreator_password_reset', always returning 200 regardless of existence; POST /kreators/auth/reset-password consumes it. consumeMagicLinkAndSetPassword must be generalised — its PENDING_PASSWORD gate at kreatorService.js:461 needs a purpose-aware branch that accepts ACTIVE for password_reset. The reset must also invalidate outstanding sessions, which today is impossible because the token has no jti or token-version; add a `tokenVersion` integer to the kreator doc, put it in the session payload at kreatorService.js:191-196, compare it in requireKreatorAuth after the Firestore read, and increment it on reset. Until the endpoint exists, stop the page lying: keep the generic message but only after a 2xx, and show a real error otherwise.

> not verified — 3-verifier cap

### P1 — The kreator application review console ships a hardcoded passphrase, gates on a client-side string compare, and cannot talk to production

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/admin/index.html:661` · surface: auth-session

**What is wrong.** kreator/admin/index.html declares a passphrase literal at line 661 (comment: 'Change this!'), compares the typed value against it in the browser at line 681, sets localStorage kreator_admin_auth='true' on match, and re-enters the console on any later load if that flag is present (line 672). It sends the same literal as the X-Admin-Key header on the applications fetch (line 707), approve (958) and reject (980). The page is served publicly — https://kaayko.com/kreator/admin returns 200 to an unauthenticated browser and the literal is in the response body. The deployed ADMIN_PASSPHRASE is a different value, which I confirmed by calling GET /kreators/admin/stats with that literal as X-Admin-Key: 401 AUTH_REQUIRED.

**Impact.** Two consequences. First, the console does not work: an operator types the passphrase, passes the client-side gate, sees the shell, and every call 401s — so applications cannot be listed, approved or rejected through the shipped UI. Combined with the other findings this means no applicant can be onboarded by any means. Second, the design puts a master credential in a public static file: the moment anyone 'fixes' the console by pasting the real ADMIN_PASSPHRASE into line 661, that value is world-readable at a 200-serving URL, and because requirePlatformAdmin short-circuits on authMethod === 'admin-key' (authMiddleware.js:310) it would be full platform admin, not just kreator admin.

**Fix.** Delete the ADMIN_PASS constant and the client-side comparison entirely. Authenticate the console the way Kortex does — Firebase sign-in, then send the ID token as `Authorization: Bearer` on the three fetches at lines 707, 958 and 980 — and pair that with switching the backend routes to requirePlatformAdmin (see the requireAdmin finding), so authorization is decided by admin_users/{uid} scope on the server. Never put an X-Admin-Key value in a file under kaayko/src. If the page must stay reachable, add /kreator/admin to the hosting rewrite exclusions so it is not served on the public host at all.

> not verified — 3-verifier cap

### P1 — Onboarding's on-screen password checklist omits the special character the server requires

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/onboarding.html:634` · surface: auth-session

**What is wrong.** onboarding.html's strength checker validates four rules — length ≥ 8, uppercase, lowercase, number (lines 555-565) — and the submit guard at line 634 blocks only on those four. The server's validatePassword sets requireSpecial: true against the class '!@#$%^&*()_+-=[]{}|;:,.<>?' (kreatorService.js:59-67, enforced at 171-176). A password satisfying all four green ticks and labelled 'Strong password' is rejected server-side with code INVALID_PASSWORD. The useful part of that response — error.details, the array naming the special-character rule (kreatorRoutes.js:363) — is dropped by the client: parseResponse throws `new Error(data.error || ...)` (kreator-api.js:130) and data.error is the bare code, so onboarding.html:193 alerts the string 'INVALID_PASSWORD'.

**Impact.** Once the magic-link verify contract is fixed, this is the next wall. The kreator sees every requirement satisfied, submits, and gets a modal saying 'INVALID_PASSWORD' with no indication of what is wrong. Nothing on screen mentions a special character. Most people will retry variations of the same rejected shape and give up.

**Fix.** Add a fifth requirement to checkPasswordStrength in onboarding.html:555 — `special: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)` — render a 'req-special' row alongside the existing four, and include !reqs.special in the guard at line 634. Separately, make server errors legible: in kreator-api.js parseResponse (line 130), when data.details is an array, throw with data.details.join('; ') so the actual rule reaches the user.

> not verified — 3-verifier cap

### P1 — kreatorRateLimit keys on req.ip, which is the proxy address — /kreators/apply is one global 5-per-hour bucket for the whole internet

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/middleware/kreatorAuthMiddleware.js:251` · surface: auth-session

**What is wrong.** kreatorRateLimit builds its key from `req.kreator?.uid || req.ip || 'unknown'` (line 251). On the four routes that use it — /apply (5/hour, kreatorRoutes.js:144), /applications/:id/status (10/min, 193), /onboarding/verify (20/min, 242), /onboarding/complete (5/min, 305) — the limiter runs before any authentication, so req.kreator is always undefined and the key is req.ip. `trust proxy` is never set on this app; api/kortex/clientIp.js:5-8 documents exactly this for the deployment: 'req.ip and req.connection.remoteAddress resolve to the proxy (commonly ::ffff:127.0.0.1) once a request has passed through Hosting, so every visitor collapses to one address... made per-IP rate limits behave as a single global bucket.' attachClientInfo, which runs first on every kreator route (kreatorRoutes.js:50), already computes a real client IP into req.clientInfo.ip — the limiter ignores it.

**Impact.** Not a bypass, an outage. Five kreator applications from anywhere in the world in one hour and the sixth applicant gets 429 'Rate limit exceeded for apply'. Twenty onboarding-verify hits in a minute — a handful of people opening their magic links, or a link preview fetcher — and the next real kreator's link check 429s and the page reports the link as broken. The counters also live in a per-instance Map (line 248), so behaviour varies unpredictably with Cloud Run autoscaling.

**Fix.** In kreatorAuthMiddleware.js:251 use the resolver that already exists: `const { getClientIp } = require('../api/kortex/clientIp'); const ip = getClientIp(req); const identifier = req.kreator?.uid || ip;` and, per that module's own warning, when ip is null skip the per-identifier bucket rather than collapsing to a shared 'unknown' sentinel — fall through to a separate, much looser global ceiling. Since Cloud Run instances do not share the Map, back the counters with the Firestore rate_limits collection already used for public paddle ratings if the limit is meant to be real.

> not verified — 3-verifier cap

### P1 — Product images: file type is taken from the client's declared MIME header, SVG is accepted, and makePublic() is used nowhere else in the repo

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorProductRoutes.js:25` · surface: dashboard-products

**What is wrong.** The multer fileFilter (lines 25-31) accepts anything whose `file.mimetype` starts with 'image/'. That string comes from the Content-Type header of the multipart part — it is entirely under the uploader's control and is never checked against the bytes. uploadProductImage then writes the object with `contentType: file.mimetype` (line 102), derives the extension verbatim from `file.originalname.split('.').pop()` (line 95), calls makePublic() (line 108) and caches it immutably for a year. image/svg+xml passes the filter, so a seller can host script-bearing SVG — or arbitrary bytes under any image/* label — on the project's storage bucket behind a kaayko-owned URL. Secondly, this is the only makePublic() call in the entire codebase: kaayko/scripts/store_uploader/firestore_writer.py:87, api/products/products.js:50 and api/weather/paddlingout.js:228 all build the unsigned `firebasestorage.googleapis.com/v0/b/<bucket>/o/<path>?alt=media` download URL instead. If the bucket has uniform bucket-level access enabled — the Firebase default for buckets created since October 2021 — makePublic() throws and every create-with-images returns 500.

**Impact.** An untrusted third-party seller gets a permanent, publicly-cached upload primitive on the Kaayko storage bucket with no content check. And depending on bucket configuration, product creation with images may 500 outright rather than merely storing the wrong thing.

**Fix.** In uploadProductImage, sniff the first 12 bytes of file.buffer and allowlist exactly three signatures — FF D8 FF (jpeg), 89 50 4E 47 (png), 'RIFF'....'WEBP' — returning a 400 otherwise; set both contentType and the filename extension from the sniffed type, never from file.mimetype or originalname. Then replace lines 108-111 with the same URL scheme the rest of the repo uses: drop makePublic() and return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filepath)}?alt=media`. Note that image ownership is otherwise sound: the storage prefix is keyed on productID (uid prefix + uuid, line 222) and PUT reuses the owned document's productID, so cross-kreator overwrite is not possible.

> not verified — 3-verifier cap

### P1 — No review gate: a third party's product is live on kaayko.com the instant they submit it

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorProductRoutes.js:257` · surface: dashboard-products

**What is wrong.** POST /kreators/products writes isAvailable:true (line 257) straight into the shared kaaykoproducts collection with no moderation field. api/products/products.js:75 includes any document where `isAvailable !== false && !deletedAt`, so the seller's title, description, tags and images appear on the public storefront alongside Kaayko's own goods with no human ever looking. There is no pending queue, no moderationStatus, and the only admin control is PATCH /admin/products/:id (index.js:136) applied per-product after the fact.

**Impact.** The first thing a newly approved seller can do is publish arbitrary text and imagery under the Kaayko brand to every store visitor. Given a shared-brand catalogue and a program that admits outside sellers by application, this should be gated — the application review currently vets the person and then trusts everything they publish forever.

**Fix.** Write `moderationStatus: 'pending'` in the productData object at kreatorProductRoutes.js:241, and set it back to 'pending' in PUT whenever title, description, tags or images change. Exclude it in two places: add `&& d.moderationStatus !== 'pending'` to the visible filter at api/products/products.js:75 and to the 143 single-product check, and add the same test to isPurchasable in api/checkout/pricing.js. Surface it as an approve action on the existing platform-admin catalogue editor (updateProduct in api/admin/products.js), and show the pending state on the kreator's product card so the seller knows why their item is not on the store.

> not verified — 3-verifier cap

### P1 — Apparel products can be saved with an empty availableSizes, which disables size validation at checkout

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorProductRoutes.js:215` · surface: dashboard-products

**What is wrong.** parseStringArray returns an empty array for an absent or empty availableSizes (line 59), and both POST (line 250) and PUT (lines 405-414) write that empty array to the product document with no floor. pricing.js resolveSize (lines 204-216) treats an empty options list as 'no size options' and accepts any free-form string up to 40 characters, or defaults to 'One Size'. add-product.html makes this one click away: every size box at lines 387-411 is toggleable and a kreator can uncheck all six. CLAUDE.md names this exact case as a money-critical invariant — 'An empty availableSizes array disables size validation entirely... Never allow one to be saved.'

**Impact.** A kreator lists a t-shirt with no sizes; buyers' orders then carry whatever 40-character string the client sends as the size, straight into the order document and the confirmation email, with nothing to reconcile against. Fulfilment gets a garbage size on the packing detail and there is no server-side record of what was actually ordered.

**Fix.** After the category and type are resolved in POST (after line 216) and in PUT (after line 414), add: if the effective category is 'apparel' or the effective productType is 'tshirt'/'cap', and the resolved availableSizes array is empty, return 400 'Apparel products must list at least one available size'. Leave the empty case legal for mugs, prints, magnets and the like, which genuinely have no size axis.

> not verified — 3-verifier cap

### P1 — The category dropdown offers five values the API rejects, and a price ceiling 20x higher than the API's

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/add-product.html:361` · surface: dashboard-products

**What is wrong.** The category select at lines 361-372 offers apparel, accessories, art, digital, souvenirs, coaching, courses, fitness and other. kreatorProductRoutes.js:80 accepts exactly four: apparel, accessories, art, other. Choosing any of the other five returns 400 'category must be one of: apparel, accessories, art, other'. Separately the price input at line 347 sets max="9999.99" while kreatorProductRoutes.js:190 rejects anything above 500.

**Impact.** Five of the nine categories a seller is invited to pick are unusable, and they only learn that after filling the whole form and uploading images. The souvenir and digital categories the program is nominally selling into are precisely the ones that fail.

**Fix.** Cut the select at add-product.html:361-372 down to the four values in the CATEGORIES constant, and set the price input's max to 500 with a hint beside it. If the wider set is actually intended, widen CATEGORIES in both kreatorProductRoutes.js:80 and api/admin/products.js, and add matching entries to resolveTaxCode's category fallback in api/checkout/pricing.js:176-179 — otherwise every new category silently gets the clothing tax code.

> not verified — 3-verifier cap

### P1 — A kreator cannot edit or delete a product — the endpoints exist but no UI reaches them

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/dashboard.html:1528` · surface: dashboard-products

**What is wrong.** renderProductsList (lines 1528-1547) builds each card with `data-id="${p.id}"` and an image, title, price and status badge — and binds no click handler, no edit control and no delete control. There is no edit page: kaayko/src/kreator/ contains only add-product.html, dashboard.html, apply.html, check-status.html, onboarding.html, kreator-login.html, forgot-password.html and index.html. PUT /kreators/products/:id and DELETE /kreators/products/:id (kreatorProductRoutes.js:360 and 453) are therefore reachable only by hand-crafted request.

**Impact.** Once a kreator lists something, they cannot fix a typo, correct a price, change stock, add a photo or take it down. The only self-service path out is deleting their entire account — which, per the finding above, does not remove the products either.

**Fix.** Add Edit and Unpublish buttons to each card in renderProductsList, wired to PUT and DELETE with the same Bearer header loadProducts already uses, and re-run loadProducts on success. Add an edit page — the cheapest version is add-product.html accepting `?id=`, prefilling from GET /kreators/products/:id and switching the submit to PUT. Guard the delete behind a confirm and reflect the resulting isAvailable:false as an 'Unpublished' badge.

> not verified — 3-verifier cap

### P1 — 'View My Store' always lands on an empty storefront — the dashboard derives a slug the API no longer writes

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/dashboard.html:1420` · surface: dashboard-products

**What is wrong.** generateStoreSlug (lines 1420-1427) slugifies the business name and updateViewStoreLink (1429-1436) builds `https://kaayko.com/store?store=<slug>`. The API stamps a different value: kreatorProductRoutes.js:238 writes `${generateStoreSlug(businessName)}-${uid.substring(0,6).toLowerCase()}`, with the uid suffix added to make slugs unique. kaayko/src/js/kaayko-main.js:56 filters with strict equality — `products.filter(p => p.storeSlug === storeSlug)` — so the dashboard's suffix-less slug matches nothing.

**Impact.** The one link a seller uses to check that their storefront looks right always shows an empty store. Their first impression of the platform is that their products did not publish.

**Fix.** Stop deriving the slug on the client. Have the product router (or the approval step in kreatorService) write storeSlug onto the kreators/{uid} document when it first stamps it, return it from GET /kreators/me, and have updateViewStoreLink read `user.storeSlug` — falling back to hiding the card when it is absent because the kreator has not listed anything yet. Delete generateStoreSlug from dashboard.html so the duplication cannot drift again.

> not verified — 3-verifier cap

### P1 — Settings > Shipping Settings silently throws away everything the seller types

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/dashboard.html:1239` · surface: dashboard-products

**What is wrong.** The shipping form (lines 1239-1269) has a Ship From Address input, a Shipping Coverage select, a Fulfilment Time select and a `<button type="submit">Save Shipping Settings</button>`. The id 'shipping-form' appears exactly once in the file — there is no submit listener anywhere in the module script (contrast the profile form at line 1577, which does have one). With no handler and no preventDefault, the button performs a default form submission; the inputs have no name attributes, so the browser navigates to `dashboard?` and the entered values are gone. No API endpoint stores shipping settings either.

**Impact.** A seller enters their warehouse address and fulfilment window, clicks Save, and the page appears to reload with the fields blank. Nothing is persisted and no error is shown — the platform has no idea where anything ships from or how long it takes, which is exactly the information the store's delay notice depends on.

**Fix.** Add a submit handler mirroring the profile one at dashboard.html:1577: preventDefault, collect shipFromAddress / shippingCoverage / fulfillmentTime, and call updateProfile — those three keys are not in the protectedFields list at kreatorRoutes.js:420, so PUT /kreators/me already accepts them. Populate the fields from the same user object in loadUserData's setVal block. If shipping is genuinely not being built yet, remove the card rather than leaving a Save button that lies.

> not verified — 3-verifier cap

### P1 — Dashboard home, Orders, Earnings and Settings promise state that is never computed — including a weekly payout that does not exist

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/dashboard.html:884` · surface: dashboard-products

**What is wrong.** Beyond the known hardcoded zeros in Orders and Earnings, the home view is also inert in ways the data is already available to fix. stat-total-products (line 890) stays 0 even though loadProducts has the count in hand and writes it to the nav badge two lines away. The setup checklist (lines 864-877) hardcodes Profile as complete and Payment / Add Products / Shipping as pending regardless of reality, so a kreator with five live products is still told to add their first. The 'Complete Setup' anchor (line 881) carries data-view="settings" but is not a .nav-item, .quick-action-card[data-view] or .view-all-link[data-view], so none of the three selectors at lines 1443-1445 bind it — clicking it does nothing. Connect Bank (1226), Change (1283) and Enable (1293) have no ids and no handlers. And the Earnings view states 'Ready to withdraw' (1105) and 'Payouts are processed weekly' (1147) with no payout system anywhere in the API.

**Impact.** A seller cannot tell working functionality from decoration. They are told payouts arrive weekly and that money is ready to withdraw, when no code has ever computed either number — a claim about their money that the platform cannot honour.

**Fix.** Set `document.getElementById('stat-total-products').textContent = result.data.length` inside loadProducts alongside the existing products-count line. Drive the setup checklist from the fetched user object plus the product count instead of static classes. Add `.btn[data-view]` to the selector list at line 1445 so Complete Setup navigates. Until the endpoints exist, replace the Earnings copy at 1105/1147 and the Orders tiles with an explicit 'Coming soon — orders and payouts are not live yet' state, and either remove or disable the Connect Bank / Change Password / Enable 2FA buttons.

> not verified — 3-verifier cap

### P1 — The applications list returns the entire Firestore document, including live magic-link codes and submitter IPs

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/services/kreatorApplicationService.js:420` · surface: admin-console

**What is wrong.** listApplications maps each doc as `{ id: doc.id, ...data, ... }` (lines 418-428) — an unfiltered spread of the stored application. That document carries `magicLinkCode` (written on approval, line 632), `ipAddress`, `userAgent`, and `consent.consentIp` (lines 260-271). So GET /kreators/admin/applications hands back the live activation code for every approved-but-not-yet-activated kreator, plus the submitter's IP address. The console displays none of these — it only needs name, email, business, categories, status, date.

**Impact.** Anyone who reaches this endpoint (which, per the previous finding, is any self-provisioned Kortex tenant) can lift a pending kreator's magic-link code and complete that account's onboarding themselves — taking over a seller identity that can list priced products in the shared store. Applicant IP addresses are also disclosed well beyond what review requires.

**Fix.** In listApplications (kreatorApplicationService.js:418-428), replace the `...data` spread with an explicit projection: id, firstName, lastName, displayName, email, phone, businessName, businessType, website, productCategories, productCount, priceRange, productDescription, location, shippingCapability, fulfillmentTime, status, rejectionReason, reviewedBy, and the four timestamp fields. Never include magicLinkCode, ipAddress, userAgent or consent.consentIp. Apply the same projection to getApplication (line 335) which feeds GET /admin/applications/:id.

> not verified — 3-verifier cap

### P1 — The 'Admin Login' on the console is decorative — the passphrase is in the served page and the gate is a localStorage boolean

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/admin/index.html:672` · surface: admin-console

**What is wrong.** The login form compares the typed value against the in-page constant (`if (pass === ADMIN_PASS)`, line 681) and on success writes `localStorage.setItem('kreator_admin_auth','true')` (682); on load, `if (localStorage.getItem('kreator_admin_auth') === 'true') showAdmin()` (672-674). Both the check and the stored proof live entirely in the visitor's browser, and the passphrase itself is published in the page source at https://kaayko.com/kreator/admin, which returns 200 to anyone. `logout()` (697) just deletes that boolean. To be precise about the current pre-auth behaviour, which I checked in the code: before the fake login the page makes zero network calls (loadApplications is reached only via showAdmin), admin-content is display:none, and no applicant data of any kind is embedded — it fails cleanly and leaks only structure (the four stat labels and six table headers) and the passphrase string.

**Impact.** The console shell and its operational shape are public, and 'kaayko2026admin' is published on the live site. Today the server saves it — the real API rejects that key. But the value is a candidate for ADMIN_PASSPHRASE (the comment at line 661 literally says 'Change this!'), and if anyone ever sets it there to make the console work, every requireAdmin route on the platform opens to the internet, including /kreators/admin/* and the Kortex admin surface.

**Fix.** Delete lines 661, 672-687 and 697-700 along with the passphrase form (588-595). Gate the page on Firebase Auth: initialize the Firebase SDK, show the content only after onAuthStateChanged yields a user, send that user's ID token as a Bearer header, and let the server's requirePlatformAdmin be the only authorization decision. If the page must stay public, add it to firebase.json hosting with a noindex header (already present at line 9) — but never re-introduce a client-side secret.

> not verified — 3-verifier cap

### P1 — Reject is unusable: the UI calls the reason optional, the service demands 10+ characters, and the error is swallowed

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/admin/index.html:972` · surface: admin-console

**What is wrong.** rejectApplication() prompts `'Rejection reason (optional):'` (line 972) and posts whatever comes back, including an empty string. The route rejects a falsy reason with 400 REASON_REQUIRED (api/kreators/kreatorRoutes.js:841-848), and the service rejects anything under 10 characters with VALIDATION_ERROR (services/kreatorApplicationService.js:693-696). The frontend only checks `response.ok` and throws a hardcoded 'Failed to reject' (line 985), discarding the server's actual message, so the operator sees `Error rejecting application: Failed to reject` with no clue what went wrong. Note also that this text is not internal — rejectionReason is returned to the applicant by the public status endpoint (kreatorApplicationService.js:367).

**Impact.** The owner clicks Reject, presses Enter or types 'spam', and gets an opaque failure. Repeated tries fail the same way. Rejection is effectively broken, and there is no hint that the text he types will be shown verbatim to the applicant.

**Fix.** In index.html rejectApplication(), change the prompt to 'Reason shown to the applicant (min 10 characters):', validate `reason.trim().length >= 10` client-side before the fetch, and on failure parse the JSON body and surface `body.message` instead of the hardcoded string. Do the same in approveApplication (line 962). Add a separate optional `notes` field for internal text, since the route already accepts `notes` (kreatorRoutes.js:839) and the service stores it in reviewNotes without showing it to the applicant.

> not verified — 3-verifier cap

### P1 — Stats and filters are computed client-side over the first 50 rows; the real /admin/stats endpoint is never called

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/admin/index.html:705` · surface: admin-console

**What is wrong.** loadApplications() fetches /kreators/admin/applications with no query string (line 705), so the server defaults to `limit: 50, offset: 0` (kreatorRoutes.js:726-727). The four dashboard tiles are then computed by filtering that array (lines 743-752), and the All/Pending/Approved/Rejected chips filter the same array in memory (757). The response carries `total` and `hasMore` (kreatorApplicationService.js:432-437) and the page ignores both — there is no pagination control anywhere. Meanwhile GET /kreators/admin/stats (kreatorRoutes.js:934) exists, runs real Firestore count() aggregations, and has no caller in the repo.

**Impact.** Past 50 applications the console silently lies: 'Total Applications' stops at 50, 'Pending Review' under-counts, and — since the default ordering is submittedAt desc — older pending applications drop off the end and become unreachable, so they can never be approved or rejected. The owner has no indication anything is missing.

**Fix.** In loadApplications(), call GET /kreators/admin/stats and bind its `applications.pending/approved/rejected/total` to the four tiles instead of counting the array (replace updateStats at 743-752). Make the filter chips server-side: pass `?status=<filter>&limit=50&offset=<n>` on the fetch and re-fetch on chip click rather than filtering in memory, and render Prev/Next controls driven by the response's `hasMore` and `total`.

> not verified — 3-verifier cap

### P1 — Password reset is a facade: the frontend calls two endpoints that do not exist and shows "Check Your Email" from the catch block

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/forgot-password.html:261` · surface: email-notifications

**What is wrong.** forgot-password.html imports requestPasswordReset (line 239) and calls it at line 261. That function POSTs to /kreators/auth/forgot-password (kreator-api.js:362); resetPassword POSTs to /kreators/auth/reset-password (kreator-api.js:376). Neither route exists — kreatorRoutes.js defines /auth/google/signin, /auth/google/connect and /auth/google/disconnect and nothing else under /auth. The page's try block and its catch block both do the identical thing (lines 264-268): hide the form and reveal the "Check Your Email … we've sent password reset instructions" panel. The comment on line 267 justifies it as "don't reveal if email exists", which conveniently hides a 404. kreatorService.js:54 defines MAGIC_LINK_EXPIRY_HOURS.password_reset = 1 but no code path ever passes 'password_reset' to generateMagicLinkToken.

**Impact.** A kreator who forgets their password is permanently locked out with no recovery path — there is no self-serve reset, and resendMagicLink (kreatorService.js:743) refuses anyone whose status is not pending_password, so an active kreator cannot be rescued by an admin either. The page tells them mail is on the way, so they wait, then check spam, then give up.

**Fix.** Add POST /kreators/auth/forgot-password to kreatorRoutes.js (rate-limited via kreatorRateLimit('reset', 5, 3600000)): look up kreators by email, and when one exists in status active or pending_password call generateMagicLinkToken('password_reset'), write the short_links doc with metadata.purpose 'kreator_password_reset', and queueMailOnce the link through api/email/render.js. Add POST /kreators/auth/reset-password that consumes it via the same transactional single-use path as consumeMagicLinkAndSetPassword (kreatorService.js:403) — including stamping metadata.usedAt. Always return 200 regardless of whether the email exists, so the enumeration-safe copy on the page becomes true rather than accidental. Until the routes exist, the page should not claim mail was sent.

> not verified — 3-verifier cap

### P1 — An applicant is never emailed anything — not a receipt, not an approval, not a rejection — while two surfaces promise they will be

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/services/kreatorApplicationService.js:292` · surface: email-notifications

**What is wrong.** No branch of the application lifecycle mails the applicant. submitApplication returns a message string ending "We will review it within 2-3 business days and contact you at <email>" (line 292) but queues nothing. rejectApplication (line 692) updates status and rejectionReason inside a transaction and writes an audit log — no mail. Approval nominally mails, but per the P0 above it cannot be delivered. The frontend commits to more: apply.html:956 "We'll email you with next steps once approved" and apply.html:1026 "Email Confirmation — You'll receive your application status via email". The only pull channel is /kreator/check-status, and getApplicationStatus (line 348) requires the application ID as a path parameter plus a matching email — and that ID is rendered on screen exactly once (apply.html:1274) and never emailed, so closing the tab loses it forever.

**Impact.** An applicant submits, is told to expect email, and receives nothing at any stage. A rejected applicant is never told they were rejected and can never read the rejection reason the admin was forced to write. Kaayko looks like it ghosts every seller who applies.

**Fix.** Three queueMailOnce calls through api/email/render.js, each with a deterministic id so a retry cannot double-send: (1) in submitApplication after the .set — id `kreator_app_ack_${applicationId}`, body containing the application ID and the /kreator/check-status link; (2) in rejectApplication after the transaction resolves — id `kreator_app_reject_${applicationId}`, body carrying reason.trim() (never `notes`, which is internal); (3) the approval mail from finding 1. Add the three templates under api/email/templates/. Because the ack email carries the application ID, the pull channel finally works too.

> not verified — 3-verifier cap

### P1 — A kreator is never notified when their product is bought — the buyer pays and nothing reaches the seller

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/checkout/stripeWebhook.js:1148` · surface: email-notifications

**What is wrong.** sendOrderConfirmationEmails queues exactly two messages: the buyer's confirmation (line 1171, keyed `${paymentIntent.id}_customer`) and the platform owner's new-order alert (line 1197, keyed `${paymentIntent.id}_admin`, addressed via resolveNotifyEmail). Neither the webhook nor anything else under api/checkout or api/admin reads `sellerEmail`, `kreatorId` or `storeSlug`, all of which the kreator router stamps onto the product document (kreatorProductRoutes.js:279-283). Kreator products are fully purchasable: they are written to the shared kaaykoproducts collection with isAvailable:true (line 277) and pricing.js re-prices them from that same document, so checkout succeeds and money is captured. This is a distinct defect from the known hardcoded-zeros Orders view: even if the dashboard worked, there is no push channel at all.

**Impact.** A customer pays for a third-party seller's item. The seller — who holds the physical stock and is the only party who can fulfil — is never told an order exists, by email or in-app. The item is never shipped, the buyer chases Kaayko, and the store's own delay-notice copy promises "cancel for a full refund" against a refund path that does not exist.

**Fix.** In sendOrderConfirmationEmails, group the ctx items by the product document's kreatorId, and for each distinct kreator queue `queueMailOnce(db, `${paymentIntent.id}_seller_${kreatorId}`, { to: sellerEmail, message: {...} })` using a new api/email/templates/sellerOrderNotification.html that lists only that kreator's line items plus the ship-to block — never the other sellers' items and never the payment intent's full total. The deterministic id keeps webhook redelivery safe. Validate sellerEmail with validEmail() from api/email/notifyAddress.js and, when it fails, queue an owner alert instead so the order is not silently unfulfillable.

> not verified — 3-verifier cap

### P1 — A kreator can publish into the shared kaaykoproducts catalogue with no notification to the owner and no review step

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorProductRoutes.js:288` · surface: email-notifications

**What is wrong.** POST /kreators/products writes straight to the shared kaaykoproducts collection (line 288) with isAvailable: true (line 277) and a caller-supplied actualPrice (line 244, bounded only to $0.99–$500). The product is live on kaayko.com and chargeable immediately — pricing.js re-derives the charge from precisely this document. Nothing queues an owner alert, nothing writes an admin_audit_logs entry (contrast approveApplication, which writes one at kreatorApplicationService.js:636), and there is no pending/review status in the schema. The only trace is a console.log.

**Impact.** A third party can put arbitrary titles, descriptions, images and prices onto Kaayko's own storefront, sold under Kaayko's Stripe account, and the owner has no signal at all — no email, no queue, no audit row. Discovery requires browsing the store. A bad or mispriced listing is live and billable until someone happens to notice.

**Fix.** After the docRef.add at line 288, write an admin_audit_logs entry (action 'kreator.product.created', actorUid req.kreator.uid, resourceId docRef.id) and queue an owner alert with queueMailOnce keyed `kreator_product_${docRef.id}` to resolveNotifyEmail(), listing title, actualPrice, storeName and a link to the product. If moderation is wanted rather than after-the-fact notification, the smaller change is to default isAvailable to false on the kreator write path and expose an approve toggle in the admin product router (api/admin/products.js) — kreator products are currently the only unreviewed write path into the money-critical catalogue.

> not verified — 3-verifier cap

### P1 — Applications and kreator products carry unbounded, unsanitised free text that two pages inject as HTML

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/services/kreatorApplicationService.js:85` · surface: data-model

**What is wrong.** validateApplication checks firstName, lastName, businessName and location only for presence and a minimum length (kreatorApplicationService.js:64-92) — no maximum length, no character restriction. businessName needs only 2 characters. Those values are stored verbatim (lines 205-215) by an unauthenticated POST /kreators/apply, and reach two HTML sinks. (1) The admin console interpolates app.firstName, app.lastName, app.email and app.businessName into a template literal at kreator/admin/index.html:787-794 and assigns it with innerHTML at line 827 (and again in the detail modal at 858/881). (2) On approval, businessName becomes kreators.businessName, which becomes kaaykoproducts.storeName at kreatorProductRoutes.js:265, which the public products API returns (products.js:96), which kaayko-main.js:68-74 injects with `storeBanner.innerHTML = ...${storeName}...` on the ?store= storefront. kaayko_ui.js:394 uses textContent and is safe; kaayko-main.js is not. The tags fix from 5 Sep covered kaayko_ui.js, not this banner.

**Impact.** An approved kreator whose business name contains markup gets script execution on kaayko.com/store — the same origin as the cart and checkout — for every shopper who opens their storefront. Before approval, the same unfiltered string is waiting in kreator_applications for whoever fixes the admin console's auth; the first admin to load the applications list executes it in the admin origin. Both sinks are currently gated behind the broken approval console, so this is latent rather than live, and it goes live the moment that console works.

**Fix.** Two independent fixes, both needed. (a) In kaayko-main.js, build the banner with createElement and textContent for the store name (mirror the pattern already used at kaayko_ui.js:390-396) instead of the innerHTML at line 68. (b) In kreator/admin/index.html add `const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))` and wrap every interpolated application field at lines 787-794 and 875-885. (c) In validateApplication, add max-length checks — firstName/lastName 80, businessName 120, location 200, otherPlatforms/additionalInfo 1000 — and reject `<` or `>` in businessName, matching the rule parseStringArray already applies to tags at kreatorProductRoutes.js:71.

> not verified — 3-verifier cap

### P1 — There is no way to suspend or offboard a kreator, and deleting the account leaves every product on sale

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorRoutes.js:449` · surface: data-model

**What is wrong.** The full route list in kreatorRoutes.js (lines 72-999) contains no suspend, deactivate or reinstate endpoint, and no admin product-takedown for a kreator. KREATOR_STATUS.SUSPENDED exists (kreatorService.js:40) and requireActiveKreator rejects it (kreatorAuthMiddleware.js:126), but nothing can ever set it except a manual Firestore edit. Even then it only stops writes: the public catalogue filter at products.js:72-75 tests `d.isAvailable !== false && !d.deletedAt` and never looks at the owning kreator, so a suspended seller's products stay purchasable. DELETE /kreators/me (line 449-470) is worse — it sets status 'deleted', nulls firstName/lastName/phone and rewrites email to `deleted_<ts>_<email>`, but touches no product document. Every one of that kreator's products stays live, still carrying storeName, storeSlug and sellerEmail set to the original address at kreatorProductRoutes.js:266.

**Impact.** Kaayko cannot take a bad seller off the store without hand-editing Firestore product by product. A kreator who deletes their account is still selling on kaayko.com the next day, and the store keeps taking orders nobody will fulfil. The account-deletion anonymisation is also defeated: the deleted person's real email address remains on every product document (not publicly exposed — Firestore rules deny reads at firestore.rules:50 and products.js does not return sellerEmail — but the erasure did not happen).

**Fix.** In the DELETE /kreators/me handler, before returning, run a batched update over `kaaykoproducts where kreatorId == uid` setting isAvailable:false, deletedAt: serverTimestamp(), deletedBy:'kreator-account-deletion' and clearing sellerEmail. Add `PUT /kreators/admin/:uid/status` guarded by requireAuth+requirePlatformAdmin that sets status to suspended/active and applies the same batch to hide or restore products. And make products.js:72 the belt-and-braces backstop by denormalising a `kreatorActive` boolean onto product documents, flipped by that same status route.

> not verified — 3-verifier cap

### P1 — planLimits and permissions are written onto every kreator and enforced nowhere

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/services/kreatorApplicationService.js:538` · surface: data-model

**What is wrong.** Approval writes permissions: ['products:create','products:read','products:update','orders:read','analytics:read'] (kreatorApplicationService.js:538-545) and planLimits: { productsAllowed: 50, monthlyOrders: 100 } (lines 549-552). requireKreatorPermission exists and works (kreatorAuthMiddleware.js:165-190) but a repo-wide grep shows it is referenced only by its own definition and its export at line 308 — zero routes use it. Every kreator route uses requireKreatorAuth + requireActiveKreator only. Nothing anywhere reads planLimits: POST /kreators/products (kreatorProductRoutes.js:174) never counts the kreator's existing products before writing. The only planLimits module in the codebase, api/billing/planLimits.js, is a Kortex concept and is not imported by any kreator file.

**Impact.** The product cap the platform believes it granted does not exist. One kreator can push unlimited documents into the shared kaaykoproducts collection, which is also what makes the storefront's whole-collection fetch fail. Removing a permission from a kreator's array has no effect — they keep full product CRUD. The plan tier is decorative.

**Fix.** In POST /kreators/products, before the add() at kreatorProductRoutes.js:277, run `db.collection('kaaykoproducts').where('kreatorId','==',req.kreator.uid).where('deletedAt','==',null).count().get()` and return 403 PLAN_LIMIT_REACHED when it is at or above `req.kreator.planLimits?.productsAllowed ?? 50`. Add `requireKreatorPermission('products:create')` to the POST route, `'products:update'` to the PUT, and delete the permissions array from the kreator document if you do not intend to honour it — a field that lies is worse than no field.

> not verified — 3-verifier cap

### P1 — The storefront downloads the entire catalogue and filters ?store= in the browser

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/products/products.js:69` · surface: data-model

**What is wrong.** GET /products does `db.collection('kaaykoproducts').get()` with no limit, no cursor and no filter (products.js:69). There is no server-side store parameter anywhere in the router. kaayko-main.js:56 then does `products.filter(p => p.storeSlug === storeSlug)` on the full payload after it has been downloaded. Inside the same handler, every visible product whose imgSrc is empty or holds a legacy signed URL triggers a live Storage listing (products.js:110-115 calling fetchImagesFromStorage), and all of those run inside one Promise.all at line 76 with no concurrency cap. Kreator-written products avoid that branch because uploadProductImage writes unsigned storage.googleapis.com URLs (kreatorProductRoutes.js:105), but the existing uploader-written products do not.

**Impact.** At 10 kreators and 500 products, every visit to /store — including a visit to one kreator's storefront — downloads all 500 product records with titles, descriptions, tags and image URL arrays. Each kreator's storefront ships every competitor's full catalogue to the shopper's browser, which is a commercial disclosure as much as a performance one. The Storage-listing fan-out on legacy products turns one page load into hundreds of concurrent bucket LIST calls, which is both slow and billable.

**Fix.** Add `?store=<slug>` handling to products.js:69: when present, query `.where('storeSlug','==',slug)` instead of the bare .get(). Add `limit` (default 60) and a `startAfter` cursor keyed on createdAt for the unfiltered listing, and declare the matching composite index in firestore.indexes.json. Change kaayko-main.js:54-56 to request `/api/products?store=${slug}` rather than filtering client-side. Cap the fetchImagesFromStorage fan-out by processing the visible list in chunks of 10 rather than one Promise.all over the whole collection.

> not verified — 3-verifier cap

### P1 — kreator businessName reaches the public storefront banner through innerHTML unescaped

`/Users/Rohan/Kaayko_v6/kaayko/src/js/kaayko-main.js:68` · surface: no-leak

**What is wrong.** The ?store= storefront reads storeName off the first matching product and interpolates it into innerHTML (kaayko-main.js:60, 68-74). storeName is written server-side from `req.kreator.businessName || req.kreator.displayName` (kreatorProductRoutes.js:264), which is copied from the application's businessName (kreatorApplicationService.js:506) with no sanitisation — validateApplication only checks it is a string of length >= 2 (kreatorApplicationService.js:86). The tag/size/colour arrays on the same product go through parseStringArray, which rejects `<` and `>` (kreatorProductRoutes.js:74), but storeName bypasses that entirely. The other storeName render site, kaayko_ui.js:394, correctly uses textContent — this banner is the one that does not.

**Impact.** An approved kreator whose business name contains markup gets script execution on kaayko.com/store?store=<their-slug> for every visitor, on the same origin as the cart and checkout pages. The kreator never touches the product form to do it — the name they typed on the application is enough.

**Fix.** Two places. In /Users/Rohan/Kaayko_v6/kaayko/src/js/kaayko-main.js build the banner with createElement and set `nameEl.textContent = storeName` instead of the template literal at line 68 (the product-count and link nodes can stay static). And in /Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorProductRoutes.js, before writing storeName at line 264, reject or strip `<`/`>` the same way parseStringArray does and cap it at 60 characters.

> not verified — 3-verifier cap

### P1 — Public POST /kreators/apply accepts unbounded, unsanitised free-text that the admin console renders with innerHTML

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/services/kreatorApplicationService.js:61` · surface: no-leak

**What is wrong.** validateApplication (lines 61-158) applies no maximum length and no character filtering to firstName, lastName, businessName, location, otherPlatforms or additionalInfo — only productDescription has a 2000-char cap (line 116). Everything is trimmed and written straight to kreator_applications (lines 208-235) from an unauthenticated endpoint rate-limited to 5/hour/IP (kreatorRoutes.js:144). The review console then interpolates app.firstName, app.lastName, app.email and app.businessName into innerHTML with no escaping (/Users/Rohan/Kaayko_v6/kaayko/src/kreator/admin/index.html:788-794, 827, and again in the detail modal at 858).

**Impact.** An anonymous applicant can store script in the reviewer's console: whoever eventually fixes the admin page's auth inherits an XSS that runs with a platform-admin session. The same endpoint can also write near-1MB documents into kreator_applications at 5/hour/IP with no size ceiling.

**Fix.** In validateApplication add explicit caps and a markup check: firstName/lastName <= 60, businessName <= 100, location <= 120, otherPlatforms/additionalInfo <= 500, and reject any of them containing `<` or `>` — mirroring the parseStringArray rule already used in kreatorProductRoutes.js:74. Independently, in /Users/Rohan/Kaayko_v6/kaayko/src/kreator/admin/index.html escape every interpolated application field (a local `esc(s)` helper that maps & < > " ') at lines 788-794 and 858.

> not verified — 3-verifier cap


## P2 Findings — unverified (21)

Reported by a surface auditor with a file:line citation, but **not** put through adversarial verification (3-verifier cap). Treat as high-quality leads, not confirmed defects — the store audit refuted 18 of 38 similar candidates.

### P2 — Application IDs come from Math.random and are written with set(), so they are predictable and can silently overwrite

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/services/kreatorApplicationService.js:35` · surface: application-pipeline

**What is wrong.** `generateApplicationId` (35-42) builds `app_` plus 10 characters drawn from `Math.random()`. V8's Math.random is a non-cryptographic xorshift128+ whose internal state is recoverable from a modest number of observed outputs, and an applicant legitimately receives one full ID (about 59 bits of that stream) from their own submission. The document is then persisted with `.doc(applicationId).set(application)` at line 279 — `set` overwrites, and there is no existence check first.

**Impact.** An attacker who submits one application can predict IDs issued to other applicants by the same warm instance; combined with a known target email (a competitor, say) that reads their status and rejection reason via the public GET /kreators/applications/:id/status. The same predictability plus `set()` lets them deliberately submit against a predicted ID and destroy a pending competitor's application with no trace.

**Fix.** Replace the loop in `generateApplicationId` with `'app_' + crypto.randomBytes(9).toString('base64url')` — `crypto` is already required at line 15. Change line 279 from `.set(application)` to `.create(application)` so an ID collision throws ALREADY_EXISTS instead of clobbering, and retry once on that error.

> not verified — 3-verifier cap

### P2 — check-status renders "undefined" as the Application ID, and an expired application shows "Status Unknown"

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/check-status.html:405` · surface: application-pipeline

**What is wrong.** `getApplicationStatus` returns `{ id, status, submittedAt, reviewedAt, rejectionReason }` (kreatorApplicationService.js:362-368) — there is no `applicationId` key. check-status.html:405 does `document.getElementById('detail-id').textContent = data.applicationId`, which renders the string "undefined". Separately, `displayStatus`'s switch (363-403) handles only pending/approved/rejected; `expired` — a real value of APPLICATION_STATUS (line 25) — falls to the default branch showing "Status Unknown / Unable to determine application status."

**Impact.** The applicant confirms their ID on the one page built to reassure them and sees the word "undefined" where their reference number should be. An applicant whose application has expired is told the system cannot determine their status rather than that they should re-apply.

**Fix.** Change check-status.html:405 to `data.id`. Add a `case 'expired':` branch to the switch at 363 with an explicit message and an "Apply Again" button matching the `rejected` branch at 390-394.

> not verified — 3-verifier cap

### P2 — Required application fields are collected and then never shown to the reviewer

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/admin/index.html:858` · surface: application-pipeline

**What is wrong.** apply.html:1246-1253 collects and posts `inventoryManagement`, `yearsInBusiness`, `otherPlatforms`, `hearAboutUs` and `additionalInfo`, and the server requires `inventoryManagement` (kreatorApplicationService.js:141-143) and stores all five (229-235). The admin detail modal (admin/index.html:858-920) renders name, email, phone, business name/type, website, categories, product count, price range, description, location, shipping and fulfilment — grepping the admin page for those five field names returns zero matches. There is also no rejection-notes or review-notes input in the modal footer (931-940); `rejectApplication` requires a >=10-char reason (693) which the page supplies from a `prompt()` at line 976 onward.

**Impact.** The reviewer decides on incomplete information: how the seller manages inventory, how long they have traded, and whatever they wrote in the free-text "anything else" box are invisible in the only review UI. Applicants fill in a required field that no human ever reads.

**Fix.** Add detail rows for `inventoryManagement`, `yearsInBusiness`, `otherPlatforms`, `hearAboutUs` and `additionalInfo` to the modal template at admin/index.html:858-920, escaped with the `esc()` helper from the XSS fix. Either render them or drop them from the form — do not keep asking for data nobody sees.

> not verified — 3-verifier cap

### P2 — No maximum length on businessName, location, additionalInfo or otherPlatforms

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/services/kreatorApplicationService.js:86` · surface: application-pipeline

**What is wrong.** `validateApplication` caps only `productDescription` (50-2000 chars, lines 114-118) and `phone` (regex bounded to 20, line 81). `businessName` is checked for a minimum of 2 characters and no maximum (86-88); `location` for a minimum of 3 and no maximum (129-131); `additionalInfo` and `otherPlatforms` have no checks at all — they are trimmed and stored (231, 235). `express.json()` is mounted with default options (functions/index.js:63), so the ceiling is the 100 KB body limit. On approval, `businessName` flows into `kreators.brandName` and `kreators.businessName` (kreatorApplicationService.js:505-506), and from there onto every product the kreator lists as `storeName`, which the public products API now returns and the storefront renders.

**Impact.** An applicant can push a ~90 KB business name through the form; if approved it becomes the store name stamped on shared-catalogue products and rendered in the public storefront header and product cards, wrecking the layout for all shoppers on that page.

**Fix.** In `validateApplication`, add upper bounds alongside the existing minimum checks: `businessName` <= 80, `location` <= 120, `firstName`/`lastName` <= 60, `otherPlatforms` <= 500, `additionalInfo` <= 2000. Reject rather than truncate, so the applicant sees the error in the form's existing error alert.

> not verified — 3-verifier cap

### P2 — POST /kreators/auth/google/connect writes an unverified client-supplied Google identity, and the client sends the wrong body anyway

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorRoutes.js:616` · surface: auth-session

**What is wrong.** The handler reads `{ googleUid, googleProfile }` straight from req.body (line 616) and passes both to connectGoogleAccount, which persists googleProfile.email, displayName and photoURL into the kreator doc and adds 'google' to authProviders (kreatorService.js:598-610). No Google or Firebase ID token is verified anywhere on this path — the route trusts whatever JSON an authenticated kreator posts. Meanwhile the only caller, kreator-api.js connectGoogle (line 317), sends `{ googleIdToken }`, which matches neither field name, so the guard at kreatorRoutes.js:618 returns 400 MISSING_GOOGLE_INFO on every legitimate use.

**Impact.** Today the feature is simply dead — the connect button can never succeed because of the body-shape mismatch. If someone fixes the client to send the field names the server wants, the server will accept an arbitrary googleUid and an arbitrary email as a proven Google identity and mark the account google-linked, corrupting the identity record and the audit-log entry written at kreatorService.js:613-627.

**Fix.** Change the route to take `{ idToken }`, verify it with admin.auth().verifyIdToken, require decoded.firebase.sign_in_provider === 'google.com' and decoded.email_verified === true, and derive googleUid and the profile from the decoded token rather than the body. Then update kreator-api.js:317-325 to send { idToken } obtained from a Firebase Google popup. If Google linking is not actually wanted, delete the route and connectGoogleAccount instead of leaving an unverified write path mounted.

> not verified — 3-verifier cap

### P2 — optionalKreatorAuth verifies a Firebase ID token, not a kreator session token, and skips the status check

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/middleware/kreatorAuthMiddleware.js:211` · surface: auth-session

**What is wrong.** optionalKreatorAuth calls admin.auth().verifyIdToken on the bearer value (line 211) — a completely different credential from the HMAC session token that requireKreatorAuth verifies through kreatorService.verifySessionToken (line 39). The two middlewares in the same file accept mutually incompatible tokens. optionalKreatorAuth also attaches req.kreator for any kreators/{uid} doc that is not soft-deleted (lines 222-226) with no status check, so a suspended or deactivated kreator is attached as a live kreator. Its only current use is GET /kreators/debug (kreatorRoutes.js:106), which is emulator-gated at line 109, so nothing is exposed today.

**Impact.** A latent trap. The next route that reaches for the obvious-sounding optionalKreatorAuth gets a middleware that ignores kreator sessions entirely, accepts a raw Firebase ID token from any user in the project — including the self-provisioned Kortex tenant accounts — and treats suspended kreators as active. Given how much of this surface is already broken by contract drift, that is a realistic next mistake.

**Fix.** Rewrite optionalKreatorAuth to use kreatorService.verifySessionToken exactly as requireKreatorAuth does, returning next() with req.kreator = null on any failure, and to set req.kreator only when kreatorData.status === 'active' and deletedAt is falsy. If nothing but the emulator debug route needs it, delete it from the exports at line 309 instead.

> not verified — 3-verifier cap

### P2 — DELETE /kreators/me has no status gate — a suspended kreator can self-delete and anonymize their own record

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorRoutes.js:449` · surface: auth-session

**What is wrong.** DELETE /kreators/me is mounted with requireKreatorAuth alone (line 449); requireActiveKreator is absent, unlike PUT /me (line 415) and the product write routes. The handler sets status 'deleted', stamps deletedAt, and overwrites email with `deleted_${Date.now()}_${email}` while nulling firstName, lastName and phone (lines 455-463). Session tokens live seven days (kreatorService.js:195) and cannot be revoked, so a kreator suspended today still holds a working token.

**Impact.** An admin suspends a kreator — for fraud, for mispriced listings, for anything — and the suspended kreator, still holding a valid week-long token, can immediately call DELETE /kreators/me and mangle the email and name on their own record. getKreatorByEmail and the admin list stop finding them under their real identity, which frustrates exactly the investigation that motivated the suspension. It also skips the admin_audit_logs entry that every other lifecycle change writes.

**Fix.** Add requireActiveKreator to the route at kreatorRoutes.js:449 so suspended and deactivated accounts cannot self-delete, and have the handler write an admin_audit_logs entry (action 'kreator.self_deleted', before/after status) inside a transaction like consumeMagicLinkAndSetPassword does at kreatorService.js:498-513. Preserve the original email in a non-indexed field such as `deletedEmailOriginal` so suspension investigations survive.

> not verified — 3-verifier cap

### P2 — requireKreatorAuth spreads the Firestore document over the uid it just set, so a `uid` field in the doc wins

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/middleware/kreatorAuthMiddleware.js:82` · surface: auth-session

**What is wrong.** req.kreator is built as `{ uid: kreatorDoc.id, ...kreatorData, createdAt: ..., updatedAt: ... }` (lines 82-87). Because the spread comes after the explicit uid, any `uid` field stored in the document overrides the document id — and kreator docs do carry one: kreatorApplicationService.js:500 writes `uid: userRecord.uid` into the doc body. The same pattern appears in optionalKreatorAuth (line 223-226) and in getKreator (kreatorService.js:258-268). Today the two values are always equal at creation, and updateKreatorProfile's allowlist plus the protectedFields delete at kreatorRoutes.js:420-423 keep the field from being rewritten, so nothing is exploitable right now.

**Impact.** req.kreator.uid is the ownership key every downstream handler uses — the kreatorId stamped on kaaykoproducts documents, the id in the /products ownership checks. It is currently derived from mutable document data rather than from the authenticated document path, and it stays correct only because two separate write filters happen to hold. Any future admin edit path or migration script that touches the `uid` field silently re-points a kreator's authority.

**Fix.** Put the authoritative value last in kreatorAuthMiddleware.js:82: `req.kreator = { ...kreatorData, uid: kreatorDoc.id, createdAt: ..., updatedAt: ... }`, and make the same reordering in optionalKreatorAuth (line 223) and kreatorService.getKreator (line 258). Then drop the redundant `uid` field from the document written at kreatorApplicationService.js:500 — the document id already is the uid.

> not verified — 3-verifier cap

### P2 — Kreator products are written with productType 'other', a value the same route rejects on input, and are then taxed as clothing

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorProductRoutes.js:254` · surface: dashboard-products

**What is wrong.** Line 254 defaults productType to `requestedType || (normalisedCategory === 'apparel' ? 'tshirt' : 'other')`. 'other' is not in the PRODUCT_TYPES allowlist at line 81 — the route would reject it if a client sent it, but writes it itself by default. add-product.html never sends productType at all, so every non-apparel kreator product gets it. pricing.js resolveTaxCode (lines 170-181) then finds no TAX_CODE_BY_TYPE entry for 'other' and, for a product whose category is also 'other', no category match either, so it returns null and api/checkout/tax.js:65 applies DEFAULT_TAX_CODE txcd_30011000 — 'Clothing & Footwear'.

**Impact.** A kreator's mug, sticker or magnet filed under Other is taxed as apparel, which is wrong in the states that exempt clothing but not general goods (PA, MN, NJ, MA). This is precisely the bug the TAX_CODE_BY_TYPE table was written to fix, reintroduced through the kreator write path.

**Fix.** Add a required product-type select to add-product.html backed by the eight PRODUCT_TYPES values, and change kreatorProductRoutes.js:254 to require a valid type rather than defaulting outside the enum. As a backstop for documents already written, add `if (category === 'other') return 'txcd_99999999';` to the category fallback in pricing.js resolveTaxCode around line 178.

> not verified — 3-verifier cap

### P2 — Repeat soft-delete decrements the product counter again; hiding via PUT never adjusts it

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorProductRoutes.js:485` · surface: dashboard-products

**What is wrong.** DELETE /kreators/products/:id decrements stats.totalProducts (lines 485-487) but has no guard against being called on a product that already carries deletedAt — the existence check at 458 and the ownership check at 469 both still pass, deletedAt is simply overwritten, and the counter drops again. Meanwhile PUT setting isAvailable false or true (line 415) never touches the counter at all.

**Impact.** stats.totalProducts drifts from reality and can go negative, which is the number any future seller-facing or admin dashboard would trust.

**Fix.** In the DELETE handler, after the ownership check at line 475, add `if (product.deletedAt) return res.status(409).json({ success:false, error:'Conflict', message:'Product is already deleted' });` before the update and the decrement. Better still, drop the counter entirely and derive it from the existing kreatorId query in GET /kreators/products, which is already run on every dashboard load.

> not verified — 3-verifier cap

### P2 — Dashboard renders kreator-controlled title into innerHTML, and the API caps neither title nor description length

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/dashboard.html:1536` · surface: dashboard-products

**What is wrong.** renderProductsList interpolates the product title straight into an HTML string at lines 1536-1538 — `alt="${p.title}"` and `<h4>${p.title}</h4>` — with no escaping, along with `src="${p.imgSrc?.[0]}"`. On the backend, title and description get only `.trim()` (kreatorProductRoutes.js:242-243 and 387-388): no length cap and no < > rejection, unlike tags/sizes/colours which go through parseStringArray. The public storefront is safe — kaayko_ui.js:379-394 uses textContent for title and storeName — so the exposure is confined to the kreator's own dashboard, but a title containing a double quote breaks the card markup and a title containing a tag executes in the seller's session.

**Impact.** Mostly self-inflicted, but an unbounded title or description goes into the shared public catalogue and is snapshotted into order records and confirmation emails at purchase time, where no length limit is enforced anywhere downstream.

**Fix.** Rebuild the card with createElement and textContent for title, price and status (keep only the img src as an attribute, set via setAttribute after validating it starts with https://). In kreatorProductRoutes.js, add length checks alongside the existing price check in POST and inside the `if (title)` / `if (description)` branches in PUT: reject a title over 120 characters or a description over 2000 with a 400.

> not verified — 3-verifier cap

### P2 — Approve claims 'Onboarding email sent' regardless of whether the email actually went out

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/admin/index.html:964` · surface: admin-console

**What is wrong.** On a 200 the console alerts 'Application approved! Onboarding email sent.' (line 964). The send is deliberately fire-and-forget outside the transaction: sendMagicLinkEmail(...).catch(err => console.error(...)) (services/kreatorApplicationService.js:672-681), so the route returns success even when delivery fails. The approve response does carry `magicLinkUrl` and `expiresAt` (lines 659-664), and the console throws both away. There is also no UI for POST /kreators/admin/:uid/resend-link (kreatorRoutes.js:999), which is the only recovery path.

**Impact.** When SMTP fails, the owner is told the kreator was emailed. The kreator never receives the link, the account sits in `pending_password` forever, and the owner has no way from this console to see the failure or resend — he would have to call the API by hand.

**Fix.** Change the alert to show the returned magic link: on success, render `data.data.magicLinkUrl` and its expiry in a copyable modal with the wording 'Approved. Activation email queued — if it does not arrive, send this link:'. Add a Resend Link button on approved rows that POSTs to /kreators/admin/${app.kreatorId}/resend-link.

> not verified — 3-verifier cap

### P2 — Expired applications still render as pending with a live Approve button that always 410s

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/services/kreatorApplicationService.js:386` · surface: admin-console

**What is wrong.** getApplication runs a lazy expiry transition — if a pending application is past expiresAt it writes status 'expired' before returning (lines 319-328). listApplications does no such thing (376-437), so a pending application older than APPLICATION_EXPIRY_DAYS (30, line 29) is still returned with status 'pending'. The console therefore renders the pending badge and both Approve and Reject buttons (index.html:815-818), but approveApplication re-checks expiry inside the transaction and throws EXPIRED → 410 (service lines 477-484, mapped at kreatorRoutes.js:810). The console has no 'expired' filter chip (index.html:621-624) and no `.status-badge.expired` CSS rule (382-395), so genuinely expired rows also render as an unstyled badge.

**Impact.** The owner clicks Approve on an application that looks actionable and gets 'Error approving application: Failed to approve' with no explanation. Expired rows are also indistinguishable from active ones in the list.

**Fix.** In listApplications, after mapping each doc, derive a display status: if `status === 'pending' && expiresAt < now`, report 'expired'. Add an 'Expired' filter chip and a `.status-badge.expired` rule (grey) in index.html, and suppress the Approve/Reject buttons for that status at line 815.

> not verified — 3-verifier cap

### P2 — An audit trail exists but every X-Admin-Key action is attributed to one shared pseudo-identity, and it stores live magic-link codes

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/services/kreatorApplicationService.js:636` · surface: admin-console

**What is wrong.** To answer the question directly: yes, there is an audit trail. Approve writes an admin_audit_logs doc with action, resourceType, resourceId, actorUid, before/after and timestamp inside the same transaction (lines 635-655), reject does the same (728-746), and reviewedBy/reviewedAt/reviewNotes are stamped on the application itself (627-633, 719-725). Three defects. (1) actorUid comes from req.user.uid, and on the X-Admin-Key path requireAdmin synthesizes `{ uid: 'admin-key-user', email: 'admin@kaayko.com' }` (middleware/authMiddleware.js:180-184) — so every approval made through this console records the same fake identity, and the log line at kreatorRoutes.js:797 prints 'approved by admin@kaayko.com'. (2) The audit doc's comment says `ipAddress: null, // Set in route handler` (line 650) but the route handler at kreatorRoutes.js:786-802 never sets it; `req.clientInfo` is already attached by attachClientInfo (line 50) and is simply not passed through. (3) The approve audit record stores the live `magicLinkCode` in its `after` object (line 645).

**Impact.** If several people ever operate the console, the log cannot say who approved whom — the answer is always 'admin-key-user'. And anyone with read access to admin_audit_logs holds a working activation code for every recently approved kreator.

**Fix.** Pass `req.clientInfo` into approveApplication/rejectApplication and write it into the audit doc's ipAddress/userAgent fields (kreatorRoutes.js:791 and 850; service lines 650 and 737). Replace the magicLinkCode in the approve audit's `after` with a SHA-256 prefix or just `magicLinkIssued: true` (line 645). Once the console uses Bearer auth (finding 1), actorUid becomes a real uid; also record `req.user.authMethod` on the audit doc so key-based actions are distinguishable.

> not verified — 3-verifier cap

### P2 — Two admin consoles with two unrelated auth models, one of which is a static string

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/admin/index.html:659` · surface: admin-console

**What is wrong.** Kortex (kaayko/src/kortex.html) is a Firebase-Auth SPA: ID token, admin_users/{uid} role lookup, scope separation, email verification. This page is a standalone static file with a shared passphrase in JS, a localStorage boolean session, and no logout that revokes anything. Grepping kaayko/src for 'kreators/admin' returns exactly one file — this one — so there is no fallback surface, and Kortex has no awareness of kreator applications at all. The split means the owner keeps two mental models, and the weaker one guards the pipeline that mints sellers into the shared kaaykoproducts catalogue.

**Impact.** The owner has to remember which console uses which credential; the kreator one, being the weaker, is the one guarding seller onboarding. Every hardening improvement made to Kortex auth (email verification, scope, revocation) has to be re-implemented here or is simply absent.

**Fix.** Fold the applications view into the Kortex SPA as a new tab that reuses its existing Firebase ID-token fetch wrapper against /kreators/admin/* (now guarded by requirePlatformAdmin), then delete kaayko/src/kreator/admin/ and add a hosting redirect from /kreator/admin to the Kortex tab. If that is too large for one pass, the minimum interim step is replacing this page's passphrase gate with the same Firebase sign-in code kortex.html already uses.

> not verified — 3-verifier cap

### P2 — The activation email states a single-use guarantee the code does not enforce at click time

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/services/emailNotificationService.js:390` · surface: email-notifications

**What is wrong.** The magic-link email tells the recipient, in both the HTML body (line 390) and the plain-text body (line 413), "It is single-use — it will stop working after you click it once." That is false. Clicking the link hits GET /l/:code (api/kortex/deeplinkRoutes.js:195), which redirects and tracks analytics; it does not touch metadata.usedAt. validateMagicLink (kreatorService.js:356) only reads usedAt, and usedAt is written solely by consumeMagicLinkAndSetPassword (kreatorService.js:403) when a password is successfully set. So the link stays fully usable for the whole 24-hour window (MAGIC_LINK_EXPIRY_HOURS.onboarding, kreatorService.js:53) after any number of clicks, and the code travels in the URL query string to /kreator/onboarding.

**Impact.** A recipient who clicks the link, does not finish, and then forwards the mail or leaves it in a shared inbox believes the link is spent. It is not — anyone holding it can set the password and take over the seller account for the remainder of the window.

**Fix.** Either make the copy true or make the code true. Truthful copy is the cheap fix: replace both strings with "This link works once — it stops working as soon as an account password is set with it, and expires at <time>." The stronger fix is to stamp metadata.firstClickedAt in the /l/ redirect for type === 'magic_link' and have validateMagicLink reject a link first clicked from a different IP/user-agent, alongside actually verifying the presented code against the stored tokenHash/tokenSalt with the already-written verifyToken() (kreatorService.js:90), which today is dead code.

> not verified — 3-verifier cap

### P2 — The admin reject dialog calls the rejection reason "optional" while the API requires ten characters, so rejections fail with a generic error

`/Users/Rohan/Kaayko_v6/kaayko/src/kreator/admin/index.html:972` · surface: email-notifications

**What is wrong.** The admin UI collects the rejection reason with `prompt('Rejection reason (optional):')` at line 972. It is not optional: the route returns 400 REASON_REQUIRED when reason is falsy (kreatorRoutes.js:842) and rejectApplication throws VALIDATION_ERROR when reason.trim().length < 10 (kreatorApplicationService.js:693). Cancelling the prompt yields null, and a short reason like "spam" yields a 400; either way the page's `if (!response.ok) throw new Error('Failed to reject')` surfaces "Error rejecting application: Failed to reject" without saying why, and the application stays pending. The reason field matters because rejectionReason is the only content an applicant can ever see about the outcome (getApplicationStatus, kreatorApplicationService.js:367).

**Impact.** The owner tries to clear the queue, gets an opaque failure, and the application sits pending forever. When a rejection does go through with a terse reason it is rejected by the server, so the one piece of feedback the applicant could pull is never written.

**Fix.** Change the prompt label at index.html:972 to 'Rejection reason (shown to the applicant, min 10 characters):', reject client-side when the trimmed value is under 10 characters or the prompt was cancelled, and surface the server's message instead of a generic string by parsing the JSON body's `message` field in the !response.ok branch (lines 985-990).

> not verified — 3-verifier cap

### P2 — There is no store registry — storeSlug is recomputed on every product write and never reconciled

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorProductRoutes.js:239` · surface: data-model

**What is wrong.** The slug is derived inline at each product create: `${generateStoreSlug(req.kreator.businessName || req.kreator.displayName)}-${req.kreator.uid.substring(0,6)}` (kreatorProductRoutes.js:239). There is no stores or store_slugs collection — a repo-wide grep for collection('stores') returns nothing. Nothing reserves a slug, nothing can enumerate the stores that exist, and the storefront's only way to know a store is real is that at least one product happens to carry the slug (kaayko-main.js:56-90 renders 'This store doesn't have any products yet' for an unknown slug). PUT /kreators/products/:id never recomputes storeName or storeSlug, and no code path rewrites existing products, so a rename would fork one seller into two storefronts. businessName is not in the updateKreatorProfile allowlist (kreatorService.js:539-547) so a rename is currently only possible by editing Firestore, which is exactly the hand-edit path that produces the fork.

**Impact.** Kaayko cannot answer 'which stores exist' without scanning the catalogue, cannot render a store directory, cannot give a store a logo or a description, and cannot rename a store without splitting it. Store identity is a string copied onto product rows rather than a thing that exists.

**Fix.** Create the store document at approval time, inside the existing transaction at kreatorApplicationService.js:568: `stores/{slug}` holding { slug, kreatorId, storeName, createdAt, active }, with the slug reserved by the document id so a second write fails. Change kreatorProductRoutes.js:239 to read req.kreator.storeSlug (stamped on the kreator doc at approval) rather than recomputing it, and have the rename path update stores/{slug} plus a batched write over the kreator's products so the denormalised copies stay in step.

> not verified — 3-verifier cap

### P2 — stats.totalProducts drifts and can go negative; totalOrders and totalRevenue are never written

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/api/kreators/kreatorProductRoutes.js:484` · surface: data-model

**What is wrong.** DELETE /kreators/products/:id decrements stats.totalProducts (kreatorProductRoutes.js:484-486) without checking whether product.deletedAt is already set — the ownership check at line 469 passes on an already-deleted document, so repeated DELETEs on the same id decrement repeatedly. Conversely PUT with isAvailable:false (line 414) hides a product without decrementing. stats.totalOrders and stats.totalRevenue are set to 0 at kreatorApplicationService.js:555-559 and a repo-wide grep finds no other writer.

**Impact.** The kreator's product count on the dashboard drifts away from reality and can go negative, and the revenue counters are permanent zeros — which is the same underlying gap as the hardcoded Earnings view, but sitting in the data model rather than the UI.

**Fix.** At kreatorProductRoutes.js:461, return 404 when product.deletedAt is already set, before the update and the decrement. Better: drop the stored counter and compute the count with a Firestore count() aggregation on `kreatorId == uid && deletedAt == null` in GET /kreators/products, which cannot drift. Once orders carry kreatorId (see the payout finding), derive totalOrders and totalRevenue from the orders collection rather than maintaining them.

> not verified — 3-verifier cap

### P2 — GET /kreators/admin/list has no matching composite index for its default query

`/Users/Rohan/Kaayko_v6/kaayko-api/firestore.indexes.json:278` · surface: data-model

**What is wrong.** listKreators builds `where('deletedAt','==',null).orderBy('createdAt','desc')` when no status or plan filter is supplied (kreatorService.js:312-322, defaults at lines 306-310). firestore.indexes.json declares only two kreators indexes: (deletedAt ASC, status ASC, createdAt DESC) at line 278 and (deletedAt ASC, plan ASC, createdAt DESC) at line 296. The unfiltered query needs (deletedAt ASC, createdAt DESC), which is not a prefix of either — Firestore matches an index by field prefix in order, and createdAt sits third in both.

**Impact.** Opening the kreator list without picking a status filter returns FAILED_PRECONDITION, which the route turns into a 500. The admin sees a server error rather than the roster of sellers.

**Fix.** Add a third kreators entry to firestore.indexes.json with fields [{deletedAt, ASCENDING}, {createdAt, DESCENDING}] and deploy indexes. Also note that listKreators paginates with .offset(offset) at kreatorService.js:329, which Firestore bills for every skipped document — switch to the startAfter cursor pattern already used in listApplications (kreatorApplicationService.js:407-414).

> not verified — 3-verifier cap

### P2 — Applicant and kreator email addresses are written into Cloud Logging on every lifecycle event

`/Users/Rohan/Kaayko_v6/kaayko-api/functions/services/kreatorApplicationService.js:281` · surface: no-leak

**What is wrong.** Ten log statements across the kreator pipeline print PII into Cloud Logging: kreatorApplicationService.js:281 logs applicant email and business name on every submission, :679 the kreator email on mail failure, :744 the email on rejection; kreatorService.js:515 the magic-link target email, :851 and :872 the kreator email on resend; kreatorRoutes.js:333 logs result.email on onboarding completion, :546 and :575 the Google account email on sign-in; kreatorProductRoutes.js:285 logs the kreator email on every product create. Nothing redacts them, and the monthly orderRetention job (functions/scheduled/orderRetention.js) covers orders, payment_intents and mail — not logs.

**Impact.** Every person who applies to sell has their email, and often their business name, sitting in the project's log bucket readable by anyone with Logs Viewer on kaaykostore, outside the retention promise the privacy policy makes about order data. Log exports and error-reporting integrations widen that further.

**Fix.** Replace the email in each of those ten statements with a non-reversible handle — the applicationId or kreator uid is already present in most of them, so `${applicationId}` alone suffices at kreatorApplicationService.js:281/744 and `${kreatorId}` at kreatorService.js:851/872 and kreatorRoutes.js:333. Where the address is genuinely useful for support, log only the domain (`email.split('@')[1]`).

> not verified — 3-verifier cap


## Counts

- Raw findings: 75
- Unique after dedup: 75
- Adversarially verified: 3 (all confirmed, 0 refuted)
- Reported unverified: 72
- By severity: 22 P0 · 32 P1 · 21 P2

Audit cost: 10 agents (7 surface auditors + 3 verifiers), ~1.06M tokens, 0 agent failures.

---

## Real-Launch Readiness Checklist

Nothing below is optional. The program is non-functional until all of 1–6 pass.

1. **Bind `SESSION_SECRET`** to the deployed `api` function. Nothing about kreator
   auth works until this exists. Note the deploy pipeline cannot catch this:
   `predeploy-check.js` forces emulator mode, which suppresses the very assertion
   that would have failed.
2. **Write `POST /kreators/auth/login`.** The frontend has always called a route
   that does not exist.
3. **Move kreator email onto the store's proven pipeline.** The store's
   `queueMailOnce` → Firestore `mail` → `mailSender` SMTP path is deployed,
   idempotent and tested. The kreator flow was built on a second, dead SendGrid
   stack. Do not install SendGrid; delete that path and reuse the working one.
   (This also needs `MAIL_SMTP_URL` bound — currently absent.)
4. **Give the review console real auth.** Delete the hardcoded
   `kaayko2026admin`. Either fold application review into the Kortex admin SPA —
   where `apiFetch` already carries a Firebase token — or gate this page the same
   way. **Escape applicant free text before this ships**: reviving the console
   without output escaping arms a stored XSS aimed at the owner.
5. **Swap `requireAdmin` → `requirePlatformAdmin`** on all eight
   `/kreators/admin/*` routes. `role: 'admin'` is self-serve.
6. **Rotate `ADMIN_PASSPHRASE` to a value distinct from `KORTEX_SYNC_KEY`.** The
   code fallback was removed on 5 Sep; the identical deployed values re-create the
   same master-credential exposure.
7. Fix the onboarding `valid` field mismatch so a good magic link does not render
   as expired.
8. Confirm product create actually works end to end once auth exists — multer
   under Firebase Functions is the same `rawBody` trap this repo already
   documents for the Stripe webhook.

## The Question This Audit Cannot Answer

**How does a kreator get paid?**

There is no answer in the code. `kreatorId` is written onto the product document
and stops there: `pricing.js` does not copy ownership onto the line item, the
Stripe webhook does not write it onto the order, and no commission, payout,
balance or earnings field exists anywhere in the API. Verified directly — `grep
kreatorId` across `pricing.js` and `stripeWebhook.js` returns nothing.

So today Kaayko cannot pay a kreator and cannot reconstruct what it owes one. The
only link from money to seller is a mutable join through the product document; if
a product is edited, reassigned or deleted, the historical attribution is gone —
and orders deliberately snapshot title and price precisely so they *cannot* be
rewritten by later product edits.

This is a product decision, not a bug: **decide the commercial model before
building more of the pipeline.** Whatever is chosen, the minimum technical
requirement is that `kreatorId` and an agreed commission basis are copied onto the
order line at purchase time, next to the existing price snapshot.

## Agent Task Queue

**P0 — program is dead until these land**
- Bind `SESSION_SECRET`; write the login route; move email to the working SMTP pipeline.
- Give the review console real auth **and** output escaping, together.
- `requirePlatformAdmin` on the eight admin routes; rotate `ADMIN_PASSPHRASE`.
- Stop returning the one-time magic-link code in approve/resend HTTP responses.
- Decide the payout model; carry `kreatorId` onto the order line.

**P1 — a seller or buyer hits a broken or dishonest experience**
- Validate price on `PUT /kreators/products/:id` (no bounds, no NaN check today).
- Decide whether a third party's product goes live with no review gate.
- Suspension/offboarding: a deleted kreator's products stay live and purchasable.
- Notify the owner when an application arrives; the queue is poll-only.
- Give the kreator edit/delete UI, or stop offering products they cannot manage.
- Stop the dashboard promising Orders, Earnings and Shipping state nothing computes.

**P2 — quality and defence in depth**
- Application ids from `Math.random` written with `set()`.
- PII in Cloud Logging on every lifecycle event.
- `stats.totalProducts` drift; missing composite index on `/admin/list`.
- Two admin consoles with two unrelated auth models.

## Method And Cost

7 surface auditors in parallel (application pipeline, auth/session, dashboard +
products, admin console, email/notifications, data model, no-leak), then 3
adversarial verifiers on the highest-severity findings. 10 agents, ~1.06M tokens,
0 failures — sized and capped under the rules in `CLAUDE.md`, with the count agreed
before launch.

Every configuration claim in the Executive Verdict was additionally verified by
hand against the live deployment rather than taken from an agent: Cloud Run env
binding, secret-value comparison by hash, the served page's hardcoded key, that
key's 401 against production, `@sendgrid/mail` absence, and the missing login
route. The 72 unverified findings are labelled as such throughout.
