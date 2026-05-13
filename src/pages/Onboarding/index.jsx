import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import StepIdentity from './StepIdentity';
import StepLabel from './StepLabel';
import StepInvite from './StepInvite';
import styles from './Onboarding.module.css';

export default function Onboarding({ user, profile, onComplete }) {
  const navigate = useNavigate();
  const hasProfile = !!profile;
  const [step, setStep] = useState(hasProfile ? 'label' : 'identity');
  const [partnership, setPartnership] = useState(null);

  // If profile already exists with a partnership, we shouldn't be here at all.
  useEffect(() => {
    if (profile?.partnership_id) onComplete();
  }, [profile, onComplete]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className={styles.page}>
      {step === 'identity' && (
        <StepIdentity
          userId={user.id}
          onDone={() => setStep('label')}
        />
      )}
      {step === 'label' && (
        <StepLabel
          userId={user.id}
          onDone={(p) => {
            setPartnership(p);
            setStep('invite');
          }}
        />
      )}
      {step === 'invite' && partnership && (
        <StepInvite partnership={partnership} onDone={onComplete} />
      )}
      <button className={styles.signOut} onClick={signOut}>Sign out</button>
    </div>
  );
}
