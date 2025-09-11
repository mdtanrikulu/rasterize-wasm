/**
 * Input adapters for different SVG sources
 */

export class SVGInputAdapter {
    static fromRawSVG(svgString) {
        if (typeof svgString !== 'string') {
            throw new Error('Raw SVG input must be a string');
        }
        return svgString;
    }

    static fromBase64(base64String) {
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

    static fromBuffer(buffer) {
        if (!Buffer.isBuffer(buffer)) {
            throw new Error('Input must be a Buffer');
        }
        return buffer.toString('utf-8');
    }

    static async fromFile(filePath) {
        const { readFileSync } = await import('fs');
        try {
            return readFileSync(filePath, 'utf-8');
        } catch (error) {
            throw new Error(`Failed to read file ${filePath}: ${error.message}`);
        }
    }

    static detectAndConvert(input) {
        if (typeof input === 'string') {
            // Check if it's base64 data URL
            if (input.startsWith('data:image/svg+xml;base64,')) {
                return this.fromBase64(input);
            }
            // Check if it's raw SVG
            if (input.trim().startsWith('<svg') || input.trim().startsWith('<?xml')) {
                return this.fromRawSVG(input);
            }
            // Assume it's base64 (but this might fail if it's invalid base64)
            try {
                return this.fromBase64(input);
            } catch (error) {
                throw new Error(`Invalid input format: not valid base64, SVG, or data URL. Error: ${error.message}`);
            }
        }
        
        if (Buffer.isBuffer(input)) {
            return this.fromBuffer(input);
        }
        
        throw new Error('Unsupported input format');
    }
}