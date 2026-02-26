/**
 * Text processing and path generation (harfbuzzjs backend)
 */
import { FontLoader } from './font-loader.js';

const GRAPHEME_SEGMENTER = new Intl.Segmenter('en', { granularity: 'grapheme' });

export function segmentGraphemes(text) {
    return [...GRAPHEME_SEGMENTER.segment(text)].map(s => s.segment);
}

export function isEmoji(grapheme) {
    const cp = grapheme.codePointAt(0);
    if (cp >= 0x1F1E0 && cp <= 0x1F1FF) return true;
    if (cp >= 0x1F000) return true;
    if (cp >= 0x2600 && cp <= 0x27BF) return true;
    if (cp >= 0x2300 && cp <= 0x23FF) return true;
    return false;
}

export async function loadEmojiSvg(grapheme) {
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
    if (!internationalFonts) return null;
    if (!(internationalFonts instanceof Map)) return internationalFonts;

    const scriptEntry = FontLoader.getScriptFont(char);
    if (!scriptEntry) return null;
    return internationalFonts.get(scriptEntry) || null;
}

/**
 * Pre-fetch all emoji SVGs in parallel.
 */
async function prefetchEmoji(chars) {
    const emojiChars = chars.filter(c => c !== '\n' && c !== '\r' && isEmoji(c));
    if (emojiChars.length === 0) return new Map();

    const unique = [...new Set(emojiChars)];
    const results = await Promise.all(unique.map(async (char) => {
        const svg = await loadEmojiSvg(char);
        return [char, svg];
    }));

    return new Map(results);
}

/**
 * Segment text into runs by font (emoji, international, primary, fallback).
 * Each run is { type: 'emoji'|'text'|'fallback', chars: string, font: fontObj|null, graphemes: [] }
 */
function segmentByFont(graphemes, primaryFont, internationalFonts, fallbackFont, emojiCache, enableEmoji) {
    const runs = [];
    let currentRun = null;

    function pushRun() {
        if (currentRun && currentRun.chars.length > 0) {
            runs.push(currentRun);
        }
        currentRun = null;
    }

    for (const grapheme of graphemes) {
        if (grapheme === '\n' || grapheme === '\r') {
            pushRun();
            runs.push({ type: 'newline', chars: grapheme, font: null, graphemes: [grapheme] });
            continue;
        }

        // Check for emoji
        if (enableEmoji && isEmoji(grapheme) && emojiCache.has(grapheme) && emojiCache.get(grapheme)) {
            pushRun();
            runs.push({ type: 'emoji', chars: grapheme, font: null, graphemes: [grapheme], emojiSvg: emojiCache.get(grapheme) });
            continue;
        }

        // Determine which font to use
        const scriptFont = resolveInternationalFont(grapheme, internationalFonts);
        let font = scriptFont || primaryFont;
        if (!font && fallbackFont) font = fallbackFont;

        if (!font) {
            // No font available — use <text> fallback
            pushRun();
            runs.push({ type: 'fallback', chars: grapheme, font: null, graphemes: [grapheme] });
            continue;
        }

        // Continue current text run if same font
        if (currentRun && currentRun.type === 'text' && currentRun.font === font) {
            currentRun.chars += grapheme;
            currentRun.graphemes.push(grapheme);
        } else {
            pushRun();
            currentRun = { type: 'text', chars: grapheme, font, graphemes: [grapheme] };
        }
    }

    pushRun();
    return runs;
}

/**
 * Shape a text run with HarfBuzz and return SVG path fragments.
 */
function shapeAndRender(hb, fontObj, text, x, y, fontSize, fill, featureString) {
    const { hbFont, upem } = fontObj;
    const scale = fontSize / upem;
    const parts = [];
    let currentX = x;

    const buffer = hb.createBuffer();
    try {
        buffer.addText(text);
        buffer.guessSegmentProperties();

        if (featureString) {
            hb.shape(hbFont, buffer, featureString);
        } else {
            hb.shape(hbFont, buffer);
        }

        const glyphs = buffer.json();

        for (const glyph of glyphs) {
            const glyphId = glyph.g;
            const xAdvance = glyph.ax * scale;
            const xOffset = glyph.dx * scale;
            const yOffset = glyph.dy * scale;

            if (glyphId !== 0) {
                const pathData = hbFont.glyphToPath(glyphId);
                if (pathData) {
                    // font.glyphToPath returns path in font units, Y-up.
                    // Apply transform: translate to position, scale to fontSize, flip Y.
                    const gx = currentX + xOffset;
                    const gy = y - yOffset;
                    parts.push(`<path d="${pathData}" transform="translate(${gx},${gy}) scale(${scale},${-scale})" fill="${fill}" />`);
                }
            }

            currentX += xAdvance;
        }
    } finally {
        buffer.destroy();
    }

    return { parts, advanceX: currentX - x };
}

export async function generateTextPaths(text, x, y, fontSize, fill, primaryFont, internationalFonts, fallbackFont, options = {}) {
    const { enableEmoji = true, fontWeight = 700, featureString = '' } = options;
    const hb = await FontLoader.getHb();
    const parts = [];
    let currentX = x;
    let currentY = y;
    const lineHeight = fontSize * 1.2;

    const graphemes = segmentGraphemes(text);

    // Batch-fetch all emoji SVGs upfront
    const emojiCache = enableEmoji ? await prefetchEmoji(graphemes) : new Map();

    // Segment text into runs by font
    const runs = segmentByFont(graphemes, primaryFont, internationalFonts, fallbackFont, emojiCache, enableEmoji);

    for (const run of runs) {
        if (run.type === 'newline') {
            if (run.chars === '\n') {
                currentX = x;
                currentY += lineHeight;
            }
            continue;
        }

        if (run.type === 'emoji') {
            const emojiContent = run.emojiSvg.match(/<svg[^>]*>(.*)<\/svg>/s)?.[1];
            if (emojiContent) {
                const emojiY = currentY - fontSize * 0.75;
                parts.push(`<g transform="translate(${currentX}, ${emojiY}) scale(${fontSize/36})">${emojiContent}</g>`);
                currentX += fontSize;
            }
            continue;
        }

        if (run.type === 'fallback') {
            // No font — emit <text> fallback
            const char = run.chars;
            const fontFamilyAttr = FontLoader.getFontFamilyCSS(char);
            parts.push(`<text x="${currentX}" y="${currentY}" font-family="${fontFamilyAttr}" font-size="${fontSize}" fill="${fill}" font-weight="${fontWeight}">${escapeXml(char)}</text>`);
            currentX += FontLoader.isCJK(char) ? fontSize : fontSize * 0.6;
            continue;
        }

        if (run.type === 'text') {
            // Shape with HarfBuzz — features only apply to the primary font
            const features = (run.font === primaryFont) ? featureString : '';
            const { parts: shapedParts, advanceX } = shapeAndRender(
                hb, run.font, run.chars, currentX, currentY, fontSize, fill, features
            );
            parts.push(...shapedParts);
            currentX += advanceX;
            continue;
        }
    }

    return parts.join('');
}
