import { NextResponse } from "next/server";

export const runtime = "nodejs";
// The Agent SDK extraction call plus per-transaction categorization/verification
// can run well past typical serverless defaults. This must be set to at most
// the Vercel plan's actual function-duration cap (streaming does not bypass
// it — the connection is still cut at this limit regardless of how much has
// already streamed), and should stay <= the Cloud Run --timeout configured
// for apps/server.
export const maxDuration = 300;

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

  // A successful run and a mid-stream pipeline error both arrive as 200
  // text/event-stream (the error is an event inside the stream) — only
  // pre-hijack validation failures (bad/missing files) are plain JSON.
  if (upstream.headers.get("content-type")?.includes("text/event-stream") && upstream.body) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  const data = await upstream.json().catch(() => ({ ok: false, error: "Upstream error" }));
  return NextResponse.json(data, { status: upstream.status });
}
