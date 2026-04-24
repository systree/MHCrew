import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';

/**
 * BottomNav
 *
 * Fixed mobile bottom navigation bar.
 * Admin users see an extra "Admin" tab that links to /admin.
 * Highlights the active route using react-router NavLink's active class.
 */

const CREW_NAV_ITEMS = [
  {
    to: '/dashboard',
    label: 'Jobs',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
  },
  {
    to: '/profile',
    label: 'Profile',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

const ADMIN_NAV_ITEM = {
  to: '/admin',
  label: 'Admin',
  icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  // Admin tab is active for any /admin path
  matchPrefix: '/admin',
};

export default function BottomNav() {
  const user     = useAuthStore((s) => s.user);
  const location = useLocation();

  const isAdmin   = user?.role === 'admin';
  const navItems  = isAdmin ? [...CREW_NAV_ITEMS, ADMIN_NAV_ITEM] : CREW_NAV_ITEMS;

  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
        backgroundColor: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'stretch',
        zIndex: 100,
        boxShadow: '0 -4px 16px rgba(0,0,0,0.4)',
      }}
    >
      {navItems.map(({ to, label, icon, matchPrefix }) => {
        // For items with a matchPrefix (like /admin), check if the current
        // path starts with it so all sub-pages keep the tab highlighted.
        const isActiveOverride = matchPrefix
          ? location.pathname.startsWith(matchPrefix)
          : undefined;

        return (
          <NavLink
            key={to}
            to={to}
            end={!matchPrefix}              // exact match for crew items
            style={({ isActive: routerActive }) => {
              const isActive = isActiveOverride !== undefined ? isActiveOverride : routerActive;
              return {
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                textDecoration: 'none',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                transition: 'color var(--transition-fast)',
                padding: '8px 0',
                position: 'relative',
              };
            }}
          >
            {({ isActive: routerActive }) => {
              const isActive = isActiveOverride !== undefined ? isActiveOverride : routerActive;
              return (
                <>
                  {/* Active indicator bar */}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: '25%',
                        right: '25%',
                        height: 2,
                        backgroundColor: 'var(--color-primary)',
                        borderRadius: '0 0 2px 2px',
                      }}
                    />
                  )}
                  {icon}
                  <span>{label}</span>
                </>
              );
            }}
          </NavLink>
        );
      })}
    </nav>
  );
}
