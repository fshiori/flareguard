export type UpstreamRequest = {
  method: string;
  path: string;
  search: string;
  headers: Headers;
  body: BodyInit | null;
};

export function buildCloudflareUrl(path: string, search: string): string {
  return `https://api.cloudflare.com${path}${search}`;
}

export async function fetchCloudflare(
  token: string,
  request: UpstreamRequest
): Promise<Response> {
  const headers = new Headers(request.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.delete("Host");

  return fetch(buildCloudflareUrl(request.path, request.search), {
    method: request.method,
    headers,
    body: request.body
  });
}
