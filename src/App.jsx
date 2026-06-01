import { useEffect } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
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
      warming up…
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

  // Block page-level pinch-zoom where we can (iOS gesture* events,
  // double-tap zoom). For paths we can't fully block — desktop trackpad
  // pinch in Chromium browsers, Safari Responsive Design Mode — we also
  // anchor chrome to the visual viewport via CSS vars below.
  useEffect(() => {
    const stop = (e) => e.preventDefault();
    const opts = { passive: false };
    document.addEventListener('gesturestart', stop, opts);
    document.addEventListener('gesturechange', stop, opts);
    document.addEventListener('gestureend', stop, opts);

    let lastTouchEnd = 0;
    const onTouchEnd = (e) => {
      const now = Date.now();
      if (now - lastTouchEnd < 350) e.preventDefault();
      lastTouchEnd = now;
    };
    document.addEventListener('touchend', onTouchEnd, opts);

    return () => {
      document.removeEventListener('gesturestart', stop, opts);
      document.removeEventListener('gesturechange', stop, opts);
      document.removeEventListener('gestureend', stop, opts);
      document.removeEventListener('touchend', onTouchEnd, opts);
    };
  }, []);

  // The app chrome (header / nav / FAB / pages / board) is sized in static,
  // keyboard-independent CSS (dvh) so the on-screen keyboard simply overlays a
  // motionless UI — no JS re-measures the viewport on keyboard events, which is
  // what made the chrome stutter as it tried to chase iOS's keyboard animation.
  //
  // The only thing we track in JS is --kb-vh: the live (keyboard-aware) height
  // that modal sheets use to sit above the keyboard. While pinch-zoomed we also
  // pin the chrome to the visual viewport so it doesn't drift off a zoomed page.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty('--kb-vh', `${vv.height}px`);

      if (vv.scale > 1.01) {
        root.style.setProperty('--vv-x', `${vv.offsetLeft}px`);
        root.style.setProperty('--vv-y', `${vv.offsetTop}px`);
        root.style.setProperty('--vv-w', `${vv.width}px`);
        root.style.setProperty('--vv-h', `${vv.height}px`);
        root.style.setProperty('--chrome-x', `${vv.offsetLeft}px`);
        root.style.setProperty('--chrome-y', `${vv.offsetTop}px`);
        root.style.setProperty('--chrome-w', `${vv.width}px`);
        root.style.setProperty('--chrome-h', `${vv.height}px`);
      } else {
        // Hand the chrome back to the static dvh-based defaults in tokens.css.
        for (const v of ['--vv-x', '--vv-y', '--vv-w', '--vv-h', '--chrome-x', '--chrome-y', '--chrome-w', '--chrome-h']) {
          root.style.removeProperty(v);
        }
      }
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

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
              : <AppShell user={user} profile={profile} onProfileChange={refreshProfile} />
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
