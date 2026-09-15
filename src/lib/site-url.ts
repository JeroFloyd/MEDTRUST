/**
 * The source APIs live on the Convex HTTP surface (.convex.site). The browser
 * already knows the deployment URL (VITE_CONVEX_URL points at .convex.cloud), so
 * we derive the site origin here and hand it to the mediator. That lets the
 * integration run over real HTTP even when the deployment environment does not
 * expose CONVEX_SITE_URL to the functions.
 */
export function convexSiteUrl(): string | undefined {
  const deployment = import.meta.env.VITE_CONVEX_URL as string | undefined;
  if (!deployment) return undefined;
  try {
    const url = new URL(deployment);
    url.hostname = url.hostname.replace(/\.convex\.cloud$/, ".convex.site");
    if (!url.hostname.endsWith(".convex.site")) return undefined;
    return `${url.protocol}//${url.hostname}`;
  } catch {
    return undefined;
  }
}

export function apiUrl(path: string): string {
  const base = convexSiteUrl();
  if (!base) return path;
  return `${base}${path}`;
}
