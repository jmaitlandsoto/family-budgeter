import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { config } from "./config.js";
import { registerUploadRoute } from "./routes/upload.js";

const app = Fastify({ logger: true });

await app.register(multipart);

app.addHook("onRequest", async (request, reply) => {
  if (request.url === "/health") return;
  if (request.headers["x-api-key"] !== config.backendApiKey) {
    return reply.code(401).send({ ok: false, error: "Unauthorized" });
  }
});

app.get("/health", async () => ({ ok: true }));

await registerUploadRoute(app);

try {
  await app.listen({ port: config.port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
