import type { FastifyReply, FastifyRequest } from "fastify";

export const createRestoreAdmission = () => {
  const active = new Set<string>();
  const release = async (request: FastifyRequest): Promise<void> => {
    active.delete(request.id);
  };
  const acquire = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (active.size > 0) {
      request.log.warn({ event: "restore_upload_busy" }, "Another restore upload is in progress");
      await reply.header("Retry-After", "5").code(409).send({
        error: "Another restore upload is in progress. Try again after it completes."
      });
      return;
    }
    active.add(request.id);
    request.raw.once("aborted", () => { active.delete(request.id); });
  };
  return { acquire, release };
};
