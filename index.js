import "dotenv/config";
import Fastify from "fastify";
import { Permit } from "permitio";

const fastify = Fastify({});

const permit = new Permit({
  pdp: process.env.PERMIT_PDP_URL,
  token: process.env.PERMIT_API_KEY,
});

const permitIdp = new Permit({
  pdp: process.env.PERMIT_IDP_PDP_URL,
  token: process.env.PERMIT_IDP_API_KEY,
});

// Cache for scope to avoid fetching on every request
let idpScopeCache = null;

// Helper function to get scope (project/env) from API key
async function getScope(apiKey) {
  // Return cached scope if available
  if (idpScopeCache) {
    return idpScopeCache;
  }

  const response = await fetch("https://api.permit.io/v2/api-key/scope", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get scope: ${response.status} ${response.statusText}`);
  }

  const scope = await response.json();
  // Cache the scope
  idpScopeCache = scope;
  return scope;
}

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

fastify.post(
  "/access/v1/search/resource",
  async function handler({
    body: {
      subject: { id },
      action: { name: action },
      resource: { type: resourceType },
    },
    reply,
  }) {
    console.log("Searching resources for", {
      userId: id,
      action,
      resourceType,
    });


    try {
      // Get user details first (API expects a User object, not just a string)
      const userData = await permitIdp.api.users.get(id);
      
      // Get scope (project/env) from API key
      const scope = await getScope(process.env.PERMIT_IDP_API_KEY);
      const projectId = scope.project_id;
      const environmentId = scope.environment_id;

      console.log("Getting user permissions for", {
        userId: id,
        userKey: userData.key,
        projectId,
        environmentId,
        action,
        resourceType,
      });

      // Call the raw user-permissions API endpoint
      // The API expects a User object with at least a 'key' field
      const response = await fetch(`${process.env.PERMIT_IDP_PDP_URL}/user-permissions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PERMIT_IDP_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user: {
            key: userData.key,
            email: userData.email,
            attributes: userData.attributes || {},
          },
          tenants: ["default"],
          resource_types: [resourceType],
          action: action,
          context: {
            enable_abac_user_permissions: true,
            project_id: projectId,
            environment_id: environmentId,
          },
        }),
      });

      console.log("Permissions", JSON.stringify(response));

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get user permissions: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const permissions = await response.json();

      // Map action name to permission format (e.g., "delete" -> "record:delete")
      const permissionKey = `${resourceType}:${action}`;

      // Filter permissions to find resources where user has the specific action
      const results = [];

      // The API returns IUserPermissions: an object where keys are resource IDs
      // and values are ResourcePermissions objects with a 'permissions' array
      // Format: { "resourceId": { permissions: ["record:delete", ...], resource?: {...} } }
      for (const [resourceId, permissionData] of Object.entries(permissions || {})) {
        // Check if this resource has the specific action permission
        if (permissionData?.permissions?.includes(permissionKey)) {
          results.push({
            type: resourceType,
            id: resourceId,
          });
        }
      }

      console.log("Search results", JSON.stringify({ results }));
      return { results };
    } catch (error) {
      console.error("Error searching resources:", error);
      // Return empty results on error (as per AuthZEN spec)
      return { results: [] };
    }
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
