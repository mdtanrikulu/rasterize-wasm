/**
 * Usage examples for Universal SVG Renderer
 */
import { UniversalSVGRenderer, SVGInputAdapter } from '../src/index.js';
import { base64svg } from './assets/base64Img.js';

// Example 1: Using the default instance
async function example1() {
    console.log('Example 1: Default instance with base64 input');
    
    const renderer = new UniversalSVGRenderer();
    
    // Render to buffer
    const buffer = await renderer.renderToBuffer(base64svg);
    console.log('Rendered to buffer, size:', buffer.length);
    
    // Render to base64
    const base64 = await renderer.renderToBase64(base64svg, true);
    console.log('Rendered to base64 data URL, length:', base64.length);
    
    // Render to file
    const filePath = await renderer.renderToFile(base64svg, 'output/example1.png');
    console.log('Rendered to file:', filePath);
}

// Example 2: Multiple output formats at once
async function example2() {
    console.log('\\nExample 2: Multiple output formats');
    
    const renderer = new UniversalSVGRenderer();
    
    const results = await renderer.render(base64svg, {
        buffer: true,
        base64: true,
        file: 'output/example2.png',
        dataURL: true
    });
    
    console.log('Results:', {
        bufferSize: results.buffer?.length,
        base64Length: results.base64?.length,
        filePath: results.filePath
    });
}

// Example 3: Raw SVG input
async function example3() {
    console.log('\\nExample 3: Raw SVG input');
    
    const rawSvg = `<svg width="200" height="100" xmlns="http://www.w3.org/2000/svg">
        <text x="10" y="50" font-size="20" fill="black">Hello 世界! 🌍</text>
    </svg>`;
    
    const renderer = new UniversalSVGRenderer();
    const filePath = await renderer.renderToFile(rawSvg, 'output/example3.png');
    console.log('Raw SVG rendered to:', filePath);
}

// Example 4: File input (ENS domain SVG with Satoshi fallback)
async function example4() {
    console.log('\\nExample 4: ENS domain SVG (tanrikulu.eth) with Satoshi fallback');
    
    const renderer = new UniversalSVGRenderer({
        fallbackFont: 'Satoshi'  // Will use Noto Sans since Satoshi isn't on Google Fonts
    });
    
    // Read and render tanrikulu.eth ENS domain SVG
    const svgContent = await SVGInputAdapter.fromFile('examples/assets/tanrikulu.eth.svg');
    const filePath = await renderer.renderToFile(svgContent, 'output/example4-file.png');
    console.log('ENS domain SVG rendered with Satoshi fallback to:', filePath);
}

// Example 5: Custom renderer options
async function example5() {
    console.log('\\nExample 5: Custom renderer options');
    
    const renderer = new UniversalSVGRenderer({
        enableInternationalFonts: true,
        enableEmoji: true
    });
    
    const buffer = await renderer.renderToBuffer(base64svg);
    console.log('Custom renderer result size:', buffer.length);
}

// Run examples
async function runExamples() {
    try {
        await example1();
        await example2();
        await example3();
        await example4();
        await example5();
        console.log('\\n✅ All examples completed successfully!');
    } catch (error) {
        console.error('❌ Example failed:', error.message);
        console.error(error.stack);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runExamples();
}

export { runExamples };