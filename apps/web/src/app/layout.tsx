import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import SiteHeader from "@/components/SiteHeader";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Civil Automation Hub",
  description: "Day-to-day civil engineering automation tools. Excel in, Excel out.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Applies a saved theme before first paint to avoid a light/dark flash.
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">
        <SiteHeader />
        {children}
        <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-muted sm:px-6">
          Your files are processed locally in your browser. Nothing is uploaded.
        </footer>
      </body>
    </html>
  );
}
