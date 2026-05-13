import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import StepIdentity from './Onboarding/StepIdentity';
import styles from './Onboarding/Onboarding.module.css';

export default function InviteAccept({ user, profile, onComplete }) {
  const { token } = useParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState('init'); // init | identity | joining | done | error
  const [error, setError] = useState(null);

  // On mount: stash the token so post-signin we can resume here, then decide next.
  useEffect(() => {
    if (!token) return;

    if (!user) {
      sessionStorage.setItem('invite_token', token);
      navigate('/');
      return;
    }

    if (!profile) {
      setPhase('identity');
    } else if (profile.partnership_id) {
      onComplete();
    } else {
      joinNow();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user, profile]);

  const joinNow = async () => {
    setPhase('joining');
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('join_partnership_by_token', { token });
      if (rpcErr) throw rpcErr;
      if (!data) throw new Error('Invite not found.');
      setPhase('done');
      sessionStorage.removeItem('invite_token');
      onComplete();
    } catch (err) {
      setError(err.message);
      setPhase('error');
    }
  };

  return (
    <div className={styles.page}>
      {phase === 'init' && <div className={styles.waiting}>Looking up the invite…</div>}

      {phase === 'identity' && (
        <StepIdentity userId={user.id} onDone={joinNow} />
      )}

      {phase === 'joining' && (
        <div className={styles.card}>
          <div className={styles.title}>Joining…</div>
          <div className={styles.waiting}>One moment.</div>
        </div>
      )}

      {phase === 'error' && (
        <div className={styles.card}>
          <div className={styles.title}>Something went wrong</div>
          <div className={styles.error}>{error}</div>
          <button className={styles.copyBtn} onClick={() => navigate('/')}>Go home</button>
        </div>
      )}
    </div>
  );
}
