export const APP_VERSION: string = __APP_VERSION__;
export const GIT_SHA: string = __GIT_SHA__;
export const BUILD_DATE: string = __BUILD_DATE__;

export function formatBuildInfo(): string {
  return `v${APP_VERSION} · ${GIT_SHA} · ${BUILD_DATE}`;
}
