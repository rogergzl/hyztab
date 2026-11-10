import { relocateLinksWidget } from "./migrations/linksPosition";

/**
 * Startup migrations.
 *
 * The legacy import paths that read data written by the pre-rebrand build have
 * been removed along with the old storage keys: this build is not distributed
 * and there is no earlier data to adopt, so those branches could never match
 * anything. What remains are the layout fixes that apply to this build's own
 * profiles.
 */
export const migrate = async (): Promise<void> => {
  relocateLinksWidget();
};
