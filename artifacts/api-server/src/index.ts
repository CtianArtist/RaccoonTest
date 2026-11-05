import app from "./app";
import { logger } from "./lib/logger";
import { spawn } from "node:child_process";
import path from "node:path";
import { internalKey, pythonOrigin, signProof } from "./retail/internal";
import { seedDevelopment } from "./retail/seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);
const workspaceRoot = path.resolve(import.meta.dirname, "../../..");

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const childEnvironment: NodeJS.ProcessEnv = { ...process.env, RSC_INTERNAL_KEY: internalKey };
const child = spawn("uv", ["run", "python", "-m", "uvicorn", "retail.main:app",
  "--app-dir", path.join(workspaceRoot, "artifacts/api-server/python"), "--host", "127.0.0.1",
  "--port", "5041", "--no-access-log"], {
  cwd: workspaceRoot, stdio: ["ignore", "inherit", "inherit"],
  env: childEnvironment,
});
child.once("exit", code => { logger.error({ code }, "Python backend exited"); process.exit(code || 1); });
await seedDevelopment();
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    const health = await fetch(`${pythonOrigin}/api/healthz`, { headers: signProof("GET", "/api/healthz") });
    if (health.ok) break;
  } catch { /* allow the child to bind */ }
  if (attempt === 59) throw new Error("Python backend failed to start");
  await new Promise(resolve => setTimeout(resolve, 500));
}
const server = app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
logger.info("Fictional checkout enabled; no payment provider is configured");
process.on("SIGTERM", () => { child.kill(); server.close(() => process.exit(0)); });
