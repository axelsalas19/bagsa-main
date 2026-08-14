// Autenticación con Supabase Auth: login/registro/sesión para operaciones de escritura
import { state } from './state.js';
import { SUPABASE_ALLOW_SIGNUP } from './config.js';
import { showStatus } from './utils.js';

export function isAuthenticated() {
    return !!state.user;
}

export function getUser() {
    return state.user || null;
}

// Listeners que se ejecutan cada vez que cambia el estado de autenticación
const authListeners = [];

/**
 * Registra un callback que se invoca al iniciar/cerrar sesión o restaurar sesión.
 * Sirve para re-renderizar la UI (popups, panel de rutas) sin recargar la página.
 */
export function onAuthChange(cb) {
    if (typeof cb === 'function') authListeners.push(cb);
}

function notifyAuthChange() {
    authListeners.forEach(cb => {
        try { cb(); } catch (e) { console.error('Error en onAuthChange:', e); }
    });
}

function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function setMsg(text, color) {
    const el = document.getElementById('authMsg');
    if (!el) return;
    el.innerHTML = text;
    el.style.color = color || '';
}

function renderAuthUI() {
    const loggedOut = document.getElementById('authLoggedOut');
    const loggedIn = document.getElementById('authLoggedIn');
    const userInfo = document.getElementById('authUserInfo');
    const signupBtn = document.getElementById('authSignupBtn');

    if (signupBtn) signupBtn.style.display = SUPABASE_ALLOW_SIGNUP ? 'inline-block' : 'none';
    if (!loggedOut || !loggedIn) return;

    if (state.user) {
        loggedOut.style.display = 'none';
        loggedIn.style.display = 'block';
        if (userInfo) userInfo.innerHTML = `<strong>👤 ${escapeHtml(state.user.email || '')}</strong>`;
    } else {
        loggedOut.style.display = 'block';
        loggedIn.style.display = 'none';
    }
}

/**
 * Inicializa la autenticación: restaura la sesión, escucha cambios y vincula la UI.
 * Debe llamarse después de crear state.supabaseClient.
 */
export function initAuth() {
    if (!state.supabaseClient) return;

    renderAuthUI();

    state.supabaseClient.auth.getSession()
        .then(({ data }) => {
            console.log('🔑 Sesión restaurada:', data.session ? `usuario ${data.session.user.email}` : 'sin sesión');
            state.user = data.session?.user ?? null;
            renderAuthUI();
            notifyAuthChange();
        })
        .catch(err => console.error('Error restaurando sesión:', err));

    state.supabaseClient.auth.onAuthStateChange((event, session) => {
        console.log('🔑 Auth event:', event, session ? `usuario ${session.user.email}` : 'sin sesión');
        state.user = session?.user ?? null;
        renderAuthUI();
        notifyAuthChange();
    });

    const loginBtn = document.getElementById('authLoginBtn');
    const signupBtn = document.getElementById('authSignupBtn');
    const logoutBtn = document.getElementById('authLogoutBtn');
    const emailInput = document.getElementById('authEmail');
    const passInput = document.getElementById('authPassword');

    if (loginBtn) loginBtn.addEventListener('click', handleLogin);
    if (signupBtn) signupBtn.addEventListener('click', handleSignup);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (emailInput) emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
    if (passInput) passInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
}

async function handleLogin() {
    const email = document.getElementById('authEmail')?.value.trim();
    const password = document.getElementById('authPassword')?.value;
    if (!email || !password) { setMsg('Ingrese email y contraseña.', '#721c24'); return; }

    setMsg('⏳ Iniciando sesión...', '#856404');
    const { data, error } = await state.supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
        console.error('❌ Error de login:', error);
        setMsg('❌ ' + (error.message || 'No se pudo iniciar sesión.'), '#721c24');
        showStatus('❌ No se pudo iniciar sesión: ' + (error.message || ''), 'error');
        return;
    }
    console.log('✅ Login OK. Sesión:', data.session ? 'activa' : 'no devolvió sesión');
    state.user = data.session?.user ?? null;
    renderAuthUI();
    notifyAuthChange();
    setMsg('');
    const pass = document.getElementById('authPassword');
    if (pass) pass.value = '';
    showStatus('✅ Sesión iniciada', 'success');
}

async function handleSignup() {
    if (!SUPABASE_ALLOW_SIGNUP) {
        setMsg('⚠️ El registro está deshabilitado. Contacte al administrador.', '#856404');
        return;
    }
    const email = document.getElementById('authEmail')?.value.trim();
    const password = document.getElementById('authPassword')?.value;
    if (!email || !password) { setMsg('Ingrese email y contraseña para registrarse.', '#721c24'); return; }

    setMsg('⏳ Registrando...', '#856404');
    const { data, error } = await state.supabaseClient.auth.signUp({ email, password });
    if (error) {
        console.error('Error de registro:', error);
        setMsg('❌ ' + (error.message || 'No se pudo registrar.'), '#721c24');
        return;
    }
    if (data.session) {
        showStatus('✅ Cuenta creada e inicio de sesión automático', 'success');
        setMsg('');
    } else {
        setMsg('📧 Cuenta creada. Revise su correo para confirmar y luego inicie sesión.', '#155724');
    }
}

async function handleLogout() {
    const { error } = await state.supabaseClient.auth.signOut();
    if (error) console.error('Error cerrando sesión:', error);
    state.user = null;
    renderAuthUI();
    notifyAuthChange();
    setMsg('');
    showStatus('Sesión cerrada', 'success');
}

/**
 * Guard de escritura: retorna true si hay sesión activa; si no, solicita login.
 */
export function requireAuth() {
    if (state.user) return true;

    showStatus('🔒 Debe iniciar sesión para editar', 'error');
    setMsg('🔒 Inicie sesión para realizar esta operación.', '#856404');
    const section = document.getElementById('authSection');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const emailInput = document.getElementById('authEmail');
    if (emailInput) emailInput.focus();
    return false;
}

// Exponer en window para uso desde consola o llamadas inline
window.initAuth = initAuth;
window.isAuthenticated = isAuthenticated;
