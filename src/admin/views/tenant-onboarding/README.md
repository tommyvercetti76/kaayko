# Tenant Onboarding UI Module

**Multi-step wizard for onboarding new external clients/brands to Kaayko Smart Links Platform**

---

## Overview

The Tenant Onboarding module provides a complete guided workflow for super-admins to:
- Create new tenant accounts
- Set up admin users
- Configure custom domains and DNS
- Generate API keys
- Configure webhook subscriptions
- Download configuration files and client instructions

## Location

```
/frontend/src/admin/views/tenant-onboarding/
├── tenant-onboarding.html   # View structure
├── tenant-onboarding.css    # Styles (matches Kaayko dark theme)
├── tenant-onboarding.js     # Module logic
└── README.md               # This file
```

## Integration

### 1. View Registration

The view is registered in `kortex-core.js`:

```javascript
'tenant-onboarding': {
  module: '../views/tenant-onboarding/tenant-onboarding.js',
  css: 'views/tenant-onboarding/tenant-onboarding.css',
  container: '#tenant-onboarding-view'
}
```

### 2. Navigation

Added to sidebar navigation in `kortex.html`:

```html
<a href="#" class="nav-item" data-view="tenant-onboarding">
  <span class="nav-icon">👥</span>
  <span>Tenant Onboarding</span>
</a>
```

### 3. Access

Navigate to: `kortex.html?view=tenant-onboarding`

---

## Wizard Flow

### Step 1: Tenant Details
- **Required Fields:**
  - Tenant Name (display name)
  - Tenant ID (slug: lowercase, hyphens, no spaces)
  - Primary Domain (e.g., go.clientx.com)
  - Path Prefix (default: /l)
- **Optional Fields:**
  - Branding Color (hex code)
  - Branding Logo URL
- **API Call:** `POST /tenants`
- **Auto-generates:** Tenant ID from name (editable)

### Step 2: Admin User (Optional)
- **Toggle:** Create admin user?
- **Fields (if enabled):**
  - Admin Email (required)
  - Display Name (optional)
- **API Call:** `POST /admin-users`
- **Purpose:** Allows tenant to access web portal

### Step 3: Domain & DNS Setup
- **Displays:**
  - Required DNS records (CNAME, TXT)
  - Copy buttons for each record
  - DNS status indicator
- **Actions:**
  - Refresh DNS status button
- **API Call:** `GET /tenants/:tenantId/dns-status`
- **Note:** Informational step, can proceed without DNS verification

### Step 4: API Keys
- **Checkbox Options:**
  - Create Production API Key
    - Scopes: create, read, update, delete, stats
    - Rate limit: 120 req/min
  - Create Analytics Read-Only Key
    - Scopes: read links, read stats
    - Rate limit: 300 req/min
- **API Call:** `POST /api-keys`
- **Warning:** API keys shown only once, must be copied immediately
- **Display:** Key values with copy buttons, scopes badges

### Step 5: Webhooks (Optional)
- **Toggle:** Configure webhook?
- **Fields (if enabled):**
  - Webhook URL (HTTPS required)
  - Webhook Secret (for HMAC verification)
  - Event checkboxes:
    - link.created
    - link.updated
    - link.deleted
    - link.clicked
    - app.installed
- **API Call:** `POST /webhooks`
- **Validation:** At least one event must be selected

### Step 6: Summary
- **Displays:**
  - Tenant information summary
  - Admin user details (if created)
  - API keys metadata (values not shown again)
  - Webhook configuration
- **Actions:**
  - Download Configuration JSON
  - Copy Client Instructions (formatted guide)
  - Go to Tenant Dashboard

---

## API Endpoints Used

All endpoints are called via `apiFetch()` which automatically includes authentication headers.

### Create Tenant
```
POST /tenants
Body: {
  id: string,
  name: string,
  domain: string,
  pathPrefix: string,
  settings: { branding: {...} }
}
```

### Create Admin User
```
POST /admin-users
Body: {
  email: string,
  displayName: string,
  tenantId: string,
  role: "admin"
}
```

### Check DNS Status
```
GET /tenants/:tenantId/dns-status
Returns: { success: boolean, status: "verified" | "pending" | "not-configured" }
```

### Create API Key
```
POST /api-keys
Body: {
  tenantId: string,
  name: string,
  scopes: string[],
  rateLimitPerMinute: number
}
Returns: { success: boolean, apiKey: string, keyId: string }
```

### Create Webhook
```
POST /webhooks
Body: {
  tenantId: string,
  targetUrl: string,
  secret: string,
  events: string[],
  description: string
}
```

---

## State Management

The module maintains wizard state in `wizardState` object:

```javascript
{
  currentStep: 1,
  totalSteps: 6,
  tenant: null,              // Created tenant object
  adminUser: null,           // Created admin user object
  apiKeys: [],              // Array of generated API keys
  webhooks: [],             // Array of webhook subscriptions
  dnsStatus: null,          // DNS verification status
  errors: {},               // Validation errors
  formData: {               // Form input values
    tenantName: '',
    tenantId: '',
    domain: '',
    pathPrefix: '/l',
    // ... etc
  }
}
```

