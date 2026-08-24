/**
 * Smart Links Enterprise - Configuration & Authentication
 * Core configuration and authentication utilities
 */

// Configuration
export const CONFIG = {
  // Environment: 'local' or 'production'
  // Default to 'production' - auth is always local emulator, but data is from prod API
  ENVIRONMENT: localStorage.getItem('kaayko_environment') || 'production',
  
  // API endpoints
  LOCAL_API: 'http://127.0.0.1:5001/kaaykostore/us-central1/api',
  PROD_API: 'https://api-vwcc5j4qda-uc.a.run.app',
  
  QR_API: 'https://api.qrserver.com/v1/create-qr-code/',
  VERSION: '4.5.0',
  BUILD: '20251109',
  
  // Get current API base
  get API_BASE() {
    return this.ENVIRONMENT === 'production' ? this.PROD_API : this.LOCAL_API;
  },
  
  // Switch environment
  setEnvironment(env) {
    this.ENVIRONMENT = env;
    localStorage.setItem('kaayko_environment', env);
    console.log(`🔄 Switched to ${env.toUpperCase()} environment`);
    console.log(`📡 API: ${this.API_BASE}`);
    window.location.reload();
  }
};

// Authentication
// Authentication object
export const AUTH = {
  user: null,
  token: null,
  
  // Initialize from localStorage
  init() {
    const token = localStorage.getItem('kaayko_auth_token');
    const userStr = localStorage.getItem('kaayko_user');
    
    console.log('🔐 AUTH.init() called');
    if (CONFIG.ENVIRONMENT !== 'production') console.log('   Token in localStorage:', token ? 'YES' : 'NO');
    console.log('   User in localStorage:', userStr ? 'YES' : 'NO');

    if (token && userStr) {
      try {
        this.token = token;
        this.user = JSON.parse(userStr);
        if (CONFIG.ENVIRONMENT !== 'production') console.log('   ✅ Parsed user:', this.user);
        return true;
      } catch (err) {
        console.error('   ❌ Failed to parse user data:', err);
        return false;
      }
    }
    console.log('   ❌ Missing token or user data');
    return false;
  },
  
  // Get headers with auth token
  getHeaders() {
    if (!this.token) this.init();
    return {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` })
    };
  },
  
  // Check if user is authenticated
  isAuthenticated() {
    return this.init();
  },
  
  // Logout with backend token revocation
  async logout() {
    try {
      // Call backend to revoke tokens
      const apiBase = CONFIG.API_BASE;
      await fetch(`${apiBase}/auth/logout`, {
        method: 'POST',
        headers: this.getHeaders()
      });
    } catch (error) {
      console.error('Logout API error:', error);
      // Continue with frontend logout even if backend fails
    }
    
    // Clear local storage
    localStorage.removeItem('kaayko_auth_token');
    localStorage.removeItem('kaayko_user');
    localStorage.removeItem('kaayko_tenant_id');
    
    // Redirect to login
    window.location.href = './login';
  },
  
  // Require authentication (redirect if not logged in)
  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = './login';
      return false;
    }
    return true;
  }
};

// API Wrapper with Authentication
export async function apiFetch(endpoint, options = {}) {
  const normalizedEndpoint = endpoint.startsWith('/smartlinks')
    ? endpoint.replace('/smartlinks', '/kortex')
    : endpoint;
  const url = `${CONFIG.API_BASE}${normalizedEndpoint}`;
  
  if (CONFIG.ENVIRONMENT !== 'production') console.log(`🌐 API Request: ${url}`);
  if (CONFIG.ENVIRONMENT !== 'production') console.log('   Method:', options.method || 'GET');
  if (CONFIG.ENVIRONMENT !== 'production') console.log('   AUTH token:', AUTH.token ? 'EXISTS' : 'MISSING');
  
  // Get tenant ID from localStorage
  const tenantId = localStorage.getItem('kaayko_tenant_id');
  
  const fetchOptions = {
    ...options,
    headers: {
      ...AUTH.getHeaders(),
      ...(tenantId && { 'X-Kaayko-Tenant-Id': tenantId }),
      ...(options.headers || {})
    }
  };
  
  if (tenantId) {
    console.log('   Tenant:', tenantId);
  }

  try {
    const response = await fetch(url, fetchOptions);
    if (CONFIG.ENVIRONMENT !== 'production') console.log(`   Response status: ${response.status}`);

    // Handle 401 Unauthorized - logout
    if (response.status === 401) {
      if (CONFIG.ENVIRONMENT !== 'production') console.error('❌ Authentication failed (401) - logging out');
      AUTH.logout();
      return null;
    }
    
    return response;
  } catch (error) {
    console.error(`❌ API call failed: ${endpoint}`, error);
    throw error;
  }
}

// ============================================================================
// TOKEN AUTO-REFRESH
// ============================================================================
// Firebase ID tokens expire after ~1h. The SPA reads `kaayko_auth_token` from
// localStorage once at load and never refreshes it, so admins were being
// force-logged-out (401 -> logout) roughly an hour into a session. This mirrors
// the refresh pattern used by views/roots/index.html
// (`setInterval(() => user.getIdToken(true), 50*60*1000)`), but is wired into
// the SPA via a dynamically-imported Firebase app so no build step / new
// <script> tag is required. Fully defensive: any failure (no Firebase, no auth
// session, offline) is a silent no-op that leaves the existing stored token
// untouched — it never removes the token or logs the user out, so it can only
// improve on the current behavior, never regress it.
//
// NOTE: this relies on the Firebase auth session persisted at login
// (src/kortex.html, project "kaaykostore") being restorable from this same
// origin. Verify in a real browser that onAuthStateChanged yields the signed-in
// user before relying on this refresh in production.
let tokenRefreshStarted = false;

async function initTokenAutoRefresh() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    // Only relevant for an already-authenticated SPA session.
    if (!localStorage.getItem('kaayko_auth_token')) return;

    const firebaseConfig = {
      apiKey: 'AIzaSyC59ECKLt3rowOoavF76hV_djb--W4jekA',
      authDomain: 'kaaykostore.firebaseapp.com',
      projectId: 'kaaykostore',
      appId: '1:87383373015:web:ee1ce56d4f5192ec67ec92',
      storageBucket: 'kaaykostore.firebasestorage.app',
      messagingSenderId: '87383373015'
    };

    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const { getAuth, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');

    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    const auth = getAuth(app);

    onAuthStateChanged(auth, (user) => {
      if (!user || tokenRefreshStarted) return;
      tokenRefreshStarted = true;

      const refresh = async () => {
        try {
          const token = await user.getIdToken(true);
          if (token) {
            localStorage.setItem('kaayko_auth_token', token);
            AUTH.token = token;
          }
        } catch (err) {
          // Keep the existing token; a later tick may succeed.
        }
      };

      refresh();
      setInterval(refresh, 50 * 60 * 1000);
    });
  } catch (err) {
    // Firebase/auth unavailable — SPA continues with the stored token as before.
  }
}

initTokenAutoRefresh();
