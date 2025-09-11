/**
 * SVG parsing utilities
 */

export class SVGParser {
    static extractTextContent(svgString) {
        // Updated regex to handle multiline text elements with whitespace and attributes
        const textMatch = svgString.match(/<text[\s\S]*?>([\s\S]*?)<\/text>/);
        if (!textMatch) {
            throw new Error('No text element found in SVG');
        }

        const textElement = textMatch[0];
        const textContent = textMatch[1].trim();

        // Extract attributes from the full text element
        const fontSizeMatch = textElement.match(/font-size="(\d+)(?:px)?"/);
        const fontSize = parseInt(fontSizeMatch?.[1] || '68');
        const fill = textElement.match(/fill="([^"]+)"/)?.[1] || 'white';
        const x = parseFloat(textElement.match(/x="([^"]+)"/)?.[1] || '70');
        const y = parseFloat(textElement.match(/y="([^"]+)"/)?.[1] || '446');

        return {
            textElement,
            textContent,
            attributes: { fontSize, fill, x, y }
        };
    }

    static extractEmbeddedFont(svgString) {
        const fontDataMatch = svgString.match(/src:\s*url\(data:font\/truetype;base64,([^)]+)\)/);
        if (!fontDataMatch) {
            return null;
        }

        try {
            const fontBuffer = Buffer.from(fontDataMatch[1], 'base64');
            return fontBuffer;
        } catch (error) {
            console.warn('Failed to extract embedded font:', error.message);
            return null;
        }
    }

    static replaceTextElement(svgString, textElement, replacementContent) {
        return svgString.replace(textElement, replacementContent);
    }
}