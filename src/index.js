/**
 * Universal Unicode SVG Renderer
 * A powerful library for converting SVGs with international text to PNG
 */
import { detectAndConvert } from './adapters/input.js';
import { toBase64, toFile, toMultipleFormats } from './adapters/output.js';
import { extractAllTextContent, extractEmbeddedFont, extractFontFeatures, replaceTextElement, optimizeFilters } from './utils/svg-parser.js';
import { FontLoader } from './renderers/font-loader.js';
import { generateTextPaths } from './renderers/text-processor.js';
import { SVGRenderer } from './renderers/svg-renderer.js';

export class UniversalSVGRenderer {
    constructor(options = {}) {
        this.options = {
            enableInternationalFonts: true,
            enableEmoji: true,
            fallbackFont: 'Noto+Sans',
            ...options
        };
    }

    /**
     * Main rendering method - supports multiple input/output formats
     */
    async render(input, outputOptions = {}) {
        try {
            // Step 1: Convert input to SVG string
            const svgString = detectAndConvert(input);

            // Step 2: Parse SVG and extract all text elements
            const textEntries = extractAllTextContent(svgString);

            let processedSvg = svgString;

            // Only process text if there are text elements
            if (textEntries.length > 0) {
                // Step 3: Load fonts in parallel
                const embeddedFontBuffer = extractEmbeddedFont(svgString);
                const allText = textEntries.map(e => e.textContent).join('');
                const dominantWeight = textEntries[0]?.attributes?.fontWeight || 700;

                const [primaryFont, internationalFonts, fallbackFont] = await Promise.all([
                    FontLoader.loadPrimaryFont(embeddedFontBuffer),
                    this.options.enableInternationalFonts
                        ? FontLoader.loadInternationalFonts(allText)
                        : Promise.resolve(new Map()),
                    FontLoader.loadFallbackFont(this.options.fallbackFont)
                ]);

                // Use fallback only when no primary font
                const effectiveFallback = primaryFont ? null : fallbackFont;

                // Extract font-feature-settings as a HarfBuzz feature string (e.g. "ss01,ss03")
                const fontFeatures = extractFontFeatures(svgString);
                const featureString = fontFeatures.join(',');

                // Step 4: Generate text paths for all elements in parallel
                const pathResults = await Promise.all(
                    textEntries.map(({ textContent, attributes }) => {
                        const { fontSize, fill, fontWeight, x, y } = attributes;
                        return generateTextPaths(
                            textContent, x, y, fontSize, fill, primaryFont, internationalFonts, effectiveFallback,
                            { enableEmoji: this.options.enableEmoji, fontWeight, featureString }
                        );
                    })
                );

                // Step 5: Apply all replacements
                for (let i = 0; i < textEntries.length; i++) {
                    processedSvg = replaceTextElement(processedSvg, textEntries[i].textElement, pathResults[i]);
                }
            }

            // Step 6: Optimize filters for faster rendering
            processedSvg = optimizeFilters(processedSvg);

            // Step 7: Render SVG to PNG
            const pngBuffer = await SVGRenderer.renderSVGToPNG(processedSvg, {
                wasmBuffer: this.options.wasmBuffer
            });

            // Step 8: Return in requested format(s)
            return this._handleOutput(pngBuffer, outputOptions);

        } catch (error) {
            throw new Error(`Rendering failed: ${error.message}`);
        }
    }

    _handleOutput(pngBuffer, outputOptions) {
        // If no specific output requested, return buffer
        if (!outputOptions || Object.keys(outputOptions).length === 0) {
            return pngBuffer;
        }

        // Handle single output format
        if (outputOptions.format) {
            switch (outputOptions.format) {
                case 'buffer':
                    return pngBuffer;
                case 'base64':
                    return toBase64(pngBuffer, outputOptions.dataURL);
                case 'file':
                    if (!outputOptions.path) {
                        throw new Error('File path required for file output');
                    }
                    return toFile(pngBuffer, outputOptions.path);
                default:
                    throw new Error(`Unsupported output format: ${outputOptions.format}`);
            }
        }

        // Handle multiple output formats
        return toMultipleFormats(pngBuffer, outputOptions);
    }
}

// Export individual components for advanced usage
export { detectAndConvert, fromRawSVG, fromBase64, fromBuffer } from './adapters/input.js';
export { toBase64, toFile, toMultipleFormats } from './adapters/output.js';
export { extractAllTextContent, extractEmbeddedFont, extractFontFeatures, replaceTextElement, optimizeFilters } from './utils/svg-parser.js';
export { FontLoader } from './renderers/font-loader.js';
export { generateTextPaths, segmentGraphemes, isEmoji, loadEmojiSvg, applyRTLProcessing } from './renderers/text-processor.js';
export { SVGRenderer } from './renderers/svg-renderer.js';

// Export default instance
export default new UniversalSVGRenderer();
