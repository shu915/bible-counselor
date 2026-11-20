import type { MetadataRoute } from "next";

// スマホのホーム画面に追加したときの名前・色・アイコン
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shu の本棚",
    short_name: "Shu の本棚",
    description:
      "悩みや弱音、懺悔を打ち明けると、古典・聖書・リアリズムの言葉を引きながら答えてくれます。",
    start_url: "/",
    display: "standalone",
    background_color: "#faf7f0",
    theme_color: "#17213a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
