/**
 * Kreator API Client
 * Handles all communication with the Kreator backend APIs
 */

// Configuration
const CONFIG = {
  // Environment: 'local' or 'production'
  ENVIRONMENT: localStorage.getItem('kreator_environment') || 'production',
  
  // API endpoints
  LOCAL_API: 'http://127.0.0.1:5001/kaaykostore/us-central1/api',
  PROD_API: 'https://api-vwcc5j4qda-uc.a.run.app',
  
  get API_BASE() {
    return this.ENVIRONMENT === 'production' ? this.PROD_API : this.LOCAL_API;
  },
  
  setEnvironment(env) {
    this.ENVIRONMENT = env;
    localStorage.setItem('kreator_environment', env);
    console.log(`🔄 Kreator API switched to ${env.toUpperCase()}`);
  }
};

// Auth token management
const AUTH = {
  token: null,
  kreator: null,
  
  init() {
    const token = localStorage.getItem('kreator_auth_token');
    const kreatorStr = localStorage.getItem('kreator_user');
    
    if (token && kreatorStr) {
      try {
        this.token = token;
        this.kreator = JSON.parse(kreatorStr);
        return true;
      } catch (err) {
        this.clear();
        return false;
      }
    }
    return false;
  },
  
  setAuth(token, kreator) {
    this.token = token;
    this.kreator = kreator;
    localStorage.setItem('kreator_auth_token', token);
    localStorage.setItem('kreator_user', JSON.stringify(kreator));
  },
  
  clear() {
    this.token = null;
    this.kreator = null;
    localStorage.removeItem('kreator_auth_token');
    localStorage.removeItem('kreator_user');
  },
  
  getHeaders() {
    if (!this.token) this.init();
    return {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` })
    };
  },
  
  isAuthenticated() {
    return this.init();
  },
  
  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = './kreator-login.html';
      return false;
    }
    return true;
  },
  
  logout() {
    this.clear();
    window.location.href = './kreator-login.html';
  }
};

/**
 * Base API fetch wrapper
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${CONFIG.API_BASE}${endpoint}`;
  
  console.log(`🌐 Kreator API: ${options.method || 'GET'} ${endpoint}`);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...AUTH.getHeaders(),
        ...(options.headers || {})
      }
    });
    
    // Handle 401 - redirect to login
    if (response.status === 401) {
      console.error('❌ Authentication required');
      AUTH.logout();
      return null;
    }
    
    return response;
  } catch (error) {
    console.error(`❌ API Error: ${endpoint}`, error);
    throw error;
  }
}

/**
 * Parse API response with error handling
 */
async function parseResponse(response) {
  if (!response) {
    throw new Error('No response received');
  }
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || data.message || `HTTP ${response.status}`);
  }
  
  return data;
}

// ============================================================================
// PUBLIC APIs - No Authentication Required
// ============================================================================

/**
 * Submit a kreator application
 * @param {Object} applicationData - Application form data
 */
export async function submitApplication(applicationData) {
  const response = await apiFetch('/kreators/apply', {
    method: 'POST',
    body: JSON.stringify(applicationData)
  });
  
  return parseResponse(response);
}

/**
 * Check application status
 * @param {string} applicationId - Application ID
 * @param {string} email - Applicant email
 */
export async function checkApplicationStatus(applicationId, email) {
  const response = await apiFetch(`/kreators/applications/${applicationId}/status?email=${encodeURIComponent(email)}`);
  return parseResponse(response);
}

/**
 * Verify magic link token
 * @param {string} token - Magic link token
 */
export async function verifyMagicLink(token) {
  const response = await apiFetch('/kreators/onboarding/verify', {
    method: 'POST',
    body: JSON.stringify({ token })
  });
  
  return parseResponse(response);
}

/**
 * Complete onboarding with password
 * @param {string} token - Magic link token
 * @param {string} password - New password
 * @param {string} displayName - Display name (optional)
 */
export async function completeOnboarding(token, password, displayName = null) {
  const body = { token, password };
  if (displayName) body.displayName = displayName;
  
  const response = await apiFetch('/kreators/onboarding/complete', {
    method: 'POST',
    body: JSON.stringify(body)
  });
  
  return parseResponse(response);
}

/**
 * Login with email and password
 * @param {string} email - Kreator email
 * @param {string} password - Password
 */
