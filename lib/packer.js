'use strict';

var constants = require('./constants');
var CrcStream = require('./crc');
var bitPacker = require('./bitpacker');
var filter = require('./filter-pack');

var Packer = module.exports = function(options) {
  this._options = options;
};

Packer.prototype.filterData = function(data, width, height){
  // convert to correct format for filtering (e.g. right bpp and bit depth)
  var packedData = bitPacker(data, width, height, this._options);

  // filter pixel data
  var bpp = constants.COLORTYPE_TO_BPP_MAP[this._options.colorType];
  var filteredData = filter(packedData, width, height, this._options, bpp);
  return filteredData;
};

Packer.prototype._packChunk = function(type, data) {

  var len = (data ? data.length : 0);
  var buf = new Buffer(len + 12);

  buf.writeUInt32BE(len, 0);
  buf.writeUInt32BE(type, 4);

  if (data) {
    data.copy(buf, 8);
  }

  buf.writeInt32BE(CrcStream.crc32(buf.slice(4, buf.length - 4)), buf.length - 4);
  return buf;
};

Packer.prototype.packGAMA = function(gamma) {
  var buf = new Buffer(4);
  buf.writeUInt32BE(Math.floor(gamma * constants.GAMMA_DIVISION), 0);
  return this._packChunk(constants.TYPE_gAMA, buf);
};

Packer.prototype.packIHDR = function(width, height) {

  var buf = new Buffer(13);
  buf.writeUInt32BE(width, 0);
  buf.writeUInt32BE(height, 4);
  buf[8] = this._options.bitDepth;  // Bit depth
  buf[9] = this._options.colorType; // colorType
  buf[10] = 0; // compression
  buf[11] = 0; // filter
  buf[12] = 0; // interlace

  return this._packChunk(constants.TYPE_IHDR, buf);
};

Packer.prototype.packIDAT = function(data) {
  return this._packChunk(constants.TYPE_IDAT, data);
};

Packer.prototype.packIEND = function() {
  return this._packChunk(constants.TYPE_IEND, null);
};