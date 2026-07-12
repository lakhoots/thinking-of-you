import { useState } from 'react';
import { supabase } from '../lib/supabase';
import styles from './SignIn.module.css';

export default function SignIn() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      }
      // Success unmounts this view without a real navigation. Give Safari's
      // save-password heuristic its two strongest SPA signals: end the form
      // session (blur) and record a same-document navigation (pushState) —
      // WebKit treats the latter as "login completed, offer to save".
      document.activeElement?.blur?.();
      window.history.pushState(null, '', window.location.href);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.title}>Made Me Think<br />of You</div>
        <div className={styles.sub}>
          A quiet place for two people, across distance.
        </div>

        <form className={styles.form} onSubmit={submit}>
          <label className={styles.label}>Email</label>
          {/* autoComplete="username" (not "email") is what iOS keys saved
              credentials to — with "email" Safari treats the form as a
              sign-up and only ever offers a new strong password. */}
          <input
            className={styles.input}
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@somewhere.com"
            required
            autoComplete="username"
          />

          <label className={styles.label}>Password</label>
          {/* key={mode} remounts the field when toggling sign-in/sign-up so
              Safari re-reads the autocomplete hint — it classifies the field
              once and ignores attribute changes on a live input. */}
          <input
            key={mode}
            className={styles.input}
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />

          {error && <div className={styles.error}>{error}</div>}

          <button className={styles.cta} disabled={busy} type="submit">
            {busy ? '…' : mode === 'signin' ? 'Sign in →' : 'Create account →'}
          </button>
        </form>

        <button
          className={styles.toggle}
          onClick={() => setMode((m) => (m === 'signin' ? 'signup' : 'signin'))}
        >
          {mode === 'signin' ? 'Create an account' : 'Already have an account'}
        </button>
      </div>
    </div>
  );
}
