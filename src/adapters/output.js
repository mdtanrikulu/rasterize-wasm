/**
 * Output adapters for different PNG output formats
 */
import { createRequire } from 'module';

export function toBase64(pngBuffer, includeDataURL = false) {
    // resvg returns a Uint8Array, whose toString() ignores 'base64'
    const base64 = Buffer.from(pngBuffer).toString('base64');
    return includeDataURL ? `data:image/png;base64,${base64}` : base64;
}

export function toFile(pngBuffer, filePath, baseDir = process.cwd()) {
    const require = createRequire(import.meta.url);
    const { dirname, resolve, relative, isAbsolute, sep } = require('path');
    const { writeFileSync, mkdirSync } = require('fs');

    const resolved = resolve(baseDir, filePath);
    // relative() uses the platform separator, so this also holds on Windows
    const rel = relative(resolve(baseDir), resolved);
    if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
        throw new Error('Path traversal detected: output path escapes base directory');
    }

    try {
        mkdirSync(dirname(resolved), { recursive: true });
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
