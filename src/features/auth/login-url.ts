/** Only trusted deployment configuration supplies the login URL, never query parameters. */
export function resolveLoginUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.hash
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
