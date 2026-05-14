import { useEffect, useState } from 'react';
import StepIdentity from './StepIdentity';
import StepLabel from './StepLabel';
import StepInvite from './StepInvite';
import styles from './Onboarding.module.css';

export default function Onboarding({ user, profile, onComplete }) {
  const hasProfile = !!profile;
  const [step, setStep] = useState(hasProfile ? 'label' : 'identity');
  const [partnership, setPartnership] = useState(null);

  // If profile already exists with a partnership, we shouldn't be here at all.
  useEffect(() => {
    if (profile?.partnership_id) onComplete();
  }, [profile, onComplete]);

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
    </div>
  );
}
