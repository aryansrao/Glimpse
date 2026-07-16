import imageCompression from "browser-image-compression";

const MAX_DIMENSION = 256;
const TARGET_MB = 0.15;

/**
 * Resizes + compresses an avatar image in the browser and returns it as a
 * base64 WebP data URL, small enough to store directly as a DB column.
 */
export async function fileToAvatarWebpBase64(file: File): Promise<string> {
  const compressed = await imageCompression(file, {
    maxSizeMB: TARGET_MB,
    maxWidthOrHeight: MAX_DIMENSION,
    fileType: "image/webp",
    useWebWorker: true,
    initialQuality: 0.82,
  });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(compressed);
  });
}
