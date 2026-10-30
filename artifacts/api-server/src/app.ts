import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { session, limit, mutationGuard } from "./support/auth.mjs";
import { supportApi } from "./support/api.mjs";
import { supportWeb } from "./support/web.mjs";
import { pool } from "./support/schema.mjs";

const app: Express = express();
app.disable("x-powered-by");
// Only trust a known, configured proxy hop count. Never trust arbitrary forwarded
// headers from clients. Replit/other reverse proxies must set TRUST_PROXY_HOPS.
const hops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (!Number.isInteger(hops) || hops < 0 || hops > 3) throw new Error("Invalid TRUST_PROXY_HOPS");
app.set("trust proxy", hops);
if (!process.env.PUBLIC_ORIGIN) {
  if (process.env.NODE_ENV === "production") throw new Error("PUBLIC_ORIGIN is required in production.");
  process.env.PUBLIC_ORIGIN = `http://localhost:${process.env.PORT || 5000}`;
}
const origin = new URL(process.env.PUBLIC_ORIGIN);
if (origin.origin !== process.env.PUBLIC_ORIGIN || (process.env.NODE_ENV === "production" && origin.protocol !== "https:")) throw new Error("PUBLIC_ORIGIN must be an origin, using HTTPS in production.");
const base = process.env.PUBLIC_BASE_PATH || "/";
if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base)) throw new Error("PUBLIC_BASE_PATH must start and end with /.");

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use((_req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff").set("X-Frame-Options", "DENY").set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set("Content-Security-Policy", "default-src 'self'; script-src 'self' https://static.zdassets.com https://ekr.zdassets.com; connect-src 'self' https: wss:; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; frame-src https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if (process.env.NODE_ENV === "production") res.set("Strict-Transport-Security", "max-age=31536000");
  next();
});
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));
app.use(cookieParser());
app.use(session);
app.use((req, res, next) => {
  res.on("finish", () => {
    // Route templates, never request bodies, cookies, credentials or query strings.
    const route = String(req.route?.path || "unmatched").slice(0, 150);
    const status = res.statusCode;
    pool.query("INSERT INTO rsc_audit(actor_id,method,path,status,result) VALUES($1,$2,$3,$4,$5)",
      [res.locals.user?.id || res.locals.service?.id || null, req.method, route, status,
        status >= 400 ? "denied-or-failed" : ["POST", "PATCH", "DELETE"].includes(req.method) ? "operation-completed" : "read-completed"])
      .catch(() => logger.error("Audit record could not be persisted."));
  });
  next();
});
app.use(mutationGuard);
app.use((req, res, next) => {
  if (req.path.startsWith(`${base}api/`) || req.path.startsWith(`${base}auth/`) || !["GET", "HEAD", "OPTIONS"].includes(req.method)) return limit(req, res, next);
  return next();
});

app.use(`${base}api`, (_req, res, next) => { res.set("Cache-Control", "no-store").set("X-Robots-Tag", "noindex, nofollow"); next(); }, supportApi());
app.use(`${base}api`, router);
app.use(`${base}api`, (_req, res) => { res.status(404).json({ error: "Endpoint not found." }); });
app.use(base, supportWeb(base));
const staticRoot = process.env.STATIC_ROOT || fileURLToPath(new URL("../../raccoon-supply-shop/dist/public/", import.meta.url));
app.use(base, express.static(path.resolve(staticRoot), { index: false, dotfiles: "deny" }));
app.get(base, (_req, res) => { res.sendFile(path.join(path.resolve(staticRoot), "index.html")); });
app.use((_req, res) => { res.status(404).type("html").send("<h1>Page not found</h1>"); });
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = [400, 401, 403, 404, 409, 413, 429].includes(err.status) ? err.status : 500;
  if (status === 500) logger.error({ type: err.name, code: err.code }, "Request failed.");
  res.status(status).set("Cache-Control", "no-store").json({ error: status === 500 ? "Service temporarily unavailable." : err.message });
});

export default app;
