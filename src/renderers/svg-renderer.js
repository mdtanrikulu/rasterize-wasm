/**
 * Core SVG to PNG rendering engine
 */
import { createRequire } from 'module';
import { Resvg, initWasm } from '@resvg/resvg-wasm';

export class SVGRenderer {
    static wasmInitialized = false;
    static wasmBuffer = null;

    static async initializeWasm(wasmBuffer = null) {
        if (this.wasmInitialized) return;

        try {
            let wasmBytes;

            if (wasmBuffer) {
                // Use provided WASM buffer (for Cloudflare Workers)
                wasmBytes = wasmBuffer;
            } else {
                // Load from local file (for Node.js)
                const require = createRequire(import.meta.url);
                const { readFileSync } = require('fs');
                const { fileURLToPath } = require('url');
                const { dirname, join } = require('path');
                const __filename = fileURLToPath(import.meta.url);
                const __dirname = dirname(__filename);
                const wasmPath = join(__dirname, '../../wasm/resvg.wasm');
                wasmBytes = readFileSync(wasmPath);
            }

            await initWasm(wasmBytes);
            this.wasmInitialized = true;
        } catch (error) {
            throw new Error(`Failed to initialize WASM: ${error.message}`);
        }
    }

    static async renderSVGToPNG(svgString, options = {}) {
        await this.initializeWasm(options.wasmBuffer);

        // Free the wasm-side tree and pixmap eagerly; resvg-wasm otherwise only
        // releases them via FinalizationRegistry, and wasm memory never shrinks.
        let resvg;
        let pngData;
        try {
            resvg = new Resvg(svgString, options);
            pngData = resvg.render();
            return pngData.asPng();
        } catch (error) {
            throw new Error(`SVG rendering failed: ${error.message}`);
        } finally {
            pngData?.free();
            resvg?.free();
        }
    }
}