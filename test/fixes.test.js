/**
 * Regression tests for parsing, output and font-loading fixes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    setHarfBuzzWasm, FontLoader, toBase64, replaceTextElement,
    extractAllTextContent, optimizeFilters, loadEmojiSvg, generateTextPaths
} from '../src/index.js';

// Runs first: HarfBuzz must not be initialized yet
test('a failing precompiled HarfBuzz module rejects instead of hanging', async () => {
    // Valid wasm module importing x.missng, which HarfBuzz's glue does not provide
    const bad = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 2, 12, 1, 1, 120, 6, 109, 105, 115, 115, 110, 103, 0, 0]);
    setHarfBuzzWasm(new WebAssembly.Module(bad));
    await assert.rejects(FontLoader.getHb(), TypeError);
    // The failure is not cached: back to the default binary, initialization succeeds
    setHarfBuzzWasm(null);
    assert.ok(await FontLoader.getHb());
});

test('toBase64 encodes the Uint8Array resvg returns', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    assert.equal(toBase64(png), 'iVBORw==');
    assert.equal(toBase64(png, true), 'data:image/png;base64,iVBORw==');
});

test('replaceTextElement inserts $ patterns literally', () => {
    const svg = `<svg>${'A'.repeat(100)}<text>x</text></svg>`;
    assert.equal(replaceTextElement(svg, '<text>x</text>', '<path fill="$`$&"/>'), `<svg>${'A'.repeat(100)}<path fill="$\`$&"/></svg>`);
});

test('text attributes are not read from longer attribute names', () => {
    const [t] = extractAllTextContent('<svg><text dx="500" dy="600" data-fill="red" x="10" y="20">a</text></svg>');
    assert.deepEqual([t.attributes.x, t.attributes.y, t.attributes.fill], [10, 20, 'white']);
});

test('SVG parsing stays linear on malformed input', () => {
    // Each of these took 1-27 s with the old regexes
    const inputs = [
        () => extractAllTextContent('<text '.repeat(20000)),
        () => extractAllTextContent(`<text>${'<'.repeat(120000)}</text>`),
        () => optimizeFilters('<filter '.repeat(20000)),
        () => optimizeFilters('<filter' + ' filterUnits="userSpaceOnUse"'.repeat(5000)),
        () => optimizeFilters(`<filter filterUnits="userSpaceOnUse"${' '.repeat(120000)}>`),
    ];
    for (const run of inputs) {
        const start = performance.now();
        run();
        assert.ok(performance.now() - start < 500, `took ${(performance.now() - start).toFixed(0)} ms`);
    }
    assert.equal(
        optimizeFilters('<filter id="f" x="0" y="0" width="9" height="9" filterUnits="userSpaceOnUse">'),
        '<filter id="f" filterUnits="objectBoundingBox">'
    );
});

test('concurrent cold loads share one font', async () => {
    const fonts = await Promise.all([1, 2, 3].map(() => FontLoader._loadLocalFont('Noto+Sans+Hebrew')));
    assert.ok(fonts[0]);
    assert.equal(new Set(fonts).size, 1);
});

test('emoji resolve when ENS normalization dropped the FE0F their twemoji key has', async () => {
    const emoji = (hex) => String.fromCodePoint(...hex.split('-').map(h => parseInt(h, 16)));
    for (const [bare, key] of [
        ['1f9d9-1f3fb-200d-2642', '1f9d9-1f3fb-200d-2642-fe0f'], // FE0F at the end of the key
        ['2764-200d-1f525', '2764-fe0f-200d-1f525'],             // FE0F mid-sequence
        ['1f3f3-200d-1f308', '1f3f3-fe0f-200d-1f308'],
    ]) {
        const svg = await loadEmojiSvg(emoji(key));
        assert.ok(svg, `${key} missing from data`);
        assert.equal(await loadEmojiSvg(emoji(bare)), svg, bare);
    }
    // Existing lookups, with and without FE0F in the input
    assert.equal(await loadEmojiSvg(emoji('2764-fe0f')), await loadEmojiSvg(emoji('2764')));
    assert.ok(await loadEmojiSvg(emoji('1f600')));

    const font = await FontLoader.loadFallbackFont('Noto+Sans');
    const paths = await generateTextPaths('🦊🧙🏻‍♂.eth', 0, 50, 40, 'white', null, new Map(), font, {});
    assert.equal(paths.match(/<g transform/g)?.length, 2, 'fox and mage should both be drawn');
});
