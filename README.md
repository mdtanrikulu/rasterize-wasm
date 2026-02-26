# rasterize-wasm

Universal SVG to PNG renderer that works with international text, emojis, and complex fonts.

## what it does

- Converts SVG to PNG using WASM (works in Cloudflare Workers)
- Handles CJK characters, Arabic, Hebrew, emojis, basically any Unicode
- Loads fonts dynamically from Google Fonts when needed
- Fallback font system so text never disappears
- No server dependencies, no Canvas API

## install

```bash
yarn add rasterize-wasm
```

## basic usage

```javascript
import { UniversalSVGRenderer } from 'rasterize-wasm';

const renderer = new UniversalSVGRenderer();

// from SVG string
const pngBuffer = await renderer.render(svgString);

// to file
await renderer.render(svgString, { format: 'file', path: 'output.png' });

// to base64
const base64 = await renderer.render(svgString, { format: 'base64', dataURL: true });
```

## examples

```javascript
// basic text
const svg = `<svg width="200" height="100">
  <text x="10" y="50" font-size="20">Hello 世界! 🌍</text>
</svg>`;

// custom fallback font
const renderer = new UniversalSVGRenderer({
  fallbackFont: 'Satoshi' // uses Noto Sans if not available on Google Fonts
});

// multiple outputs at once
const results = await renderer.render(svg, {
  buffer: true,
  base64: true,
  file: 'output.png'
});
```

## how it works

1. extracts text from SVG
2. loads embedded fonts or downloads from Google Fonts
3. converts text to SVG paths using opentype.js
4. replaces original text with paths
5. renders final SVG to PNG with resvg-wasm

## why this exists

Every other solution either:
- doesn't handle international text
- requires system fonts
- needs Canvas API
- breaks on emojis, especially on compound emojis
- doesn't work in Workers

This one actually works.

## cloudflare workers

WASM is bundled locally. For Workers, pass the WASM buffer:

```javascript
import wasmBuffer from './node_modules/rasterize-wasm/wasm/resvg.wasm';
import { UniversalSVGRenderer } from 'rasterize-wasm';

export default {
  async fetch(request, env) {
    const renderer = new UniversalSVGRenderer();
    const svg = await request.text();

    // Pass WASM buffer through render options
    const png = await renderer.render(svg, {
      buffer: true,
      wasmBuffer: wasmBuffer
    });

    return new Response(png, {
      headers: { 'Content-Type': 'image/png' }
    });
  }
}
```

Make sure your `wrangler.toml` has:
```toml
[build]
upload.format = "modules"
```

## run examples

```bash
yarn example
```

Check `examples/usage.js` for more patterns.