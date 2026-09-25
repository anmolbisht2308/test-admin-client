import type { ApiClient } from "@mockprep/api-client";
import { ApiError } from "@mockprep/api-client";
import {
  FIGURE_CONTENT_TYPES,
  MAX_FIGURE_BYTES,
  figurePresignResponseSchema,
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
