// Behaviour of the lazy scene loader with a fake Phaser game (sceneLoaders.ts only imports Phaser as a type).
import type Phaser from 'phaser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SCENE_LOADERS, ensureSceneLoaded, startSceneLazily } from '../../src/game/sceneLoaders';

class FakeScene {}

function fakeGame(existing: string[] = []) {
  const keys = new Map<string, unknown>(existing.map((k) => [k, new FakeScene()]));
  const add = vi.fn((key: string, cls: unknown) => {
    keys.set(key, cls);
  });
  const start = vi.fn();
  const game = { scene: { getScene: (key: string) => keys.get(key) ?? null, add, start } };
  return { game: game as unknown as Phaser.Game, add, start };
}

const loaders = SCENE_LOADERS as Record<string, () => Promise<unknown>>;
const TEST_KEYS = ['TestLazyScene', 'TestFailingScene'];
afterEach(() => {
  for (const key of TEST_KEYS) delete loaders[key];
});

describe('ensureSceneLoaded', () => {
  it('returns null (synchronous path) for a scene that is already added', () => {
    const { game, add } = fakeGame(['MapScene']);
    expect(ensureSceneLoaded(game, 'MapScene')).toBeNull();
    expect(add).not.toHaveBeenCalled();
  });

  it('imports once and adds the scene (inactive) once, even for concurrent callers', async () => {
    const load = vi.fn(async () => FakeScene);
    loaders.TestLazyScene = load;
    const { game, add } = fakeGame();

    const first = ensureSceneLoaded(game, 'TestLazyScene');
    const second = ensureSceneLoaded(game, 'TestLazyScene');
    expect(second).toBe(first);
    await Promise.all([first, second]);

    expect(load).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith('TestLazyScene', FakeScene, false);
    expect(ensureSceneLoaded(game, 'TestLazyScene')).toBeNull();
  });

  it('rejects for a key with no registered loader', async () => {
    const { game } = fakeGame();
    await expect(ensureSceneLoaded(game, 'NoSuchScene') as Promise<void>).rejects.toThrow(/NoSuchScene/);
  });

  it('does not cache a failed import: the next call retries', async () => {
    let attempts = 0;
    loaders.TestFailingScene = async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('offline');
      return FakeScene;
    };
    const { game, add } = fakeGame();

    await expect(ensureSceneLoaded(game, 'TestFailingScene') as Promise<void>).rejects.toThrow('offline');
    expect(add).not.toHaveBeenCalled();
    await ensureSceneLoaded(game, 'TestFailingScene');
    expect(add).toHaveBeenCalledTimes(1);
  });
});

describe('startSceneLazily', () => {
  it('starts an already-added scene immediately', () => {
    const { game, start } = fakeGame(['MapScene']);
    startSceneLazily(game, 'MapScene');
    expect(start).toHaveBeenCalledWith('MapScene', undefined);
  });

  it('starts a lazy scene only after it has been added', async () => {
    loaders.TestLazyScene = async () => FakeScene;
    const { game, add, start } = fakeGame();
    startSceneLazily(game, 'TestLazyScene');
    expect(start).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(start).toHaveBeenCalledWith('TestLazyScene', undefined));
    expect(add.mock.invocationCallOrder[0]).toBeLessThan(start.mock.invocationCallOrder[0]);
  });
});
