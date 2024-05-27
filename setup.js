import "dotenv/config";
import { Permit } from "permitio";

const permit = new Permit({
  token: process.env.PERMIT_API_KEY,
});

const resources = async () => {
  await permit.api.resources.create({
    key: "user",
    name: "User",
    attributes: {
      userID: { type: "string" },
    },
    actions: {
      can_read_user: {
        name: "can_read_user",
      },
    },
  });
  await permit.api.resources.create({
    key: "todo",
    name: "Task",
    attributes: {
      ownerID: { type: "string" },
    },
    actions: {
      can_read_todos: {
        name: "can_read_todos",
      },
      can_update_todo: {
        name: "can_update_todo",
      },
      can_delete_todo: {
        name: "can_delete_todo",
      },
      can_create_todo: {
        name: "can_create_todo",
      },
    },
  });
};

const roles = async () => {
  await permit.api.roles.create({
    key: "admin",
    name: "Admin",
    permissions: [
      "todo:can_read_todos",
      "todo:can_delete_todo",
      "todo:can_create_todo",
      "user:can_read_user",
    ],
  });
  await permit.api.roles.create({
    key: "viewer",
    name: "Viewer",
    permissions: ["todo:can_read_todos", "user:can_read_user"],
  });
  await permit.api.roles.create({
    key: "editor",
    name: "Editor",
    permissions: [
      "todo:can_read_todos",
      "todo:can_create_todo",
      "user:can_read_user",
    ],
  });
  await permit.api.roles.create({
    key: "evil_genius",
    name: "Evil Genius",
    permissions: [
      "todo:can_read_todos",
      "todo:can_update_todo",
      "todo:can_create_todo",
      "user:can_read_user",
    ],
  });
};

const abac = async () => {
  await permit.api.conditionSets.create({
    key: "owned_tasks",
    name: "Owned Tasks",
    type: "resourceset",
    resource_id: "todo",
    conditions: {
      allOf: [
        { allOf: [{ "resource.ownerID": { equals: { ref: "user.email" } } }] },
      ],
    },
  });
  await permit.api.conditionSetRules.create({
    resource_set: "owned_tasks",
    permission: "todo:can_update_todo",
    is_role: true,
    user_set: "editor",
  });
  await permit.api.conditionSetRules.create({
    resource_set: "owned_tasks",
    permission: "todo:can_delete_todo",
    is_role: true,
    user_set: "editor",
  });
  await permit.api.conditionSetRules.create({
    resource_set: "owned_tasks",
    permission: "todo:can_delete_todo",
    is_role: true,
    user_set: "evil_genius",
  });
  await permit.api.conditionSetRules.create({
    resource_set: "owned_tasks",
    permission: "todo:can_update_todo",
    is_role: true,
    user_set: "admin",
  });
};

const users = async () => {
  const interopUsers = {
    CiRmZDA2MTRkMy1jMzlhLTQ3ODEtYjdiZC04Yjk2ZjVhNTEwMGQSBWxvY2Fs: {
      id: "rick@the-citadel.com",
      name: "Rick Sanchez",
      email: "rick@the-citadel.com",
      roles: ["admin", "evil_genius"],
      picture:
        "https://www.topaz.sh/assets/templates/citadel/img/Rick%20Sanchez.jpg",
    },
    CiRmZDM2MTRkMy1jMzlhLTQ3ODEtYjdiZC04Yjk2ZjVhNTEwMGQSBWxvY2Fs: {
      id: "beth@the-smiths.com",
      name: "Beth Smith",
      email: "beth@the-smiths.com",
      roles: ["viewer"],
      picture:
        "https://www.topaz.sh/assets/templates/citadel/img/Beth%20Smith.jpg",
    },
    CiRmZDE2MTRkMy1jMzlhLTQ3ODEtYjdiZC04Yjk2ZjVhNTEwMGQSBWxvY2Fs: {
      id: "morty@the-citadel.com",
      name: "Morty Smith",
      email: "morty@the-citadel.com",
      roles: ["editor"],
      picture:
        "https://www.topaz.sh/assets/templates/citadel/img/Morty%20Smith.jpg",
    },
    CiRmZDI2MTRkMy1jMzlhLTQ3ODEtYjdiZC04Yjk2ZjVhNTEwMGQSBWxvY2Fs: {
      id: "summer@the-smiths.com",
      name: "Summer Smith",
      email: "summer@the-smiths.com",
      roles: ["editor"],
      picture:
        "https://www.topaz.sh/assets/templates/citadel/img/Summer%20Smith.jpg",
    },
    CiRmZDQ2MTRkMy1jMzlhLTQ3ODEtYjdiZC04Yjk2ZjVhNTEwMGQSBWxvY2Fs: {
      id: "jerry@the-smiths.com",
      name: "Jerry Smith",
      email: "jerry@the-smiths.com",
      roles: ["viewer"],
      picture:
        "https://www.topaz.sh/assets/templates/citadel/img/Jerry%20Smith.jpg",
    },
  };
  for (const [key, { id: email, name, roles }] of Object.entries(
    interopUsers
  )) {
    await permit.api.users.create({
      key,
      email,
      first_name: name.split(" ")[0],
      last_name: name.split(" ")[1],
    });
    for (const role of roles) {
      await permit.api.users.assignRole({
        user: key,
        role,
        tenant: "default",
      });
    }
  }
};

(async () => {
  await resources();
  await roles();
  await abac();
  await users();
})();
