import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const backendUrl = process.env.BACKEND_URL;
  const backendApiKey = process.env.BACKEND_API_KEY;

  if (!backendUrl || !backendApiKey) {
    return NextResponse.json({ ok: false, error: "Server is not configured" }, { status: 500 });
  }

  const { jobId, ...rest } = await request.json();
  if (!jobId || typeof jobId !== "string") {
    return NextResponse.json({ ok: false, error: "Missing jobId" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/export/${encodeURIComponent(jobId)}`, {
      method: "POST",
      headers: { "x-api-key": backendApiKey, "Content-Type": "application/json" },
      body: JSON.stringify(rest),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not reach the processing service" }, { status: 502 });
  }

  const data = await upstream.json().catch(() => ({ ok: false, error: "Upstream error" }));
  return NextResponse.json(data, { status: upstream.status });
}
