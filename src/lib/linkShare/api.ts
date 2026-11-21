import { signRequest } from "./crypto";
import {
  PublicIdentity,
  ShareIdentity,
  SharePayload,
  ShareRecord,
} from "./types";

/** Validate and normalize the user's relay URL to an origin/path base. */
export const normalizeServiceUrl = (raw: string): string => {
  const value = (raw ?? "").trim();
  if (!value) throw new Error("请填写中转服务地址");

  let url: URL;
  try {
    url = new URL(value);
  } catch (e) {
    throw new Error("中转服务地址格式不正确", { cause: e });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new Error("中转服务地址只支持 http / https");
  if (url.username || url.password)
    throw new Error("中转服务地址不要包含账号或密码");

  return url.href.replace(/\/$/, "");
};

/**
 * Ask for host access only when the user connects, never at install time.
 * The project declares `<all_urls>` as an optional permission, so Chrome/Edge
 * can show a narrow, user-triggered prompt for this one origin.
 */
export const requestHostPermission = async (serviceUrl: string): Promise<void> => {
  const base = normalizeServiceUrl(serviceUrl);
  const root = globalThis as Record<string, any>;
  const permissions =
    root.chrome?.permissions ??
    root.browser?.permissions ??
    null;
  if (!permissions?.request) return;

  const granted = await permissions.request({
    origins: [`${new URL(base).origin}/*`],
  });
  if (!granted) throw new Error("未授予中转服务访问权限");
};

const endpoint = (serviceUrl: string, path: string): string =>
  `${normalizeServiceUrl(serviceUrl)}/${path.replace(/^\//, "")}`;

const parseBody = async (response: Response): Promise<any> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`中转服务返回了无法解析的内容（HTTP ${response.status}）`, {
      cause: e,
    });
  }
};

const send = async <T>(
  serviceUrl: string,
  method: string,
  path: string,
  body?: unknown,
  identity?: ShareIdentity,
): Promise<T> => {
  const payload = body === undefined ? "" : JSON.stringify(body);
  const headers = identity
    ? await signRequest(identity, method, path, payload)
    : { "content-type": "application/json" };

  let response: Response;
  try {
    response = await fetch(endpoint(serviceUrl, path), {
      method,
      headers,
      body: method === "GET" || method === "DELETE" ? undefined : payload,
      cache: "no-store",
    });
  } catch (e) {
    throw new Error("无法连接中转服务，请检查地址、权限与服务状态", { cause: e });
  }

  const data = await parseBody(response);
  if (!response.ok) {
    const message =
      data && typeof data.error === "string" ? data.error : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data as T;
};

/** Register a freshly generated public key using a self-signed request. */
export const registerIdentity = (
  serviceUrl: string,
  identity: ShareIdentity,
  group?: { name: string; password: string },
): Promise<PublicIdentity> =>
  send<PublicIdentity>(serviceUrl, "POST", "identities", {
    name: identity.name,
    publicKey: identity.publicKey,
    // 只有显式传分组时才带上，避免把已有用户踢回「未分组」。
    ...(group ? { groupName: group.name, groupPassword: group.password } : {}),
  }, identity);

/**
 * 同组的公开身份，供接收者选择。
 *
 * 服务端会按分组过滤，所以必须带签名身份——这也顺带证明了请求者确实是
 * 该组的成员。
 */
export const listIdentities = (
  serviceUrl: string,
  viewer: ShareIdentity,
): Promise<PublicIdentity[]> =>
  send<PublicIdentity[]>(serviceUrl, "GET", "identities", undefined, viewer);

/** 注销自己的身份（服务端会连带撤销它发布的分享）。 */
export const deleteIdentity = (
  serviceUrl: string,
  identity: ShareIdentity,
): Promise<{ ok: boolean; removedShares: number }> =>
  send<{ ok: boolean; removedShares: number }>(
    serviceUrl,
    "DELETE",
    "identities",
    undefined,
    identity,
  );

/** Create or replace a share. `id` is kept stable across edits. */
export const publishShare = (
  serviceUrl: string,
  owner: ShareIdentity,
  input: {
    id: string;
    recipients: string[];
    payload: SharePayload;
  },
): Promise<ShareRecord> =>
  send<ShareRecord>(serviceUrl, "POST", "shares", {
    id: input.id,
    owner: owner.fingerprint,
    recipients: input.recipients,
    payload: input.payload,
  }, owner);

/** Shares addressed to one of the local identities. */
export const listIncoming = (
  serviceUrl: string,
  recipient: ShareIdentity,
): Promise<ShareRecord[]> =>
  send<ShareRecord[]>(
    serviceUrl,
    "GET",
    `shares?recipient=${encodeURIComponent(recipient.fingerprint)}`,
    undefined,
    recipient,
  );

/** Fetch the latest payload for an already added link. */
export const getShare = (
  serviceUrl: string,
  recipient: ShareIdentity,
  id: string,
): Promise<ShareRecord> =>
  send<ShareRecord>(
    serviceUrl,
    "GET",
    `shares/${encodeURIComponent(id)}?recipient=${encodeURIComponent(recipient.fingerprint)}`,
    undefined,
    recipient,
  );

/** Remove a share the local identity owns. */
export const deleteShare = (
  serviceUrl: string,
  owner: ShareIdentity,
  id: string,
): Promise<void> =>
  send<void>(serviceUrl, "DELETE", `shares/${encodeURIComponent(id)}`, undefined, owner);
