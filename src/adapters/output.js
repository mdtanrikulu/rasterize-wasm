/**
 * Output adapters for different PNG output formats
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

export class PNGOutputAdapter {
    static toBuffer(pngBuffer) {
        return pngBuffer;
    }

    static toBase64(pngBuffer, includeDataURL = false) {
        const base64 = pngBuffer.toString('base64');
        return includeDataURL ? `data:image/png;base64,${base64}` : base64;
    }

    static toFile(pngBuffer, filePath) {
        try {
            // Create directory if it doesn't exist
            const dir = dirname(filePath);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            
            writeFileSync(filePath, pngBuffer);
            return filePath;
        } catch (error) {
            throw new Error(`Failed to write file ${filePath}: ${error.message}`);
        }
    }

    static toMultipleFormats(pngBuffer, options = {}) {
        const results = {};
        
        if (options.buffer) {
            results.buffer = this.toBuffer(pngBuffer);
        }
        
        if (options.base64) {
            results.base64 = this.toBase64(pngBuffer, options.dataURL);
        }
        
        if (options.file) {
            results.filePath = this.toFile(pngBuffer, options.file);
        }
        
        return results;
    }
}