import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import opentype from 'opentype.js';
import { base64svg } from './examples/assets/base64Img.js';

console.log('🚀 Hybrid Unicode renderer - preserving original design...');

// Initialize resvg WASM
const wasmResponse = await fetch('https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm');
const wasmBytes = await wasmResponse.arrayBuffer();
await initWasm(wasmBytes);

// Decode the base64 SVG
const svgData = base64svg.split(',')[1];
const originalSvg = atob(svgData);

console.log('✅ Original SVG loaded, length:', originalSvg.length);

// Extract the embedded font
const fontMatch = originalSvg.match(/url\(data:font\/truetype;base64,([^)]+)\)/);
if (!fontMatch) {
    console.error('❌ No embedded font found');
    process.exit(1);
}

const fontBase64 = fontMatch[1];
const fontBuffer = new ArrayBuffer(atob(fontBase64).length);
const fontView = new Uint8Array(fontBuffer);
const fontString = atob(fontBase64);
for (let i = 0; i < fontString.length; i++) {
    fontView[i] = fontString.charCodeAt(i);
}

const primaryFont = opentype.parse(fontBuffer);
console.log('✅ Primary font loaded:', primaryFont.names.fontFamily?.en || 'Unknown');
console.log('📊 Font details:');
console.log('  - Family:', primaryFont.names.fontFamily?.en);  
console.log('  - Weight class:', primaryFont.tables?.os2?.usWeightClass);
console.log('  - Units per em:', primaryFont.unitsPerEm);
console.log('  - Available glyphs:', Object.keys(primaryFont.glyphs.glyphs || {}).length);

// Extract text content and analyze it
const textMatch = originalSvg.match(/<text[^>]*>(.*?)<\/text>/s);
if (!textMatch) {
    console.error('❌ No text element found');
    process.exit(1);
}

const rawTextContent = textMatch[0];
const textContentMatch = rawTextContent.match(/>([^<]*)</)
const rawText = textContentMatch ? textContentMatch[1] : '';

// Properly decode UTF-8 content
function decodeUTF8Properly(str) {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        bytes[i] = str.charCodeAt(i);
    }
    
    try {
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(bytes);
    } catch (e) {
        console.log('⚠️ UTF-8 decode failed, using original');
        return str;
    }
}

const properText = decodeUTF8Properly(rawText);
console.log('✅ Decoded text:', properText);

// Extract text positioning from original
const xMatch = rawTextContent.match(/x="([^"]+)"/);
const yMatch = rawTextContent.match(/y="([^"]+)"/);
const fontSizeMatch = rawTextContent.match(/font-size="([^"]+)"/);
const fillMatch = rawTextContent.match(/fill="([^"]+)"/);

const x = xMatch ? parseFloat(xMatch[1]) : 259;
const y = yMatch ? parseFloat(yMatch[1]) : 446;
const fontSize = fontSizeMatch ? parseFloat(fontSizeMatch[1]) : 55;
const fill = fillMatch ? fillMatch[1] : 'white';

console.log('📏 Original text attributes:', { x, y, fontSize, fill });

// Test font size scaling - SVG font-size vs opentype.js font size
const testChar = 'A';
const testPath = primaryFont.getPath(testChar, 0, 100, fontSize);
const testBbox = testPath.getBoundingBox();
const actualHeight = testBbox.y2 - testBbox.y1;
console.log('🔍 Font size analysis:');
console.log('  - CSS font-size:', fontSize);
console.log('  - Test char "A" height:', actualHeight);
console.log('  - Expected vs actual ratio:', fontSize / actualHeight);
console.log('  - Suggested scaling factor:', fontSize / actualHeight);

// Use exact original font size - no scaling needed for visual accuracy
const adjustedFontSize = fontSize;
console.log('✅ Using original font size without scaling:', adjustedFontSize);
console.log('  (Preserving exact original CSS font-size from SVG)');

