/**
 * Kreator API Client
 * Handles all communication with the Kreator backend APIs
 */

// Configuration
const IS_LOCAL_HOST = ['localhost', '127.0.0.1'].includes(location.hostname);

const CONFIG = {
  // Environment: 'local' or 'production'. A page served from localhost talks to
  // the emulators unless told otherwise — it used to default to production, so a
  // local test application landed in the live kreator_applications.
  ENVIRONMENT: (() => { try { return localStorage.getItem('kreator_environment'); } catch (_) { return null; } })()
    || (IS_LOCAL_HOST ? 'local' : 'production'),
  
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
        // A session lasts 7 days. An expired one used to count as signed in, so
        // the login page bounced straight back to a dashboard that could not load.
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload.exp && payload.exp * 1000 < Date.now()) { this.clear(); return false; }
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
      window.location.href = '/kreator/kreator-login';
      return false;
    }
    return true;
  },
  
  // Signs out everywhere: the server bumps the account's session version, so a
  // copied or stolen token dies too. It used to clear this browser only.
  async logout(message) {
    const token = this.token || localStorage.getItem('kreator_auth_token');
    if (token && !message) {
      try {
        await fetch(`${CONFIG.API_BASE}/kreators/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      } catch (_) { /* offline: still sign this browser out */ }
    }
    this.clear();
    window.location.href = `/kreator/kreator-login?message=${message || 'logged_out'}`;
  }
};

/** Firebase Auth, pointed at the Auth emulator when the API is the emulator. */
function firebaseAuth() {
  if (typeof firebase === 'undefined' || !firebase.auth) {
    throw new Error('Sign-in did not load. Please refresh the page.');
  }
  const auth = firebase.auth();
  if (CONFIG.ENVIRONMENT === 'local' && !auth.__kaaykoEmulator) {
    auth.useEmulator('http://127.0.0.1:9099');
    auth.__kaaykoEmulator = true;
  }
  return auth;
}

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
    
    // A signed-in call that comes back 401 means the session expired or was
    // revoked. Public calls (sign-in with a bad token) return their own message.
    if (response.status === 401 && AUTH.token) {
      console.error('❌ Session expired');
      AUTH.logout('session_expired');
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
  
  const data = await response.json().catch(() => ({}));
  
  if (!response.ok) {
    // The useful words are in `details` (validation) or `message`; `error` is a
    // label like "Validation Error" that told applicants nothing.
    const details = Array.isArray(data.details) ? data.details.join(' ') : '';
    const err = new Error(details || data.message || data.error || `HTTP ${response.status}`);
    err.code = data.code;
    err.status = response.status;
    throw err;
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
  let credential;
  try {
    credential = await firebaseAuth().signInWithEmailAndPassword(email, password);
  } catch (e) {
    const code = e && e.code;
    if (code === 'auth/too-many-requests') throw new Error('Too many attempts. Wait a minute, or reset your password.');
    if (code === 'auth/network-request-failed') throw new Error('No connection. Check your network and try again.');
    throw new Error('That email and password do not match a seller account.');
  }
  const idToken = await credential.user.getIdToken();
  // The Firebase sign-in is only the credential for this exchange; the seller
  // session is the token the API returns.
  firebaseAuth().signOut().catch(() => {});

  const response = await fetch(`${CONFIG.API_BASE}/kreators/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
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
  const auth = firebaseAuth();
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  
  try {
    console.log('[Kreator Auth] Starting Google sign-in popup...');
    const result = await auth.signInWithPopup(provider);
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
 * Request password reset. Firebase Auth emails the reset link and hosts the
 * page that sets the new password. This used to post to /kreators/auth/forgot-
 * password, which never existed, and always said "check your email".
 * @param {string} email - Kreator email
 */
export async function requestPasswordReset(email) {
  try {
    await firebaseAuth().sendPasswordResetEmail(email);
  } catch (e) {
    // Do not reveal whether an address has an account.
    if (e && e.code !== 'auth/user-not-found' && e.code !== 'auth/invalid-email') {
      throw new Error('Could not send the reset email. Please try again.');
    }
  }
  return { success: true };
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
  return AUTH.logout();
}

/**
 * Manually set auth (for OAuth callback)
 */
export function setAuthFromCallback(token, kreator) {
  AUTH.setAuth(token, kreator);
}

// Export config for debugging
export { CONFIG, AUTH };
