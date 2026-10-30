import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Extract project ref from Supabase URL to scope CSP (e.g. "abc123" from "https://abc123.supabase.co")
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseHost = supabaseUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
const supabaseCsp = supabaseHost || "*.supabase.co";

const securityHeaders = [
  // Prevent clickjacking
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Stop MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Control referrer info
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Force HTTPS for 1 year (only applied on HTTPS)
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  // Restrict browser features
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self)",
  },
  // XSS protection header for legacy browsers
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // Content Security Policy
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js requires 'unsafe-inline' for styles; nonce-based CSP needs additional setup
      "style-src 'self' 'unsafe-inline'",
      // Scripts: self + Razorpay SDK + (unsafe-eval in development for Fast Refresh)
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com"
        : "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com",
      // Images: self + data URIs (QR codes) + Supabase + Unsplash
      `img-src 'self' data: blob: https://${supabaseCsp} https://images.unsplash.com`,
      // Frames: Razorpay payment iframe
      "frame-src https://api.razorpay.com https://checkout.razorpay.com",
      // API connections + HMR WebSockets in development
      isDev
        ? `connect-src 'self' https://${supabaseCsp} wss://${supabaseCsp} https://api.razorpay.com ws://localhost:* wss://localhost:* ws://127.0.0.1:* wss://127.0.0.1:*`
        : `connect-src 'self' https://${supabaseCsp} wss://${supabaseCsp} https://api.razorpay.com`,
      // Fonts: local only
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: supabaseHost || "*.supabase.co" },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60,
  },

  // Compress responses
  compress: true,

  // Power header removal (minor security improvement)
  poweredByHeader: false,

  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // Immutable cache for static assets
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
