// Pure Colouring Time layout in canvas (game) units; equals CSS px at the 1280x800 / 800x1280 base sizes.
import type { ColouringGeometry } from '../../ui/colouringChrome';

const TAP = 64;
const GAP = 8;
const EDGE = 24;
const TOP = 88;

export function computeColouringLayout(width: number, height: number, swatchCount: number): ColouringGeometry {
  const landscape = width >= height;
  const swatches: ColouringGeometry['swatches'] = [];
  if (landscape) {
    // Palette column on the RTL start (right) side; 1 column up to 8 swatches, 2 columns of 8 beyond.
    const cols = swatchCount > 8 ? 2 : 1;
    const palW = cols * TAP + (cols - 1) * GAP;
    const palX = width - EDGE - palW;
    for (let i = 0; i < swatchCount; i++) {
      const col = Math.floor(i / 8);
      const row = i % 8;
      swatches.push({ x: palX + palW - TAP - col * (TAP + GAP), y: TOP + row * (TAP + GAP), width: TAP, height: TAP });
    }
    const rows = Math.min(8, swatchCount);
    const palette = { x: palX, y: TOP, width: palW, height: rows * TAP + (rows - 1) * GAP };
    const toolX = EDGE;
    const tool = (i: number) => ({ x: toolX, y: TOP + i * (TAP + 12), width: TAP, height: TAP });
    const side = Math.min(704, height - TOP - 8);
    const left = toolX + TAP;
    const page = { x: Math.round((left + palX) / 2 - side / 2), y: TOP, width: side, height: side };
    return { page, tools: { undo: tool(0), clear: tool(1), prev: tool(2), next: tool(3) }, palette, swatches };
  }
  const side = Math.min(720, width - 2 * EDGE);
  const page = { x: Math.round((width - side) / 2), y: TOP, width: side, height: side };
  const rows = swatchCount > 8 ? 2 : 1;
  const perRow = Math.ceil(swatchCount / rows);
  const palW = perRow * TAP + (perRow - 1) * GAP;
  const palH = rows * TAP + (rows - 1) * GAP;
  const palX = Math.round((width - palW) / 2);
  const palY = height - 40 - palH;
  for (let i = 0; i < swatchCount; i++) {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    swatches.push({ x: palX + palW - TAP - col * (TAP + GAP), y: palY + row * (TAP + GAP), width: TAP, height: TAP });
  }
  const toolsW = 4 * TAP + 3 * 16;
  const pageBottom = page.y + page.height;
  const toolY = Math.round(pageBottom + (palY - pageBottom - TAP) / 2);
  const tool = (i: number) => ({ x: Math.round((width - toolsW) / 2) + toolsW - TAP - i * (TAP + 16), y: toolY, width: TAP, height: TAP });
  return {
    page,
    tools: { undo: tool(0), clear: tool(1), prev: tool(2), next: tool(3) },
    palette: { x: palX, y: palY, width: palW, height: palH },
    swatches,
  };
}
