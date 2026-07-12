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
export const FEATURE_STICKERS = flag(import.meta.env.VITE_FEATURE_STICKERS);
