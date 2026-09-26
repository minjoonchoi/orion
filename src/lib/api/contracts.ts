import {
  optional,
  datetime as dt,
  string as s,
  number as n,
  nullable as nil,
  array as arr,
  object as obj,
  enumeration as en,
} from "./schema.ts";
const status = en(["active", "inactive"]);
const person = obj({ id: s, name: s });
const userShape = {
  id: s,
  name: s,
  email: s,
  employeeNumber: s,
  title: s,
  status,
  createdAt: dt,
  lastSignedInAt: nil(dt),
};
const user = obj(userShape);
const orgShape = {
  id: s,
  name: s,
  code: s,
  description: s,
  status,
  createdAt: dt,
};
const org = obj(orgShape);
const role = obj({ id: s, name: s, description: s });
const serviceShape = { id: s, name: s, description: s, status };
const service = obj(serviceShape);
const accountShape = {
  id: s,
  name: s,
  description: s,
  status,
  createdAt: dt,
  lastUsedAt: nil(dt),
};
const account = obj(accountShape);
const userRow = obj({ ...userShape, organizations: arr(person), roleCount: n });
const orgRow = obj({
  ...orgShape,
  memberCount: n,
  serviceAccountCount: n,
  serviceCount: n,
  roleCount: n,
});
const roleRow = obj({
  id: s,
  name: s,
  description: s,
  userCount: n,
  organizationCount: n,
  policyCount: n,
});
const policyRow = obj({
  id: s,
  name: s,
  description: s,
  serviceIds: arr(s),
  endpointIds: arr(s),
  workspaceIds: arr(s),
  serviceCount: n,
  endpointCount: n,
  workspaceCount: n,
  effect: optional(en(["allow", "deny"])),
  pageIds: optional(arr(s)),
});
const endpoint = obj({
  id: s,
  name: s,
  serviceId: s,
  serviceName: s,
  method: en(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]),
  path: s,
});
const workspaceShape = { id: s, name: s, description: s };
const workspace = obj(workspaceShape);
const workspaceRow = obj({ ...workspaceShape, pageCount: n });
const page = obj({
  id: s,
  name: s,
  description: s,
  workspaceId: s,
  path: s,
  workspaceName: s,
});
const serviceRow = obj({ ...serviceShape, endpointCount: n });
const key = obj({
  id: s,
  name: s,
  description: s,
  displayHint: s,
  status: en(["active", "expired", "revoked"]),
  organizationId: s,
  ownerId: s,
  createdAt: dt,
  expiresAt: nil(dt),
  lastUsedAt: nil(dt),
  revokedAt: nil(dt),
  organization: person,
  owner: person,
  approvalCount: n,
});
const approvalShape = {
  id: s,
  keyId: s,
  templateId: s,
  type: en(["issue", "renew", "revoke"]),
  status: en(["pending", "approved", "rejected"]),
  requesterId: s,
  reviewerId: nil(s),
  requestedAt: dt,
  decidedAt: nil(dt),
  reason: s,
  comment: nil(s),
  requester: person,
  reviewer: nil(person),
};
const approval = obj({
  ...approvalShape,
  title: s,
  keyName: s,
  templateName: s,
  templateVersion: n,
});
const template = obj({
  id: s,
  name: s,
  description: s,
  type: en(["issue", "renew", "revoke"]),
  version: n,
  status,
  instructions: s,
  createdAt: dt,
  updatedAt: dt,
});
const accountRow = obj({
  ...accountShape,
  organization: person,
  roleCount: n,
  keyCount: n,
});
export const contracts = {
  users: {
    list: userRow,
    detail: obj({
      user,
      organizations: arr(obj({ ...orgShape, joinedAt: dt })),
      roles: arr(role),
    }),
  },
  organizations: {
    list: orgRow,
    detail: obj({
      organization: orgRow,
      members: arr(obj({ ...userShape, joinedAt: dt })),
      serviceAccounts: arr(account),
      services: arr(service),
      roles: arr(role),
    }),
  },
  roles: {
    list: roleRow,
    detail: obj({
      role: roleRow,
      users: arr(user),
      organizations: arr(org),
      policies: arr(policyRow),
    }),
  },
  policies: {
    list: policyRow,
    detail: obj({
      policy: policyRow,
      services: arr(service),
      endpoints: arr(endpoint),
      workspaces: arr(workspace),
      pages: optional(arr(page)),
    }),
  },
  services: {
    list: serviceRow,
    detail: obj({ service: serviceRow, endpoints: arr(endpoint) }),
  },
  "service-endpoints": { list: endpoint, detail: endpoint },
  workspaces: {
    list: workspaceRow,
    detail: obj({ workspace: workspaceRow, pages: arr(page) }),
  },
  pages: { list: page, detail: page },
  "api-keys": {
    list: key,
    detail: obj({ key, approvals: arr(obj(approvalShape)) }),
  },
  "approval-templates": { list: template, detail: template },
  approvals: { list: approval, detail: approval },
  "service-accounts": {
    list: accountRow,
    detail: obj({ account: accountRow, roles: arr(role), keys: arr(key) }),
  },
};
export const relatedGroups = arr(
  obj({ title: s, rows: arr(obj({ id: s, name: s, href: s })) }),
);