// Function to get Twemoji SVG for emoji
async function loadEmojiSvg(char) {
    try {
        const codePoint = char.codePointAt(0);
        const twemojiCode = codePoint.toString(16).toLowerCase();
        const url = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${twemojiCode}.svg`;
        const response = await fetch(url);
        
        if (response.ok) {
            const emojiSvg = await response.text();
            console.log(`✅ Loaded emoji SVG for ${char} (${twemojiCode})`);
            return emojiSvg;
        }
        
        console.log(`⚠️ Could not load emoji ${char} from Twemoji`);
        return null;
    } catch (error) {
        console.log(`⚠️ Error loading emoji:`, error.message);
        return null;
    }
}

// Function to load international font as Uint8Array for resvg fontBuffers
async function loadInternationalFontBuffer(textContent) {
    try {
        console.log('📥 Loading international font via Google Fonts API...');
        
        // Detect various international scripts
        const internationalChars = Array.from(textContent).filter(char => {
            const codePoint = char.codePointAt(0);
            return (codePoint >= 0x4E00 && codePoint <= 0x9FFF) || // CJK Unified Ideographs
                   (codePoint >= 0x3400 && codePoint <= 0x4DBF) || // CJK Extension A  
                   (codePoint >= 0x20000 && codePoint <= 0x2A6DF) || // CJK Extension B
                   (codePoint >= 0x3040 && codePoint <= 0x309F) || // Hiragana
                   (codePoint >= 0x30A0 && codePoint <= 0x30FF) || // Katakana
                   (codePoint >= 0xAC00 && codePoint <= 0xD7AF) || // Hangul
                   (codePoint >= 0x0590 && codePoint <= 0x05FF) || // Hebrew
                   (codePoint >= 0x0600 && codePoint <= 0x06FF) || // Arabic
                   (codePoint >= 0x0750 && codePoint <= 0x077F) || // Arabic Supplement
                   (codePoint >= 0x0400 && codePoint <= 0x04FF) || // Cyrillic
                   (codePoint >= 0x0370 && codePoint <= 0x03FF) || // Greek
                   (codePoint >= 0x0900 && codePoint <= 0x097F) || // Devanagari
                   (codePoint >= 0x0A00 && codePoint <= 0x0A7F) || // Gurmukhi
                   (codePoint >= 0x0A80 && codePoint <= 0x0AFF) || // Gujarati
                   (codePoint >= 0x0E00 && codePoint <= 0x0E7F) || // Thai
                   (codePoint >= 0x1100 && codePoint <= 0x11FF);   // Hangul Jamo
        }).join('');
        
        if (!internationalChars) {
            console.log('🔤 No international characters detected');
            return null;
        }
        
        const testText = encodeURIComponent(internationalChars);
        console.log('🔤 Detected international characters in text:', internationalChars);
        
        // Choose appropriate font based on script detection
        let fontFamily = 'Noto+Sans+SC'; // Default to CJK
        const hasHebrew = /[\u0590-\u05FF]/.test(internationalChars);
        const hasArabic = /[\u0600-\u06FF\u0750-\u077F]/.test(internationalChars);
        const hasCyrillic = /[\u0400-\u04FF]/.test(internationalChars);
        const hasGreek = /[\u0370-\u03FF]/.test(internationalChars);
        const hasDevanagari = /[\u0900-\u097F]/.test(internationalChars);
        const hasThai = /[\u0E00-\u0E7F]/.test(internationalChars);
        
        if (hasHebrew) {
            fontFamily = 'Noto+Sans+Hebrew';
            console.log('🔤 Using Hebrew font');
        } else if (hasArabic) {
            // Try multiple Arabic fonts for better compatibility
            const arabicFonts = [
                'Noto+Naskh+Arabic',     // Traditional Arabic script font
                'Noto+Sans+Arabic',      // Modern Arabic font
                'Amiri',                 // Traditional Arabic calligraphy font
                'Cairo'                  // Modern Arabic font
            ];
            
            // For now, start with the best Arabic font
            fontFamily = arabicFonts[0];
            console.log('🔤 Using Arabic font (Noto Naskh Arabic)');
        } else if (hasCyrillic) {
            fontFamily = 'Noto+Sans';
            console.log('🔤 Using Cyrillic-compatible font');
        } else if (hasGreek) {
            fontFamily = 'Noto+Sans';
            console.log('🔤 Using Greek-compatible font');
        } else if (hasDevanagari) {
            fontFamily = 'Noto+Sans+Devanagari';
            console.log('🔤 Using Devanagari font');
        } else if (hasThai) {
            fontFamily = 'Noto+Sans+Thai';
            console.log('🔤 Using Thai font');
        } else {
            console.log('🔤 Using default CJK font');
        }
        
        // For Arabic fonts, try multiple fallbacks
        const fontsToTry = hasArabic ? [
            'Noto+Naskh+Arabic',     // Traditional Arabic script font
            'Noto+Sans+Arabic',      // Modern Arabic font  
            'Amiri',                 // Traditional Arabic calligraphy font
            'Cairo'                  // Modern Arabic font
        ] : [fontFamily];
        
        let cssResponse = null;
        let workingFontFamily = null;
        
        // Try each font until one works
        for (const tryFont of fontsToTry) {
            console.log(`🔍 Trying font: ${tryFont}`);
            cssResponse = await fetch(`https://fonts.googleapis.com/css?family=${tryFont}:700&text=${testText}&display=swap`, {
                headers: {
                    // Use older user agent to get TTF instead of WOFF2
                    'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0'
                }
            });
            
            if (cssResponse.ok) {
                workingFontFamily = tryFont;
                console.log(`✅ Font ${tryFont} is available`);
                break;
            } else {
                console.log(`⚠️ Font ${tryFont} failed, trying next...`);
            }
        }
        
        if (!cssResponse || !cssResponse.ok) {
            console.log('⚠️ All font requests failed');
            return null;
        }
        
        const css = await cssResponse.text();
        console.log('📋 Retrieved Google Fonts CSS');
        
        // Extract the font URL from the CSS
        const urlMatch = css.match(/url\(([^)]+)\)/);
        if (!urlMatch) {
            console.log('⚠️ Could not extract font URL from CSS');
            return null;
        }
        
        const fontUrl = urlMatch[1];
        console.log('🔗 Extracted font URL:', fontUrl);
        
        // Download the actual font file
        const fontResponse = await fetch(fontUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        if (fontResponse.ok) {
            console.log('📦 Font file downloaded, converting to Uint8Array...');
            const fontBuffer = await fontResponse.arrayBuffer();
            const fontUint8Array = new Uint8Array(fontBuffer);
            
            console.log('✅ International font loaded as Uint8Array, size:', fontUint8Array.length, 'bytes');
            return fontUint8Array;
        }
        
        console.log('⚠️ Font download failed:', fontResponse.status, fontResponse.statusText);
        return null;
    } catch (error) {
        console.log('⚠️ Error loading international font buffer:', error.message);
        return null;
    }
}

