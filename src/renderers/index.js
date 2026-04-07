/**
 * Rendering modules for Universal SVG Renderer
 */
export { FontLoader, setHarfBuzzWasm } from './font-loader.js';
export { generateTextPaths, segmentGraphemes, isEmoji, loadEmojiSvg, applyRTLProcessing } from './text-processor.js';
export { SVGRenderer } from './svg-renderer.js';