export async function login(email, password) {
  const response = await apiFetch('/kreators/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  
  const data = await parseResponse(response);
  
  if (data.success && data.data.token) {
    AUTH.setAuth(data.data.token, data.data.kreator);
  }
  
  return data;
}

/**
 * Initiate Google OAuth flow using Firebase Auth
 * Returns a promise - use with async/await
 */
export async function signInWithGoogle() {
  // Firebase Auth is loaded globally in the HTML
  if (typeof firebase === 'undefined' || !firebase.auth) {
    throw new Error('Firebase Auth not loaded. Please refresh the page.');
  }
  
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  
  try {
    console.log('[Kreator Auth] Starting Google sign-in popup...');
    const result = await firebase.auth().signInWithPopup(provider);
    const user = result.user;
    const idToken = await user.getIdToken();
    
    console.log('[Kreator Auth] Got Firebase token, verifying with backend...');
    
    // Now verify with our backend
    const response = await fetch(`${CONFIG.API_BASE}/kreators/auth/google/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        idToken,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      })
    });
    
    const data = await response.json();
    console.log('[Kreator Auth] Backend response:', data);
    
    if (!response.ok) {
      throw new Error(data.message || data.error || `Server error: ${response.status}`);
    }
    
    if (data.success && data.data && data.data.token) {
      AUTH.setAuth(data.data.token, data.data.kreator);
      console.log('[Kreator Auth] ✅ Auth saved, ready to redirect');
    }
    
    return data;
  } catch (error) {
    console.error('[Kreator Auth] Google sign-in error:', error);
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in was cancelled.');
    }
    throw error;
  }
}

/**
 * Legacy function for backwards compatibility
 * @deprecated Use signInWithGoogle() instead
 */
export function initiateGoogleLogin() {
  console.warn('initiateGoogleLogin is deprecated. Use signInWithGoogle() instead.');
  signInWithGoogle().catch(err => {
    console.error('Google login failed:', err);
    alert('Google sign-in failed: ' + err.message);
  });
}

// ============================================================================
// AUTHENTICATED APIs - Require Kreator Auth
// ============================================================================

/**
 * Get current kreator profile
 */
export async function getProfile() {
  if (!AUTH.requireAuth()) return null;
  
  const response = await apiFetch('/kreators/me');
  return parseResponse(response);
}

/**
 * Update kreator profile
 * @param {Object} updates - Profile updates
 */
export async function updateProfile(updates) {
  if (!AUTH.requireAuth()) return null;
  
  const response = await apiFetch('/kreators/me', {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
  
  return parseResponse(response);
}

/**
 * Connect Google account
 * @param {string} googleIdToken - Google OAuth ID token
 */
export async function connectGoogle(googleIdToken) {
  if (!AUTH.requireAuth()) return null;
  
  const response = await apiFetch('/kreators/auth/google/connect', {
    method: 'POST',
    body: JSON.stringify({ googleIdToken })
  });
  
  return parseResponse(response);
}

/**
 * Disconnect Google account
 */
export async function disconnectGoogle() {
  if (!AUTH.requireAuth()) return null;
  
  const response = await apiFetch('/kreators/auth/google/disconnect', {
    method: 'POST'
  });
  
  return parseResponse(response);
}

/**
 * Change password
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 */
export async function changePassword(currentPassword, newPassword) {
  if (!AUTH.requireAuth()) return null;
  
  const response = await apiFetch('/kreators/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword })
  });
  
  return parseResponse(response);
}

/**
 * Request password reset
 * @param {string} email - Kreator email
 */
export async function requestPasswordReset(email) {
  const response = await apiFetch('/kreators/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
  
  return parseResponse(response);
}

/**
 * Reset password with token
 * @param {string} token - Reset token
 * @param {string} newPassword - New password
 */
export async function resetPassword(token, newPassword) {
  const response = await apiFetch('/kreators/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword })
  });
  
  return parseResponse(response);
}

/**
 * Get kreator's smart links
 */
export async function getMyLinks() {
  if (!AUTH.requireAuth()) return null;
  
  const response = await apiFetch('/kreators/links');
  return parseResponse(response);
}

/**
 * Get kreator's analytics
 * @param {Object} params - Query parameters (startDate, endDate, etc.)
 */
export async function getAnalytics(params = {}) {
  if (!AUTH.requireAuth()) return null;
  
  const queryString = new URLSearchParams(params).toString();
  const response = await apiFetch(`/kreators/analytics${queryString ? `?${queryString}` : ''}`);
  return parseResponse(response);
}

/**
 * Get kreator's earnings
 */
export async function getEarnings() {
  if (!AUTH.requireAuth()) return null;
  
  const response = await apiFetch('/kreators/earnings');
  return parseResponse(response);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check API health
 */
export async function healthCheck() {
  const response = await apiFetch('/kreators/health');
  return parseResponse(response);
}

/**
 * Get current environment
 */
export function getEnvironment() {
  return CONFIG.ENVIRONMENT;
}

/**
 * Set environment
 */
export function setEnvironment(env) {
  CONFIG.setEnvironment(env);
}

/**
 * Get current auth state
 */
export function getAuthState() {
  return {
    isAuthenticated: AUTH.isAuthenticated(),
    kreator: AUTH.kreator
  };
}

/**
 * Logout
 */
export function logout() {
  AUTH.logout();
}

/**
 * Manually set auth (for OAuth callback)
 */
export function setAuthFromCallback(token, kreator) {
  AUTH.setAuth(token, kreator);
}

// Export config for debugging
export { CONFIG, AUTH };