const chars = Array.from(properText);

// Try to load international font buffer and parse it with opentype.js for path conversion
let internationalFontBuffer = null;
let internationalFont = null;
const needsInternationalFont = chars.some(char => {
    const codePoint = char.codePointAt(0);
    return (codePoint >= 0x4E00 && codePoint <= 0x9FFF) || // CJK Unified Ideographs
           (codePoint >= 0x3400 && codePoint <= 0x4DBF) || // CJK Extension A  
           (codePoint >= 0x20000 && codePoint <= 0x2A6DF) || // CJK Extension B
           (codePoint >= 0x3040 && codePoint <= 0x309F) || // Hiragana
           (codePoint >= 0x30A0 && codePoint <= 0x30FF) || // Katakana
           (codePoint >= 0xAC00 && codePoint <= 0xD7AF) || // Hangul
           (codePoint >= 0x0590 && codePoint <= 0x05FF) || // Hebrew
           (codePoint >= 0x0600 && codePoint <= 0x06FF) || // Arabic
           (codePoint >= 0x0750 && codePoint <= 0x077F) || // Arabic Supplement
           (codePoint >= 0x0400 && codePoint <= 0x04FF) || // Cyrillic
           (codePoint >= 0x0370 && codePoint <= 0x03FF) || // Greek
           (codePoint >= 0x0900 && codePoint <= 0x097F) || // Devanagari
           (codePoint >= 0x0A00 && codePoint <= 0x0A7F) || // Gurmukhi
           (codePoint >= 0x0A80 && codePoint <= 0x0AFF) || // Gujarati
           (codePoint >= 0x0E00 && codePoint <= 0x0E7F) || // Thai
           (codePoint >= 0x1100 && codePoint <= 0x11FF);   // Hangul Jamo
});

