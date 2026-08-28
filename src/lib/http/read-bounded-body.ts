export type BoundedBodyResult =
  | { readonly success: true; readonly text: string }
  | { readonly success: false; readonly reason: "too_large" };

/** Reads a request stream while enforcing a byte limit for chunked bodies too. */
export async function readBoundedBody(
  request: Request,
  maximumBytes: number,
): Promise<BoundedBodyResult> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    return { success: false, reason: "too_large" };
  }
  if (!request.body) return { success: true, text: "" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    totalBytes += chunk.value.byteLength;
    if (totalBytes > maximumBytes) {
      await reader.cancel();
      return { success: false, reason: "too_large" };
    }
    chunks.push(chunk.value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { success: true, text: new TextDecoder().decode(bytes) };
}
