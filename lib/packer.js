"use strict";

let constants = require("./constants");
let CrcStream = require("./crc");
let bitPacker = require("./bitpacker");
let filter = require("./filter-pack");
let zlib = require("zlib");

let Packer = (module.exports = function (options) {
  this._options = options;

  options.deflateChunkSize = options.deflateChunkSize || 32 * 1024;
  options.deflateLevel =
    options.deflateLevel != null ? options.deflateLevel : 9;
  options.deflateStrategy =
    options.deflateStrategy != null ? options.deflateStrategy : 3;
  options.inputHasAlpha =
    options.inputHasAlpha != null
      ? options.inputHasAlpha
      : // Indexed has no alpha by default, everything else does
      options.colorType === constants.COLORTYPE_PALETTE_COLOR
      ? false
      : true;
  options.deflateFactory = options.deflateFactory || zlib.createDeflate;
  options.bitDepth = options.bitDepth || 8;
  // This is outputColorType
  options.colorType =
    typeof options.colorType === "number"
      ? options.colorType
      : constants.COLORTYPE_COLOR_ALPHA;
  options.inputColorType =
    typeof options.inputColorType === "number"
      ? options.inputColorType
      : constants.COLORTYPE_COLOR_ALPHA;

  if (
    [
      constants.COLORTYPE_GRAYSCALE,
      constants.COLORTYPE_COLOR,
      constants.COLORTYPE_PALETTE_COLOR,
      constants.COLORTYPE_ALPHA,
      constants.COLORTYPE_COLOR_ALPHA,
    ].indexOf(options.colorType) === -1
  ) {
    throw new Error(
      "option color type:" + options.colorType + " is not supported at present"
    );
  }
  if (
    [
      constants.COLORTYPE_GRAYSCALE,
      constants.COLORTYPE_COLOR,
      constants.COLORTYPE_PALETTE_COLOR,
      constants.COLORTYPE_ALPHA,
      constants.COLORTYPE_COLOR_ALPHA,
    ].indexOf(options.inputColorType) === -1
  ) {
    throw new Error(
      "option input color type:" +
        options.inputColorType +
        " is not supported at present"
    );
  }
  if ([1, 2, 4, 8, 16].indexOf(options.bitDepth) === -1) {
    throw new Error(
      "option bit depth:" + options.bitDepth + " is not supported at present"
    );
  }
});

Packer.prototype.getDeflateOptions = function () {
  return {
    chunkSize: this._options.deflateChunkSize,
    level: this._options.deflateLevel,
    strategy: this._options.deflateStrategy,
  };
};

Packer.prototype.createDeflate = function () {
  return this._options.deflateFactory(this.getDeflateOptions());
};

Packer.prototype.filterData = function (data, width, height) {
  // convert to correct format for filtering (e.g. right bpp and bit depth)
  let packedData = bitPacker(data, width, height, this._options);

  // filter pixel data, noting that bit depths < 8 are treated as 8 (1Bpp)
  let bpp = constants.COLORTYPE_TO_BPP_MAP[this._options.colorType];
  let filteredData = filter(packedData, width, height, this._options, bpp);
  return filteredData;
};

Packer.prototype._packChunk = function (type, data) {
  let len = data ? data.length : 0;
  let buf = Buffer.alloc(len + 12);

  buf.writeUInt32BE(len, 0);
  buf.writeUInt32BE(type, 4);

  if (data) {
    data.copy(buf, 8);
  }

  buf.writeInt32BE(
    CrcStream.crc32(buf.slice(4, buf.length - 4)),
    buf.length - 4
  );
  return buf;
};

Packer.prototype.packGAMA = function (gamma) {
  let buf = Buffer.alloc(4);
  buf.writeUInt32BE(Math.floor(gamma * constants.GAMMA_DIVISION), 0);
  return this._packChunk(constants.TYPE_gAMA, buf);
};

Packer.prototype.packPLTE = function (palette) {
  let buf = Buffer.alloc(palette.length * 3);
  // Convert palette from RGBA array to RGB buffer
  for (let i = 0; i < palette.length; i++) {
    for (let c = 0; c < 3; c++) {
      buf[i * 3 + c] = palette[i][c];
    }
  }
  return this._packChunk(constants.TYPE_PLTE, buf);
};

Packer.prototype.packTRNS = function (palette, transColor) {
  let buf;
  switch (this._options.colorType) {
    case constants.COLORTYPE_PALETTE_COLOR: {
      if (!palette) return;

      // Find the last palette entry that has transparency set.
      let maxPal = -1;
      for (let i = 0; i < palette.length; i++) {
        if (palette[i][3] !== 255) {
          maxPal = i;
        }
      }
      if (maxPal >= 0) {
        // Got at least one transparent color, write out the tRNS block.
        buf = Buffer.alloc(maxPal + 1);
        for (let i = 0; i <= maxPal; i++) {
          buf[i] = palette[i][3];
        }
      } // else no transparent colors, don't write the block.
      break;
    }
    case constants.COLORTYPE_GRAYSCALE:
      if (!transColor) return;

      buf = Buffer.alloc(2);
      buf.writeUint16BE(0, transColor[0]);
      break;
    case constants.COLORTYPE_COLOR:
      if (!transColor) return;

      buf = Buffer.alloc(6);
      buf.writeUint16BE(0, transColor[0]);
      buf.writeUint16BE(2, transColor[1]);
      buf.writeUint16BE(4, transColor[2]);
      break;
  }

  if (!buf) return; // no transparent colors

  return this._packChunk(constants.TYPE_tRNS, buf);
};

Packer.prototype.packIHDR = function (width, height) {
  let buf = Buffer.alloc(13);
  buf.writeUInt32BE(width, 0);
  buf.writeUInt32BE(height, 4);
  buf[8] = this._options.bitDepth; // Bit depth
  buf[9] = this._options.colorType; // colorType
  buf[10] = 0; // compression
  buf[11] = 0; // filter
  buf[12] = 0; // interlace

  return this._packChunk(constants.TYPE_IHDR, buf);
};

Packer.prototype.packIDAT = function (data) {
  return this._packChunk(constants.TYPE_IDAT, data);
};

Packer.prototype.packIEND = function () {
  return this._packChunk(constants.TYPE_IEND, null);
};
