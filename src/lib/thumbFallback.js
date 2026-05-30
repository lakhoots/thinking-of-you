// Fallback for thumbnail <img>s: if the thumbnail fails to load (e.g. a
// 0-byte thumbnail written by an older backfill), swap to the full-size
// image, which is always present. Guarded so a genuinely-broken original
// doesn't loop.
export function fallbackToFull(fullUrl) {
  return (e) => {
    const img = e.currentTarget;
    if (fullUrl && img.src !== fullUrl) {
      img.src = fullUrl;
    }
  };
}
