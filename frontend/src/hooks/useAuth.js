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
 *   locations       — [{ locationId, companyName }] for all locations this user belongs to
 *
 * Exposed actions:
 *   sendOtp(phone)                  — request OTP SMS
 *   verifyOtp(phone, otp)           — validate OTP, returns { requiresPinSetup, sessionToken, user, timezone, locations }
 *   setupPin(pin)                   — first-time PIN creation; navigates to /dashboard on success
 *   loginWithPin(phone, pin, locationId?) — PIN login; stores auth state and navigates to /dashboard
 *   switchLocation(locationId)      — reissue JWT for a different location; updates auth store
 *   logout()                        — clears auth state and redirects to login
 */
export default function useAuth() {
  const { user, token, isAuthenticated, locations, setAuth, logout: storeLogout } =
    useAuthStore();
  const navigate = useNavigate();

  /** Step 1: Request OTP for a given phone number (E.164 format). */
  const sendOtp = useCallback(async (phone) => {
    const { data } = await authApi.sendOtp(phone);
    return data;
  }, []);

  /**
   * Step 2: Validate the 6-digit OTP.
   * Always returns a session token (defaulting to the user's first/oldest location).
   * Also returns a `locations` array so the UI can offer a post-login company switcher.
   */
  const verifyOtp = useCallback(async (phone, otp) => {
    const { data } = await authApi.verifyOtp(phone, otp);
    return {
      requiresPinSetup: data.requiresPinSetup ?? false,
      sessionToken: data.sessionToken,
      user: data.user,
      timezone: data.timezone ?? 'Australia/Sydney',
      locations: data.locations ?? [],
    };
  }, []);

  /**
   * Step 3a (new users): Set up a 4-digit PIN.
   * Caller must have already stored sessionToken in the store so the
   * Axios interceptor can send the Authorization header.
   * On success, navigates to /dashboard.
   */
  const setupPin = useCallback(
    async (pin) => {
      await authApi.setupPin(pin);
      navigate('/dashboard', { replace: true });
    },
    [navigate]
  );

  /**
   * Step 3b (returning users): Log in with a 4-digit PIN.
   * locationId is optional but should be passed for multi-location users
   * so the query resolves to the correct crew_users row.
   */
  const loginWithPin = useCallback(
    async (phone, pin, locationId) => {
      const { data } = await authApi.loginWithPin(phone, pin, locationId);
      // Refresh the locations list so PIN re-login picks up newly-added locations.
      // (Passing data.locations directly: if an older backend omits it, setAuth
      //  preserves the existing list rather than wiping it.)
      setAuth(data.user, data.sessionToken, data.timezone, data.locations);
      navigate('/dashboard', { replace: true });
    },
    [setAuth, navigate]
  );

  /**
   * Switch to a different location post-login.
   * Reissues a JWT for the chosen locationId — must be a location the user
   * already belongs to (enforced server-side). Updates the auth store in place.
   */
  const switchLocation = useCallback(
    async (locationId) => {
      const { data } = await authApi.switchLocation(locationId);
      // Preserve existing locations list — it doesn't change when switching
      setAuth(data.user, data.sessionToken, data.timezone);
    },
    [setAuth]
  );

  /** Clear auth and return to login screen. */
  const logout = useCallback(() => {
    api.delete('/notifications/subscriptions').catch(() => {});
    storeLogout();
    navigate('/', { replace: true });
  }, [storeLogout, navigate]);

  return {
    user,
    token,
    isAuthenticated,
    locations,
    sendOtp,
    verifyOtp,
    setupPin,
    loginWithPin,
    switchLocation,
    logout,
  };
}
