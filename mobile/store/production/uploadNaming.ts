export function fileNameFromUri(uri: string): string {
  const fileName = uri.split("/").at(-1)?.split("?")[0];
  return fileName?.trim() || "freight-attachment";
}

export function mimeTypeFromUri(uri: string): string {
  const extension = fileNameFromUri(uri).split(".").at(-1)?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "heic") return "image/heic";
  if (extension === "pdf") return "application/pdf";
  return "application/octet-stream";
}

/** Upload intents only accept the document content types the backend signs. */
export function uploadContentType(mimeType: string, fallback: "image/jpeg" | "image/png"): string {
  const allowed = new Set([
    "application/pdf",
    "image/heic",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);
  return allowed.has(mimeType) ? mimeType : fallback;
}
