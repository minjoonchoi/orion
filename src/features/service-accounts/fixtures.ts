import { apiKeys } from "../api-keys/fixtures";
// Explicit synthetic links. Organization membership does not imply role inheritance.
export const serviceAccountRoles: Record<string, string[]> = {
  "sa-directory-sync": ["role-viewer"],
  "sa-platform-ci": ["role-platform", "role-viewer"],
  "sa-approval-bot": ["role-operator"],
};
// Derived from each key's single owner; never maintain a second independent mapping.
export const serviceAccountKeys: Record<string, string[]> = Object.fromEntries(
  [...new Set(apiKeys.map((key) => key.serviceAccountId))].map((id) => [
    id,
    apiKeys.filter((key) => key.serviceAccountId === id).map((key) => key.id),
  ]),
);