---

## Validation Rules

### Step 1 (Tenant Details)
- Tenant Name: Required, non-empty
- Tenant ID: Required, lowercase, alphanumeric + hyphens only
- Domain: Required, non-empty
- Path Prefix: Required, non-empty

### Step 2 (Admin User)
- If toggle enabled:
  - Admin Email: Required, valid email format

### Step 4 (API Keys)
- No validation (optional)
- Warning shown if no keys selected

### Step 5 (Webhooks)
- If toggle enabled:
  - Webhook URL: Required, valid HTTPS URL
  - Webhook Secret: Required, non-empty
  - Events: At least one must be selected

---

## Styling

### Theme Consistency
- Matches `kortex-base.css` dark theme
- Uses CSS variables:
  - `--gold-primary` for accents
  - `--bg-card` for surfaces
  - `--text-primary/secondary/muted` for text
  - `--border-subtle/medium` for borders

### Key Components
- **Step Indicator:** Horizontal progress bar with active/completed states
- **Toggle Switch:** Custom animated toggle (gold when active)
- **Form Inputs:** Dark theme with gold focus states
- **Checkbox Items:** Card-style selectable items
- **Info/Warning Boxes:** Color-coded message containers
- **DNS Records:** Grid layout with copy buttons
- **API Key Display:** Monospace code blocks with copy buttons

### Responsive Behavior
- Desktop: Full width with side-by-side layouts
- Tablet: Adjusted grid columns
- Mobile: Single column, step labels hidden

---

## Output Files

### Configuration JSON
Downloaded as `tenant-{tenantId}-config.json`:
```json
{
  "tenant": { ... },
  "adminUser": { ... },
  "apiKeys": [
    { "name": "Production", "scopes": [...], "rateLimitPerMinute": 120 }
  ],
  "webhooks": [...]
}
```

### Client Instructions
Plain text guide copied to clipboard:
- API base URL
- Tenant ID
- Authentication header format
- Example API request (curl)
- Short link domain format
- DNS configuration steps
- API keys metadata
- Support contact

---

## Error Handling

### Validation Errors
- Displayed as error banner at top of wizard content
- Also shown as toast notification
- Prevents progression to next step

### API Errors
- Caught in try/catch blocks
- User-friendly messages displayed
- Console logging for debugging
- Allows retry without losing form data

### Network Errors
- Generic "Network error" message shown
- Does not clear form data
- User can retry after fixing connectivity

---

## Future Enhancements

Potential improvements for future versions:

1. **Tenant Preview:** Show live preview of branded short link
2. **Bulk Import:** CSV import for multiple tenants
3. **Email Templates:** Send welcome email to admin user
4. **DNS Auto-Check:** Periodic automatic DNS verification
5. **Advanced Settings:** Custom rate limits, IP whitelisting
6. **Tenant Analytics:** Quick stats preview before finishing
7. **Clone Existing Tenant:** Duplicate settings from existing tenant
8. **Step Validation:** Real-time validation as user types
9. **Save Draft:** Resume incomplete onboarding later
10. **Audit Log:** Track who created which tenants and when

---

## Testing Checklist

- [ ] Navigate to Tenant Onboarding from sidebar
- [ ] Step 1: Create tenant with all required fields
- [ ] Step 1: Verify tenant ID auto-slugifies from name
- [ ] Step 1: Verify validation for invalid tenant ID format
- [ ] Step 2: Toggle admin user on/off
- [ ] Step 2: Create admin user with valid email
- [ ] Step 3: Copy DNS records to clipboard
- [ ] Step 3: Refresh DNS status (requires backend)
- [ ] Step 4: Generate both Production and Analytics keys
- [ ] Step 4: Copy API keys to clipboard
- [ ] Step 5: Toggle webhook on/off
- [ ] Step 5: Select multiple events
- [ ] Step 5: Validate webhook URL format
- [ ] Step 6: Download configuration JSON
- [ ] Step 6: Copy client instructions
- [ ] Navigation: Back/Next buttons work correctly
- [ ] Navigation: Step indicator shows correct state
- [ ] Responsive: Works on mobile/tablet screens
- [ ] Errors: Invalid inputs show proper error messages
- [ ] Errors: API failures don't break wizard state

---

## Backend Requirements

This frontend module requires these backend endpoints to be implemented:

1. `POST /tenants` - Create new tenant
2. `POST /admin-users` - Create admin user with Firebase Auth
3. `GET /tenants/:id/dns-status` - Check DNS verification
4. `POST /api-keys` - Generate API key (returns key value once)
5. `POST /webhooks` - Create webhook subscription

All endpoints should:
- Require authentication (Bearer token)
- Return `{ success: boolean, ... }` format
- Handle errors gracefully with descriptive messages
- Validate input data server-side

---

## Support

For questions or issues with this module:
- Technical docs: `/api/docs/`
- API reference: `/api/docs/API-QUICK-REFERENCE-v2.1.0.md`
- Multi-tenant guide: `/docs/SMARTLINKS_MULTI_TENANT_ONBOARDING.md`
- Contact: rohan@kaayko.com
