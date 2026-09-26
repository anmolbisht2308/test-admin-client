import { ApiError, type ApiClient } from "@mockprep/api-client";

/** Authed file download (e.g. an invoice PDF): fetch → blob → save as the server's filename. */
export async function downloadFile(api: ApiClient, path: string, fallbackName: string) {
  const res = await api.fetchRaw(path);
  if (!res.ok) throw await ApiError.fromResponse(res);
  const name =
    /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
