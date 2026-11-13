export declare function unitTestsMode(
  baseSha: string | undefined,
  deps: { commitExists: (sha: string) => boolean },
): { mode: 'full' | 'changed'; warning: string | null };
