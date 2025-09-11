import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import opentype from 'opentype.js';
import { base64svg } from './base64Img.js';

// Initialize resvg WASM
const wasmResponse = await fetch('https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm');
const wasmBytes = await wasmResponse.arrayBuffer();
await initWasm(wasmBytes);

console.log('🚀 Simplified Unicode renderer...');

// Decode SVG with proper UTF-8 handling
const svgData = base64svg.split(',')[1];
const originalSvg = Buffer.from(svgData, 'base64').toString('utf-8');
const textMatch = originalSvg.match(/<text[^>]*>(.*?)<\/text>/s);
if (!textMatch) {
    console.error('❌ No text element found');
    process.exit(1);
}

// Extract text and attributes
const textElement = textMatch[0];
const textContent = textMatch[1];
const fontSize = parseInt(textElement.match(/font-size="(\d+)"/)?.[1] || '68');
const fill = textElement.match(/fill="([^"]+)"/)?.[1] || 'white';
const x = parseFloat(textElement.match(/x="([^"]+)"/)?.[1] || '70');
const y = parseFloat(textElement.match(/y="([^"]+)"/)?.[1] || '446');

console.log('📝 Text:', textContent);

// Load primary font (embedded in SVG)
const fontDataMatch = originalSvg.match(/src:\s*url\(data:font\/truetype;base64,([^)]+)\)/);
let primaryFont = null;
if (fontDataMatch) {
    const fontBuffer = Buffer.from(fontDataMatch[1], 'base64');
    primaryFont = opentype.parse(fontBuffer.buffer);
    console.log('✅ Primary font loaded');
} else {
    console.log('⚠️ No primary font found in SVG');
}

// Load international font if needed
async function loadInternationalFont(text) {
    const hasInternational = /[\u0600-\u06FF\u0750-\u077F\u0590-\u05FF\u4E00-\u9FFF\u0900-\u097F]/.test(text);
    if (!hasInternational) return null;
    
    console.log('🔤 Loading international font...');
    
    // Use script-specific fonts for Arabic/Hebrew (need proper shaping), universal for others
    let fontFamily = 'Noto+Sans';
    if (/[\u0600-\u06FF\u0750-\u077F]/.test(text)) {
        fontFamily = 'Noto+Naskh+Arabic';
        console.log('📝 Using Arabic-specific font for proper character shaping');
    } else if (/[\u0590-\u05FF]/.test(text)) {
        fontFamily = 'Noto+Sans+Hebrew'; 
        console.log('📝 Using Hebrew-specific font');
    } else {
        console.log('📝 Using universal Noto Sans for other international scripts');
    }
    
    try {
        const cssResponse = await fetch(`https://fonts.googleapis.com/css?family=${fontFamily}:700&text=${encodeURIComponent(text)}&display=swap`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0' }
        });
        const css = await cssResponse.text();
        const urlMatch = css.match(/url\(([^)]+)\)/);
        if (!urlMatch) return null;
        
        const fontResponse = await fetch(urlMatch[1]);
        const fontBuffer = await fontResponse.arrayBuffer();
        const font = opentype.parse(fontBuffer);
        console.log('✅ International font loaded:', fontFamily);
        return font;
    } catch (error) {
        console.log('⚠️ Failed to load international font:', error.message);
        return null;
    }
}

// Load emoji SVG
async function loadEmojiSvg(char) {
    const codePoint = char.codePointAt(0).toString(16).toLowerCase();
    try {
        const response = await fetch(`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codePoint}.svg`);
        return response.ok ? await response.text() : null;
    } catch {
        return null;
    }
}

// Generate text paths
async function generateTextPaths(text, x, y, fontSize, fill, primaryFont, internationalFont) {
    let paths = '';
    let currentX = x;
    
    // Handle RTL for Arabic
    const chars = Array.from(text);
    const hasArabic = /[\u0600-\u06FF\u0750-\u077F]/.test(text);
    
    if (hasArabic) {
        console.log('🔤 Applying RTL processing for Arabic text');
        // Simple RTL: reverse Arabic segments, keep Latin segments in order
        let segments = [];
        let currentSegment = {chars: [], isArabic: false};
        
        for (const char of chars) {
            const isArabic = /[\u0600-\u06FF\u0750-\u077F]/.test(char);
            if (isArabic !== currentSegment.isArabic) {
                if (currentSegment.chars.length > 0) {
                    segments.push(currentSegment);
                }
                currentSegment = {chars: [char], isArabic};
            } else {
                currentSegment.chars.push(char);
            }
        }
        if (currentSegment.chars.length > 0) {
            segments.push(currentSegment);
        }
        
        // Reverse Arabic segments
        chars.length = 0;
        for (const segment of segments) {
            if (segment.isArabic) {
                chars.push(...segment.chars.reverse());
            } else {
                chars.push(...segment.chars);
            }
        }
    }
    
    for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        const codePoint = char.codePointAt(0);
        
        // Handle emoji
        if (codePoint >= 0x1F000) {
            const emojiSvg = await loadEmojiSvg(char);
            if (emojiSvg) {
                const emojiContent = emojiSvg.match(/<svg[^>]*>(.*)<\/svg>/s)?.[1];
                if (emojiContent) {
                    const emojiY = y - fontSize * 0.75;
                    paths += `<g transform="translate(${currentX}, ${emojiY}) scale(${fontSize/36})">${emojiContent}</g>`;
                    currentX += fontSize;
                    console.log('✅ Emoji rendered');
                    continue;
                }
            }
        }
        
        // Handle international characters
        const isInternational = /[\u0600-\u06FF\u0750-\u077F\u0590-\u05FF\u4E00-\u9FFF\u0900-\u097F]/.test(char);
        const font = isInternational && internationalFont ? internationalFont : primaryFont;
        
        if (font && font.hasChar && font.hasChar(char)) {
            const path = font.getPath(char, currentX, y, fontSize);
            const pathData = path.toPathData(2);
            if (pathData && pathData !== 'M0,0') {
                paths += `<path d="${pathData}" fill="${fill}" />`;
                currentX += font.getAdvanceWidth(char, fontSize);
            } else {
                currentX += fontSize * 0.6;
            }
        } else {
            // Fallback: approximate width
            currentX += fontSize * 0.6;
        }
    }
    
    return paths;
}

// Main processing
const internationalFont = await loadInternationalFont(textContent);
const textPaths = await generateTextPaths(textContent, x, y, fontSize, fill, primaryFont, internationalFont);

// Replace text in SVG
const processedSvg = originalSvg.replace(textMatch[0], textPaths);

// Render PNG
const resvg = new Resvg(processedSvg);
const pngBuffer = resvg.render().asPng();

// Create output directory if it doesn't exist
if (!existsSync('output')) {
    mkdirSync('output');
}

// Save result
writeFileSync('output/output.png', pngBuffer);
console.log(`✅ Simplified rendering complete! Size: ${(pngBuffer.length/1024).toFixed(2)}KB`);
console.log('📊 Saved as: output/output.png');