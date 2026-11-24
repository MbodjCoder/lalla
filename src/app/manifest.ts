import type { MetadataRoute } from "next";

export default function manifeste(): MetadataRoute.Manifest {
  return {
    name: "Lalla — Concierge",
    short_name: "Lalla",
    description: "Votre concierge personnel, dans votre langue, à toute heure.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8f3",
    theme_color: "#f7f8f3",
    icons: [{ src: "/icone.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
