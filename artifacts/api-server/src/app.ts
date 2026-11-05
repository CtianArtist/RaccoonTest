import express, { type Express, type Request } from "express";
import pinoHttp from "pino-http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { clerkClient, clerkMiddleware, getAuth } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { logger } from "./lib/logger";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";
import { internalKey, pythonOrigin, signProof } from "./retail/internal";

const app: Express = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(pinoHttp({ logger, serializers: {
  req(req) { return { id: req.id, method: req.method, path: req.url?.split("?")[0] }; },
  res(res) { return { statusCode: res.statusCode }; },
} }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Public forum HTML and API docs must remain viewable inside Replit Preview.
  res.setHeader("Content-Security-Policy", "frame-ancestors 'self' https://replit.com https://*.replit.dev https://*.replit.app");
  res.setHeader("Cache-Control", "no-store");
  if (process.env.NODE_ENV === "production") res.setHeader("Strict-Transport-Security", "max-age=31536000");
  next();
});
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(express.json({ limit: "100kb" }));

function allowedOrigin(req: Request) {
  const candidates = [process.env.REPLIT_DEV_DOMAIN, ...(process.env.REPLIT_DOMAINS || "").split(",")].filter(Boolean);
  const host = req.hostname;
  if (candidates.includes(host)) return `https://${host}`;
  if (host === "localhost" || host === "127.0.0.1") return `http://${req.get("host")}`;
  throw new Error("Unrecognized application origin");
}

const people = new Map<string, { name: string; email: string; expires: number }>();
async function profile(subject: string) {
  const cached = people.get(subject);
  if (cached && cached.expires > Date.now()) return cached;
  const user = await clerkClient.users.getUser(subject);
  const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress || "";
  const detail = { name: [user.firstName, user.lastName].filter(Boolean).join(" ") || "Customer", email, expires: Date.now() + 60000 };
  if (people.size > 500) people.clear();
  people.set(subject, detail);
  return detail;
}

async function proxy(req: Request, res: express.Response, identity: Record<string, unknown>) {
  const path = req.originalUrl.split("?")[0];
  const url = new URL(req.originalUrl, pythonOrigin);
  try {
    const origin = allowedOrigin(req);
    const headers: Record<string, string> = { ...signProof(req.method, path, {
      ...identity, origin,
      ipHash: createHmac("sha256", internalKey).update(req.ip || "unknown").digest("hex"),
    }), "Content-Type": "application/json" };
    if (req.get("authorization")) headers.authorization = req.get("authorization")!;
    const response = await fetch(url, { method: req.method, headers,
      ...(req.method === "GET" || req.method === "HEAD" ? {} : { body: JSON.stringify(req.body || {}) }),
      signal: AbortSignal.timeout(45000), redirect: "manual",
    });
    res.status(response.status);
    for (const name of ["content-type", "cache-control", "x-robots-tag", "location"])
      if (response.headers.has(name)) res.setHeader(name, response.headers.get(name)!);
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.status(503).json({ error: "Service is temporarily unavailable. Please retry shortly." });
  }
}
// Dedicated service interface never accepts browser session identity or a selected customer.
app.use("/api/integration", (req, res) => {
  if (!req.get("authorization")?.startsWith("Bearer ")) { res.status(401).json({ error: "Integration credential required" }); return; }
  void proxy(req, res, {});
});
app.use(clerkMiddleware(req => ({
  publishableKey: publishableKeyFromHost(getClerkProxyHost(req) ?? "", process.env.CLERK_PUBLISHABLE_KEY),
})));
function csrf(sessionId: string) {
  return createHmac("sha256", internalKey).update(`csrf:${sessionId}`).digest("hex");
}
app.get("/api/auth/csrf", (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId || !auth.sessionId) { res.status(401).json({ error: "Sign in required" }); return; }
  res.json({ csrfToken: csrf(auth.sessionId) });
});
app.use(async (req, res, next) => {
  if (!req.path.startsWith("/api") && !req.path.startsWith("/community") && !["/sitemap.xml", "/robots.txt"].includes(req.path)) { next(); return; }
  const auth = getAuth(req);
  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      const origin = req.get("origin");
      if (origin && origin !== allowedOrigin(req)) { res.status(403).json({ error: "Invalid request origin" }); return; }
    } catch { res.status(403).json({ error: "Invalid request origin" }); return; }
    if (auth.userId && auth.sessionId) {
      const actual = Buffer.from(req.get("x-csrf-token") || ""), expected = Buffer.from(csrf(auth.sessionId));
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        res.status(403).json({ error: "Please refresh your session before trying again" }); return;
      }
    }
  }
  try {
    const user = auth.userId ? await profile(auth.userId) : null;
    await proxy(req, res, { subject: auth.userId || null, name: user?.name, email: user?.email });
  } catch {
    res.status(503).json({ error: "Account service temporarily unavailable" });
  }
});
app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.warn({ kind: error instanceof Error ? error.name : "Error" }, "Gateway request rejected");
  res.status(400).json({ error: "Invalid request" });
});
export default app;
