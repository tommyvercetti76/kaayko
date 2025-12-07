# Tenant Onboarding - Quick Start Guide

**Get the tenant onboarding wizard up and running in 5 minutes**

---

## Prerequisites

- ✅ Kaayko Admin Portal already running
- ✅ Firebase authentication configured
- ✅ Backend API accessible

---

## Installation (Already Complete! ✅)

All files have been created and integrated:

```
✅ /frontend/src/admin/views/tenant-onboarding/tenant-onboarding.html
✅ /frontend/src/admin/views/tenant-onboarding/tenant-onboarding.css
✅ /frontend/src/admin/views/tenant-onboarding/tenant-onboarding.js
✅ /frontend/src/admin/smartlinks.html (updated)
✅ /frontend/src/admin/js/smartlinks-core.js (updated)
✅ /frontend/src/admin/js/utils.js (updated)
```

---

## Access the Wizard

### Method 1: Click Sidebar Navigation
1. Open admin portal: `https://your-domain.com/admin/smartlinks.html`
2. Look for **"Tenant Onboarding"** in the sidebar (👥 icon)
3. Click to launch wizard

### Method 2: Direct URL
```
https://your-domain.com/admin/smartlinks.html?view=tenant-onboarding
```

---

## Backend Setup Required

⚠️ **The UI is ready, but you need to implement these backend endpoints:**

### 1. Create Tenant Endpoint
```javascript
// POST /tenants
router.post('/tenants', async (req, res) => {
  const { id, name, domain, pathPrefix, settings } = req.body;
  
  // Create tenant in Firestore
  await db.collection('tenants').doc(id).set({
    id,
    name,
    domain,
    pathPrefix,
    settings,
    enabled: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  res.json({ 
    success: true, 
    tenant: { id, name, domain, pathPrefix, settings }
  });
});
```

### 2. Create Admin User Endpoint
```javascript
// POST /admin-users
router.post('/admin-users', async (req, res) => {
  const { email, displayName, tenantId, role } = req.body;
  
  // Create Firebase Auth user
  const userRecord = await admin.auth().createUser({
    email,
    displayName: displayName || email.split('@')[0]
  });
  
  // Store in Firestore
  await db.collection('admin_users').doc(userRecord.uid).set({
    uid: userRecord.uid,
    email,
    displayName: displayName || email.split('@')[0],
    tenantId,
    role,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  res.json({ 
    success: true, 
    user: { uid: userRecord.uid, email, role }
  });
});
```

### 3. DNS Status Endpoint
```javascript
// GET /tenants/:tenantId/dns-status
router.get('/tenants/:tenantId/dns-status', async (req, res) => {
  const { tenantId } = req.params;
  
  // TODO: Check DNS records via DNS lookup
  // For now, return mock status
  res.json({ 
    success: true, 
    status: 'not-configured' // or 'pending' or 'verified'
  });
});
```

### 4. Create API Key Endpoint
```javascript
// POST /api-keys
router.post('/api-keys', async (req, res) => {
  const { tenantId, name, scopes, rateLimitPerMinute } = req.body;
  
  // Generate secure API key
  const apiKey = `ak_${crypto.randomBytes(32).toString('hex')}`;
  const keyId = `key_${crypto.randomBytes(8).toString('hex')}`;
  
  // Store in Firestore (hash the key!)
  await db.collection('api_keys').doc(keyId).set({
    keyId,
    apiKeyHash: hashApiKey(apiKey), // Don't store plain text!
    tenantId,
    name,
    scopes,
    rateLimitPerMinute,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // Return API key ONCE
  res.json({ 
    success: true, 
    apiKey,  // ⚠️ Only shown once!
    keyId 
  });
});
```

### 5. Create Webhook Endpoint
```javascript
// POST /webhooks
router.post('/webhooks', async (req, res) => {
  const { tenantId, targetUrl, secret, events, description } = req.body;
  
  const subscriptionId = `sub_${crypto.randomBytes(8).toString('hex')}`;
  
  await db.collection('webhook_subscriptions').doc(subscriptionId).set({
    subscriptionId,
    tenantId,
    targetUrl,
    secret, // Store securely!
    events,
    description,
    enabled: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  res.json({ 
    success: true, 
    subscriptionId 
  });
});
```

---

## Testing Locally

