export default function manifest() {
  return {
    name: "Kobby’s Kitchen",
    short_name: "Kobby’s Kitchen",
    description: "Tasty and satisfying meals in Tema Community Two.",
    start_url: "/",
    display: "browser",
    background_color: "#fffdf7",
    theme_color: "#ffd000",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/images/brand/kobbys-logo.png",
        sizes: "673x767",
        type: "image/png",
      },
    ],
  };
}
