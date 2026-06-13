const AUTH_KEY = "zc_authenticated";
const AUTH_COOKIE = "zc_auth";

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUTH_KEY) === "1";
}

/** Bypass auth for demo — call after sign-in / sign-up / social login. */
export function completeAuth(displayName?: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_KEY, "1");
  if (displayName?.trim()) {
    localStorage.setItem("zc_display_name", displayName.trim());
  }
  document.cookie = `${AUTH_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_KEY);
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0`;
}
