import "dotenv/config";
import Fastify from "fastify";
import { Permit } from "permitio";

const fastify = Fastify({});

const permit = new Permit({
  pdp: process.env.PERMIT_PDP_URL,
  token: process.env.PERMIT_API_KEY,
});

fastify.post(
  "/access/v1/evaluation",
  async function handler(
    {
      body: {
        subject: { identity },
        action: { name: action },
        resource: { type, ...attributes },
      },
    },
    reply
  ) {
    const { key, email } = await permit.api.users.get(identity);
    const decision = await permit.check(
      { key, email, attributes: { email } },
      action,
      {
        type,
        attributes: attributes,
        tenant: "default",
      }
    );
    return { decision };
  }
);

// Run the server!
try {
  await fastify.listen({ port: 3000 });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
