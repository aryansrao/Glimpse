import imageCompression from "browser-image-compression";

const MAX_DIMENSION = 1080;
const TARGET_MB = 0.4;

/**
 * Resizes + compresses a story image in the browser and returns it as a
 * base64 WebP data URL. Same approach as `fileToAvatarWebpBase64` in
 * src/lib/avatar-image.ts, but tuned for full-screen story media.
 */
export async function fileToStoryWebpBase64(file: File): Promise<string> {
  const compressed = await imageCompression(file, {
    maxSizeMB: TARGET_MB,
    maxWidthOrHeight: MAX_DIMENSION,
    fileType: "image/webp",
    useWebWorker: true,
    initialQuality: 0.85,
  });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(compressed);
  });
}
