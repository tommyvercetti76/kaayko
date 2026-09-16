/* Kortex sign-in: admin and tenant accounts (Firebase Auth) for the console at
   /admin/kortex. Loaded by kaayko.com/kortex only; kaay.link links here instead
   because the console's session lives on the kaayko.com origin. Needs
   kortex-app.js (CONFIG, $, escapeHtml) and the Firebase compat SDK. */
/* ── FIREBASE ── */
const firebaseConfig = {
  apiKey: "AIzaSyC59ECKLt3rowOoavF76hV_djb--W4jekA",
  authDomain: "kaaykostore.firebaseapp.com",
  projectId: "kaaykostore",
  appId: "1:87383373015:web:ee1ce56d4f5192ec67ec92",
  storageBucket: "kaaykostore.firebasestorage.app",
  messagingSenderId: "87383373015"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
document.getElementById('env-badge').textContent = CONFIG.ENVIRONMENT.charAt(0).toUpperCase() + CONFIG.ENVIRONMENT.slice(1);
/* ── FORGOT PASSWORD ── */
$('forgot-password-link').addEventListener('click', async (e) => {
  e.preventDefault();
  const email = prompt('Enter your email address:');
  if (!email) return;
  try {
    await auth.sendPasswordResetEmail(email);
    showAlert('success', `Reset email sent to ${email}.`);
  } catch (error) {
    showAlert('error', error.code === 'auth/user-not-found' ? 'No account found.' : 'Failed to send reset email.');
  }
});
/* ── LOGIN STATE MACHINE (admin + tenant accounts; unchanged) ── */
let loginState = { user: null, idToken: null, role: null, tenants: [], step: 'credentials' };

/* ── CREATE ACCOUNT (16 Sep 2026): a free workspace owner makes an account,
   claims the workspace with its access code (or starts a new one), and lands
   in the console; with ?plan=pro|business, on the billing view, ready to pay. */
const PARAMS = new URLSearchParams(location.search);
const PLAN = ['pro', 'business'].includes(PARAMS.get('plan')) ? PARAMS.get('plan') : null;
let mode = PARAMS.get('claim') === '1' || PLAN ? 'create' : 'signin';
function applyMode() {
  const create = mode === 'create';
  $('sub-signin').hidden = create; $('sub-create').hidden = !create;
  $('claim-group').hidden = !create; $('org-group').hidden = !create;
  $('login-btn').textContent = create ? 'Create account' : 'Sign In';
  $('mode-toggle').textContent = create ? 'Have an account? Sign in' : 'New here? Create an account';
  $('password').autocomplete = create ? 'new-password' : 'current-password';
  const pl = $('plan-line');
  if (PLAN) { pl.hidden = false; pl.textContent = `${PLAN === 'pro' ? 'Pro, $29 a month' : 'Business, $99 a month'}: ${create ? 'create your account, then pay by card.' : 'sign in, then pay by card.'}`; }
}
$('mode-toggle').addEventListener('click', (e) => { e.preventDefault(); mode = mode === 'create' ? 'signin' : 'create'; hideAlert(); applyMode(); });
applyMode();

function consoleUrl() { return PLAN ? `/admin/kortex?plan=${PLAN}#/billing` : '/admin/kortex'; }

async function handleCreateStep() {
  const email = $('email').value.trim(), password = $('password').value;
  const accessCode = $('claim-code').value.trim(), name = $('org-name').value.trim();
  const loginBtn = $('login-btn'), loading = $('loading'), form = $('login-form');
  if (password.length < 8) { showAlert('error', 'Use a password of at least 8 characters.'); return; }
  if (!accessCode && !name) { showAlert('error', 'Enter the access code of your free workspace, or a name for a new one.'); return; }
  try {
    loginBtn.disabled = true; form.style.display = 'none'; loading.classList.add('show'); hideAlert();
    let user;
    try { user = (await auth.createUserWithEmailAndPassword(email, password)).user; }
    catch (err) {
      if (err.code !== 'auth/email-already-in-use') throw err;
      user = (await auth.signInWithEmailAndPassword(email, password)).user;   // same person, second visit
    }
    const idToken = await user.getIdToken();
    const path = accessCode ? '/kortex/guest/claim' : '/kortex/tenants/provision';
    const body = accessCode ? { accessCode, name: name || undefined } : { organization: name };
    const res = await fetch(`${CONFIG.API_BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok && data.code !== 'ALREADY_HAS_TENANT' && data.code !== 'ALREADY_PROVISIONED') throw new Error(data.error || 'Could not set up the workspace.');
    try { await user.sendEmailVerification(); } catch (_) { /* optional */ }
    const fresh = await user.getIdToken(true);                     // the role claim is on it now
    const tenantId = (data.tenant && data.tenant.id) || (data.profile && data.profile.tenantId) || null;
    localStorage.setItem('kaayko_auth_token', fresh);
    localStorage.setItem('kaayko_user', JSON.stringify({ uid: user.uid, email: user.email, displayName: user.email.split('@')[0], role: 'admin', emailVerified: user.emailVerified, requireEmailVerification: true, tenantId, tenantName: (data.tenant && data.tenant.name) || name || tenantId }));
    if (tenantId) localStorage.setItem('kaayko_tenant_id', tenantId);
    localStorage.setItem('kaayko_environment', CONFIG.ENVIRONMENT);
    showAlert('success', accessCode ? 'Workspace claimed. Opening the console…' : 'Workspace made. Opening the console…');
    setTimeout(() => { window.location.href = consoleUrl(); }, 800);
  } catch (error) {
    const msgs = { 'auth/invalid-email': 'That email does not look right.', 'auth/weak-password': 'Use a stronger password.', 'auth/wrong-password': 'That email already has an account and the password did not match. Sign in instead.', 'auth/too-many-requests': 'Too many attempts. Try later.' };
    showAlert('error', msgs[error.code] || error.message || 'Could not create the account.');
    loginBtn.disabled = false; form.style.display = ''; loading.classList.remove('show');
  }
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (mode === 'create' && loginState.step === 'credentials') await handleCreateStep();
  else if (loginState.step === 'credentials') await handleCredentialsStep();
  else if (loginState.step === 'tenant-selection') await handleTenantSelectionStep();
});

async function handleCredentialsStep() {
  const email = $('email').value;
  const password = $('password').value;
  const loginBtn = $('login-btn');
  const loading = $('loading');
  const form = $('login-form');
  try {
    loginBtn.disabled = true; form.style.display = 'none'; loading.classList.add('show'); hideAlert();
    const cred = await auth.signInWithEmailAndPassword(email, password);
    const user = cred.user;
    const idToken = await user.getIdToken();
    const role = (await user.getIdTokenResult()).claims.role;
    if (!role || !['super-admin','admin','editor','viewer'].includes(role)) throw new Error('Access denied. Admin role required.');
    loginState = { ...loginState, user, idToken, role };
    await fetchUserTenants(idToken, user.uid, role);
    loginState.step = 'tenant-selection';
    showTenantSelection();
    loginBtn.disabled = false; form.style.display = ''; loading.classList.remove('show');
  } catch (error) {
    const msgs = { 'auth/user-not-found':'No account found.', 'auth/wrong-password':'Incorrect password.',
      'auth/invalid-email':'Invalid email.', 'auth/too-many-requests':'Too many attempts. Try later.' };
    showAlert('error', msgs[error.code] || error.message || 'Login failed.');
    loginBtn.disabled = false; form.style.display = ''; loading.classList.remove('show');
  }
}

async function fetchUserTenants(idToken, uid, role) {
  try {
    const res = await fetch(`${CONFIG.API_BASE}/kortex/tenants`, { headers: { 'Authorization': `Bearer ${idToken}` } });
    if (!res.ok) throw new Error();
    const data = await res.json();
    loginState.tenants = (data.success && data.tenants?.length) ? data.tenants : [{ id:'kaayko-default', name:'Kaayko (Default)' }];
    loginState.requireEmailVerification = data.profile?.requireEmailVerification === true;
  } catch { loginState.tenants = [{ id:'kaayko-default', name:'Kaayko (Default)' }]; }
}

function showTenantSelection() {
  $('email').parentElement.style.display = 'none';
  $('password').parentElement.style.display = 'none';
  $('tenant-selection-group').style.display = 'block';
  const sel = $('tenant');
  sel.innerHTML = '';
  if (loginState.tenants.length === 1 && loginState.role !== 'super-admin') {
    const t = loginState.tenants[0];
    sel.innerHTML = `<option value="${escapeHtml(t.id)}" selected>${escapeHtml(t.name)}</option>`;
    showAlert('success', `Signing in to ${t.name}…`);
    setTimeout(() => handleTenantSelectionStep(), 400);
    return;
  }
  sel.innerHTML = '<option value="">Select a tenant</option>';
  loginState.tenants.forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name; sel.appendChild(o); });
  $('login-btn').textContent = 'Continue to Dashboard';
  showAlert('success', `Signed in as ${loginState.role === 'super-admin' ? 'Super Admin' : loginState.role.charAt(0).toUpperCase() + loginState.role.slice(1)}. Select your tenant.`);
}

async function handleTenantSelectionStep() {
  const tenantId = $('tenant').value;
  if (!tenantId) { showAlert('error', 'Please select a tenant'); return; }
  const loginBtn = $('login-btn');
  const loading = $('loading');
  const form = $('login-form');
  try {
    loginBtn.disabled = true; form.style.display = 'none'; loading.classList.add('show'); hideAlert();
    const tenant = loginState.tenants.find(t => t.id === tenantId);
    localStorage.setItem('kaayko_auth_token', loginState.idToken);
    localStorage.setItem('kaayko_user', JSON.stringify({
      uid: loginState.user.uid, email: loginState.user.email,
      displayName: loginState.user.displayName || loginState.user.email.split('@')[0],
      role: loginState.role, emailVerified: loginState.user.emailVerified,
      requireEmailVerification: loginState.requireEmailVerification === true,
      tenantId, tenantName: tenant?.name || tenantId
    }));
    localStorage.setItem('kaayko_tenant_id', tenantId);
    localStorage.setItem('kaayko_environment', CONFIG.ENVIRONMENT);
    showAlert('success', `Redirecting to ${tenant?.name || tenantId}…`);
    setTimeout(() => { window.location.href = consoleUrl(); }, 800);
    setTimeout(() => {
      if ($('loading').classList.contains('show')) {
        showAlert('error', 'Redirect timed out.');
        loading.classList.remove('show'); form.style.display = ''; loginBtn.disabled = false;
        loginBtn.textContent = 'Go to Dashboard';
        loginBtn.onclick = () => { window.location.href = '/admin/kortex'; };
      }
    }, 6000);
  } catch {
    showAlert('error', 'Something went wrong.'); loginBtn.disabled = false; form.style.display = ''; loading.classList.remove('show');
  }
}

function showAlert(type, msg) { const el = $('alert'); el.className = `alert ${type} show`; el.textContent = msg; }
function hideAlert() { const el = $('alert'); el.className = 'alert'; el.textContent = ''; }

/* ── AUTH STATE ── */
auth.onAuthStateChanged(async (user) => {
  if (user) {
    const t = localStorage.getItem('kaayko_auth_token');
    const n = localStorage.getItem('kaayko_tenant_id');
    if (t && n) {
      try {
        localStorage.setItem('kaayko_auth_token', await user.getIdToken(true));
        const nav = $('nav-auth-link');
        if (nav) { nav.textContent = 'Dashboard'; nav.href = '/admin/kortex'; }
        const hero = $('hero-auth-btn');
        if (hero) { hero.textContent = 'Dashboard'; hero.href = '/admin/kortex'; }
        const lp = $('login'); if (lp) lp.style.display = 'none';
        const dv = document.querySelector('.connect-divider'); if (dv) dv.style.display = 'none';
        return;
      } catch {
        localStorage.removeItem('kaayko_auth_token');
        localStorage.removeItem('kaayko_user');
        localStorage.removeItem('kaayko_tenant_id');
      }
    }
  }
  $('login-form').style.display = '';
  $('loading').classList.remove('show');
  $('login-btn').disabled = false;
});
