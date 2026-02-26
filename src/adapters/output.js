/**
 * Output adapters for different PNG output formats
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';

export function toBase64(pngBuffer, includeDataURL = false) {
    const base64 = pngBuffer.toString('base64');
    return includeDataURL ? `data:image/png;base64,${base64}` : base64;
}

export function toFile(pngBuffer, filePath, baseDir = process.cwd()) {
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
