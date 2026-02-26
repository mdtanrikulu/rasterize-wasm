/**
 * Text processing and path generation
 */
import { FontLoader } from './font-loader.js';

const GRAPHEME_SEGMENTER = new Intl.Segmenter('en', { granularity: 'grapheme' });

export function segmentGraphemes(text) {
    return [...GRAPHEME_SEGMENTER.segment(text)].map(s => s.segment);
}

export function isEmoji(grapheme) {
    const cp = grapheme.codePointAt(0);
    // Regional indicator symbols (flags): U+1F1E0-U+1F1FF
    if (cp >= 0x1F1E0 && cp <= 0x1F1FF) return true;
    // Common emoji ranges
    if (cp >= 0x1F000) return true;
    // ZWJ sequences start with a character in emoji range — checked by first codepoint
    // Keycap sequences, etc.
    if (cp >= 0x2600 && cp <= 0x27BF) return true;
    // Misc symbols
    if (cp >= 0x2300 && cp <= 0x23FF) return true;
    return false;
}

export async function loadEmojiSvg(grapheme) {
    // Build Twemoji filename: dash-separated hex codepoints, excluding VS16 (U+FE0F)
    const codepoints = [...grapheme]
        .map(c => c.codePointAt(0))
        .filter(cp => cp !== 0xFE0F)
        .map(cp => cp.toString(16).toLowerCase());
    const filename = codepoints.join('-');
    try {
        const response = await fetch(`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${filename}.svg`);
        return response.ok ? await response.text() : null;
    } catch {
        return null;
    }
}

function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export function applyRTLProcessing(text) {
    const chars = segmentGraphemes(text);
    const hasRTL = /[\u0600-\u06FF\u0750-\u077F\u0590-\u05FF]/.test(text);

    if (!hasRTL) return chars;

    // Simple RTL: reverse RTL segments (Arabic + Hebrew), keep LTR segments in order
    let segments = [];
    let currentSegment = { chars: [], isRTL: false };

    for (const char of chars) {
        const isRTL = /[\u0600-\u06FF\u0750-\u077F\u0590-\u05FF]/.test(char);
        if (isRTL !== currentSegment.isRTL) {
            if (currentSegment.chars.length > 0) {
                segments.push(currentSegment);
            }
            currentSegment = { chars: [char], isRTL };
        } else {
            currentSegment.chars.push(char);
        }
    }

    if (currentSegment.chars.length > 0) {
        segments.push(currentSegment);
    }

    // Reverse RTL segments
    const processedChars = [];
    for (const segment of segments) {
        if (segment.isRTL) {
            processedChars.push(...segment.chars.reverse());
        } else {
            processedChars.push(...segment.chars);
        }
    }

    return processedChars;
}

function resolveInternationalFont(char, internationalFonts) {
    // Support both Map (new multi-font API) and single font object (backward compat)
    if (!internationalFonts) return null;
    if (!(internationalFonts instanceof Map)) return internationalFonts;

    const scriptEntry = FontLoader.getScriptFont(char);
    if (!scriptEntry) return null;
    return internationalFonts.get(scriptEntry) || null;
}

/**
 * Pre-fetch all emoji SVGs in parallel. Returns a Map<grapheme, svgString|null>.
 */
async function prefetchEmoji(chars) {
    const emojiChars = chars.filter(c => c !== '\n' && c !== '\r' && isEmoji(c));
    if (emojiChars.length === 0) return new Map();

    // Deduplicate
    const unique = [...new Set(emojiChars)];
    const results = await Promise.all(unique.map(async (char) => {
        const svg = await loadEmojiSvg(char);
        return [char, svg];
    }));

    return new Map(results);
}

export async function generateTextPaths(text, x, y, fontSize, fill, primaryFont, internationalFonts, fallbackFont, options = {}) {
    const { enableEmoji = true, fontWeight = 700, glyphSubMap = new Map() } = options;
    const parts = [];
    let currentX = x;
    let currentY = y;
    const lineHeight = fontSize * 1.2;

    const chars = applyRTLProcessing(text);

    // Batch-fetch all emoji SVGs upfront in parallel
    const emojiCache = enableEmoji ? await prefetchEmoji(chars) : new Map();

    for (const char of chars) {
        // Handle newlines — advance to next line (\r\n counts as one break)
        if (char === '\n') {
            currentX = x;
            currentY += lineHeight;
            continue;
        }
        if (char === '\r') continue;

        // Handle emoji (including ZWJ sequences, flags, skin tones)
        if (enableEmoji && isEmoji(char)) {
            const emojiSvg = emojiCache.get(char);
            if (emojiSvg) {
                const emojiContent = emojiSvg.match(/<svg[^>]*>(.*)<\/svg>/s)?.[1];
                if (emojiContent) {
                    const emojiY = currentY - fontSize * 0.75;
                    parts.push(`<g transform="translate(${currentX}, ${emojiY}) scale(${fontSize/36})">${emojiContent}</g>`);
                    currentX += fontSize;
                    continue;
                }
            }
        }

        // Handle international characters — look up per-character font from the map
        const scriptFont = resolveInternationalFont(char, internationalFonts);
        let font = scriptFont || primaryFont;

        // Use fallback font if no primary font available
        if (!font && fallbackFont) {
            font = fallbackFont;
        }

        // Use direct glyph API (charToGlyphIndex + glyph.getPath) instead of
        // font.getPath/font.getAdvanceWidth to avoid opentype.js Bidi/GSUB crash on Arabic fonts.
        let glyphIndex = font?.charToGlyphIndex?.(char) ?? 0;
        // Apply GSUB stylistic alternates (ss01, ss03, etc.)
        if (glyphIndex > 0 && font === primaryFont && glyphSubMap.has(glyphIndex)) {
            glyphIndex = glyphSubMap.get(glyphIndex);
        }
        const glyph = glyphIndex > 0 ? font.glyphs.get(glyphIndex) : null;

        if (glyph) {
            const scale = fontSize / font.unitsPerEm;
            const path = glyph.getPath(currentX, currentY, fontSize);
            const pathData = path.toPathData(2);
            if (pathData && pathData !== 'M0,0') {
                parts.push(`<path d="${pathData}" fill="${fill}" />`);
            }
            // Always use the glyph's real advance width (handles space, punctuation, etc.)
            currentX += glyph.advanceWidth * scale;
        } else {
            // Multi-tier fallback: emit a <text> element so the character is visible
            const fontFamilyAttr = FontLoader.getFontFamilyCSS(char);

            parts.push(`<text x="${currentX}" y="${currentY}" font-family="${fontFamilyAttr}" font-size="${fontSize}" fill="${fill}" font-weight="${fontWeight}">${escapeXml(char)}</text>`);

            currentX += FontLoader.isCJK(char) ? fontSize : fontSize * 0.6;
        }
    }

    return parts.join('');
}
