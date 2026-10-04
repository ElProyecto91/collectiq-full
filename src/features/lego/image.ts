/**
 * Shrinks a photo before sending it: a phone photo is several MB, recognition needs ~1000 px.
 * Returns a JPEG. Throws if the browser cannot decode the file.
 */
export async function compressImage(file: Blob, maxSide = 1024, quality = 0.85): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas_unavailable');
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) throw new Error('compress_failed');
    return blob;
  } finally {
    bmp.close();
  }
}