### 1. Start Local Environment
```bash
cd local-dev/scripts
./start-local.sh
```

### 2. Open Admin Portal
```bash
open http://localhost:5000/admin/smartlinks.html
```

### 3. Navigate to Tenant Onboarding
Click the **"Tenant Onboarding"** item in the sidebar (👥 icon)

### 4. Test Each Step

**Step 1 - Tenant Details:**
```
Tenant Name: Test Client
Tenant ID: test-client (auto-generated)
Domain: go.testclient.com
Path Prefix: /l
```

**Step 2 - Admin User:**
```
Toggle: ON
Email: admin@testclient.com
Display Name: Test Admin
```

**Step 3 - Domain:**
- Click "Refresh DNS Status"
- Copy DNS records

**Step 4 - API Keys:**
```
✓ Create Production API Key
✓ Create Analytics Read-Only Key
```
- Copy the API keys immediately!

**Step 5 - Webhooks:**
```
Toggle: ON
URL: https://testclient.com/webhook
Secret: test-secret-123
Events: ✓ link.created, ✓ link.clicked
```

**Step 6 - Summary:**
- Download configuration JSON
- Copy client instructions

---

## Troubleshooting

### Issue: "View not loading"
**Solution:** Check browser console for errors
```javascript
// Verify view is registered
console.log(VIEW_CONFIGS['tenant-onboarding']);
```

### Issue: "API calls failing"
**Solution:** Check network tab
- Verify endpoint URLs
- Check authentication token
- Ensure CORS is configured

### Issue: "Styles not applied"
**Solution:** 
```bash
# Clear browser cache
# Check CSS file loaded in Network tab
# Verify CSS variables defined in smartlinks-base.css
```

### Issue: "Navigation not working"
**Solution:**
```javascript
// Check event listener attached
document.querySelector('[data-view="tenant-onboarding"]').onclick
```

---

## Production Deployment

### 1. Build Frontend
```bash
cd frontend
npm run build
# or
firebase deploy --only hosting
```

### 2. Deploy Backend Functions
```bash
cd api/deployment
./deploy-firebase-functions.sh
```

### 3. Update Environment
```javascript
// Ensure CONFIG.API_BASE points to production
// In config.js, PROD_API should be set correctly
```

### 4. Test in Production
- Log in as super-admin
- Navigate to Tenant Onboarding
- Create test tenant
- Verify all API calls succeed

---

## Quick Reference

### Key Files
| File | Purpose |
|------|---------|
| `tenant-onboarding.js` | Main logic, API calls, state management |
| `tenant-onboarding.css` | Styles matching Kaayko dark theme |
| `tenant-onboarding.html` | View structure (embedded in smartlinks.html) |
| `smartlinks-core.js` | View registration |
| `utils.js` | Helper functions (copyToClipboard added) |

### Key Functions
| Function | Purpose |
|----------|---------|
| `init(state)` | Initialize wizard, render first step |
| `goToStep(n)` | Navigate to specific step |
| `validateCurrentStep()` | Validate current step data |
| `processCurrentStep()` | Make API calls for current step |
| `renderStep1TenantDetails()` | Render tenant form |
| `downloadConfiguration()` | Download JSON config |
| `copyClientInstructions()` | Copy formatted guide |

### API Call Pattern
```javascript
const response = await apiFetch('/endpoint', {
  method: 'POST',
  body: JSON.stringify(data)
});
const result = await response.json();
if (result.success) {
  // Handle success
} else {
  // Handle error
}
```

---

## Next Steps

1. ✅ **Verify UI Works:** Open admin portal and check navigation
2. 🔧 **Implement Backend:** Create the 5 required endpoints
3. 🧪 **Test End-to-End:** Create a test tenant through entire flow
4. 📊 **Add Analytics:** Track tenant creation events
5. 🚀 **Deploy to Production:** Once backend is ready

---

## Support

**Documentation:**
- Full README: `views/tenant-onboarding/README.md`
- Integration guide: `views/tenant-onboarding/INTEGRATION_SUMMARY.md`
- Backend guide: `/docs/SMARTLINKS_MULTI_TENANT_ONBOARDING.md`

**Contact:**
rohan@kaayko.com

---

**Status: ✅ Frontend Complete - Backend Required**

The UI is fully functional and ready. You just need to implement the backend API endpoints to make it live!
