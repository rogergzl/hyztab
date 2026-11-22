/**
 * 导入备份后的云端校对。
 *
 * 导入本身只覆盖本地配置，不会碰中转服务；这会导致两类不一致：
 * - 本地有私钥、云端却没记录 → 发布/接收直接 403「密钥尚未注册」；
 * - 云端有身份、本地没有 → 面板里凭空多出一个同名用户。
 *
 * 这里采取安全策略：**只补注册，不删除**。删除是破坏性操作，交给用户在
 * 面板或侧边栏手动确认；差异只做提示。
 */

import { PublicIdentity, ShareIdentity } from "./types";

export type ReconcileReport = {
  /** 跳过原因（未配置服务、无密钥、未授予权限等）。 */
  skipped?: string;
  /** 成功补注册的密钥数。 */
  registered: number;
  /** 注册失败的密钥名。 */
  failed: string[];
  /** 本地有、云端看不到的（名字 + 短指纹）。 */
  onlyLocal: string[];
  /** 云端有、本地没有的（名字 + 短指纹）。 */
  onlyRemote: string[];
  /** 本地身份中缺少私钥的数量（导入文件不含私钥）。 */
  withoutPrivateKey?: number;
};

export type ReconcileDeps = {
  local: ShareIdentity[];
  listPeers: (viewer: ShareIdentity) => Promise<PublicIdentity[]>;
  register: (identity: ShareIdentity) => Promise<PublicIdentity>;
};

const label = (identity: { name?: string; fingerprint: string }): string =>
  `${identity.name || "未命名"} ${identity.fingerprint.slice(0, 8)}`;

/** 执行校对。所有网络访问通过 deps 注入，便于测试与复用。 */
export const reconcileIdentities = async (
  deps: ReconcileDeps,
): Promise<ReconcileReport> => {
  const report: ReconcileReport = {
    registered: 0,
    failed: [],
    onlyLocal: [],
    onlyRemote: [],
    withoutPrivateKey: deps.local.filter((identity) => !identity.privateKey).length,
  };

  // 只有带私钥的身份才能签名，也只有它们能注册/查询。
  const signers = deps.local.filter((identity) => identity.privateKey);
  if (signers.length === 0) {
    report.skipped = "本地没有带私钥的密钥";
    return report;
  }

  // 顺序很重要：先补注册，再拉列表。
  // 若反过来，当密钥在云端已不存在时（正是要补注册的场景），
  // 拉取列表会直接 403「密钥尚未注册」，整段校对被迫跳过。
  for (const identity of signers) {
    try {
      await deps.register(identity);
      report.registered += 1;
    } catch {
      report.failed.push(label(identity));
    }
  }

  // 补注册后的云端视图；拿不到时只给「注册结果」，不臆测差异。
  let after: PublicIdentity[] | null = null;
  try {
    after = await deps.listPeers(signers[0]);
  } catch (error) {
    report.skipped = `已尝试补注册，但无法读取云端身份：${(error as Error).message}`;
    return report;
  }

  const remoteFingerprints = new Set(after.map((peer) => peer.fingerprint));
  const localFingerprints = new Set(deps.local.map((item) => item.fingerprint));

  report.onlyLocal = deps.local
    .filter((identity) => !remoteFingerprints.has(identity.fingerprint))
    .map(label);
  report.onlyRemote = after
    .filter((peer) => !localFingerprints.has(peer.fingerprint))
    .map(label);

  return report;
};

/** 把报告转成给用户看的多行文本；无差异时返回 null，不打扰用户。 */
export const formatReconcileReport = (report: ReconcileReport): string | null => {
  if (report.skipped) return `导入完成。云端校对已跳过：${report.skipped}`;

  const lines: string[] = ["导入完成，已与云端校对："];
  if (report.registered > 0) lines.push(`· 已补注册 ${report.registered} 个密钥`);
  if (report.failed.length)
    lines.push(`· 注册失败：${report.failed.join("、")}`);
  if (report.onlyLocal.length)
    lines.push(`· 仅本地（云端未找到）：${report.onlyLocal.join("、")}`);
  if (report.onlyRemote.length)
    lines.push(`· 仅云端（本地没有，可能是其它设备）：${report.onlyRemote.join("、")}`);
  if (report.withoutPrivateKey)
    lines.push(
      `· ${report.withoutPrivateKey} 个密钥没有私钥：导入的备份不含私钥，需重新生成才能用于分享`,
    );

  if (lines.length === 1) return null;
  return lines.join("\n");
};
