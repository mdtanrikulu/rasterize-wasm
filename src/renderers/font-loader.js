/**
 * Font loading and management (harfbuzzjs backend)
 */
import hbPromise from 'harfbuzzjs';

let _hb = null;

async function getHb() {
    if (!_hb) _hb = await hbPromise;
    return _hb;
}

/**
 * Create a harfbuzzjs font from an ArrayBuffer.
 * Returns { hbFont, hbFace, hbBlob, upem } or null on failure.
 */
async function createHbFont(arrayBuffer) {
    const hb = await getHb();
    const blob = hb.createBlob(arrayBuffer);
    const face = hb.createFace(blob, 0);
    const font = hb.createFont(face);
    return { hbFont: font, hbFace: face, hbBlob: blob, upem: face.upem };
}

export class FontLoader {
    static _fontCache = new Map();

    static async _fetchGoogleFont(fontFamily, weight = 700) {
        const cacheKey = `${fontFamily}:${weight}`;
        if (this._fontCache.has(cacheKey)) {
            return this._fontCache.get(cacheKey);
        }

        // Use CSS2 API to get fonts with cmap format 12 (full Unicode mapping).
        // The v1 API with text= subsets return cmap format 4 which strips non-Latin mappings.
        const familyParam = fontFamily.replace(/\+/g, ' ');
        const cssResponse = await fetch(
            `https://fonts.googleapis.com/css2?family=${encodeURIComponent(familyParam)}:wght@${weight}&display=swap`,
            {
                headers: {
                    // Safari UA returns truetype (TTF) format, which harfbuzzjs can parse.
                    // Firefox/Chrome UAs return WOFF/WOFF2, which harfbuzzjs cannot decompress.
                    'User-Agent': 'Safari/604.1'
                }
            }
        );

        if (!cssResponse.ok) return null;

        const css = await cssResponse.text();
        const urlMatch = css.match(/url\(([^)]+)\)/);
        if (!urlMatch) return null;

        const fontResponse = await fetch(urlMatch[1]);
        if (!fontResponse.ok) return null;

        const fontBuffer = await fontResponse.arrayBuffer();
        const fontObj = await createHbFont(fontBuffer);
        if (!fontObj) return null;
        this._fontCache.set(cacheKey, fontObj);
        return fontObj;
    }

    static async loadPrimaryFont(fontBuffer) {
        if (!fontBuffer) return null;

        try {
            // fontBuffer is a Node Buffer — use its underlying ArrayBuffer
            return await createHbFont(fontBuffer.buffer.slice(fontBuffer.byteOffset, fontBuffer.byteOffset + fontBuffer.byteLength));
        } catch (error) {
            console.warn('Failed to load primary font:', error.message);
            return null;
        }
    }

    static async loadFallbackFont(fontFamily = 'Noto+Sans', weight = 700) {
        try {
            // Handle special case for Satoshi (not available on Google Fonts)
            if (fontFamily.toLowerCase().includes('satoshi')) {
                fontFamily = 'Noto+Sans';
            }

            return await this._fetchGoogleFont(fontFamily, weight);
        } catch (error) {
            console.warn('Failed to load fallback font:', error.message);
            return null;
        }
    }

    static SCRIPT_FONTS = [
        { regex: /[\u0600-\u06FF\u0750-\u077F]/, fonts: ['Noto+Naskh+Arabic', 'Noto+Sans+Arabic', 'Amiri', 'Cairo'] },
        { regex: /[\u0590-\u05FF]/, fonts: ['Noto+Sans+Hebrew'] },
        { regex: /[\u3400-\u4DBF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\u1100-\u11FF]/, fonts: ['Noto+Sans+SC'] },
        { regex: /[\u0900-\u097F]/, fonts: ['Noto+Sans+Devanagari'] },
        { regex: /[\u0980-\u09FF]/, fonts: ['Noto+Sans+Bengali'] },
        { regex: /[\u0A00-\u0A7F]/, fonts: ['Noto+Sans+Gurmukhi'] },
        { regex: /[\u0A80-\u0AFF]/, fonts: ['Noto+Sans+Gujarati'] },
        { regex: /[\u0B80-\u0BFF]/, fonts: ['Noto+Sans+Tamil'] },
        { regex: /[\u0C00-\u0C7F]/, fonts: ['Noto+Sans+Telugu'] },
        { regex: /[\u0C80-\u0CFF]/, fonts: ['Noto+Sans+Kannada'] },
        { regex: /[\u0D00-\u0D7F]/, fonts: ['Noto+Sans+Malayalam'] },
        { regex: /[\u0E00-\u0E7F]/, fonts: ['Noto+Sans+Thai'] },
        { regex: /[\u0E80-\u0EFF]/, fonts: ['Noto+Sans+Lao'] },
        { regex: /[\u1000-\u109F]/, fonts: ['Noto+Sans+Myanmar'] },
        { regex: /[\u0530-\u058F]/, fonts: ['Noto+Sans+Armenian'] },
        { regex: /[\u10A0-\u10FF]/, fonts: ['Noto+Sans+Georgian'] },
        { regex: /[\u0400-\u04FF\u0370-\u03FF]/, fonts: ['Noto+Sans'] },
    ];

    static getScriptFont(char) {
        for (const entry of this.SCRIPT_FONTS) {
            if (entry.regex.test(char)) return entry;
        }
        return null;
    }

    static getFontFamilyCSS(char) {
        const entry = this.getScriptFont(char);
        if (!entry) return 'Arial, sans-serif';
        const name = entry.fonts[0].replace(/\+/g, ' ');
        return `'${name}', sans-serif`;
    }

    static CJK_REGEX = /[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u30FF\uAC00-\uD7AF]/;

    static isCJK(char) {
        return this.CJK_REGEX.test(char);
    }

    static async loadInternationalFonts(text, weight = 700) {
        const fontMap = new Map();

        // Detect which scripts are present
        const needed = new Map();
        for (const entry of this.SCRIPT_FONTS) {
            if (entry.regex.test(text)) {
                needed.set(entry, entry.fonts);
            }
        }

        if (needed.size === 0) return fontMap;

        // Load all needed fonts in parallel
        const entries = [...needed.entries()];
        const results = await Promise.all(
            entries.map(async ([entry, fontChain]) => {
                try {
                    for (const tryFont of fontChain) {
                        const font = await this._fetchGoogleFont(tryFont, weight);
                        if (font) return { entry, font };
                    }
                } catch (error) {
                    console.warn('Failed to load font for script:', error.message);
                }
                return { entry, font: null };
            })
        );

        for (const { entry, font } of results) {
            if (font) fontMap.set(entry, font);
        }

        return fontMap;
    }

    /**
     * Get the harfbuzzjs instance (for shaping in text-processor)
     */
    static async getHb() {
        return getHb();
    }
}
