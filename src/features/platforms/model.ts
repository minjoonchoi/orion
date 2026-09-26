import {
  object,
  array,
  string,
  enumeration,
  number,
} from "../../lib/api/schema.ts";
const named = object({ id: string, name: string });
export const directorySchema = object({
  revision: number,
  platforms: array(
    object({
      id: string,
      name: string,
      description: string,
      status: enumeration(["active", "inactive"]),
      provider: string,
      issuer: string,
      clientId: string,
      loginPath: string,
    }),
  ),
  members: array(
    object({
      id: string,
      platformId: string,
      userId: string,
      name: string,
      email: string,
      status: enumeration(["active", "suspended"]),
    }),
  ),
  users: array(object({ id: string, name: string, email: string })),
  userRoles: array(
    object({ userId: string, platformId: string, roleIds: array(string) }),
  ),
  roles: array(
    object({
      id: string,
      platformId: string,
      name: string,
      description: string,
      policyIds: array(string),
    }),
  ),
  workspaces: array(object({ id: string, platformId: string, name: string })),
  accounts: array(object({ id: string, name: string, roleIds: array(string) })),
  organizations: array(
    object({
      id: string,
      name: string,
      platformId: string,
      roleIds: array(string),
    }),
  ),
  policies: array(named),
});
export type Directory = ReturnType<typeof directorySchema.parse>;
export function validateDirectory(value: unknown): Directory {
  const d = directorySchema.parse(value);
  const hasPlatform = (id: string) => d.platforms.some((p) => p.id === id);
  for (const rows of [d.platforms, d.roles, d.workspaces, d.accounts, d.users])
    if (new Set(rows.map((r) => r.id)).size !== rows.length)
      throw Error("DUPLICATE_ID");
  if (
    new Set(d.members.map((m) => `${m.platformId}/${m.id}`)).size !==
    d.members.length
  )
    throw Error("DUPLICATE_MEMBER");
  if (
    new Set(d.members.map((m) => m.platformId + "/" + m.userId)).size !==
    d.members.length
  )
    throw Error("DUPLICATE_MEMBERSHIP");
  for (const r of [
    ...d.roles,
    ...d.workspaces,
    ...d.members,
    ...d.organizations,
    ...d.userRoles,
  ])
    if (!hasPlatform(r.platformId)) throw Error("PLATFORM_NOT_FOUND");
  if (
    new Set(d.userRoles.map((m) => m.platformId + "/" + m.userId)).size !==
    d.userRoles.length
  )
    throw Error("DUPLICATE_ASSIGNMENT");
  for (const m of [...d.members, ...d.userRoles])
    if (!d.users.some((u) => u.id === m.userId)) throw Error("USER_NOT_FOUND");
  for (const m of [...d.userRoles, ...d.organizations])
    if (
      m.roleIds.some(
        (id) =>
          !d.roles.some((r) => r.id === id && r.platformId === m.platformId),
      )
    )
      throw Error("ROLE_SCOPE_MISMATCH");
  for (const a of d.accounts)
    if (
      a.roleIds.some(
        (id) => !d.roles.some((r) => r.id === id && r.platformId === "orion"),
      )
    )
      throw Error("SERVICE_ACCOUNT_ROLE_SCOPE");
  return d;
}

export function userRoleIds(d: Directory, userId: string, platformId?: string) {
  return d.userRoles
    .filter(
      (a) =>
        a.userId === userId && (!platformId || a.platformId === platformId),
    )
    .flatMap((a) => a.roleIds);
}
export function updateUserRoles(
  d: Directory,
  platformId: string,
  userId: string,
  roleIds: string[],
  revision: number,
): Directory {
  if (d.revision !== revision) throw Error("REVISION_CONFLICT");
  if (
    !d.users.some((u) => u.id === userId) ||
    !d.platforms.some((p) => p.id === platformId && p.status === "active")
  )
    throw Error("SUBJECT_NOT_FOUND");
  if (
    !Array.isArray(roleIds) ||
    roleIds.some(
      (id) => !d.roles.some((r) => r.id === id && r.platformId === platformId),
    )
  )
    throw Error("ROLE_SCOPE_MISMATCH");
  return validateDirectory({
    ...d,
    revision: d.revision + 1,
    userRoles: [
      ...d.userRoles.filter(
        (a) => a.platformId !== platformId || a.userId !== userId,
      ),
      { platformId, userId, roleIds: [...new Set(roleIds)] },
    ],
  });
}

export type RecipientChange = {
  kind: "members" | "role-users";
  platformId: string;
  roleId?: string;
  operation: "add" | "remove";
  userIds: string[];
  expectedRevision: number;
};
export function changeRecipients(
  d: Directory,
  change: RecipientChange,
): Directory {
  if (d.revision !== change.expectedRevision) throw Error("REVISION_CONFLICT");
  if (
    !d.platforms.some(
      (p) => p.id === change.platformId && p.status === "active",
    )
  )
    throw Error("PLATFORM_NOT_FOUND");
  if (
    !["members", "role-users"].includes(change.kind) ||
    !["add", "remove"].includes(change.operation)
  )
    throw Error("INVALID_CHANGE");
  if (
    !Array.isArray(change.userIds) ||
    !change.userIds.length ||
    new Set(change.userIds).size !== change.userIds.length ||
    change.userIds.some((id) => !d.users.some((u) => u.id === id))
  )
    throw Error("INVALID_USERS");
  if (change.kind === "members") {
    if (change.operation !== "add") throw Error("INVALID_CHANGE");
    if (
      change.userIds.some((id) =>
        d.members.some(
          (m) => m.platformId === change.platformId && m.userId === id,
        ),
      )
    )
      throw Error("ALREADY_MEMBER");
    return validateDirectory({
      ...d,
      revision: d.revision + 1,
      members: [
        ...d.members,
        ...change.userIds.map((id) => {
          const u = d.users.find((u) => u.id === id)!;
          // Deterministic ID is scoped to the platform; existing IDs remain unchanged.
          let memberId = "user-" + encodeURIComponent(id);
          while (
            d.members.some(
              (m) => m.platformId === change.platformId && m.id === memberId,
            )
          )
            memberId += "-new";
          return {
            id: memberId,
            platformId: change.platformId,
            userId: id,
            name: u.name,
            email: u.email,
            status: "active",
          };
        }),
      ],
    });
  }
  const role = d.roles.find(
    (r) => r.id === change.roleId && r.platformId === change.platformId,
  );
  if (!role) throw Error("ROLE_SCOPE_MISMATCH");
  const assignments = d.userRoles.map((a) => ({
    ...a,
    roleIds: [...a.roleIds],
  }));
  for (const userId of change.userIds) {
    let a = assignments.find(
      (a) => a.userId === userId && a.platformId === change.platformId,
    );
    const exists = !!a?.roleIds.includes(role.id);
    if (
      (change.operation === "add" && exists) ||
      (change.operation === "remove" && !exists)
    )
      throw Error("ASSIGNMENT_CONFLICT");
    if (!a) {
      a = { userId, platformId: change.platformId, roleIds: [] };
      assignments.push(a);
    }
    a.roleIds =
      change.operation === "add"
        ? [...a.roleIds, role.id]
        : a.roleIds.filter((id) => id !== role.id);
  }
  return validateDirectory({
    ...d,
    revision: d.revision + 1,
    userRoles: assignments,
  });
}
