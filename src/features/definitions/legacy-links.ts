// Explicit links from the previous global demo IDs. Never resolve by name or path.
export const legacyPages = {
  "page-users": "ws-platform~page-users",
  "page-organizations": "ws-platform~page-organizations",
  "page-roles": "ws-platform~page-roles",
  "page-policies": "ws-platform~page-policies",
  "page-services": "ws-platform~page-services",
  "page-workspaces": "ws-platform~page-workspaces",
  "page-directory": "ws-directory~page-directory",
  "page-approvals": "ws-approval~page-approvals",
} as Record<string, string>;
export const legacyEndpoints = {
  "ep-users": "svc-directory~ep-users",
  "ep-orgs": "svc-directory~ep-orgs",
  "ep-roles": "svc-orion~ep-roles",
  "ep-policies": "svc-orion~ep-policies",
  "ep-approvals": "svc-approval~ep-approvals",
  "ep-approval-submit": "svc-approval~ep-approval-submit",
} as Record<string, string>;
