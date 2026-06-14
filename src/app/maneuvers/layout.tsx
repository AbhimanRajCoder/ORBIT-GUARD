import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Orbital Maneuver Queue | OrbitGuard",
  description: "Plan, optimize, and schedule evasive collision avoidance burns.",
};

export default function ManeuversLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
