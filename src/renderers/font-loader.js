/**
 * Font loading and management
 */
import opentype from 'opentype.js';

export class FontLoader {
    static async loadPrimaryFont(fontBuffer) {
        if (!fontBuffer) return null;
        
        try {
            const font = opentype.parse(fontBuffer.buffer);
            return font;
        } catch (error) {
            console.warn('Failed to load primary font:', error.message);
            return null;
        }
    }

    static async loadFallbackFont(fontFamily = 'Noto+Sans') {
        try {
            // Handle special case for Satoshi (not available on Google Fonts)
            if (fontFamily.toLowerCase().includes('satoshi')) {
                fontFamily = 'Noto+Sans';
            }
            
            const cssResponse = await fetch(
                `https://fonts.googleapis.com/css?family=${fontFamily}:700&display=swap`,
                {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0'
                    }
                }
            );
            
            if (!cssResponse.ok) {
                return null;
            }
            
            const css = await cssResponse.text();
            const urlMatch = css.match(/url\(([^)]+)\)/);
            if (!urlMatch) {
                return null;
            }

            const fontResponse = await fetch(urlMatch[1]);
            if (!fontResponse.ok) {
                return null;
            }
            
            const fontBuffer = await fontResponse.arrayBuffer();
            const font = opentype.parse(fontBuffer);
            return font;
        } catch (error) {
            console.warn('Failed to load fallback font:', error.message);
            return null;
        }
    }

    static async loadInternationalFont(text) {
        const hasInternational = /[\u0600-\u06FF\u0750-\u077F\u0590-\u05FF\u4E00-\u9FFF\u0900-\u097F]/.test(text);
        if (!hasInternational) return null;

        // Determine font family based on script
        let fontFamily = 'Noto+Sans';
        if (/[\u0600-\u06FF\u0750-\u077F]/.test(text)) {
            fontFamily = 'Noto+Naskh+Arabic';
        } else if (/[\u0590-\u05FF]/.test(text)) {
            fontFamily = 'Noto+Sans+Hebrew';
        }

        try {
            const cssResponse = await fetch(
                `https://fonts.googleapis.com/css?family=${fontFamily}:700&text=${encodeURIComponent(text)}&display=swap`,
                {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0'
                    }
                }
            );
            
            const css = await cssResponse.text();
            const urlMatch = css.match(/url\(([^)]+)\)/);
            if (!urlMatch) return null;

            const fontResponse = await fetch(urlMatch[1]);
            const fontBuffer = await fontResponse.arrayBuffer();
            return opentype.parse(fontBuffer);
        } catch (error) {
            console.warn('Failed to load international font:', error.message);
            return null;
        }
    }
}