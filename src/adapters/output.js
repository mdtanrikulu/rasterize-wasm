/**
 * Output adapters for different PNG output formats
 */
import { createRequire } from 'module';

export function toBase64(pngBuffer, includeDataURL = false) {
    let base64;
    if (typeof pngBuffer.toString === 'function') {
        try {
            base64 = pngBuffer.toString('base64');
        } catch {
            // Fallback for environments where Buffer.toString('base64') is unavailable
            base64 = btoa(String.fromCharCode(...new Uint8Array(pngBuffer)));
        }
    } else {
        base64 = btoa(String.fromCharCode(...new Uint8Array(pngBuffer)));
    }
    return includeDataURL ? `data:image/png;base64,${base64}` : base64;
}

export function toFile(pngBuffer, filePath, baseDir = process.cwd()) {
    const require = createRequire(import.meta.url);
    const { dirname, resolve } = require('path');
    const { writeFileSync, mkdirSync, existsSync } = require('fs');

    const resolved = resolve(baseDir, filePath);
    const resolvedBase = resolve(baseDir);
    if (!resolved.startsWith(resolvedBase + '/') && resolved !== resolvedBase) {
        throw new Error('Path traversal detected: output path escapes base directory');
    }

    try {
        const dir = dirname(resolved);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }

        writeFileSync(resolved, pngBuffer);
        return resolved;
    } catch (error) {
        throw new Error(`Failed to write file: ${error.message}`);
    }
}

export function toMultipleFormats(pngBuffer, options = {}) {
    const results = {};

    if (options.buffer) {
        results.buffer = pngBuffer;
    }

    if (options.base64) {
        results.base64 = toBase64(pngBuffer, options.dataURL);
    }

    if (options.file) {
        results.filePath = toFile(pngBuffer, options.file);
    }

    return results;
}
