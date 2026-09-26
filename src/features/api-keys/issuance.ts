"use server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { deployment } from "@/lib/api/server";
import { requestData, DataApiError } from "@/lib/api/transport";
import { object, string, enumeration } from "@/lib/api/schema";
import { getLocale } from "@/i18n/server";
import { serviceAccountRepository } from "../service-accounts/repository";
const receipt = object({ id: string, status: enumeration(["pending"]) });
const root = globalThis as typeof globalThis & {
  orionKeyRequests?: Map<
    string,
    { at: number; body: string; receipt: { id: string; status: "pending" } }
  >;
};
const requests = (root.orionKeyRequests ??= new Map());
export async function requestKey(input: {
  accountId: string;
  serviceId: string;
  name: string;
  reason: string;
  expiresAt: string;
  requestId: string;
}) {
  try {
    if (
      !input ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(input.accountId) ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(input.serviceId) ||
      !/^[a-f0-9-]{36}$/.test(input.requestId) ||
      !input.name?.trim() ||
      input.name.length > 100 ||
      !input.reason?.trim() ||
      input.reason.length > 1000 ||
      !Number.isFinite(Date.parse(input.expiresAt)) ||
      Date.parse(input.expiresAt) <= Date.now()
    )
      return { error: "INVALID_INPUT" };
    const account = await serviceAccountRepository.getAccount(input.accountId);
    if (
      !account ||
      account.account.status !== "active" ||
      !account.issuableServices.some((s) => s.id === input.serviceId)
    )
      return { error: "NOT_ELIGIBLE" };
    const body = {
      serviceId: input.serviceId,
      name: input.name.trim(),
      reason: input.reason.trim(),
      expiresAt: new Date(input.expiresAt).toISOString(),
      requestId: input.requestId,
    };
    const config = deployment();
    const jar = await cookies();
    if (config.mode === "api") {
      const result = await requestData(
        config,
        `service-accounts/${encodeURIComponent(input.accountId)}/api-key-requests`,
        object({ data: receipt }),
        {
          method: "POST",
          body,
          locale: await getLocale(),
          session: config.sessionCookie
            ? jar.get(config.sessionCookie)?.value
            : undefined,
        },
      );
      return { data: result.data };
    }
    let session = jar.get("orion-demo-key-requests")?.value;
    if (!session) {
      session = randomUUID();
      jar.set("orion-demo-key-requests", session, {
        httpOnly: true,
        sameSite: "lax",
        secure:
          process.env.NODE_ENV === "production" &&
          process.env.ORION_ENVIRONMENT !== "test",
        path: "/",
        maxAge: 86400,
      });
    }
    for (const [key, value] of requests)
      if (Date.now() - value.at > 86400000) requests.delete(key);
    const key = `${session}:${input.requestId}`;
    const serialized = JSON.stringify({ accountId: input.accountId, ...body });
    const prior = requests.get(key);
    if (prior && prior.body !== serialized) return { error: "CONFLICT" };
    const result = prior?.receipt ?? {
      id: `key-request-${randomUUID()}`,
      status: "pending" as const,
    };
    requests.set(key, { at: Date.now(), body: serialized, receipt: result });
    return { data: result };
  } catch (error) {
    return {
      error:
        error instanceof DataApiError && error.status === 403
          ? "FORBIDDEN"
          : error instanceof DataApiError && error.status === 401
            ? "UNAUTHENTICATED"
            : "REQUEST_FAILED",
    };
  }
}
