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
const pngBuffer = await renderer.renderToBuffer(svgString);

// to file
await renderer.renderToFile(svgString, 'output.png');

// to base64
const base64 = await renderer.renderToBase64(svgString, true); // true = data URL
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

## run examples

```bash
yarn example
```

Check `examples/usage.js` for more patterns.