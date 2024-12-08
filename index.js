import "dotenv/config";
import Fastify from "fastify";
import { Permit } from "permitio";

const fastify = Fastify({});

const permit = new Permit({
  pdp: process.env.PERMIT_PDP_URL,
  token: process.env.PERMIT_API_KEY,
});

fastify.get("/", async () => {
  return { status: "ok" };
});

fastify.post(
  "/access/v1/evaluation",
  async function handler({
    body: {
      subject: { id },
      action: { name: action },
      resource: { type, id: resourceId, properties },
    },
    reply,
  }) {
    const { key, email } = await permit.api.users.get(id);
    console.log("Checking access for", {
      key,
      email,
      action,
      type,
      properties,
    });
    const decision = await permit.check(
      { key, email, attributes: { email } },
      action,
      {
        type,
        attributes: { ...properties },
        id: resourceId,
        tenant: "default",
      }
    );
    console.log("Decision", JSON.stringify({ decision }));
    return { decision };
  }
);

fastify.post(
  "/access/v1/evaluations",
  async function handler({
    body: {
      subject: { id },
      action: { name: action },
      evaluations,
    },
    reply,
  }) {
    const { key, email } = await permit.api.users.get(id);
    console.log(
      "Checking access for",
      evaluations.map(({ resource: { type, id: resourceId, properties } }) => ({
        user: { key, email, attributes: { email } },
        action,
        resource: {
          type,
          attributes: { ...properties },
          id: resourceId,
          tenant: "default",
        },
      }))
    );
    const decisions = await permit.bulkCheck(
      evaluations.map(({ resource: { type, id: resourceId, properties } }) => ({
        user: { key, email, attributes: { email } },
        action,
        resource: {
          type,
          attributes: { ...properties },
          id: resourceId,
          tenant: "default",
        },
      }))
    );
    console.log(
      "Decisions",
      JSON.stringify(decisions.map((decision) => ({ decision })))
    );
    return { evaluations: decisions.map((decision) => ({ decision })) };
  }
);

// Run the server!
try {
  await fastify.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" });
  console.log(`Server listening on ${fastify.server.address().port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
