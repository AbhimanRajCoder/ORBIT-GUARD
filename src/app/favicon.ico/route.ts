import { NextResponse } from "next/server";

export function GET() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <circle cx="16" cy="16" r="14" fill="none" stroke="#00c8e0" stroke-width="1.5" stroke-dasharray="2,2"/>
  <circle cx="16" cy="16" r="4" fill="#0c1520" stroke="#00c8e0" stroke-width="1.5"/>
  <!-- solar panels -->
  <rect x="3" y="13" width="7" height="6" rx="1.5" fill="#1c2b3a" stroke="#00c8e0" stroke-width="1"/>
  <rect x="22" y="13" width="7" height="6" rx="1.5" fill="#1c2b3a" stroke="#00c8e0" stroke-width="1"/>
  <!-- body and signal beam -->
  <circle cx="16" cy="16" r="1.5" fill="#dce8f0"/>
  <line x1="16" y1="20" x2="16" y2="25" stroke="#00c8e0" stroke-width="1" stroke-dasharray="1,1"/>
  <path d="M13 26 Q 16 29 19 26" fill="none" stroke="#00c8e0" stroke-width="1"/>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
