import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth.js';
import useAuthStore from '../store/authStore.js';

/**
 * LoginPage
 *
 * Four-step authentication flow:
 *   Step 1  — Phone number entry  → "Send Code"
 *   Step 2  — 6-digit OTP boxes   → auto-submit / paste / resend
 *   Step 3a — PIN SETUP (new)     — enter PIN then confirm it
 *   Step 3b — PIN LOGIN (returning) — 4 dot inputs, auto-submit
 */

const STEP = {
  PHONE:       'PHONE',
  OTP:         'OTP',
  PIN_LOGIN:   'PIN_LOGIN',
  PIN_SETUP:   'PIN_SETUP',
  PIN_CONFIRM: 'PIN_CONFIRM',
};

/**
 * Normalise an Australian mobile number to E.164 (+61xxxxxxxxx).
 * Accepts:  04xxxxxxxx  /  +614xxxxxxxx  /  614xxxxxxxx
 * Returns null when the input doesn't look like a valid AU mobile.
 */
function normaliseAuPhone(raw) {
  const cleaned = raw.replace(/[\s\-().]/g, '');
  // Already E.164 (+61 followed by 9 digits)
  if (/^\+61[0-9]{9}$/.test(cleaned)) return cleaned;
  // 614xxxxxxxx (missing leading +)
  if (/^614\d{8}$/.test(cleaned)) return `+${cleaned}`;
  // 04xxxxxxxx (local format)
  if (/^04\d{8}$/.test(cleaned)) return `+61${cleaned.slice(1)}`;
  return null;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { setAuth } = useAuthStore();
  const { sendOtp, verifyOtp, setupPin, loginWithPin } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const [step, setStep]               = useState(STEP.PHONE);
  const [phone, setPhone]             = useState('');
  const [e164Phone, setE164Phone]     = useState('');
  const [otp, setOtp]                 = useState(['', '', '', '', '', '']);
  const [pin, setPin]                 = useState(['', '', '', '']);
  const [pinConfirm, setPinConfirm]   = useState(['', '', '', '']);
  const [firstPin, setFirstPin]       = useState('');   // stash after first entry during setup
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [resendCountdown, setCountdown] = useState(0);

  const otpRefs        = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];
  const pinRefs        = [useRef(), useRef(), useRef(), useRef()];
  const pinConfirmRefs = [useRef(), useRef(), useRef(), useRef()];

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  /* ---- Helpers ---- */

  const handleError = (err) => {
    setError(
      err?.response?.data?.error ??
      err?.response?.data?.message ??
      err?.message ??
      'Something went wrong. Please try again.'
    );
  };

  const clearPin     = () => setPin(['', '', '', '']);
  const clearConfirm = () => setPinConfirm(['', '', '', '']);

  /* ====================================================== */
  /*  Step 1: Phone                                         */
  /* ====================================================== */

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');

    const normalised = normaliseAuPhone(phone);
    if (!normalised) {
      setError('Please enter a valid Australian mobile number (e.g. 0412 345 678).');
      return;
    }

    setLoading(true);
    try {
      await sendOtp(normalised);
      setE164Phone(normalised);
      setStep(STEP.OTP);
      setCountdown(60);
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  /* ====================================================== */
  /*  Step 2: OTP                                           */
  /* ====================================================== */

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) otpRefs[index + 1].current?.focus();
    if (value && index === 5 && next.every((d) => d !== '')) {
      handleVerifyOtp(next.join(''));
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setOtp(text.split(''));
      handleVerifyOtp(text);
    }
    e.preventDefault();
  };

  const handleVerifyOtp = async (code) => {
    setError('');
    setLoading(true);
    try {
      const { requiresPinSetup, sessionToken, user, timezone } = await verifyOtp(e164Phone, code);

      // Pre-load the store with the session token so the protected
      // /auth/setup-pin call will have an Authorization header.
      setAuth(user, sessionToken, timezone);

      if (requiresPinSetup) {
        setStep(STEP.PIN_SETUP);
        setTimeout(() => pinRefs[0].current?.focus(), 100);
      } else {
        setStep(STEP.PIN_LOGIN);
        setTimeout(() => pinRefs[0].current?.focus(), 100);
      }
    } catch (err) {
      handleError(err);
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => otpRefs[0].current?.focus(), 50);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0) return;
    setError('');
    setLoading(true);
    try {
      await sendOtp(e164Phone);
      setOtp(['', '', '', '', '', '']);
      setCountdown(60);
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  /* ====================================================== */
  /*  Step 3b: PIN Login                                    */
  /* ====================================================== */

  const handlePinLoginChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...pin];
    next[index] = value.slice(-1);
    setPin(next);
    if (value && index < 3) pinRefs[index + 1].current?.focus();
    if (value && index === 3 && next.every((d) => d !== '')) {
      handleSubmitPinLogin(next.join(''));
    }
  };

  const handlePinLoginKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinRefs[index - 1].current?.focus();
    }
  };

  const handleSubmitPinLogin = async (code) => {
    setError('');
    setLoading(true);
    try {
      await loginWithPin(e164Phone, code);
      // Navigation handled inside useAuth
    } catch (err) {
      handleError(err);
      clearPin();
      setTimeout(() => pinRefs[0].current?.focus(), 50);
    } finally {
      setLoading(false);
    }
  };

  /* ====================================================== */
  /*  Step 3a: PIN Setup — first entry                      */
  /* ====================================================== */

  const handlePinSetupChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...pin];
    next[index] = value.slice(-1);
    setPin(next);
    if (value && index < 3) pinRefs[index + 1].current?.focus();
    if (value && index === 3 && next.every((d) => d !== '')) {
      // Stash and move to confirmation
      setFirstPin(next.join(''));
      clearPin();
      setStep(STEP.PIN_CONFIRM);
      setTimeout(() => pinConfirmRefs[0].current?.focus(), 100);
    }
  };

  const handlePinSetupKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinRefs[index - 1].current?.focus();
    }
  };

  /* ====================================================== */
  /*  Step 3a: PIN Setup — confirmation entry               */
  /* ====================================================== */

  const handlePinConfirmChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...pinConfirm];
    next[index] = value.slice(-1);
    setPinConfirm(next);
    if (value && index < 3) pinConfirmRefs[index + 1].current?.focus();
    if (value && index === 3 && next.every((d) => d !== '')) {
      handleSubmitPinSetup(next.join(''));
    }
  };

  const handlePinConfirmKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pinConfirm[index] && index > 0) {
      pinConfirmRefs[index - 1].current?.focus();
    }
  };

  const handleSubmitPinSetup = async (confirmCode) => {
    setError('');
    if (confirmCode !== firstPin) {
      setError('PINs do not match. Please try again.');
      clearConfirm();
      // Go back to first entry
      setFirstPin('');
      clearPin();
      setStep(STEP.PIN_SETUP);
      setTimeout(() => pinRefs[0].current?.focus(), 50);
      return;
    }
    setLoading(true);
    try {
      await setupPin(firstPin);
      // Navigation handled inside useAuth
    } catch (err) {
      handleError(err);
      clearConfirm();
      setFirstPin('');
      clearPin();
      setStep(STEP.PIN_SETUP);
      setTimeout(() => pinRefs[0].current?.focus(), 50);
    } finally {
      setLoading(false);
    }
  };

  /* ====================================================== */
  /*  Render                                                */
  /* ====================================================== */

  return (
    <div style={styles.root}>
      {/* Logo / brand area */}
      <div style={styles.brand}>
        <div style={styles.logoMark}>
          <span style={{ fontSize: 28, fontWeight: 900 }}>MH</span>
        </div>
        <h1 style={styles.brandName}>Mover Hero</h1>
        <p style={styles.brandSub}>Crew Portal</p>
      </div>

      {/* Card */}
      <div style={styles.card}>

        {/* ---- Step 1: Phone ---- */}
        {step === STEP.PHONE && (
          <form onSubmit={handleSendOtp} style={styles.form}>
            <div style={styles.stepHeader}>
              <h2 style={styles.stepTitle}>Sign in</h2>
              <p style={styles.stepDesc}>Enter your mobile number to receive a one-time code.</p>
            </div>

            <div style={styles.fieldGroup}>
              <label htmlFor="phone" style={styles.label}>Mobile number</label>
              <div style={styles.phoneInputWrapper}>
                <span style={styles.phonePrefix}>+61</span>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="412 345 678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                  autoFocus
                  style={styles.phoneInput}
                />
              </div>
              <p style={styles.hint}>Australian mobile numbers only (e.g. 0412 345 678)</p>
            </div>

            {error && <p style={styles.error}>{error}</p>}

            <button type="submit" className="btn-primary" disabled={loading || !phone.trim()}>
              {loading
                ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                : 'Send Code'}
            </button>
          </form>
        )}

        {/* ---- Step 2: OTP ---- */}
        {step === STEP.OTP && (
          <div style={styles.form}>
            <div style={styles.stepHeader}>
              <h2 style={styles.stepTitle}>Check your phone</h2>
              <p style={styles.stepDesc}>
                We sent a 6-digit code to{' '}
                <strong style={{ color: 'var(--color-text)' }}>{e164Phone}</strong>
              </p>
            </div>

            <div style={styles.otpRow} onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={otpRefs[i]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  disabled={loading}
                  aria-label={`OTP digit ${i + 1}`}
                  style={styles.otpInput}
                />
              ))}
            </div>

            {error && <p style={styles.error}>{error}</p>}

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                <span className="spinner" />
              </div>
            )}

            <button
              type="button"
              className="btn-ghost"
              onClick={handleResendOtp}
              disabled={resendCountdown > 0 || loading}
              style={{ ...styles.resendBtn, opacity: resendCountdown > 0 ? 0.5 : 1 }}
            >
              {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend code'}
            </button>

            <button
              type="button"
              className="btn-ghost"
              onClick={() => { setStep(STEP.PHONE); setError(''); setOtp(['', '', '', '', '', '']); }}
              style={styles.backBtn}
            >
              ← Change number
            </button>
          </div>
        )}

        {/* ---- Step 3b: PIN Login ---- */}
        {step === STEP.PIN_LOGIN && (
          <div style={styles.form}>
            <div style={styles.stepHeader}>
              <h2 style={styles.stepTitle}>Enter your PIN</h2>
              <p style={styles.stepDesc}>Enter your 4-digit PIN to access your account.</p>
            </div>

            <PinDots pin={pin} />

            <div style={styles.pinRow}>
              {pin.map((digit, i) => (
                <input
                  key={i}
                  ref={pinRefs[i]}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinLoginChange(i, e.target.value)}
                  onKeyDown={(e) => handlePinLoginKeyDown(i, e)}
                  disabled={loading}
                  aria-label={`PIN digit ${i + 1}`}
                  style={styles.pinInput}
                />
              ))}
            </div>

            {error && <p style={styles.error}>{error}</p>}

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                <span className="spinner" />
              </div>
            )}

            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setStep(STEP.OTP);
                setError('');
                clearPin();
                setOtp(['', '', '', '', '', '']);
              }}
              style={styles.backBtn}
            >
              ← Use OTP instead
            </button>
          </div>
        )}

        {/* ---- Step 3a: PIN Setup — enter new PIN ---- */}
        {step === STEP.PIN_SETUP && (
          <div style={styles.form}>
            <div style={styles.stepHeader}>
              <h2 style={styles.stepTitle}>Create your PIN</h2>
              <p style={styles.stepDesc}>
                Choose a 4-digit PIN. You&rsquo;ll use this every time you sign in.
              </p>
            </div>

            <PinDots pin={pin} />

            <div style={styles.pinRow}>
              {pin.map((digit, i) => (
                <input
                  key={i}
                  ref={pinRefs[i]}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinSetupChange(i, e.target.value)}
                  onKeyDown={(e) => handlePinSetupKeyDown(i, e)}
                  disabled={loading}
                  aria-label={`New PIN digit ${i + 1}`}
                  style={styles.pinInput}
                />
              ))}
            </div>

            {error && <p style={styles.error}>{error}</p>}
          </div>
        )}

        {/* ---- Step 3a: PIN Setup — confirm PIN ---- */}
        {step === STEP.PIN_CONFIRM && (
          <div style={styles.form}>
            <div style={styles.stepHeader}>
              <h2 style={styles.stepTitle}>Confirm your PIN</h2>
              <p style={styles.stepDesc}>Enter your new 4-digit PIN one more time to confirm.</p>
            </div>

            <PinDots pin={pinConfirm} />

            <div style={styles.pinRow}>
              {pinConfirm.map((digit, i) => (
                <input
                  key={i}
                  ref={pinConfirmRefs[i]}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinConfirmChange(i, e.target.value)}
                  onKeyDown={(e) => handlePinConfirmKeyDown(i, e)}
                  disabled={loading}
                  aria-label={`Confirm PIN digit ${i + 1}`}
                  style={styles.pinInput}
                />
              ))}
            </div>

            {error && <p style={styles.error}>{error}</p>}

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                <span className="spinner" />
              </div>
            )}

            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setFirstPin('');
                clearPin();
                clearConfirm();
                setError('');
                setStep(STEP.PIN_SETUP);
                setTimeout(() => pinRefs[0].current?.focus(), 100);
              }}
              style={styles.backBtn}
            >
              ← Start over
            </button>
          </div>
        )}

      </div>

      <p style={styles.footer}>Mover Hero Crew · Field App</p>
    </div>
  );
}

