import type { FastifyInstance } from "fastify";
import { writeSheet, type DriveTarget } from "../pipeline/writeSheet.js";
import { PipelineError } from "../errors.js";
import { getJob, deleteJob } from "../jobStore.js";

interface ExportBody {
  driveFolderId?: string;
  driveAccessToken?: string;
}

export async function registerExportRoute(app: FastifyInstance): Promise<void> {
  app.post("/export/:jobId", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = getJob(jobId);
    if (!job) {
      return reply.code(404).send({ ok: false, error: "Job not found or expired" });
    }

    const body = (request.body ?? {}) as ExportBody;
    if (!body.driveFolderId || !body.driveAccessToken) {
      return reply.code(400).send({ ok: false, error: "driveFolderId and driveAccessToken are required" });
    }
    const driveTarget: DriveTarget = { folderId: body.driveFolderId, accessToken: body.driveAccessToken };

    try {
      const sheetUrl = await writeSheet(job.categorized, job.result, driveTarget);
      deleteJob(jobId);
      return reply.send({ ok: true, sheetUrl });
    } catch (err) {
      if (err instanceof PipelineError) {
        request.log.error({ err, stage: err.stage }, "export failed");
        return reply.code(502).send({ ok: false, stage: err.stage, error: err.message });
      }
      request.log.error({ err }, "unexpected export failure");
      return reply.code(500).send({ ok: false, stage: "unknown", error: "Unexpected server error" });
    }
  });
}
