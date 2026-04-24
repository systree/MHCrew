import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// In development, unregister any lingering service workers so stale cached
// JS/CSS never masks code changes. The SW is only active in production builds.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
}

// Production: keep the SW up-to-date on Android PWA.
// Android keeps PWAs alive for days without a full page reload, so the default
// "check on navigation" never fires. We force a check:
//   • every 30 minutes (catches background updates)
//   • on visibilitychange (catches the user switching back to the app)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const checkForUpdate = () => {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) reg.update();
    });
  };

  // Periodic check — every 30 minutes
  setInterval(checkForUpdate, 30 * 60 * 1000);

  // Check when app comes back to foreground
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
