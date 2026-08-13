import { useCallback, useEffect, useRef, useState } from 'react';
import { clearCache } from '../lib/apiCache.js';
import { AuthContext } from './useAuth.js';

const STORAGE_KEY = 'ptp_auth';
const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please log in again.';

async function parseResponse(response) {
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text || 'Something went wrong.' };
  }
  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong.');
  }
  return data;
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (auth) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [auth]);

  // Read through a ref so authFetch keeps a stable identity and can safely sit in effect
  // dependency arrays without re-firing every render.
  const authRef = useRef(auth);
  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  // Drop every cached response when the signed-in account changes. Handling it here covers all
  // the ways that happens - login, email verification, password reset, logout, and authFetch
  // clearing an expired session on a 401 - instead of remembering to call it at each one.
  const accountKey = auth?.user?.email ?? null;
  const previousAccountKey = useRef(accountKey);
  useEffect(() => {
    if (previousAccountKey.current === accountKey) return;
    previousAccountKey.current = accountKey;
    clearCache();
  }, [accountKey]);

  /**
   * fetch() for endpoints that require a login: attaches the bearer token, and treats a 401 as
   * "this session is over" by clearing it.
   *
   * Without this, an expired token would leave isAuthenticated stuck at true - the UI keeps
   * rendering as signed in while every protected request quietly fails in a console.error.
   * Tokens last 2h, so this is a routine path, not a corner case.
   */
  const authFetch = useCallback(async (url, options = {}) => {
    const token = authRef.current?.token;
    const headers = { ...(options.headers || {}) };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      setAuth(null);
      throw new Error(SESSION_EXPIRED_MESSAGE);
    }

    return response;
  }, []);

  const post = async (url, body) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return parseResponse(response);
  };

  // Signup does not establish a session - the account is unverified until a code from the
  // inbox is accepted, and the API refuses to authenticate an unverified user anyway.
  const signup = (username, email, password) => post('/api/auth/signup', { username, email, password });
  const resendCode = (email) => post('/api/auth/resend-code', { email });
  const requestPasswordReset = (email) => post('/api/auth/request-password-reset', { email });

  // These three each end with the server handing back { token, user }, because each one has
  // proven control of the account: a correct password, a code from the inbox, or both.
  const establish = async (url, body) => {
    const data = await post(url, body);
    setAuth(data);
    return data;
  };

  const login = (email, password) => establish('/api/auth/login', { email, password });
  const verifyEmail = (email, code) => establish('/api/auth/verify-email', { email, code });
  const resetPassword = (email, code, newPassword) =>
    establish('/api/auth/reset-password', { email, code, newPassword });

  const logout = () => setAuth(null);

  const value = {
    user: auth?.user || null,
    token: auth?.token || null,
    isAuthenticated: !!auth?.token,
    isAdmin: !!auth?.user?.isAdmin,
    authFetch,
    signup,
    verifyEmail,
    resendCode,
    login,
    logout,
    requestPasswordReset,
    resetPassword
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
