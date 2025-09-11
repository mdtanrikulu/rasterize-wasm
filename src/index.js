/**
 * Universal Unicode SVG Renderer
 * A powerful library for converting SVGs with international text to PNG
 */
import { SVGInputAdapter } from './adapters/input.js';
import { PNGOutputAdapter } from './adapters/output.js';
import { SVGParser } from './utils/svg-parser.js';
import { FontLoader } from './renderers/font-loader.js';
import { TextProcessor } from './renderers/text-processor.js';
import { SVGRenderer } from './renderers/svg-renderer.js';

export class UniversalSVGRenderer {
    constructor(options = {}) {
        this.options = {
            enableInternationalFonts: true,
            enableEmoji: true,
            outputPath: 'output',
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
            const svgString = SVGInputAdapter.detectAndConvert(input);
            
            // Step 2: Parse SVG and extract text
            const { textElement, textContent, attributes } = SVGParser.extractTextContent(svgString);
            const { fontSize, fill, x, y } = attributes;
            
            // Step 3: Load fonts
            const embeddedFontBuffer = SVGParser.extractEmbeddedFont(svgString);
            const primaryFont = await FontLoader.loadPrimaryFont(embeddedFontBuffer);
            
            let internationalFont = null;
            if (this.options.enableInternationalFonts) {
                internationalFont = await FontLoader.loadInternationalFont(textContent);
            }
            
            // Load fallback font if no primary font available
            let fallbackFont = null;
            if (!primaryFont) {
                fallbackFont = await FontLoader.loadFallbackFont(this.options.fallbackFont);
            }
            
            // Step 4: Generate text paths
            const textPaths = await TextProcessor.generateTextPaths(
                textContent, x, y, fontSize, fill, primaryFont, internationalFont, fallbackFont
            );
            
            // Step 5: Replace text in SVG with paths
            const processedSvg = SVGParser.replaceTextElement(svgString, textElement, textPaths);
            
            // Step 6: Render SVG to PNG
            const pngBuffer = await SVGRenderer.renderSVGToPNG(processedSvg);
            
            // Step 7: Return in requested format(s)
            return this._handleOutput(pngBuffer, outputOptions);
            
        } catch (error) {
            throw new Error(`Rendering failed: ${error.message}`);
        }
    }

    _handleOutput(pngBuffer, outputOptions) {
        // If no specific output requested, return buffer
        if (!outputOptions || Object.keys(outputOptions).length === 0) {
            return PNGOutputAdapter.toBuffer(pngBuffer);
        }

        // Handle single output format
        if (outputOptions.format) {
            switch (outputOptions.format) {
                case 'buffer':
                    return PNGOutputAdapter.toBuffer(pngBuffer);
                case 'base64':
                    return PNGOutputAdapter.toBase64(pngBuffer, outputOptions.dataURL);
                case 'file':
                    if (!outputOptions.path) {
                        throw new Error('File path required for file output');
                    }
                    return PNGOutputAdapter.toFile(pngBuffer, outputOptions.path);
                default:
                    throw new Error(`Unsupported output format: ${outputOptions.format}`);
            }
        }

        // Handle multiple output formats
        return PNGOutputAdapter.toMultipleFormats(pngBuffer, outputOptions);
    }

    /**
     * Convenience methods for specific input types
     */
    async renderFromRawSVG(svgString, outputOptions = {}) {
        return this.render(svgString, outputOptions);
    }

    async renderFromBase64(base64String, outputOptions = {}) {
        return this.render(base64String, outputOptions);
    }

    async renderFromBuffer(buffer, outputOptions = {}) {
        return this.render(buffer, outputOptions);
    }

    /**
     * Convenience methods for specific output types
     */
    async renderToBuffer(input) {
        return this.render(input, { format: 'buffer' });
    }

    async renderToBase64(input, includeDataURL = false) {
        return this.render(input, { format: 'base64', dataURL: includeDataURL });
    }

    async renderToFile(input, filePath) {
        return this.render(input, { format: 'file', path: filePath });
    }
}

// Export individual components for advanced usage
export {
    SVGInputAdapter,
    PNGOutputAdapter,
    SVGParser,
    FontLoader,
    TextProcessor,
    SVGRenderer
};

// Export default instance
export default new UniversalSVGRenderer();