import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const backendUrl = process.env.BACKEND_URL;
  const backendApiKey = process.env.BACKEND_API_KEY;

  if (!backendUrl || !backendApiKey) {
    return NextResponse.json({ ok: false, error: "Server is not configured" }, { status: 500 });
  }

  const formData = await request.formData();

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/upload`, {
      method: "POST",
      headers: { "x-api-key": backendApiKey },
      body: formData,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not reach the processing service" }, { status: 502 });
  }

  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
