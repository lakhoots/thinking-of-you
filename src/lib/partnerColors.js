// Partner colours resolve from the author's profile at render time — colour
// is never stored per-row on sparks, stickers, or mementos, so changing your
// accent in Settings repaints your whole history everywhere at once.
export const DEFAULT_ACCENT = '#9C5E4A';

export function partnerColor(profile) {
  return profile?.accent_color || DEFAULT_ACCENT;
}

// Resolve an author_id against the partners list (the shape every page
// already receives from usePartnership).
export function colorForUser(userId, partners) {
  return partnerColor((partners ?? []).find((p) => p.id === userId));
}
