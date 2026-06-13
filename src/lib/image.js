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
  const img = await loadImageFromFile(file);
  const { canvas, ctx, w, h } = drawScaled(img, maxDim);
  const hasTransparency = preserveAlpha && hasTransparentEdges(ctx, w, h);
  const blob = await canvasToBlob(canvas, outMime, preserveAlpha ? undefined : quality);
  return { blob, hasTransparency };
}

// Produce both the full-size image and a smaller thumbnail from a single
// decode. The thumbnail is what the board pins and sparks feed render; the
// full image stays for the lightbox/detail carousel. PNG/WebP keep their
// alpha channel so transparent cut-outs still render borderless.
export async function compressImageWithThumb(file, {
  maxDim = 1600,
  quality = 0.82,
  thumbDim = 800,
  thumbQuality = 0.72,
} = {}) {
  const preserveAlpha = file.type === 'image/png' || file.type === 'image/webp';
  const outMime = preserveAlpha ? 'image/png' : 'image/jpeg';
  const img = await loadImageFromFile(file);

  const full = drawScaled(img, maxDim);
  const hasTransparency = preserveAlpha && hasTransparentEdges(full.ctx, full.w, full.h);
  const blob = await canvasToBlob(full.canvas, outMime, preserveAlpha ? undefined : quality);

  // The thumbnail is an optimization, not a requirement. If the browser
  // hands back an empty/invalid blob (some iOS Safari versions do this on
  // large canvases), degrade to no thumbnail rather than failing the whole
  // upload — the full image still posts and the UI falls back to it.
  let thumbBlob = null;
  try {
    const thumb = drawScaled(img, thumbDim);
    thumbBlob = await canvasToBlob(thumb.canvas, outMime, preserveAlpha ? undefined : thumbQuality);
  } catch {
    // Leave thumbBlob null — the thumbnail is optional and we fall back to full.
  }

  return { blob, thumbBlob, hasTransparency };
}

// Build just a thumbnail from an existing image File/Blob — used to
// backfill thumbnails for photos uploaded before thumb_url existed.
export async function makeThumbnail(file, { thumbDim = 800, thumbQuality = 0.72 } = {}) {
  const preserveAlpha = file.type === 'image/png' || file.type === 'image/webp';
  const outMime = preserveAlpha ? 'image/png' : 'image/jpeg';
  const img = await loadImageFromFile(file);
  const { canvas } = drawScaled(img, thumbDim);
  return canvasToBlob(canvas, outMime, preserveAlpha ? undefined : thumbQuality);
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => resolve(img);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function drawScaled(img, maxDim) {
  const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return { canvas, ctx, w, h };
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob && blob.size > 0 ? resolve(blob) : reject(new Error('compress failed'))),
      mime,
      quality,
    );
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
