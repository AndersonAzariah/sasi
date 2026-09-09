import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "SASI — South African Civic Intelligence Platform",
    template: "%s · SASI",
  },
  description:
    "SASI is an independent civic technology platform. Understand what is happening, build the evidence, and take the next step on civic service issues in South Africa.",
  keywords: [
    "SASI",
    "civic intelligence",
    "South Africa",
    "municipal services",
    "water outages",
    "civic technology",
  ],
  applicationName: "SASI",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/sasi-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/sasi-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/sasi-icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  openGraph: {
    title: "SASI — South African Civic Intelligence Platform",
    description:
      "Understand what is happening. Build the evidence. Take the next step.",
    siteName: "SASI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SASI — South African Civic Intelligence Platform",
    description:
      "Independent civic technology for South Africa. Civic intelligence, investigation and evidence.",
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
