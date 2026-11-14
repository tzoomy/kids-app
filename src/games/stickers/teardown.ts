/**
 * Runs every teardown step and then `persist`, each in its own try/catch so a
 * throwing step or storage error on exit never skips remaining cleanup.
 */
export function runTeardown(steps: ReadonlyArray<() => void>, persist: () => void): void {
  for (const step of steps) {
    try {
      step();
    } catch {
      // Best-effort cleanup across all steps.
    }
  }
  try {
    persist();
  } catch {
    // Storage failures on exit must not abort scene shutdown.
  }
}
