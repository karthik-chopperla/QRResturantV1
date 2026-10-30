import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "QRFast - Smart QR Dine-In Ordering",
    short_name: "QRFast",
    description: "Browse menu, customize orders, and pay instantly from your table.",
    start_url: "/",
    display: "standalone",
    background_color: "#0F0F13",
    theme_color: "#E11D48",
    icons: [
      { src: "/icon.png", sizes: "any", type: "image/png" },
    ],
  };
}
