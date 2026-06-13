// Themed-list registry. Each theme is a small "spec" the board sticker and the
// list view read from — shape, palette, and the words to use for items.
//
// Tier-A parametric stickers: handcrafted, instant, free. Shaped as data (not
// hardcoded JSX) so a later upgrade can have an LLM *produce* one of these
// specs from a list's name without touching the board or list view. A list may
// also override the visual with an uploaded image (memento.image_url); the
// theme still supplies the verbs/placeholders in that case.

export const LIST_THEMES = [
  {
    key: 'movies',
    label: 'Movies',
    shape: 'ticket',
    accent: '#B11E2F', // ticket-stub red
    itemPlaceholder: 'Add a movie…',
    checkedVerb: 'watched',
    countNoun: 'to watch',
  },
  {
    key: 'custom',
    label: 'Custom list',
    shape: 'card',
    accent: '#9C5E4A',
    itemPlaceholder: 'Add an item…',
    checkedVerb: 'done',
    countNoun: 'to do',
  },
];

const CUSTOM = LIST_THEMES[LIST_THEMES.length - 1];

// Resolve a stored theme key to its spec, falling back to the custom theme for
// unknown / missing keys (e.g. lists created before the theme set was trimmed).
export function getListTheme(key) {
  return LIST_THEMES.find((t) => t.key === key) ?? CUSTOM;
}

// Themes offered in the create form.
export const SELECTABLE_THEMES = LIST_THEMES;
