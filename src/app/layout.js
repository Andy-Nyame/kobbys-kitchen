import "./globals.css";

import { THEME_STORAGE_KEY } from "@/lib/theme";

const themeInitializationScript = `(() => {
  const root = document.documentElement;
  let preference = "system";

  try {
    const savedPreference = window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (["system", "light", "dark"].includes(savedPreference)) {
      preference = savedPreference;
    }
  } catch {}

  const resolvedTheme = preference === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : preference;

  root.dataset.themePreference = preference;
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;
})();`;

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "Kobby's Kitchen",
    template: "%s | Kobby's Kitchen",
  },
  description: "Tasty and satisfying meals in Tema Community Two.",
  openGraph: {
    type: "website",
    siteName: "Kobby's Kitchen",
    title: "Kobby's Kitchen | Fast Food in Tema Community Two",
    description: "Tasty and satisfying meals in Tema Community Two.",
    images: [
      {
        url: "/images/food/fresh-meals-and-takeaway.png",
        alt: "Fresh meals and takeaway from Kobby's Kitchen",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kobby's Kitchen | Fast Food in Tema Community Two",
    description: "Tasty and satisfying meals in Tema Community Two.",
    images: ["/images/food/fresh-meals-and-takeaway.png"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/images/brand/kobbys-logo.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
