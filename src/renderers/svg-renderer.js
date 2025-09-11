/**
 * Core SVG to PNG rendering engine
 */
import { Resvg, initWasm } from '@resvg/resvg-wasm';

export class SVGRenderer {
    static wasmInitialized = false;

    static async initializeWasm() {
        if (this.wasmInitialized) return;
        
        try {
            const wasmResponse = await fetch('https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm');
            const wasmBytes = await wasmResponse.arrayBuffer();
            await initWasm(wasmBytes);
            this.wasmInitialized = true;
        } catch (error) {
            throw new Error(`Failed to initialize WASM: ${error.message}`);
        }
    }

    static async renderSVGToPNG(svgString, options = {}) {
        await this.initializeWasm();
        
        try {
            const resvg = new Resvg(svgString, options);
            const pngData = resvg.render();
            return pngData.asPng();
        } catch (error) {
            throw new Error(`SVG rendering failed: ${error.message}`);
        }
    }
}