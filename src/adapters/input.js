/**
 * Input adapters for different SVG sources
 */

export function fromRawSVG(svgString) {
    if (typeof svgString !== 'string') {
        throw new Error('Raw SVG input must be a string');
    }
    return svgString;
}

export function fromBase64(base64String) {
    try {
        // Handle data URLs
        const base64Data = base64String.startsWith('data:')
            ? base64String.split(',')[1]
            : base64String;

        return Buffer.from(base64Data, 'base64').toString('utf-8');
    } catch (error) {
        throw new Error(`Invalid base64 SVG: ${error.message}`);
    }
}

export function fromBuffer(buffer) {
    if (!Buffer.isBuffer(buffer)) {
        throw new Error('Input must be a Buffer');
    }
    return buffer.toString('utf-8');
}

export function detectAndConvert(input) {
    if (typeof input === 'string') {
        // Check if it's base64 data URL
        if (input.startsWith('data:image/svg+xml;base64,')) {
            return fromBase64(input);
        }
        // Check if it's raw SVG
        if (input.trim().startsWith('<svg') || input.trim().startsWith('<?xml')) {
            return fromRawSVG(input);
        }
        // Assume it's base64 (but this might fail if it's invalid base64)
        try {
            return fromBase64(input);
        } catch (error) {
            throw new Error(`Invalid input format: not valid base64, SVG, or data URL. Error: ${error.message}`);
        }
    }

    if (Buffer.isBuffer(input)) {
        return fromBuffer(input);
    }

    // Handle Uint8Array (Cloudflare Workers, browser environments)
    if (input instanceof Uint8Array) {
        return new TextDecoder().decode(input);
    }

    // Handle ArrayBuffer
    if (input instanceof ArrayBuffer) {
        return new TextDecoder().decode(input);
    }

    throw new Error('Unsupported input format');
}
