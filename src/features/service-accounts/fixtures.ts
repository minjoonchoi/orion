// Explicit synthetic links. Organization membership does not imply role inheritance.
export const serviceAccountRoles: Record<string, string[]> = {
  "sa-directory-sync": ["role-viewer"],
  "sa-platform-ci": ["role-platform", "role-viewer"],
  "sa-approval-bot": ["role-operator"],
};
export const serviceAccountKeys: Record<string, string[]> = {
  "sa-directory-sync": ["key-directory"],
  "sa-platform-ci": ["key-platform-ci", "key-old-ci"],
  "sa-approval-bot": ["key-approval"],
};
