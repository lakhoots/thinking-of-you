// Partner colours resolve from the author's profile at render time — colour
// is never stored per-row on sparks, stickers, or mementos, so changing your
// accent in Settings repaints your whole history everywhere at once.
//
// Profiles store a hex (see SettingsSheet's palette), but consumers get a
// CSS custom property for the six known colours, so theme adjustments (or a
// future migration to semantic keys) only touch this map and tokens.css.
// An unknown hex passes through as-is.
//
// One caveat for callers: var() only resolves in CSS properties (the style
// prop), not in SVG presentation attributes — use style={{ fill: color }},
// never fill={color}.
const HEX_TO_TOKEN = {
  '#9C5E4A': 'var(--terracotta)',
  '#B8955A': 'var(--brass)',
  '#6B8C72': 'var(--sage)',
  '#7A6B8C': 'var(--plum)',
  '#5A7A8C': 'var(--slate)',
  '#8C6B5A': 'var(--sienna)',
};

export const DEFAULT_ACCENT = 'var(--terracotta)';

export function partnerColor(profile) {
  const hex = profile?.accent_color;
  if (!hex) return DEFAULT_ACCENT;
  return HEX_TO_TOKEN[hex.toUpperCase()] ?? hex;
}

// Resolve an author_id against the partners list (the shape every page
// already receives from usePartnership).
export function colorForUser(userId, partners) {
  return partnerColor((partners ?? []).find((p) => p.id === userId));
}
