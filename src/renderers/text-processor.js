/**
 * Text processing and path generation
 */

export class TextProcessor {
    static async loadEmojiSvg(char) {
        const codePoint = char.codePointAt(0).toString(16).toLowerCase();
        try {
            const response = await fetch(`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codePoint}.svg`);
            return response.ok ? await response.text() : null;
        } catch {
            return null;
        }
    }

    static applyRTLProcessing(text) {
        const chars = Array.from(text);
        const hasArabic = /[\u0600-\u06FF\u0750-\u077F]/.test(text);
        
        if (!hasArabic) return chars;

        // Simple RTL: reverse Arabic segments, keep Latin segments in order
        let segments = [];
        let currentSegment = { chars: [], isArabic: false };
        
        for (const char of chars) {
            const isArabic = /[\u0600-\u06FF\u0750-\u077F]/.test(char);
            if (isArabic !== currentSegment.isArabic) {
                if (currentSegment.chars.length > 0) {
                    segments.push(currentSegment);
                }
                currentSegment = { chars: [char], isArabic };
            } else {
                currentSegment.chars.push(char);
            }
        }
        
        if (currentSegment.chars.length > 0) {
            segments.push(currentSegment);
        }
        
        // Reverse Arabic segments
        const processedChars = [];
        for (const segment of segments) {
            if (segment.isArabic) {
                processedChars.push(...segment.chars.reverse());
            } else {
                processedChars.push(...segment.chars);
            }
        }
        
        return processedChars;
    }

    static async generateTextPaths(text, x, y, fontSize, fill, primaryFont, internationalFont, fallbackFont) {
        let paths = '';
        let currentX = x;
        
        const chars = this.applyRTLProcessing(text);
        
        for (const char of chars) {
            const codePoint = char.codePointAt(0);
            
            // Handle emoji
            if (codePoint >= 0x1F000) {
                const emojiSvg = await this.loadEmojiSvg(char);
                if (emojiSvg) {
                    const emojiContent = emojiSvg.match(/<svg[^>]*>(.*)<\/svg>/s)?.[1];
                    if (emojiContent) {
                        const emojiY = y - fontSize * 0.75;
                        paths += `<g transform="translate(${currentX}, ${emojiY}) scale(${fontSize/36})">${emojiContent}</g>`;
                        currentX += fontSize;
                        continue;
                    }
                }
            }
            
            // Handle international characters
            const isInternational = /[\u0600-\u06FF\u0750-\u077F\u0590-\u05FF\u4E00-\u9FFF\u0900-\u097F]/.test(char);
            let font = isInternational && internationalFont ? internationalFont : primaryFont;
            
            // Use fallback font if no primary font available
            if (!font && fallbackFont) {
                font = fallbackFont;
            }
            
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
}