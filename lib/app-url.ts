export function getPublicAppUrl(): string | null {
  const isProduction = process.env.NODE_ENV === "production";
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredUrl) {
    try {
      const url = new URL(configuredUrl);
      const isLocalHost = ["localhost", "127.0.0.1", "0.0.0.0"].includes(
        url.hostname
      );
      if (!isProduction || !isLocalHost) return url.origin;
    } catch {
      if (!isProduction) return null;
    }
  }

  const deploymentHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    (isProduction ? process.env.VERCEL_URL : undefined);
  if (deploymentHost) return `https://${deploymentHost.replace(/^https?:\/\//, "")}`;

  return isProduction ? null : "http://localhost:3000";
}
