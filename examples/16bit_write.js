#!/usr/bin/env node

var fs = require('fs');
var PNG = require("../lib/png").PNG;
var w = 32;
var h = 64;

/// RGBA input (color type 6)
var buffer = new Buffer(2 * w * h * 4);
var bitmap = new Uint16Array(buffer.buffer);
for (var i = 0; i < h; i++) {
  for (var j = 0; j < w; j++) {
    bitmap[i * 4 * w + 4*j] = i * 65535 / h;
    bitmap[i * 4 * w + 4*j + 1] = j * 65535 / w;
    bitmap[i * 4 * w + 4*j + 2] = (h-i) * 65535 / h;
    bitmap[i * 4 * w + 4*j + 3] = 65535;
  }
}

var png = new PNG({
  width: w,
  height:h,
  bitDepth: 16,
  colorType: 6,
  inputColorType: 6,
  inputHasAlpha: true
});

png.data = buffer;
png.pack().pipe(fs.createWriteStream('colortype6.png'));

//////// Grayscale 16 bits///////

var buffer = new Buffer(2 * w * h);
var bitmap = new Uint16Array(buffer.buffer);
for (var i = 0; i < h; i++) {
  for (var j = 0; j < w; j++)
    bitmap[i * w + j] = i * 65535 / h;
}

png = new PNG({
  width: w,
  height:h,
  bitDepth: 16,
  colorType: 0,
  inputColorType: 0,
  inputHasAlpha: false
});

png.data = buffer;
png.pack().pipe(fs.createWriteStream('colortype0.png'));