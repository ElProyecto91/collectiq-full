/**
 * Image processor — prepares a captured photo for recognition.
 *
 * Takes a File (from <input type="file">), loads it into an off-DOM image
 * element, draws it onto a canvas scaled so the longest side does not exceed
 * `maxSize` px, and exports a JPEG data URL at the given quality. The output
 * is what the recognition provider will receive in a later phase.
 */

export interface ProcessedImage {
  dataUrl: string;
  width: number;
  height: number;
}

const DEFAULT_MAX_SIZE = 1024;
const DEFAULT_QUALITY = 0.85;

export async function processImage(
  file: File,
  maxSize: number = DEFAULT_MAX_SIZE,
  quality: number = DEFAULT_QUALITY
): Promise<ProcessedImage> {
  const bitmap = await loadImage(file);
  const { width, height } = scaleDimensions(bitmap.width, bitmap.height, maxSize);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { dataUrl, width, height };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

function scaleDimensions(w: number, h: number, maxSize: number): { width: number; height: number } {
  if (w <= maxSize && h <= maxSize) return { width: w, height: h };
  const ratio = w > h ? maxSize / w : maxSize / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}
