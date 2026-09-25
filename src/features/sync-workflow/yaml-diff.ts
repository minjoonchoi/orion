import { stringify } from "yaml";
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, v]) => [key, normalize(v)]),
    );
  return value;
}
export function yamlLines(value: object | null) {
  return value
    ? stringify(normalize(value), { lineWidth: 0 }).trimEnd().split("\n")
    : [];
}
export function yamlDiff(
  before: object | null,
  after: object | null,
): {
  type: "same" | "remove" | "add";
  text: string;
  old?: number;
  next?: number;
}[] {
  const a = yamlLines(before),
    b = yamlLines(after);
  const result: {
    type: "same" | "remove" | "add";
    text: string;
    old?: number;
    next?: number;
  }[] = [];
  if (a.length * b.length > 1000000) {
    return [
      ...a.map((text, i) => ({ type: "remove" as const, text, old: i + 1 })),
      ...b.map((text, i) => ({ type: "add" as const, text, next: i + 1 })),
    ];
  }
  const lengths = Array.from(
    { length: a.length + 1 },
    () => new Uint32Array(b.length + 1),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lengths[i][j] =
        a[i] === b[j]
          ? lengths[i + 1][j + 1] + 1
          : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
  let i = 0,
    j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      result.push({ type: "same", text: a[i], old: ++i, next: ++j });
    } else if (
      i < a.length &&
      (j === b.length || lengths[i + 1][j] >= lengths[i][j + 1])
    ) {
      result.push({ type: "remove", text: a[i], old: ++i });
    } else {
      result.push({ type: "add", text: b[j], next: ++j });
    }
  }
  return result;
}