if (needsInternationalFont) {
    internationalFontBuffer = await loadInternationalFontBuffer(properText);
    
    // Also parse the font with opentype.js for path conversion
    if (internationalFontBuffer) {
        try {
            internationalFont = opentype.parse(internationalFontBuffer.buffer);
            console.log('✅ International font parsed with opentype.js for path conversion');
            console.log('  - Family:', internationalFont.names.fontFamily?.en || 'Unknown');
            console.log('  - Available glyphs:', Object.keys(internationalFont.glyphs.glyphs || {}).length);
        } catch (error) {
            console.log('⚠️ Failed to parse international font with opentype.js:', error.message);
        }
    }
}

// Process text character by character while maintaining original positioning
console.log('⚔️ Processing text with military-grade Unicode support...');

// Align text with ENS logo x-axis
// ENS logo starts at x=72.27 (38.0397 * 1.9 scale)
// We need to start the text at the same x position as the ENS logo
const ensLogoStartX = 38.0397 * 1.9; // 72.27543
let textPaths = '';
let currentX = ensLogoStartX; // Start text at same position as ENS logo

console.log('📍 Text positioning for ENS logo alignment:');
console.log('  - ENS logo starts at x:', ensLogoStartX);
console.log('  - Text will start at x:', currentX);
console.log('  - Original text center was at x:', x);

// Check if text contains Arabic characters for RTL processing
const hasArabicText = /[\u0600-\u06FF\u0750-\u077F]/.test(properText);
if (hasArabicText) {
    console.log('🔤 Detected Arabic text - applying RTL processing and proper character shaping');
}

// For Arabic text, process characters in reverse order (RTL)
let charOrder = [];
if (hasArabicText) {
    // Find Arabic segments and reverse them, but keep Latin segments in LTR order
    let currentSegment = [];
    let isCurrentSegmentArabic = false;
    
    for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        const codePoint = char.codePointAt(0);
        const isArabic = (codePoint >= 0x0600 && codePoint <= 0x06FF) || 
                        (codePoint >= 0x0750 && codePoint <= 0x077F);
        
        if (isArabic !== isCurrentSegmentArabic) {
            // Segment type changed, process current segment
            if (currentSegment.length > 0) {
                if (isCurrentSegmentArabic) {
                    charOrder = [...currentSegment.reverse(), ...charOrder];
                } else {
                    charOrder.push(...currentSegment);
                }
                currentSegment = [];
            }
            isCurrentSegmentArabic = isArabic;
        }
        
        currentSegment.push({char, index: i});
    }
    
    // Process final segment
    if (currentSegment.length > 0) {
        if (isCurrentSegmentArabic) {
            charOrder = [...currentSegment.reverse(), ...charOrder];
        } else {
            charOrder.push(...currentSegment);
        }
    }
} else {
    // For non-Arabic text, process normally
    for (let i = 0; i < chars.length; i++) {
        charOrder.push({char: chars[i], index: i});
    }
}

