import { getToken } from "next-auth/jwt";

async function forward(request, context) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.accessToken) return Response.json({ error: "Authentication required" }, { status: 401 });

  const params = await context.params;
  const path = (params.path || []).join("/");
  const upstream = process.env.API_INTERNAL_URL;
  if (!upstream) return Response.json({ error: "API_INTERNAL_URL is not configured" }, { status: 503 });

  const incomingUrl = new URL(request.url);
  const target = new URL(`/api/${path}${incomingUrl.search}`, upstream);
  const headers = new Headers({ authorization: `Bearer ${token.accessToken}` });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();

  try {
    const response = await fetch(target, { method: request.method, headers, body, cache: "no-store" });
    return new Response(response.body, { status: response.status, headers: { "content-type": response.headers.get("content-type") || "application/json" } });
  } catch {
    return Response.json({ error: "API service is unavailable" }, { status: 502 });
  }
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
