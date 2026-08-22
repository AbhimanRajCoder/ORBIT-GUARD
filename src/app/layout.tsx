import type { Metadata, Viewport } from "next";
import { Playfair_Display, Roboto_Mono, Inter } from "next/font/google";
import { Topbar } from "@/components/dashboard/Topbar";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { AlertBanner } from "@/components/dashboard/AlertBanner";
import { ToastProvider } from "@/lib/toast-context";
import { ToastContainer } from "@/components/ui/Toast";
import { StreamProvider } from "@/lib/hooks/useOrbitStream";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"]
});

const robotoMono = Roboto_Mono({
  variable: "--font-data",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "OrbitGuard — Automated Space Traffic Control",
  description:
    "Real-time satellite tracking, AI-powered collision avoidance, and autonomous operator negotiation. A mission-control dashboard for Earth's orbit.",
  keywords: [
    "space traffic control",
    "satellite collision avoidance",
    "orbital mechanics",
    "space debris",
    "Kessler Syndrome",
    "AI negotiation",
    "Three.js",
    "space situational awareness",
  ],
  authors: [{ name: "OrbitGuard Team" }],
  robots: "index, follow",
  openGraph: {
    title: "OrbitGuard — Automated Space Traffic Control",
    description:
      "Real-time 3D satellite tracking, AI-powered collision avoidance, and autonomous operator negotiation in a cinematic mission-control interface.",
    siteName: "OrbitGuard",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "OrbitGuard — Space Traffic Control",
    description:
      "Automated collision avoidance system for satellite operators. 3D orbit visualization, AI negotiation, and real-time SSE telemetry.",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

import { UIProvider } from "@/lib/ui-context";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${playfair.variable} ${robotoMono.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-void text-bone font-body flex">
        <ToastProvider>
          <UIProvider>
            <StreamProvider>
              <WorkspaceShell>
                {children}
              </WorkspaceShell>
              <ToastContainer />
            </StreamProvider>
          </UIProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
