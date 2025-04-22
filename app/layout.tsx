import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Configure Inter font
const inter = Inter({ subsets: ["latin"] });

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
    <html lang="en" className={inter.className}>
      <body className="bg-background text-foreground">{children}</body>
    </html>
  );
}
