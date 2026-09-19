import { sevaFixApi } from "./sevafix-api";
import type { UploadSession } from "./sevafix-types";

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");

export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return bytesToHex(new Uint8Array(digest));
}

export async function uploadDocument(
  applicationId: string,
  documentType: string,
  file: File,
): Promise<{ session: UploadSession; completed: unknown }> {
  const checksum = await sha256Hex(file);
  const session = await sevaFixApi.createUpload({
    applicationId,
    documentType,
    contentType: file.type,
    size: file.size,
    sha256: checksum,
  });

  const uploadResponse = await fetch(session.uploadUrl, {
    method: "PUT",
    body: file,
    headers: session.requiredHeaders,
  });
  if (!uploadResponse.ok) {
    throw new Error(`Document upload failed with HTTP ${uploadResponse.status}`);
  }

  const completed = await sevaFixApi.completeUpload(session.documentId);
  return { session, completed };
}
