/**
 * Cross-runtime brotli decompression (Node.js, browser, Workers)
 */
import BrotliDec, { Result } from 'tiny-brotli-dec-wasm';

let _initPromise = null;

async function init() {
    if (_initPromise) return _initPromise;
    _initPromise = (async () => {
        try {
            // Node.js: use readFileSync for Yarn PnP / local file compatibility
            const { readFileSync } = await import('fs');
            const { fileURLToPath } = await import('url');
            await BrotliDec.init((url) => readFileSync(fileURLToPath(url)));
        } catch {
            // Browser / Workers: use default fetch
            await BrotliDec.init();
        }
    })();
    return _initPromise;
}

export async function decompress(compressed) {
    await init();
    const input = compressed instanceof Uint8Array ? compressed : new Uint8Array(compressed);
    const decoder = BrotliDec.create();
    const chunks = [];
    let offset = 0;
    const chunkSize = Math.max(input.length * 4, 1024 * 1024);

    while (offset < input.length) {
        const remaining = input.subarray(offset);
        const output = decoder.dec(remaining, chunkSize);
        const result = decoder.result();
        offset += decoder.lastInputOffset();
        if (output.length > 0) chunks.push(output.slice());
        if (result === Result.Success) break;
        if (result === Result.Error) throw new Error('Brotli decompress failed');
    }
    decoder.free();

    if (chunks.length === 1) return chunks[0];
    const totalLen = chunks.reduce((s, c) => s + c.length, 0);
    const merged = new Uint8Array(totalLen);
    let pos = 0;
    for (const c of chunks) { merged.set(c, pos); pos += c.length; }
    return merged;
}
