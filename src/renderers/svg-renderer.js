/**
 * Core SVG to PNG rendering engine
 */
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

        try {
            const resvg = new Resvg(svgString, options);
            const pngData = resvg.render();
            return pngData.asPng();
        } catch (error) {
            throw new Error(`SVG rendering failed: ${error.message}`);
        }
    }
}