// Silhouettes for Shadow Match (Pass 1), generated from the approved animal art, no new art.
import Phaser from 'phaser';

const DEFAULT_SILHOUETTE_COLOR = '#2e2a3a';

/**
 * Returns a cached silhouette texture key for `key` filled with `color` (works in both Canvas and WebGL).
 * Returns `key` unchanged if the source texture is missing.
 */
export function silhouetteTextureKey(scene: Phaser.Scene, key: string, color = DEFAULT_SILHOUETTE_COLOR): string {
  if (!key || key === '__MISSING' || !scene.textures.exists(key)) return key;
  const sourceTex = scene.textures.get(key);
  if (!sourceTex || sourceTex.key === '__MISSING') return key;

  const silKey = `${key}__silhouette_${color.replace(/[^0-9a-z]/gi, '')}`;
  if (scene.textures.exists(silKey)) return silKey;

  const src = sourceTex.getSourceImage() as HTMLImageElement | HTMLCanvasElement | undefined;
  if (!src) return key;
  const w = (src as HTMLImageElement).naturalWidth || src.width;
  const h = (src as HTMLImageElement).naturalHeight || src.height;
  if (!w || !h) return key;

  const canvasTex = scene.textures.createCanvas(silKey, w, h);
  if (!canvasTex) return key;
  const ctx = canvasTex.getContext();
  ctx.drawImage(src as CanvasImageSource, 0, 0, w, h);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  canvasTex.refresh();
  return silKey;
}

interface SavedImageState {
  img: Phaser.GameObjects.Image;
  textureKey: string;
  visible: boolean;
}

/**
 * Replaces every image in `root` (recursively) with its silhouette and hides eyes/mouths.
 * Returns an idempotent restore function that reverts textures and visibility.
 */
export function applySilhouette(root: Phaser.GameObjects.Container): () => void {
  const scene = root.scene;
  const saved: SavedImageState[] = [];

  const walk = (container: Phaser.GameObjects.Container): void => {
    for (const child of container.list) {
      if (child instanceof Phaser.GameObjects.Container) {
        walk(child);
      } else if (child instanceof Phaser.GameObjects.Image) {
        const key = child.texture.key;
        const lower = key.toLowerCase();
        const state: SavedImageState = {
          img: child,
          textureKey: key,
          visible: child.visible,
        };
        saved.push(state);
        if (lower.includes('eye') || lower.includes('mouth')) {
          child.setVisible(false);
        } else {
          // Same pixel size as the source, so the part keeps its scale (including any mirroring).
          child.setTexture(silhouetteTextureKey(scene, key));
        }
      }
    }
  };

  walk(root);

  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    for (const state of saved) {
      if (!state.img.scene) continue;
      if (state.img.texture.key !== state.textureKey) {
        state.img.setTexture(state.textureKey);
      }
      state.img.setVisible(state.visible);
    }
  };
}
