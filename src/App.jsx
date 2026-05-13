import { useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import SignIn from './pages/SignIn';
import Onboarding from './pages/Onboarding';
import InviteAccept from './pages/InviteAccept';
import AppShell from './pages/App';

function LoadingScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Playfair Display', serif", fontStyle: 'italic',
      fontSize: 17, color: 'rgba(26,18,8,0.3)',
    }}>
      loading…
    </div>
  );
}

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, refresh: refreshProfile } = useProfile(user?.id);
  const navigate = useNavigate();

  // If a freshly-signed-in user has a pending invite token, resume that flow.
  useEffect(() => {
    if (!user) return;
    const pending = sessionStorage.getItem('invite_token');
    if (pending) {
      sessionStorage.removeItem('invite_token');
      navigate(`/invite/${pending}`, { replace: true });
    }
  }, [user, navigate]);

  if (authLoading) return (<><div className="grain" /><LoadingScreen /></>);

  // Not signed in
  if (!user) {
    return (
      <>
        <div className="grain" />
        <Routes>
          <Route path="/invite/:token" element={<RedirectAfterSignIn />} />
          <Route path="*" element={<SignIn />} />
        </Routes>
      </>
    );
  }

  if (profileLoading) return (<><div className="grain" /><LoadingScreen /></>);

  return (
    <>
      <div className="grain" />
      <Routes>
        <Route
          path="/invite/:token"
          element={
            <InviteAccept user={user} profile={profile} onComplete={refreshProfile} />
          }
        />
        <Route
          path="*"
          element={
            !profile || !profile.partnership_id
              ? <Onboarding user={user} profile={profile} onComplete={refreshProfile} />
              : <AppShell user={user} profile={profile} />
          }
        />
      </Routes>
    </>
  );
}

// When an unauthenticated user lands on /invite/:token, push them to SignIn
// after stashing the token so we can resume after they sign in.
function RedirectAfterSignIn() {
  const navigate = useNavigate();
  useEffect(() => {
    const path = window.location.pathname;
    const m = path.match(/^\/invite\/(.+)$/);
    if (m) sessionStorage.setItem('invite_token', m[1]);
    navigate('/', { replace: true });
  }, [navigate]);
  return <LoadingScreen />;
}
