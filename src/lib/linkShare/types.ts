/**
 * Types for the account-free quick-link sharing protocol.
 *
 * An identity is a locally generated P-256 key pair. Only the public half and
 * its fingerprint ever leave the browser; requests are signed with the private
 * half so the relay can authorise them without learning a password.
 */

/** Public identity as stored on the relay and shown in user pickers. */
export type PublicIdentity = {
  id: string;
  name: string;
  fingerprint: string;
  publicKey: JsonWebKey;
  /** 手动分组：同一分组内才互相可见、可分享；null 表示「未分组」。 */
  groupId?: string | null;
  groupName?: string;
};

/** A local identity. `privateKey` is stripped from settings exports. */
export type ShareIdentity = PublicIdentity & {
  privateKey?: JsonWebKey;
};

/** The part of a quick link that is sent to other people. */
export type SharePayload = {
  url: string;
  name?: string;
  shortName?: string;
  /** Only favicon is shareable: uploaded icons stay in local IndexedDB. */
  icon?: string;
  /** Resolved proxy address; node ids only make sense on the sender's device. */
  proxy?: { address?: string };
  /** 是否随链接分享名称 / 图标 / 代理等显示配置；未勾选时只发网址。 */
  withConfig?: boolean;
  updatedAt: number;
};

/** Sharing metadata stored on a link, on both the sender and receiver side. */
export type LinkShare = {
  shareId: string;
  serviceUrl: string;
  owner: string;
  /** Local identity id that published the share, for the editor's picker. */
  ownerId?: string;
  recipients: string[];
  /** Which local identity added this link; needed to authenticate a refresh. */
  recipient: string;
  /** 接收方是否采纳了发布者的名称 / 图标 / 代理设置。 */
  applyConfig?: boolean;
  updatedAt: number;
};

/** A share as returned by the relay. */
export type ShareRecord = {
  id: string;
  owner: string;
  ownerName?: string;
  /** 发布者所在分组名，用于「自动接受某分组」判断。 */
  ownerGroup?: string;
  recipients: string[];
  payload: SharePayload;
  updatedAt: number;
};

/** 自动接受规则：命中用户指纹或分组名时不再需要手动确认。 */
export type AutoAccept = {
  users: string[];
  groups: string[];
};

/** 暂停中的分享：内容从网格移出后暂存在这里，可随时放回。 */
export type PausedShare = {
  url: string;
  name?: string;
  shortName?: string;
  icon?: string;
  proxy?: { address?: string };
  owner: string;
  ownerName?: string;
  ownerGroup?: string;
  serviceUrl: string;
  recipient: string;
  /** 暂停前所在的槽位索引，恢复时优先写回这里，保持布局不变。 */
  index?: number;
  pausedAt: number;
};

/** Page level sharing configuration. */
export type LinkShareConfig = {
  serviceUrl: string;
  identities: ShareIdentity[];
  autoAccept: AutoAccept;
  /** shareId → 暂存内容；暂停后网格里完全不出现，也不留空槽。 */
  pausedShares: Record<string, PausedShare>;
};

export const emptyShareConfig = (): LinkShareConfig => ({
  serviceUrl: "",
  identities: [],
  autoAccept: { users: [], groups: [] },
  pausedShares: {},
});
