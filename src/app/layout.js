import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
