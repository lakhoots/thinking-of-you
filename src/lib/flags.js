// Experiment feature flags.
//
// An explicit VITE_FEATURE_* of 'true' or 'false' always wins; when unset,
// experiments show up in dev and stay hidden in production builds. Toggle in
// .env.local locally or in the deploy environment.
function flag(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return import.meta.env.DEV;
}

export const FEATURE_SKY = flag(import.meta.env.VITE_FEATURE_SKY);

// Stickers additionally support VITE_FEATURE_STICKERS=demo: the full UI runs,
// but stickers live in this browser's localStorage instead of the database —
// for previewing the mechanics before the migration ships. Only you see them.
export const STICKERS_DEMO = import.meta.env.VITE_FEATURE_STICKERS === 'demo';
export const FEATURE_STICKERS =
  STICKERS_DEMO || flag(import.meta.env.VITE_FEATURE_STICKERS);
