/**
 * Font loading and management (harfbuzzjs backend)
 */
import hbPromise from 'harfbuzzjs';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { decompress } from '../utils/decompress.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FONTS_DIR = join(__dirname, '../../fonts');

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

/**
 * Map font family names to local gzipped TTF filenames in fonts/ directory.
 */
const LOCAL_FONT_FILES = {
    'Noto+Sans':            'noto-sans-bold.ttf.br',
    'Noto+Naskh+Arabic':    'noto-naskh-arabic-bold.ttf.br',
    'Noto+Sans+Hebrew':     'noto-sans-hebrew-bold.ttf.br',
    'Noto+Sans+KR':         'noto-sans-kr-bold.ttf.br',
    'Noto+Sans+SC':         'noto-sans-sc-bold.ttf.br',
    'Noto+Sans+Devanagari': 'noto-sans-devanagari-bold.ttf.br',
    'Noto+Sans+Bengali':    'noto-sans-bengali-bold.ttf.br',
    'Noto+Sans+Gurmukhi':   'noto-sans-gurmukhi-bold.ttf.br',
    'Noto+Sans+Gujarati':   'noto-sans-gujarati-bold.ttf.br',
    'Noto+Sans+Tamil':      'noto-sans-tamil-bold.ttf.br',
    'Noto+Sans+Telugu':     'noto-sans-telugu-bold.ttf.br',
    'Noto+Sans+Kannada':    'noto-sans-kannada-bold.ttf.br',
    'Noto+Sans+Malayalam':  'noto-sans-malayalam-bold.ttf.br',
    'Noto+Sans+Thai':       'noto-sans-thai-bold.ttf.br',
    'Noto+Sans+Lao':        'noto-sans-lao-bold.ttf.br',
    'Noto+Sans+Myanmar':    'noto-sans-myanmar-bold.ttf.br',
    'Noto+Sans+Armenian':   'noto-sans-armenian-bold.ttf.br',
    'Noto+Sans+Georgian':   'noto-sans-georgian-bold.ttf.br',
};

export class FontLoader {
    static _fontCache = new Map();

    static async _loadLocalFont(fontFamily) {
        const cacheKey = fontFamily;
        if (this._fontCache.has(cacheKey)) {
            return this._fontCache.get(cacheKey);
        }

        const filename = LOCAL_FONT_FILES[fontFamily];
        if (!filename) return null;

        const fontPath = join(FONTS_DIR, filename);
        if (!existsSync(fontPath)) return null;

        const brBuf = readFileSync(fontPath);
        const fontBuffer = await decompress(brBuf);
        const fontObj = await createHbFont(fontBuffer.buffer.slice(fontBuffer.byteOffset, fontBuffer.byteOffset + fontBuffer.byteLength));
        this._fontCache.set(cacheKey, fontObj);
        return fontObj;
    }

    static async loadPrimaryFont(fontBuffer) {
        if (!fontBuffer) return null;

        try {
            return await createHbFont(fontBuffer.buffer.slice(fontBuffer.byteOffset, fontBuffer.byteOffset + fontBuffer.byteLength));
        } catch (error) {
            console.warn('Failed to load primary font:', error.message);
            return null;
        }
    }

    static async loadFallbackFont(fontFamily = 'Noto+Sans') {
        try {
            if (fontFamily.toLowerCase().includes('satoshi')) {
                fontFamily = 'Noto+Sans';
            }
            return await this._loadLocalFont(fontFamily);
        } catch (error) {
            console.warn('Failed to load fallback font:', error.message);
            return null;
        }
    }

    static SCRIPT_FONTS = [
        { regex: /[\u0600-\u06FF\u0750-\u077F]/, fonts: ['Noto+Naskh+Arabic'] },
        { regex: /[\u0590-\u05FF]/, fonts: ['Noto+Sans+Hebrew'] },
        { regex: /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/, fonts: ['Noto+Sans+KR'] },
        { regex: /[\u3400-\u4DBF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/, fonts: ['Noto+Sans+SC'] },
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

    static CJK_REGEX = /[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u30FF\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/;

    static isCJK(char) {
        return this.CJK_REGEX.test(char);
    }

    static async loadInternationalFonts(text) {
        const fontMap = new Map();

        // Detect which scripts are present and load their local fonts
        for (const entry of this.SCRIPT_FONTS) {
            if (entry.regex.test(text)) {
                const font = await this._loadLocalFont(entry.fonts[0]);
                if (font) fontMap.set(entry, font);
            }
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
