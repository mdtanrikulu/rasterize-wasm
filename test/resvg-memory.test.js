/**
 * Regression test: resvg's wasm objects must be freed after every render,
 * otherwise wasm linear memory grows until a GC happens to run finalizers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';

// Capture the resvg wasm instance before the first render initializes it
let resvgMemory = null;
const originalInstantiate = WebAssembly.instantiate;
WebAssembly.instantiate = async function (...args) {
    const result = await originalInstantiate.apply(this, args);
    const instance = result instanceof WebAssembly.Instance ? result : result.instance;
    if (instance?.exports?.__wbg_resvg_free) {
        resvgMemory = instance.exports.memory;
    }
    return result;
};

const { UniversalSVGRenderer } = await import('../src/index.js');

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

function crc32(buf) {
    let c = 0xffffffff;
    for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
    const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData));
    return Buffer.concat([length, typeAndData, crc]);
}

// All-zero RGBA PNG of the given size
function makePng(width, height) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    const raw = Buffer.alloc((width * 4 + 1) * height); // filter byte 0 per row
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        pngChunk('IHDR', ihdr),
        pngChunk('IDAT', deflateSync(raw)),
        pngChunk('IEND', Buffer.alloc(0))
    ]);
}

test('resvg wasm memory stays flat across repeated renders', async () => {
    const image = makePng(1024, 1024).toString('base64');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="2000">
  <image x="0" y="0" width="2000" height="2000" href="data:image/png;base64,${image}"/>
</svg>`;

    const renderer = new UniversalSVGRenderer();
    const sizes = [];
    for (let i = 0; i < 4; i++) {
        const png = await renderer.render(svg);
        assert.equal(Buffer.from(png.subarray(0, 4)).toString('latin1'), '\x89PNG');
        assert.ok(resvgMemory, 'resvg wasm instance was not captured');
        sizes.push(resvgMemory.buffer.byteLength);
    }

    const growth = sizes[sizes.length - 1] - sizes[0];
    const mb = (n) => (n / 1024 / 1024).toFixed(1);
    assert.ok(
        growth < 8 * 1024 * 1024,
        `resvg memory grew ${mb(growth)} MB across renders (${sizes.map(mb).join(', ')} MB)`
    );
});
