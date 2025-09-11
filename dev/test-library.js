/**
 * Simple test for the new library structure
 */
import { UniversalSVGRenderer } from './src/index.js';
import { base64svg } from './examples/assets/base64Img.js';

async function testLibrary() {
    try {
        console.log('🚀 Testing Universal SVG Renderer...');
        
        const renderer = new UniversalSVGRenderer();
        
        // Test 1: Render to file
        const filePath = await renderer.renderToFile(base64svg, 'output/library-test.png');
        console.log('✅ Rendered to file:', filePath);
        
        // Test 2: Render to buffer
        const buffer = await renderer.renderToBuffer(base64svg);
        console.log('✅ Rendered to buffer, size:', buffer.length, 'bytes');
        
        // Test 3: Render to base64
        const base64 = await renderer.renderToBase64(base64svg);
        console.log('✅ Rendered to base64, length:', base64.length);
        
        console.log('🎉 Library test completed successfully!');
        
    } catch (error) {
        console.error('❌ Library test failed:', error.message);
        console.error(error.stack);
    }
}

testLibrary();