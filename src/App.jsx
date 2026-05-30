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

  // Pin chrome (header / nav / rotateBar / modals) to the visual viewport.
  // When the page is pinch-zoomed, the layout viewport stays put but the
  // visual viewport shifts and shrinks — without this, position:fixed bars
  // anchored to layout edges drift off-screen.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty('--vv-x', `${vv.offsetLeft}px`);
      root.style.setProperty('--vv-y', `${vv.offsetTop}px`);
      root.style.setProperty('--vv-w', `${vv.width}px`);
      root.style.setProperty('--vv-h', `${vv.height}px`);

      // Bottom chrome (nav bar + FAB) should follow the visual viewport only
      // while pinch-zoomed. When the on-screen keyboard shrinks the visual
      // viewport (scale stays ~1), keep the chrome pinned to the layout
      // viewport bottom so the keyboard covers it — otherwise the FAB rides up
      // and collides with input controls like the comment Send button.
      const zoomed = vv.scale > 1.01;
      root.style.setProperty('--chrome-x', zoomed ? `${vv.offsetLeft}px` : '0px');
      root.style.setProperty('--chrome-y', zoomed ? `${vv.offsetTop}px` : '0px');
      root.style.setProperty('--chrome-w', zoomed ? `${vv.width}px` : `${window.innerWidth}px`);
      root.style.setProperty('--chrome-h', zoomed ? `${vv.height}px` : `${window.innerHeight}px`);
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

  // Track whether the on-screen keyboard is open so bottom chrome (nav bar +
  // FAB) can hide and the page can reclaim the reserved nav space. iOS can't
  // reliably keep position:fixed bars pinned behind the keyboard. Detecting the
  // keyboard needs two signals together: an editable element must be focused
  // AND the visual viewport must have actually shrunk. Focus alone over-fires
  // (browsers restore focus to inputs on load/back, hiding the nav with no
  // keyboard); viewport shrink alone is noisy (the address bar collapsing also
  // resizes it). The shrink is measured against the tallest height seen while
  // nothing was focused, since window.innerHeight itself can shrink with the
  // keyboard on some iOS versions.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const root = document.documentElement;
    const isEditable = (el) => {
      if (!el) return false;
      if (el.isContentEditable) return true;
      if (el.tagName === 'TEXTAREA') return true;
      if (el.tagName === 'INPUT') {
        const type = (el.type || 'text').toLowerCase();
        return !['file', 'checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color'].includes(type);
      }
      return false;
    };
    let baseHeight = vv.height;
    const sync = () => {
      const editable = isEditable(document.activeElement);
      // With nothing focused the keyboard is closed, so the current height is a
      // clean baseline to measure later shrink against.
      if (!editable) baseHeight = Math.max(baseHeight, vv.height);
      const shrunk = baseHeight - vv.height > 150;
      root.setAttribute('data-kb', editable && shrunk ? 'open' : 'closed');
    };
    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    document.addEventListener('focusin', sync);
    // focusout fires before focus lands on the next field; defer so a field-to-
    // field tap doesn't briefly flag the keyboard as closed.
    const onFocusOut = () => window.setTimeout(sync, 0);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      document.removeEventListener('focusin', sync);
      document.removeEventListener('focusout', onFocusOut);
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
