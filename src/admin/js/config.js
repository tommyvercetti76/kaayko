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
  PROD_API: 'https://us-central1-kaaykostore.cloudfunctions.net/api',
  
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
    console.log('   Token in localStorage:', token ? 'YES' : 'NO');
    console.log('   User in localStorage:', userStr ? 'YES' : 'NO');
    
    if (token && userStr) {
      try {
        this.token = token;
        this.user = JSON.parse(userStr);
        console.log('   ✅ Parsed user:', this.user);
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
    window.location.href = './login.html';
  },
  
  // Require authentication (redirect if not logged in)
  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = './login.html';
      return false;
    }
    return true;
  }
};

// API Wrapper with Authentication
export async function apiFetch(endpoint, options = {}) {
  const url = `${CONFIG.API_BASE}${endpoint}`;
  
  console.log(`🌐 API Request: ${url}`);
  console.log('   Method:', options.method || 'GET');
  console.log('   AUTH token:', AUTH.token ? 'EXISTS' : 'MISSING');
  
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
  
  console.log('   Headers:', fetchOptions.headers);
  if (tenantId) {
    console.log('   Tenant:', tenantId);
  }
  
  try {
    const response = await fetch(url, fetchOptions);
    console.log(`   Response status: ${response.status}`);
    
    // Handle 401 Unauthorized - logout
    if (response.status === 401) {
      console.error('❌ Authentication failed (401) - logging out');
      AUTH.logout();
      return null;
    }
    
    return response;
  } catch (error) {
    console.error(`❌ API call failed: ${endpoint}`, error);
    throw error;
  }
}
