import { NextRequest, NextResponse } from "next/server";

const CONTACT_API_URL =
  process.env.CONTACT_API_URL || "http://localhost:4000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetch(`${CONTACT_API_URL}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      console.error("Backend error:", await res.text());
      return NextResponse.json(
        { error: "Failed to create contact" },
        { status: 500 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("API route error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
