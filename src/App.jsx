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

  // Anchor the app chrome (header / nav / FAB / board canvas) to a
  // keyboard-independent viewport so the on-screen keyboard simply overlays the
  // UI: it slides up over whatever's there and slides away to reveal it again,
  // with nothing reflowing, hiding, or repositioning underneath. Reacting to
  // the keyboard's viewport shrink is exactly what caused the nav to flash and
  // the blank gap to lag in behind the closing keyboard.
  //
  // We still react to two things:
  //   - pinch-zoom (scale > 1): follow the visual viewport so fixed bars stay
  //     pinned while a zoomed page is panned.
  //   - Safari's toolbar showing/hiding (a small height change): track it so
  //     the chrome keeps fitting exactly.
  // A large height drop is the keyboard and is ignored for chrome. Modals that
  // need to sit above the keyboard read --kb-vh instead, which always tracks
  // the live (keyboard-aware) visual-viewport height.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const root = document.documentElement;
    let baseHeight = vv.height;
    let lastWidth = window.innerWidth;
    const update = () => {
      // Live, keyboard-aware height for modals.
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
        return;
      }

      // Orientation change flips the width; drop the stale baseline so the new
      // orientation's height isn't mistaken for a keyboard shrink.
      if (window.innerWidth !== lastWidth) {
        lastWidth = window.innerWidth;
        baseHeight = vv.height;
      }
      baseHeight = Math.max(baseHeight, vv.height);
      const keyboardOpen = baseHeight - vv.height > 150;
      const h = `${keyboardOpen ? baseHeight : vv.height}px`;
      const w = `${window.innerWidth}px`;
      root.style.setProperty('--vv-x', '0px');
      root.style.setProperty('--vv-y', '0px');
      root.style.setProperty('--vv-w', w);
      root.style.setProperty('--vv-h', h);
      root.style.setProperty('--chrome-x', '0px');
      root.style.setProperty('--chrome-y', '0px');
      root.style.setProperty('--chrome-w', w);
      root.style.setProperty('--chrome-h', h);
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
