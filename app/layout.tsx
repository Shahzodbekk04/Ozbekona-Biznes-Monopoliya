import type { Metadata } from "next";
import "./globals.css";
import "./premium.css";
import "./experience.css";

export const metadata: Metadata = {
  title: "O‘zbekona Biznes — Monopoliya",
  description: "Do‘stlar va botlar bilan o‘zbekona iqtisodiy stol o‘yini.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz">
      <body className="antialiased">{children}</body>
    </html>
  );
}
