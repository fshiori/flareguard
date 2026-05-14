export type UpstreamRequest = {
  method: string;
  path: string;
  search: string;
  headers: Headers;
  body: BodyInit | null;
  authorization?: string;
};

export function buildCloudflareUrl(path: string, search: string): string {
  return `https://api.cloudflare.com${path}${search}`;
}

export async function fetchCloudflare(
  token: string,
  request: UpstreamRequest
): Promise<Response> {
  const headers = new Headers(request.headers);
  headers.set("Authorization", request.authorization ?? `Bearer ${token}`);
  headers.delete("Host");
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");

  return fetch(buildCloudflareUrl(request.path, request.search), {
    method: request.method,
    headers,
    body: request.body
  });
}
