import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Visual DAW",
  description: "A digital audio workstation with visual synthesis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
