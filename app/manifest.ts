import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DineDesk - Smart Restaurant Ordering",
    short_name: "DineDesk",
    description: "Browse menu, customize orders, and pay instantly from your table.",
    start_url: "/",
    display: "standalone",
    background_color: "#0F0F13",
    theme_color: "#E11D48",
  };
}
