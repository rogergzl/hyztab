/**
 * 同组成员列表的过滤规则。
 *
 * 服务端按分组返回身份，其中可能包含本机的多把密钥（同一浏览器账号下
 * 不同设备/不同时期生成的）。展示"同组其他成员"时必须全部剔除：
 * 只按"有私钥"过滤会漏掉只有公钥的那把，看起来就像自己出现在成员里。
 */

import { PublicIdentity, ShareIdentity } from "./types";

/** 剔除本机已知的全部身份（按指纹），返回真正意义上的"别人"。 */
export const excludeLocalIdentities = (
  peers: PublicIdentity[],
  local: Array<Pick<ShareIdentity, "fingerprint">>,
): PublicIdentity[] => {
  const known = new Set(local.map((identity) => identity.fingerprint));
  return peers.filter((peer) => !known.has(peer.fingerprint));
};