/* ---- PIN dot indicator ---- */

function PinDots({ pin }) {
  return (
    <div style={dotStyles.row} aria-hidden="true">
      {pin.map((digit, i) => (
        <span
          key={i}
          style={{
            ...dotStyles.dot,
            backgroundColor: digit
              ? 'var(--color-primary)'
              : 'var(--color-surface-2)',
            border: digit
              ? '2px solid var(--color-primary)'
              : '2px solid var(--color-border)',
          }}
        />
      ))}
    </div>
  );
}

const dotStyles = {
  row: {
    display: 'flex',
    gap: 16,
    justifyContent: 'center',
    marginBottom: 4,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: '50%',
    transition: 'background-color 0.15s ease, border-color 0.15s ease',
  },
};

/* ---- Styles (inline to keep the file self-contained) ---- */

const styles = {
  root: {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 20px',
    background: 'radial-gradient(ellipse at top, #1a1a2e 0%, #0f0f1a 70%)',
  },
  brand: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 32,
    gap: 6,
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 18,
    background: 'linear-gradient(135deg, #e94560, #c73652)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    marginBottom: 8,
    boxShadow: '0 8px 24px rgba(233,69,96,0.4)',
  },
  brandName: {
    fontSize: 26,
    fontWeight: 800,
    color: 'var(--color-text)',
    letterSpacing: '-0.5px',
  },
  brandSub: {
    fontSize: 13,
    color: 'var(--color-text-muted)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '28px 24px',
    boxShadow: 'var(--shadow-lg)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  stepHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  stepTitle: {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 700,
    color: 'var(--color-text)',
  },
  stepDesc: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-muted)',
    lineHeight: 1.5,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
  },
  hint: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-dim)',
    marginTop: 2,
  },
  phoneInputWrapper: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'var(--color-surface-2)',
    border: '1.5px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
  },
  phonePrefix: {
    padding: '0 10px 0 12px',
    fontSize: 'var(--font-size-base)',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
    borderRight: '1px solid var(--color-border)',
    lineHeight: '44px',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  },
  phoneInput: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    padding: '0 12px',
    fontSize: 'var(--font-size-base)',
    color: 'var(--color-text)',
    outline: 'none',
    height: 44,
  },
  error: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--status-cancelled)',
    backgroundColor: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 12px',
    lineHeight: 1.4,
  },
  otpRow: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
  },
  otpInput: {
    width: 44,
    height: 52,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: 700,
    backgroundColor: 'var(--color-surface-2)',
    border: '1.5px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text)',
    caretColor: 'var(--color-primary)',
    outline: 'none',
    padding: 0,
    WebkitAppearance: 'none',
    appearance: 'none',
  },
  pinRow: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
  },
  pinInput: {
    width: 56,
    height: 60,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: 700,
    backgroundColor: 'var(--color-surface-2)',
    border: '1.5px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text)',
    caretColor: 'var(--color-primary)',
    outline: 'none',
    padding: 0,
    WebkitAppearance: 'none',
    appearance: 'none',
    letterSpacing: '0.1em',
  },
  resendBtn: {
    textAlign: 'center',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-primary)',
    background: 'none',
    border: 'none',
    padding: '4px 0',
    cursor: 'pointer',
    fontWeight: 600,
  },
  backBtn: {
    textAlign: 'center',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-muted)',
    background: 'none',
    border: 'none',
    padding: '4px 0',
    cursor: 'pointer',
  },
  footer: {
    marginTop: 32,
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-dim)',
    textAlign: 'center',
  },
};
