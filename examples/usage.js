/**
 * Usage examples for Universal SVG Renderer
 */
import { UniversalSVGRenderer } from '../src/index.js';
import { base64svg } from './assets/base64Img.js';
import { readFileSync } from 'fs';

// Example 1: Using the default instance
async function example1() {
    console.log('Example 1: Default instance with base64 input');

    const renderer = new UniversalSVGRenderer();

    // Render to buffer
    const buffer = await renderer.render(base64svg);
    console.log('Rendered to buffer, size:', buffer.length);

    // Render to base64
    const base64 = await renderer.render(base64svg, { format: 'base64', dataURL: true });
    console.log('Rendered to base64 data URL, length:', base64.length);

    // Render to file
    const filePath = await renderer.render(base64svg, { format: 'file', path: 'output/example1.png' });
    console.log('Rendered to file:', filePath);
}

// Example 2: Multi-script international text
async function example2() {
    console.log('\nExample 2: Multi-script international text');

    const multiScriptSvg = `<svg width="500" height="440" viewBox="0 0 500 440" xmlns="http://www.w3.org/2000/svg">
            <rect width="500" height="440" rx="16" fill="#1a1a2e"/>
            <text x="250" y="50" font-size="20" font-weight="bold" text-anchor="middle" fill="#e94560">Multi-Script Rendering</text>
            <text x="40" y="100" font-size="20" fill="#eee">Arabic: مرحبا بالعالم</text>
            <text x="40" y="140" font-size="20" fill="#eee">Hebrew: שלום עולם</text>
            <text x="40" y="180" font-size="20" fill="#eee">Hindi: नमस्ते दुनिया</text>
            <text x="40" y="220" font-size="20" fill="#eee">Korean: 안녕하세요 세계</text>
            <text x="40" y="260" font-size="20" fill="#eee">Chinese: 你好世界</text>
            <text x="40" y="300" font-size="20" fill="#eee">Tamil: வணக்கம் உலகம்</text>
            <text x="40" y="340" font-size="20" fill="#eee">Thai: สวัสดีชาวโลก</text>
            <text x="40" y="380" font-size="20" fill="#eee">Emoji: 🚀🌍👨‍👩‍👧‍👦🇹🇷 1️⃣2️⃣3️⃣ ⭐</text>
            <text x="40" y="420" font-size="20" fill="#eee">Georgian: გამარჯობა მსოფლიო</text>
        </svg>`;

    const renderer = new UniversalSVGRenderer();
    const filePath = await renderer.render(multiScriptSvg, { format: 'file', path: 'output/example2.png' });
    console.log('Multi-script rendered to:', filePath);
}

// Example 3: Raw SVG input
async function example3() {
    console.log('\nExample 3: Raw SVG input');

    const rawSvg = `<svg width="200" height="100" xmlns="http://www.w3.org/2000/svg">
        <text x="10" y="50" font-size="20" fill="black">Hello 世界! 🌍</text>
    </svg>`;

    const renderer = new UniversalSVGRenderer();
    const filePath = await renderer.render(rawSvg, { format: 'file', path: 'output/example3.png' });
    console.log('Raw SVG rendered to:', filePath);
}

// Example 4: File input (ENS domain SVG with embedded Satoshi font)
async function example4() {
    console.log('\nExample 4: ENS domain SVG (tanrikulu.eth) with embedded Satoshi font');

    const renderer = new UniversalSVGRenderer();

    // The tanrikulu.eth SVG embeds Satoshi as a base64 @font-face.
    // The library extracts and uses it automatically as the primary font.
    const svgContent = readFileSync('examples/assets/tanrikulu.eth.svg', 'utf-8');
    const filePath = await renderer.render(svgContent, { format: 'file', path: 'output/example4-file.png' });
    console.log('ENS domain SVG rendered to:', filePath);
}

// Example 5: Japanese ENS card (CJK text, no background image)
async function example5() {
    console.log('\nExample 5: Japanese ENS card (東京タワー.eth)');

    const renderer = new UniversalSVGRenderer();

    const svgContent = readFileSync('examples/assets/ens-japanese.svg', 'utf-8');
    const filePath = await renderer.render(svgContent, { format: 'file', path: 'output/example5.png' });
    console.log('Japanese ENS card rendered to:', filePath);
}

// Run examples
async function runExamples() {
    try {
        await example1();
        await example2();
        await example3();
        await example4();
        await example5();
        console.log('\n✅ All examples completed successfully!');
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
