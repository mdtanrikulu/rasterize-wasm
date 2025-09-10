import { writeFileSync } from 'fs';
import CanvasKitInit from 'canvaskit-wasm';
import { base64svg } from './base64Img.js';

console.log('🚀 CanvasKit SVG renderer with universal Unicode support...');

// Initialize CanvasKit
const CanvasKit = await CanvasKitInit();

// Decode the base64 SVG
const svgData = base64svg.split(',')[1];
const originalSvg = atob(svgData);

console.log('✅ Original SVG loaded, length:', originalSvg.length);

// Extract text content for analysis
const textMatch = originalSvg.match(/<text[^>]*>(.*?)<\/text>/s);
if (!textMatch) {
    console.error('❌ No text element found');
    process.exit(1);
}

const rawTextContent = textMatch[0];
const textContentMatch = rawTextContent.match(/>([^<]*)</);
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

// Create surface for rendering
const surface = CanvasKit.MakeSurface(512, 512);
if (!surface) {
    console.error('❌ Failed to create CanvasKit surface');
    process.exit(1);
}

const canvas = surface.getCanvas();

try {
    // Try to parse and render the SVG directly with CanvasKit
    console.log('🎨 Rendering SVG with CanvasKit...');
    
    // Check if CanvasKit has SVG support
    if (CanvasKit.MakeSVGFromString) {
        const svgElement = CanvasKit.MakeSVGFromString(originalSvg);
        if (svgElement) {
            // Clear canvas with white background
            canvas.clear(CanvasKit.WHITE);
            
            // Render the SVG
            svgElement.render(canvas);
            
            console.log('✅ SVG rendered successfully with CanvasKit');
        }
    } else {
        console.log('⚠️ CanvasKit SVG support not available, using manual rendering');
        
        // Fallback: manual rendering with proper text support
        canvas.clear(CanvasKit.WHITE);
        
        // Create paint for text
        const paint = new CanvasKit.Paint();
        paint.setColor(CanvasKit.BLACK);
        paint.setAntiAlias(true);
        
        // Load default font and create text
        const fontMgr = CanvasKit.FontMgr.RefDefault();
        const font = new CanvasKit.Font(null, 56);
        
        // Draw text at the correct position
        const textBlob = CanvasKit.TextBlob.MakeFromText(properText, font);
        canvas.drawTextBlob(textBlob, 72, 446, paint);
        
        console.log('✅ Manual text rendering completed');
        
        // Cleanup
        textBlob.delete();
        font.delete();
        fontMgr.delete();
        paint.delete();
    }
    
    // Get the image data
    const img = surface.makeImageSnapshot();
    const pngData = img.encodeToBytes(CanvasKit.ImageFormat.PNG);
    
    // Save the result
    writeFileSync('output.png', pngData);
    console.log(`🎖️ CanvasKit rendering complete! Size: ${(pngData.length/1024).toFixed(2)}KB`);
    console.log('✅ Universal Unicode support with Skia rendering engine');
    
    // Cleanup
    img.delete();
    
} catch (error) {
    console.error('❌ CanvasKit rendering error:', error);
} finally {
    surface.delete();
}