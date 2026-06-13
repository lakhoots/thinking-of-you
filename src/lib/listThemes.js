// Themed-list registry. Each theme is a small "spec" the board sticker and the
// list view read from — emoji, shape, palette, and the words to use for items.
//
// This is the Tier-A parametric source of stickers: handcrafted, instant, free.
// It's deliberately shaped as data (not hardcoded JSX) so a later upgrade can
// have an LLM *produce* one of these specs from a list's name without touching
// the board, the data model, or the list view. A list may also override the
// visual entirely with an uploaded image (memento.image_url) — the theme still
// supplies the verbs/placeholders in that case.

export const LIST_THEMES = [
  {
    key: 'movies',
    label: 'Movies',
    emoji: '🎬',
    shape: 'ticket',
    accent: '#C0654A',
    itemPlaceholder: 'Add a movie…',
    checkedVerb: 'watched',
    countNoun: 'to watch',
  },
  {
    key: 'dishes',
    label: 'Dishes & Bakes',
    emoji: '🍳',
    shape: 'card',
    accent: '#C08A3E',
    itemPlaceholder: 'Add a dish to make…',
    checkedVerb: 'made',
    countNoun: 'to make',
  },
  {
    key: 'books',
    label: 'Books',
    emoji: '📚',
    shape: 'label',
    accent: '#6E7B52',
    itemPlaceholder: 'Add a book…',
    checkedVerb: 'read',
    countNoun: 'to read',
  },
  {
    key: 'places',
    label: 'Places',
    emoji: '📍',
    shape: 'label',
    accent: '#4A7C8C',
    itemPlaceholder: 'Add a place…',
    checkedVerb: 'visited',
    countNoun: 'to visit',
  },
  {
    key: 'generic',
    label: 'Custom list',
    emoji: '✨',
    shape: 'label',
    accent: '#9C5E4A',
    itemPlaceholder: 'Add an item…',
    checkedVerb: 'done',
    countNoun: 'to do',
  },
];

const GENERIC = LIST_THEMES[LIST_THEMES.length - 1];

// Resolve a stored theme key to its spec, falling back to the generic theme
// for unknown / missing keys (e.g. legacy rows or custom-image lists).
export function getListTheme(key) {
  return LIST_THEMES.find((t) => t.key === key) ?? GENERIC;
}

// Themes offered in the create form (everything except the generic fallback,
// which the "Custom" button maps to).
export const SELECTABLE_THEMES = LIST_THEMES;
