import { useEffect, useState, type FormEvent } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  updateProfile,
  type User
} from 'firebase/auth';
import { auth, firebaseConfigured } from '../lib/firebase';
import { publishUserProfile } from '../lib/pulse-data';
import {
  MessageCircle,
  ShieldCheck,
  LoaderCircle,
  Mail,
  LockKeyhole,
  UserRound,
  ArrowLeft,
  Eye,
  EyeOff
} from 'lucide-react';

type AuthMode = 'login' | 'register' | 'reset';

function friendlyError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  const messages: Record<string, string> = {
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/operation-not-allowed': 'This sign-in method is disabled in Firebase. Enable the matching provider in Authentication → Sign-in method and save.',
    'auth/user-not-found': 'No account was found with that email. You can create an account instead.',
    'auth/wrong-password': 'The password is incorrect. Try again or reset your password.',
    'auth/invalid-credential': 'Your email or password is incorrect. Please check and try again.',
    'auth/email-already-in-use': 'An account already exists with this email. Please sign in instead.',
    'auth/weak-password': 'Choose a stronger password with at least 8 characters.',
    'auth/popup-closed-by-user': 'The Google sign-in window was closed before completion.',
    'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow popups and try again.',
    'auth/cancelled-popup-request': 'The Google sign-in request was cancelled. Please try again.',
    'auth/unauthorized-domain': 'This website domain is not authorized in Firebase Authentication.',
    'auth/network-request-failed': 'Network connection failed. Check your internet and try again.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.'
  };
  return messages[code] ?? (error instanceof Error ? error.message : 'Something went wrong. Please try again.');
}

export default function PhoneAuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!auth) {
      setChecking(false);
      return;
    }

    let active = true;

    getRedirectResult(auth).catch(err => {
      if (active) setError(friendlyError(err));
    });

    const unsubscribe = onAuthStateChanged(auth, async nextUser => {
      if (active) {
        setChecking(true);
        setError('');
      }

      try {
        // A real account must have its Firestore profile before entering PULSE.
        if (nextUser) await publishUserProfile(nextUser);

        if (active) setUser(nextUser);
      } catch (err) {
        if (active) {
          setUser(null);
          setError(
            'Your account is signed in, but your PULSE profile could not be synchronized. Check your Firestore rules and connection, then sign in again. ' +
            friendlyError(err)
          );
        }
      } finally {
        if (active) setChecking(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError('');
    setNotice('');
    setPassword('');
  };

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!auth) {
      setError('Firebase is not configured. Check your project environment settings.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    try {
      if (mode === 'register') {
        if (name.trim().length < 2) {
          setError('Please enter your name.');
          setBusy(false);
          return;
        }
        if (password.length < 8) {
          setError('Your password must contain at least 8 characters.');
          setBusy(false);
          return;
        }
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(credential.user, { displayName: name.trim() });
      } else if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await sendPasswordResetEmail(auth, email.trim());
        setNotice('Password reset instructions have been sent to your email address. Check your inbox.');
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!auth) {
      setError('Firebase is not configured. Check your project environment settings.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithRedirect(auth, provider);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="auth-loading">
        <LoaderCircle className="spin" size={28} />
        Preparing PULSE...
      </div>
    );
  }

  if (user) return <>{children}</>;

  const isRegister = mode === 'register';
  const isReset = mode === 'reset';

  return (
    <main className="auth-screen">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />

      <section className="auth-card pulse-auth-card">
        <div className="auth-brand-icon">
          <MessageCircle size={36} strokeWidth={2.6} />
          <span>•••</span>
        </div>
        <div className="auth-brand-name">PULSE</div>
        <p className="auth-tagline">Your people. Your moments. Your world.</p>

        <div className="auth-intro">
          <h1>
            {isRegister ? 'Create your account.' : isReset ? 'Reset your password.' : 'Welcome to PULSE.'}
          </h1>
          <p>
            {isRegister
              ? 'Join your people. Your PULSE journey starts here.'
              : isReset
                ? 'Enter your email and we’ll send you a secure reset link.'
                : 'Sign in and reconnect with your world.'}
          </p>
        </div>

        {!isReset && (
          <>
            <button
              type="button"
              className="pulse-google-button"
              onClick={handleGoogleSignIn}
              disabled={busy || !firebaseConfigured}
            >
              <span className="pulse-google-g">G</span>
              <span>Continue with Google</span>
            </button>

            <div className="pulse-auth-divider">
              <span />
              <small>OR CONTINUE WITH EMAIL</small>
              <span />
            </div>
          </>
        )}

        <form onSubmit={handleEmailAuth} className="auth-form pulse-email-form">
          {isRegister && (
            <>
              <label htmlFor="pulse-name">Your name</label>
              <div className="pulse-field">
                <UserRound size={18} />
                <input
                  id="pulse-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  required
                  minLength={2}
                />
              </div>
            </>
          )}

          <label htmlFor="pulse-email">Email address</label>
          <div className="pulse-field">
            <Mail size={18} />
            <input
              id="pulse-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={event => setEmail(event.target.value)}
              required
            />
          </div>

          {!isReset && (
            <>
              <label htmlFor="pulse-password">Password</label>
              <div className="pulse-field">
                <LockKeyhole size={18} />
                <input
                  id="pulse-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  placeholder={isRegister ? 'At least 8 characters' : 'Enter your password'}
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  required
                  minLength={isRegister ? 8 : 1}
                />
                <button
                  type="button"
                  className="pulse-password-toggle"
                  onClick={() => setShowPassword(value => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </>
          )}

          {error && <p className="auth-error" role="alert">{error}</p>}
          {notice && <p className="pulse-auth-notice" role="status">{notice}</p>}

          <button
            type="submit"
            className="auth-submit"
            disabled={busy || !firebaseConfigured}
          >
            {busy ? <LoaderCircle className="spin" size={18} /> : null}
            {busy
              ? 'Please wait...'
              : isRegister
                ? 'Create account'
                : isReset
                  ? 'Send reset link'
                  : 'Sign in'}
          </button>
        </form>

        {mode === 'login' && (
          <button type="button" className="pulse-text-button pulse-forgot" onClick={() => changeMode('reset')}>
            Forgot password?
          </button>
        )}

        {isReset ? (
          <button type="button" className="auth-back pulse-mode-link" onClick={() => changeMode('login')}>
            <ArrowLeft size={16} /> Back to sign in
          </button>
        ) : (
          <div className="pulse-auth-switch">
            {isRegister ? 'Already have an account?' : 'New to PULSE?'}
            <button type="button" onClick={() => changeMode(isRegister ? 'login' : 'register')}>
              {isRegister ? 'Sign in' : 'Create an account'}
            </button>
          </div>
        )}

        {!firebaseConfigured && (
          <div className="firebase-notice">
            Firebase setup is required. Check that your environment credentials are configured.
          </div>
        )}

        <div className="auth-privacy">
          <ShieldCheck size={15} />
          Your account is protected by Firebase Authentication.
        </div>
        <div className="auth-footer">
          By continuing, you agree to PULSE's Terms and Privacy Policy.
        </div>
      </section>

      <div className="auth-bottom">PULSE <span>·</span> Connect beyond the ordinary.</div>
    </main>
  );
}
