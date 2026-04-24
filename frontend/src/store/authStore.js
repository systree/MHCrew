import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { setTimezone } from '../utils/formatters.js';

/**
 * Auth store — persisted to localStorage so the session survives a page reload.
 *
 * Shape:
 *   user            — the crew member object returned by the API after login
 *   token           — JWT access token
 *   isAuthenticated — derived boolean (true when both user and token are set)
 *
 * Actions:
 *   setAuth(user, token, timezone) — called after successful login / token refresh
 *   logout()             — clears state and removes persisted data
 */
const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      timezone: 'Australia/Sydney',
      isAuthenticated: false,

      setAuth: (user, token, timezone) => {
        // Also write the token to localStorage so the Axios interceptor can
        // read it without going through Zustand (avoids circular imports).
        localStorage.setItem('mh_token', token);
        const tz = timezone ?? 'Australia/Sydney';
        setTimezone(tz);
        set({ user, token, timezone: tz, isAuthenticated: true });
      },

      logout: () => {
        localStorage.removeItem('mh_token');
        set({ user: null, token: null, timezone: 'Australia/Sydney', isAuthenticated: false });
      },
    }),
    {
      name: 'mh-auth',                      // localStorage key
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        timezone: state.timezone,
        isAuthenticated: state.isAuthenticated,
      }),
      // Re-sync standalone keys after rehydration
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          localStorage.setItem('mh_token', state.token);
        }
        if (state?.timezone) {
          setTimezone(state.timezone);
        }
      },
    }
  )
);

export default useAuthStore;