for (let i = 0; i < charOrder.length; i++) {
    const {char, index} = charOrder[i];
    const codePoint = char.codePointAt(0);
    
    console.log(`Processing char ${i}: "${char}" (${codePoint}) [original index: ${index}]`);
    
    try {
        // Handle emoji characters with Twemoji
        if (codePoint >= 0x1F000 && codePoint <= 0x1FAFF) {
            const emojiSvg = await loadEmojiSvg(char);
            if (emojiSvg) {
                // Extract the emoji SVG content (remove svg wrapper)
                const emojiContentMatch = emojiSvg.match(/<svg[^>]*>(.*)<\/svg>/s);
                if (emojiContentMatch) {
                    const emojiContent = emojiContentMatch[1];
                    const emojiSize = adjustedFontSize;
                    const emojiY = y - adjustedFontSize * 0.75;
                    
                    // Embed the emoji as inline SVG with proper positioning
                    textPaths += `<g transform="translate(${currentX}, ${emojiY}) scale(${emojiSize/36})">${emojiContent}</g>`;
                    currentX += emojiSize;
                    console.log(`✅ Embedded Twemoji for "${char}"`);
                    continue;
                }
            }
            
            // Fallback: emoji placeholder
            const emojiSize = adjustedFontSize;
            textPaths += `<circle cx="${currentX + emojiSize/2}" cy="${y - adjustedFontSize/2}" r="${emojiSize/2}" fill="#FF6B6B" stroke="#FF4444" stroke-width="2"/>`;
            currentX += emojiSize;
            console.log(`✅ Created emoji placeholder for "${char}"`);
            continue;
        }
        
        // Check if character is international (CJK, Hebrew, Arabic, Cyrillic, etc.)
        const isInternational = (codePoint >= 0x4E00 && codePoint <= 0x9FFF) || // CJK Unified Ideographs
                               (codePoint >= 0x3400 && codePoint <= 0x4DBF) || // CJK Extension A  
                               (codePoint >= 0x20000 && codePoint <= 0x2A6DF) || // CJK Extension B
                               (codePoint >= 0x3040 && codePoint <= 0x309F) || // Hiragana
                               (codePoint >= 0x30A0 && codePoint <= 0x30FF) || // Katakana
                               (codePoint >= 0xAC00 && codePoint <= 0xD7AF) || // Hangul
                               (codePoint >= 0x0590 && codePoint <= 0x05FF) || // Hebrew
                               (codePoint >= 0x0600 && codePoint <= 0x06FF) || // Arabic
                               (codePoint >= 0x0750 && codePoint <= 0x077F) || // Arabic Supplement
                               (codePoint >= 0x0400 && codePoint <= 0x04FF) || // Cyrillic
                               (codePoint >= 0x0370 && codePoint <= 0x03FF) || // Greek
                               (codePoint >= 0x0900 && codePoint <= 0x097F) || // Devanagari
                               (codePoint >= 0x0A00 && codePoint <= 0x0A7F) || // Gurmukhi
                               (codePoint >= 0x0A80 && codePoint <= 0x0AFF) || // Gujarati
                               (codePoint >= 0x0E00 && codePoint <= 0x0E7F) || // Thai
                               (codePoint >= 0x1100 && codePoint <= 0x11FF);   // Hangul Jamo

        if (isInternational) {
            // Try to convert international character to path using the loaded font
            if (internationalFont && internationalFont.hasChar && internationalFont.hasChar(char)) {
                const charPath = internationalFont.getPath(char, currentX, y, adjustedFontSize);
                const pathData = charPath.toPathData(2);
                if (pathData && pathData !== 'M0,0') {
                    textPaths += `<path d="${pathData}" fill="${fill}" />`;
                    currentX += internationalFont.getAdvanceWidth(char, adjustedFontSize);
                    console.log(`✅ International character "${char}" converted to SVG path using loaded font (${codePoint})`);
                    continue;
                }
            }
            
            // Fallback if path conversion failed
            if (internationalFontBuffer) {
                // Try using serif to see if resvg can find our embedded font via fallback
                textPaths += `<text x="${currentX}" y="${y}" font-family="serif" font-size="${adjustedFontSize}" fill="${fill}" font-weight="700">${char}</text>`;
                console.log(`✅ International character "${char}" using serif with embedded font fallback (${codePoint})`);
            } else {
                // Final fallback to system fonts
                textPaths += `<text x="${currentX}" y="${y}" font-family="sans-serif" font-size="${adjustedFontSize}" fill="${fill}" font-weight="700">${char}</text>`;
                console.log(`✅ International character "${char}" using sans-serif fallback (${codePoint})`);
            }
            
            // Use appropriate spacing based on script type
            const isCJK = (codePoint >= 0x4E00 && codePoint <= 0x9FFF) || 
                         (codePoint >= 0x3400 && codePoint <= 0x4DBF) ||
                         (codePoint >= 0x3040 && codePoint <= 0x30FF) ||
                         (codePoint >= 0xAC00 && codePoint <= 0xD7AF);
            
            currentX += isCJK ? adjustedFontSize : adjustedFontSize * 0.6; // CJK full-width, others proportional
            continue;
        }
        
        // Regular characters - convert to paths using the original font with corrected size
        if (primaryFont.hasChar && primaryFont.hasChar(char)) {
            const charPath = primaryFont.getPath(char, currentX, y, adjustedFontSize);
            const pathData = charPath.toPathData(2);
            if (pathData && pathData !== 'M0,0') {
                textPaths += `<path d="${pathData}" fill="${fill}" />`;
                currentX += primaryFont.getAdvanceWidth(char, adjustedFontSize);
                console.log(`✅ Rendered "${char}" with primary font (scaled)`);
                continue;
            }
        }
        
        // Fallback for characters not in font
        textPaths += `<text x="${currentX}" y="${y}" font-family="Arial, sans-serif" font-size="${adjustedFontSize}" fill="${fill}">${char}</text>`;
        currentX += adjustedFontSize * 0.6;
        console.log(`✅ Created fallback for "${char}"`);
        
    } catch (error) {
        console.log(`⚠️ Error processing "${char}":`, error.message);
        textPaths += `<text x="${currentX}" y="${y}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="${fill}">${char}</text>`;
        currentX += fontSize * 0.6;
    }
}

