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
  updatedAt: number;
};

/** A share as returned by the relay. */
export type ShareRecord = {
  id: string;
  owner: string;
  recipients: string[];
  payload: SharePayload;
  updatedAt: number;
};

/** Page level sharing configuration. */
export type LinkShareConfig = {
  serviceUrl: string;
  identities: ShareIdentity[];
};

export const emptyShareConfig = (): LinkShareConfig => ({
  serviceUrl: "",
  identities: [],
});
