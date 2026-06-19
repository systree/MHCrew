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
 *   setAuth(user, token, timezone, locations?) — called after successful login / token refresh
 *   logout()             — clears state and removes persisted data
 */
const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      timezone: 'Australia/Sydney',
      isAuthenticated: false,
      locations: [],   // [{ locationId, companyName }] — set on login, used by profile switcher

      // locations param is optional — omitting it preserves the existing list
      setAuth: (user, token, timezone, locations) => {
        // Also write the token to localStorage so the Axios interceptor can
        // read it without going through Zustand (avoids circular imports).
        localStorage.setItem('mh_token', token);
        const tz = timezone ?? 'Australia/Sydney';
        setTimezone(tz);
        set((state) => ({
          user,
          token,
          timezone: tz,
          isAuthenticated: true,
          locations: locations ?? state.locations,
        }));
      },

      logout: () => {
        localStorage.removeItem('mh_token');
        set({ user: null, token: null, timezone: 'Australia/Sydney', isAuthenticated: false, locations: [] });
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
        locations: state.locations,
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
