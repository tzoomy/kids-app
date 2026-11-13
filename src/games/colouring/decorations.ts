// Colouring Time background craft props: measures each `deco-*` group of a background SVG (viewBox units).
// Desk planks, seams and grain carry no `deco-` id, so they are never reported. DOM-dependent; no Phaser.
import type { VuRect } from './pageGeometry';

/** Half the thickest prop outline (4) plus 1 unit of slack: getBBox ignores strokes. */
const STROKE_PAD = 3;

export function measureDecorations(svgText: string): Array<{ id: string; rect: VuRect }> {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-9999px;top:0;width:0;height:0;overflow:hidden;visibility:hidden';
  host.innerHTML = svgText;
  document.body.appendChild(host);
  try {
    const out: Array<{ id: string; rect: VuRect }> = [];
    for (const node of host.querySelectorAll<SVGGraphicsElement>('g[id^="deco-"]')) {
      const b = node.getBBox();
      out.push({
        id: node.id,
        rect: { x: b.x - STROKE_PAD, y: b.y - STROKE_PAD, width: b.width + 2 * STROKE_PAD, height: b.height + 2 * STROKE_PAD },
      });
    }
    return out;
  } finally {
    host.remove();
  }
}
