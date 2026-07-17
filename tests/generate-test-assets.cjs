/**
 * Generates test manifest + placeholder PNG images for the devnet proof collection.
 * Outputs to tests/devnet-assets/ — commit these to GitHub so raw URLs are accessible.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ─── Minimal PNG generator (solid color 16×16) ──────────────
function makePng(r, g, b) {
  const width = 16, height = 16;
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type (RGB)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk("IHDR", ihdrData);

  // IDAT chunk (raw image data with filter byte per row)
  const rawData = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 3)] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const offset = y * (1 + width * 3) + 1 + x * 3;
      rawData[offset] = r;
      rawData[offset + 1] = g;
      rawData[offset + 2] = b;
    }
  }
  const zlib = require("zlib");
  const compressed = zlib.deflateSync(rawData);
  const idat = makeChunk("IDAT", compressed);

  // IEND chunk
  const iend = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = crc32(Buffer.concat([typeBuf, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

// CRC32 for PNG
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc ^ 0xffffffff;
}

function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// ─── Generate assets ─────────────────────────────────────────
const outDir = path.join(__dirname, "devnet-assets");
fs.mkdirSync(outDir, { recursive: true });

const NUM_EVOS = 5;
const NUM_STAGES = 2;

// Color palette: each EVO gets a unique color, each stage is a variant
const colors = [
  [255, 80, 80],   // EVO 0: red
  [80, 255, 80],   // EVO 1: green
  [80, 80, 255],   // EVO 2: blue
  [255, 255, 80],  // EVO 3: yellow
  [255, 80, 255],  // EVO 4: magenta
];

const provenanceItems = [];

for (let evoId = 0; evoId < NUM_EVOS; evoId++) {
  for (let stage = 0; stage < NUM_STAGES; stage++) {
    const [r, g, b] = colors[evoId];
    // Darken for stage 1
    const sr = stage === 0 ? r : Math.floor(r * 0.5);
    const sg = stage === 0 ? g : Math.floor(g * 0.5);
    const sb = stage === 0 ? b : Math.floor(b * 0.5);

    const png = makePng(sr, sg, sb);
    const filename = `evo${evoId}_stage${stage}.png`;
    fs.writeFileSync(path.join(outDir, filename), png);

    const hash = sha256Hex(png);
    console.log(`${filename}: ${png.length} bytes, sha256=${hash}`);

    // Provenance is per-EVO (stage 0 image hash — the primary artwork)
    if (stage === 0) {
      provenanceItems.push({ id: evoId, hash });
    }
  }
}

// Stage definitions for the manifest
const stages = [];
for (let s = 0; s < NUM_STAGES; s++) {
  stages.push({
    id: s,
    name: s === 0 ? "Genesis" : "Evolved",
    image: `https://raw.githubusercontent.com/stephenclawdbot-png/EVO/main/tests/devnet-assets/evo0_stage${s}.png`,
  });
}

const manifest = {
  schema: "evo-visual-manifest-v1",
  name: "DevTest Genesis",
  description: "Devnet proof collection — 5 EVOs, 2 stages, placeholder art",
  lifecycle: "reveal_and_evolve",
  fallback_image: "https://raw.githubusercontent.com/stephenclawdbot-png/EVO/main/tests/devnet-assets/evo0_stage0.png",
  image_template: "https://raw.githubusercontent.com/stephenclawdbot-png/EVO/main/tests/devnet-assets/evo{id}_stage{stage}.png",
  stages,
  provenance: {
    items: provenanceItems,
  },
};

const manifestJson = JSON.stringify(manifest, null, 2);
fs.writeFileSync(path.join(outDir, "manifest.json"), manifestJson);

const manifestHash = sha256Hex(Buffer.from(manifestJson));
console.log(`\nmanifest.json: ${manifestJson.length} bytes, sha256=${manifestHash}`);
console.log(`\nManifest hash (for on-chain artworkManifestHash):`);
console.log(manifestHash);

// Also output as byte array for Anchor
const hashBuf = Buffer.from(manifestHash, "hex");
const hashArray = Array.from(hashBuf);
console.log(`\nByte array for Anchor:`);
console.log(`[${hashArray.join(",")}]`);