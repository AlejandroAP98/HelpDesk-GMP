export const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_IMAGE_ACCEPT = ALLOWED_IMAGE_MIME.join(",");
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 1920;
export const WEBP_QUALITY = 0.8;

export type OptimizeOptions = {
  maxDimension?: number;
  quality?: number;
  mimeType?: "image/webp";
};

export function isImageMime(value: string | null | undefined): boolean {
  if (!value) return false;
  const base = value.split(";", 1)[0].trim().toLowerCase();
  return (ALLOWED_IMAGE_MIME as readonly string[]).includes(base);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function readFileAsImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo decodificar la imagen"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), mime, quality);
  });
}

export async function optimizeImage(
  file: File,
  opts: OptimizeOptions = {},
): Promise<File> {
  const maxDimension = opts.maxDimension ?? MAX_IMAGE_DIMENSION;
  const quality = opts.quality ?? WEBP_QUALITY;
  const mime = opts.mimeType ?? "image/webp";

  const img = await readFileAsImage(file);
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = longest > maxDimension ? maxDimension / longest : 1;
  const targetW = Math.round(img.naturalWidth * scale);
  const targetH = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const blob = await canvasToBlob(canvas, mime, quality);
  if (!blob) throw new Error("No se pudo comprimir la imagen");

  const baseName = file.name.replace(/\.[^.]+$/, "") || "imagen";
  const optimized = new File([blob], `${baseName}.webp`, {
    type: mime,
    lastModified: Date.now(),
  });
  return optimized;
}
