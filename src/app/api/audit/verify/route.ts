import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch("http://127.0.0.1:8000/audit/verify", { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to verify audit log" }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in audit verify proxy:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
