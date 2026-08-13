import { MAX_IMAGE_BYTES } from './constants.js';

// Project images used to arrive as multipart/form-data and were unpacked by multer. Multer
// wants a long-lived process with a real request stream; a Vercel function is handed an
// already-buffered body, so the upload is now a plain data: URL inside the JSON payload and
// this module is what turns it back into bytes.
//
// The image is still stored in MongoDB alongside the project rather than in blob storage. That
// is unchanged from before, and it keeps the whole site running on one Atlas cluster with no
// second service to configure - which is worth more here than the efficiency of a CDN bucket,
// given the board holds tens of images, not thousands. The form downscales before uploading so
// what lands in Mongo is a few hundred KB, well under the 16 MB document ceiling.

// Formats a browser will render inline and that <canvas>.toBlob can produce. Anything else is
// rejected rather than stored, so the image endpoint can only ever serve one of these.
const SIGNATURES = [
  { contentType: 'image/png', test: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { contentType: 'image/jpeg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { contentType: 'image/gif', test: (b) => b.length > 6 && b.toString('ascii', 0, 6).match(/^GIF8[79]a$/) !== null },
  { contentType: 'image/webp', test: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' }
];

const DATA_URL = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i;

/**
 * Turns the `image` field of a submission into what gets written to Mongo.
 * Returns { image: { data, contentType } } or { error: { message, stage } }.
 *
 * The declared MIME type is never trusted. It is the value the image endpoint later sends back
 * as Content-Type, so accepting the client's word for it would let someone store an HTML
 * document announced as a PNG and have this origin serve it back as markup. The content type
 * saved is the one derived from the file's own magic bytes, and a payload whose bytes match no
 * known image format is rejected outright.
 */
export function parseProjectImage(image) {
  if (typeof image !== 'string' || image.trim() === '') {
    return { error: { message: 'A project image is required.', stage: 'validation' } };
  }

  const match = DATA_URL.exec(image.trim());
  if (!match) {
    return { error: { message: 'The project image could not be read. Please choose another file.', stage: 'validation' } };
  }

  // Cheap length check before allocating the buffer: base64 is 4 characters per 3 bytes, so
  // this rejects an oversized payload without first decoding it into memory.
  const [, declaredType, base64] = match;
  if ((base64.length * 3) / 4 > MAX_IMAGE_BYTES) {
    return { error: { message: 'That image is too large. Please choose one under 2 MB.', stage: 'validation' } };
  }

  const data = Buffer.from(base64, 'base64');
  if (data.length === 0 || data.length > MAX_IMAGE_BYTES) {
    return { error: { message: 'That image is too large. Please choose one under 2 MB.', stage: 'validation' } };
  }

  const signature = SIGNATURES.find((candidate) => candidate.test(data));
  if (!signature) {
    return {
      error: {
        message: 'That file is not a PNG, JPEG, GIF or WebP image. Please choose another file.',
        stage: 'validation'
      }
    };
  }

  // Logged rather than rejected: a mislabelled-but-valid image is far more likely to be a
  // browser quirk than an attack, and the sniffed type is what gets stored either way.
  if (declaredType.toLowerCase() !== signature.contentType) {
    console.warn(`[image] declared ${declaredType}, stored as ${signature.contentType}`);
  }

  return { image: { data, contentType: signature.contentType } };
}
