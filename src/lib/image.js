// Compress an image File down to ~max dimensions.
// Preserves transparency: PNG/WebP sources stay PNG so alpha channels
// (e.g. a background-removed ticket cut-out) survive. Others go to JPEG.
// Returns a Blob with .type set; caller reads blob.type for content-type
// and uses extForMime() below to pick an extension.
//
// Back-compat: also exposes `hasTransparency` on the blob object as a
// non-enumerable property. New code should prefer compressImageDetailed.
export async function compressImage(file, maxDim = 1600, quality = 0.82) {
  const { blob, hasTransparency } = await compressImageDetailed(file, maxDim, quality);
  try {
    Object.defineProperty(blob, 'hasTransparency', { value: hasTransparency });
  } catch { /* some Blob impls disallow defineProperty — ignore */ }
  return blob;
}

export async function compressImageDetailed(file, maxDim = 1600, quality = 0.82) {
  const preserveAlpha = file.type === 'image/png' || file.type === 'image/webp';
  const outMime = preserveAlpha ? 'image/png' : 'image/jpeg';

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        // Probe edge pixels for any partial / full transparency. A real
        // ticket cut-out has fully-transparent corners; an opaque-PNG
        // selfie does not. We only sample edges (cheap, catches the
        // background-removal case).
        const hasTransparency = preserveAlpha && hasTransparentEdges(ctx, w, h);

        canvas.toBlob(
          (blob) =>
            blob
              ? resolve({ blob, hasTransparency })
              : reject(new Error('compress failed')),
          outMime,
          preserveAlpha ? undefined : quality,
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function hasTransparentEdges(ctx, w, h) {
  const samplesPerEdge = 24;
  const checkPixel = (x, y) => {
    const px = Math.min(w - 1, Math.max(0, x));
    const py = Math.min(h - 1, Math.max(0, y));
    const data = ctx.getImageData(px, py, 1, 1).data;
    return data[3] < 240;
  };
  for (let i = 0; i < samplesPerEdge; i++) {
    const t = i / (samplesPerEdge - 1);
    if (checkPixel(Math.round(w * t), 0)) return true;
    if (checkPixel(Math.round(w * t), h - 1)) return true;
    if (checkPixel(0, Math.round(h * t))) return true;
    if (checkPixel(w - 1, Math.round(h * t))) return true;
  }
  return false;
}

export function extForMime(mime) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}
