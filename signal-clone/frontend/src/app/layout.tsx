import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { themeBootScript } from "@/stores/ui";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Signal",
  description: "A Signal Desktop clone",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Static script (no user content): applies the saved theme before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className={`${inter.variable} antialiased`}>
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: "var(--gray-80)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontFamily: "var(--font-sans)",
            },
          }}
        />
      </body>
    </html>
  );
}
