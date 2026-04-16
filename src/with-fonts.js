/**
 * Batteries-included entry point — auto-loads bundled fonts from the filesystem.
 * NOT suitable for Cloudflare Workers (use the main entry point with createRasterizer instead).
 *
 * Usage:
 *   import { createRasterizer } from 'rasterize-wasm/with-fonts';
 *   const rasterizer = await createRasterizer();
 *   const png = await rasterizer.render(svgInput);
 */
import { UniversalSVGRenderer } from './index.js';

/**
 * Create a rasterizer that loads bundled fonts from the filesystem.
 * Fonts are loaded lazily per-render based on detected scripts (same as default behavior).
 */
export async function createRasterizer(options = {}) {
    return new UniversalSVGRenderer(options);
}

// Re-export everything from main entry for convenience
export * from './index.js';
