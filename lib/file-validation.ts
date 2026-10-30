/**
 * Server-side magic byte (file header) validation.
 * Never trust the client-sent Content-Type — verify the actual bytes.
 */

const MAGIC_BYTES: Record<string, (number | null)[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  ],
  "image/gif": [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  ],
  "image/webp": [
    // RIFF????WEBP
    [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
  ],
};

/**
 * Reads the first 12 bytes of `buffer` and checks whether they match
 * the expected magic bytes for any of the `allowedMimeTypes`.
 *
 * Returns `{ valid: true, detectedMime }` on success,
 * or `{ valid: false, error }` on failure.
 */
export function validateMagicBytes(
  buffer: ArrayBuffer,
  allowedMimeTypes: string[]
): { valid: true; detectedMime: string } | { valid: false; error: string } {
  const bytes = new Uint8Array(buffer.slice(0, 12));

  for (const mime of allowedMimeTypes) {
    const signatures = MAGIC_BYTES[mime];
    if (!signatures) continue;

    for (const sig of signatures) {
      if (sig.length > bytes.length) continue;
      let match = true;
      for (let i = 0; i < sig.length; i++) {
        if (sig[i] !== null && bytes[i] !== sig[i]) {
          match = false;
          break;
        }
      }
      if (match) return { valid: true, detectedMime: mime };
    }
  }

  return {
    valid: false,
    error: "File content does not match any allowed image type.",
  };
}
