import type { ApiClient } from "@mockprep/api-client";
import { ApiError } from "@mockprep/api-client";
import {
  FIGURE_CONTENT_TYPES,
  MAX_FIGURE_BYTES,
  MAX_UPLOAD_BYTES,
  UPLOAD_CONTENT_TYPES,
  figurePresignResponseSchema,
  type StoredFileInput,
  type UploadFileKind,
} from "@mockprep/types";

/** Presign → PUT the bytes (to S3, or the api's local driver) → the URL to store on the question. */
export async function uploadFigure(api: ApiClient, file: File): Promise<string> {
  if (!(FIGURE_CONTENT_TYPES as readonly string[]).includes(file.type)) {
    throw new ApiError(400, "Use a PNG, JPEG, WebP or GIF image");
  }
  if (file.size > MAX_FIGURE_BYTES) throw new ApiError(400, "Images must be 2 MB or smaller");
  const target = await api.request("/api/admin/figures/presign", {
    method: "POST",
    body: { contentType: file.type, size: file.size },
    schema: figurePresignResponseSchema,
  });
  // The signed URL is the permission: no cookies or Authorization header.
  const res = await fetch(target.uploadUrl, {
    method: "PUT",
    headers: target.headers,
    body: file,
    credentials: "omit",
  });
  if (!res.ok) throw new ApiError(res.status, "Upload failed. Please try again.");
  return target.fileUrl;
}

/** Presign → PUT a question paper / answer key / solutions file for a PDF upload. */
export async function uploadPaperFile(
  api: ApiClient,
  file: File,
  kind: UploadFileKind,
): Promise<StoredFileInput> {
  const contentType = UPLOAD_CONTENT_TYPES.find((t) => t === file.type);
  if (!contentType || (kind === "paper" && contentType !== "application/pdf")) {
    throw new ApiError(
      400,
      kind === "paper" ? "The question paper must be a PDF" : "Use a PDF or an image",
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(400, "Files must be 25 MB or smaller");
  const target = await api.request("/api/admin/uploads/presign", {
    method: "POST",
    body: { kind, contentType, size: file.size },
    schema: figurePresignResponseSchema,
  });
  const res = await fetch(target.uploadUrl, {
    method: "PUT",
    headers: target.headers,
    body: file,
    credentials: "omit",
  });
  if (!res.ok) throw new ApiError(res.status, "Upload failed. Please try again.");
  // Both drivers put the storage key at the end of the file URL.
  const key = /(uploads\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.\w+)$/.exec(target.fileUrl)?.[1];
  if (!key) throw new ApiError(500, "Unexpected upload URL");
  return { key, name: file.name.slice(0, 200), contentType };
}
