import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agency Factory",
  description: "Multi-tenant AI agent management platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
