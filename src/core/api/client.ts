export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}
/** Optional future Go API. No request is sent unless a base URL is configured. */
export class ApiClient {
  constructor(private baseUrl = process.env.EXPO_PUBLIC_API_URL ?? "") {}
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.baseUrl)
      throw new ApiError("API bağlantısı henüz yapılandırılmadı.");
    if (!path.startsWith("/") || path.startsWith("//"))
      throw new ApiError("API yolu geçersiz.");
    const headers = new Headers(init.headers);
    if (!headers.has("Content-Type"))
      headers.set("Content-Type", "application/json");
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new ApiError(
        `Sunucu isteği başarısız (${response.status}).`,
        response.status,
      );
    return response.status === 204
      ? (undefined as T)
      : ((await response.json()) as T);
  }
}
export const apiClient = new ApiClient();