// Replace ONLY the text element in the original SVG - preserve everything else
let processedSvg = originalSvg.replace(textMatch[0], textPaths);

// Add font definition for international font if we loaded one successfully
if (internationalFontBuffer) {
    const internationalFontStyle = `
        <style>
            @font-face {
                font-family: 'NotoSansInternational';
                font-weight: 700;
                font-style: normal;
            }
        </style>`;
    
    // Insert the font style into the SVG
    if (processedSvg.includes('<defs>')) {
        processedSvg = processedSvg.replace('<defs>', '<defs>' + internationalFontStyle);
    } else {
        // Insert after the opening <svg> tag
        processedSvg = processedSvg.replace(/<svg[^>]*>/, '$&<defs>' + internationalFontStyle + '</defs>');
    }
    console.log('✅ Added CJK font definition in SVG');
}

// Remove the original @font-face since we converted text to paths (but keep our CJK font)
processedSvg = processedSvg.replace(/@font-face\s*{\s*font-family:\s*["']?[^"']*?["']?;[^}]*?url\(data:font\/truetype;base64,[^}]*?}/g, '/* converted to paths */');

console.log('🎯 Text replacement complete, original design preserved');

// Convert to PNG with high quality settings and embedded CJK font support
const resvgOptions = {
    background: 'white',
    fitTo: {
        mode: 'width',
        value: 512
    },
    font: {
        loadSystemFonts: true,
        fontBuffers: [], // Will add CJK font if available
        defaultFontFamily: 'Arial, sans-serif',
        serif: 'Times, serif',
        sansSerif: 'Arial, Helvetica, sans-serif',
        cursive: 'cursive',
        fantasy: 'fantasy', 
        monospace: 'Courier, monospace'
    },
    logLevel: 'warn',
    shapeRendering: 2,
    textRendering: 2,
    imageRendering: 2
};

// Add international font buffer if we loaded one
if (internationalFontBuffer) {
    resvgOptions.font.fontBuffers.push(internationalFontBuffer);
    // Also set it as the default serif font since international characters might fallback to serif
    resvgOptions.font.serif = 'NotoSans, serif';
    resvgOptions.font.sansSerif = 'NotoSans, Arial, Helvetica, sans-serif';
    console.log('✅ Added international font buffer to resvg options and fallback chains');
}

const resvg = new Resvg(processedSvg, resvgOptions);

const pngData = resvg.render();
const pngBuffer = pngData.asPng();

// Create output directory if it doesn't exist
if (!existsSync('output')) {
    mkdirSync('output');
}

// Save results
writeFileSync('output/experimental-output.png', pngBuffer);
console.log(`🎖️ Hybrid military-grade rendering complete! Size: ${(pngBuffer.length/1024).toFixed(2)}KB`);
console.log('📊 Features: Original design preserved + Military Unicode support');
console.log('✅ Direct SVG-to-PNG processing (no intermediate files)');