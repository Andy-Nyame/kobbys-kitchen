import "./globals.css";

export const metadata = {
  title: "Kobby’s Kitchen",
  description: "Tasty and satisfying meals in Tema Community Two.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
