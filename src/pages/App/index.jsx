import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { usePartnership } from '../../hooks/usePartnership';
import { useMementos } from '../../hooks/useMementos';
import NavBar from '../../components/NavBar';
import AddMementoForm from '../../components/AddMementoForm';
import Board from './Board';
import Sparks from './Sparks';
import shellStyles from './AppShell.module.css';

export default function AppShell({ user, profile }) {
  const [tab, setTab] = useState('board');
  const [showAdd, setShowAdd] = useState(false);
  const [lastAddedId, setLastAddedId] = useState(null);

  const { partnership, partners } = usePartnership(profile.partnership_id);
  const { mementos, addLocal } = useMementos(profile.partnership_id);

  const partnerJoined = !!(partnership?.partner_a_id && partnership?.partner_b_id);

  // If the partnership has only one member, show the waiting state instead of the app.
  if (partnership && !partnerJoined) {
    return <WaitingForPartner partnership={partnership} profile={profile} />;
  }

  const onCreated = (m) => {
    addLocal(m);
    setLastAddedId(m.id);
    setShowAdd(false);
  };

  return (
    <>
      {tab === 'board' && (
        <Board
          mementos={mementos}
          partners={partners}
          partnershipLabel={partnership?.label ?? ''}
          lastAddedId={lastAddedId}
        />
      )}
      {tab === 'sparks' && <Sparks />}

      <NavBar
        tab={tab}
        onTab={setTab}
        onAdd={() => setShowAdd(true)}
      />

      {showAdd && (
        <AddMementoForm
          partnershipId={profile.partnership_id}
          authorId={user.id}
          existing={mementos}
          onCreated={onCreated}
          onClose={() => setShowAdd(false)}
        />
      )}
    </>
  );
}

function WaitingForPartner({ partnership, profile }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/invite/${partnership.invite_token}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className={shellStyles.waitPage}>
      <div className={shellStyles.waitTitle}>The board is ready.</div>
      <div className={shellStyles.waitSub}>
        Waiting for the other half of {partnership.label} to arrive.
      </div>
      <div className={shellStyles.inviteBox}>{link}</div>
      <button className={shellStyles.copyBtn} onClick={copy}>
        {copied ? 'Copied ✓' : 'Copy invite link'}
      </button>
      <div className={shellStyles.waitHint}>
        Signed in as {profile.name}.{' '}
        <button className={shellStyles.signOut} onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
}
