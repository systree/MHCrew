import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';
import { authApi } from '../services/api.js';
import api from '../services/api.js';

/**
 * useAuth
 *
 * Provides auth state and all login/logout actions to UI components.
 * Delegates persistence to the Zustand authStore.
 *
 * Exposed values:
 *   user            — crew member object (null when logged out)
 *   token           — JWT string (null when logged out)
 *   isAuthenticated — boolean
 *
 * Exposed actions:
 *   sendOtp(phone)           — request OTP SMS
 *   verifyOtp(phone, otp)    — validate OTP, returns { requiresPinSetup, sessionToken, user }
 *   setupPin(pin)            — first-time PIN creation; stores auth state on success
 *   loginWithPin(phone, pin) — PIN login; stores auth state on success
 *   logout()                 — clears auth state and redirects to login
 */
export default function useAuth() {
  const { user, token, isAuthenticated, setAuth, logout: storeLogout } =
    useAuthStore();
  const navigate = useNavigate();

  /**
   * Step 1: Request OTP for a given phone number.
   * Phone should already be in E.164 format (e.g. +61412345678).
   */
  const sendOtp = useCallback(async (phone) => {
    const { data } = await authApi.sendOtp(phone);
    return data; // { message: 'OTP sent' }
  }, []);

  /**
   * Step 2: Validate the 6-digit OTP.
   * Returns { requiresPinSetup, sessionToken, user } from the backend.
   * The caller is responsible for storing the sessionToken when PIN setup
   * is required (so the protected /setup-pin route can be called).
   */
  const verifyOtp = useCallback(async (phone, otp) => {
    const { data } = await authApi.verifyOtp(phone, otp);
    // data = { requiresPinSetup: bool, sessionToken: string, user: object, timezone: string }
    return {
      requiresPinSetup: data.requiresPinSetup ?? false,
      sessionToken: data.sessionToken,
      user: data.user,
      timezone: data.timezone ?? 'Australia/Sydney',
    };
  }, []);

  /**
   * Step 3a (new users): Set up a 4-digit PIN.
   * The caller must have already stored sessionToken in the store so
   * the Axios interceptor can send the Authorization header.
   * On success, navigates to /dashboard.
   */
  const setupPin = useCallback(
    async (pin) => {
      await authApi.setupPin(pin);
      // Token + user are already in the store (set by verifyOtp flow)
      navigate('/dashboard', { replace: true });
    },
    [navigate]
  );

  /**
   * Step 3b (returning users): Log in with a 4-digit PIN.
   * On success, stores auth state and navigates to /dashboard.
   */
  const loginWithPin = useCallback(
    async (phone, pin) => {
      const { data } = await authApi.loginWithPin(phone, pin);
      setAuth(data.user, data.sessionToken, data.timezone);
      navigate('/dashboard', { replace: true });
    },
    [setAuth, navigate]
  );

  /** Clear auth and return to login screen */
  const logout = useCallback(() => {
    // Fire-and-forget: remove push subscriptions from the backend before
    // clearing the JWT so the Authorization header is still present.
    api.delete('/notifications/subscriptions').catch(() => {});

    storeLogout();
    navigate('/', { replace: true });
  }, [storeLogout, navigate]);

  return {
    user,
    token,
    isAuthenticated,
    sendOtp,
    verifyOtp,
    setupPin,
    loginWithPin,
    logout,
  };
}
