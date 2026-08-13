// Turns the file somebody picked into the string /api/submit expects.
//
// The old form posted the raw file as multipart/form-data and the server stored whatever
// arrived - a 9 MB phone photo included, at full resolution, in MongoDB. Two things forced a
// change: a Vercel function refuses a request body over 4.5 MB outright, and the image was
// being served back at that size to fill a card a few hundred pixels wide.
//
// So the browser does the resizing. It has the decoder already, it costs the server nothing,
// and the upload shrinks by one to two orders of magnitude - which also makes the submission
// feel instant on campus wifi. What travels is a data: URL inside the JSON payload.

import { IMAGE_MAX_DIMENSION, MAX_UPLOAD_BYTES } from '../config.js';

// Must stay under backend/lib/constants.js's MAX_IMAGE_BYTES (2 MB), with room to spare so a
// borderline encode isn't rejected after all this work. Base64 costs 4 bytes per 3, which the
// submit endpoint's own body limit accounts for.
const TARGET_BYTES = 1.5 * 1024 * 1024;

// Tried in order until one lands under TARGET_BYTES. Most photos clear the first.
const QUALITY_STEPS = [0.85, 0.7, 0.55];

export class ImageUploadError extends Error {}

// createImageBitmap decodes off the main thread and applies the EXIF rotation a phone camera
// writes, so a portrait photo doesn't arrive sideways. Older Safari either lacks it or ignores
// imageOrientation, hence the <img> fallback - which the browser orients for us anyway.
async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Fall through to the <img> path below.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new ImageUploadError('That image could not be read. Please try another file.'));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function encode(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function toDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new ImageUploadError('That image could not be read. Please try another file.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Validates, downscales and encodes a picked file.
 * Returns { dataUrl, previewUrl, bytes }. Throws ImageUploadError with a message fit to show.
 */
export async function prepareProjectImage(file) {
  if (!file || !file.type.startsWith('image/')) {
    throw new ImageUploadError('Please choose an image file.');
  }
  // Checked before decoding: a huge file is rejected without ever being pulled into memory.
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ImageUploadError('That image is over 10MB. Please choose a smaller file.');
  }

  const source = await decode(file);
  const width = source.width;
  const height = source.height;
  if (!width || !height) {
    throw new ImageUploadError('That image could not be read. Please try another file.');
  }

  // Only ever scales down. Enlarging a small logo to hit the target would cost bytes and add
  // nothing a browser couldn't do better at render time.
  const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const context = canvas.getContext('2d');
  // Neither WebP-with-quality nor JPEG keeps an alpha channel here, and an undefined backdrop
  // renders transparent pixels black. Cards are white, so filling white first means a logo with
  // a cut-out background looks the same after the round trip as it did in the picker.
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close?.();

  // WebP is roughly a third smaller than JPEG at matched quality. A browser that can't encode
  // it ignores the type and hands back a PNG, which is how the fallback is detected.
  for (const type of ['image/webp', 'image/jpeg']) {
    for (const quality of QUALITY_STEPS) {
      const blob = await encode(canvas, type, quality);
      if (!blob || blob.type !== type) break; // Unsupported format - try the next one.
      if (blob.size <= TARGET_BYTES) {
        return { dataUrl: await toDataUrl(blob), previewUrl: URL.createObjectURL(blob), bytes: blob.size };
      }
    }
  }

  // Every format at every quality was still too big, which takes a very large, very detailed
  // source. Say so plainly rather than letting the server reject it a round trip later.
  throw new ImageUploadError('That image is too detailed to upload. Please try a smaller or simpler one.');
}
