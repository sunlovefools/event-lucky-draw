import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Event Station Quest Lucky Draw",
  description: "Hosted event lucky draw application",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Righteous&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <a href="#main" className="visually-hidden">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
