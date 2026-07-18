import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Event Station Quest Lucky Draw",
  description: "Hosted event lucky draw application",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
