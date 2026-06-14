import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "3D Orbit Map | OrbitGuard",
  description: "Live interactive 3D space situational awareness simulation.",
};

export default function MapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
