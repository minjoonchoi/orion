export type Schema<T = unknown> = { parse: (value: unknown) => T };
export const string: Schema<string> = {
  parse: (v) => {
    if (typeof v !== "string") throw Error("Expected string");
    return v;
  },
};
export const number: Schema<number> = {
  parse: (v) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0)
      throw Error("Expected nonnegative number");
    return v;
  },
};
export function nullable<T>(s: Schema<T>): Schema<T | null> {
  return { parse: (v) => (v === null ? null : s.parse(v)) };
}
export function array<T>(s: Schema<T>): Schema<T[]> {
  return {
    parse: (v) => {
      if (!Array.isArray(v)) throw Error("Expected array");
      return v.map((x) => s.parse(x));
    },
  };
}
export function enumeration<const T extends readonly string[]>(
  values: T,
): Schema<T[number]> {
  return {
    parse: (v) => {
      if (typeof v !== "string" || !values.includes(v))
        throw Error("Invalid enum");
      return v as T[number];
    },
  };
}
export function object<S extends Record<string, Schema>>(
  shape: S,
): Schema<{ [K in keyof S]: ReturnType<S[K]["parse"]> }> {
  return {
    parse: (v) => {
      if (!v || typeof v !== "object" || Array.isArray(v))
        throw Error("Expected object");
      return Object.fromEntries(
        Object.entries(shape).map(([k, s]) => [
          k,
          s.parse((v as Record<string, unknown>)[k]),
        ]),
      ) as { [K in keyof S]: ReturnType<S[K]["parse"]> };
    },
  };
}

export const datetime: Schema<string> = {
  parse: (value) => {
    const result = string.parse(value);
    if (
      !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(result) ||
      !Number.isFinite(Date.parse(result))
    )
      throw new Error("Expected ISO timestamp with timezone");
    return result;
  },
};

export function optional<T>(schema: Schema<T>): Schema<T | undefined> {
  return {
    parse: (value) => (value === undefined ? undefined : schema.parse(value)),
  };
}
