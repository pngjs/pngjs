#!/usr/bin/env node

let fs = require("fs");
let PNG = require("../lib/png").PNG;
let w = 32;
let h = 64;

/// RGBA input (color type 6)
let buffer = Buffer.alloc(2 * w * h * 4);
let bitmap = new Uint16Array(buffer.buffer);
for (let i = 0; i < h; i++) {
  for (let j = 0; j < w; j++) {
    bitmap[i * 4 * w + 4 * j] = (i * 65535) / h;
    bitmap[i * 4 * w + 4 * j + 1] = (j * 65535) / w;
    bitmap[i * 4 * w + 4 * j + 2] = ((h - i) * 65535) / h;
    bitmap[i * 4 * w + 4 * j + 3] = 65535;
  }
}

let png = new PNG({
  width: w,
  height: h,
  bitDepth: 16,
  colorType: 6,
  inputColorType: 6,
  inputHasAlpha: true,
});

png.data = buffer;
png.pack().pipe(fs.createWriteStream("colortype6.png"));

//////// Grayscale 16 bits///////

buffer = Buffer.alloc(2 * w * h);
bitmap = new Uint16Array(buffer.buffer);
for (let i = 0; i < h; i++) {
  for (let j = 0; j < w; j++) bitmap[i * w + j] = (i * 65535) / h;
}

png = new PNG({
  width: w,
  height: h,
  bitDepth: 16,
  colorType: 0,
  inputColorType: 0,
  inputHasAlpha: false,
});

png.data = buffer;
png.pack().pipe(fs.createWriteStream("colortype0.png"));
