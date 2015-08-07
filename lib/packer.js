'use strict';


var util = require('util');
var Stream = require('stream');
var zlib = require('zlib');
var filter = require('./filter-pack');
var CrcStream = require('./crc');
var constants = require('./constants');


var Packer = module.exports = function(options) {
  Stream.call(this);

  this._options = options;

  options.deflateChunkSize = options.deflateChunkSize || 32 * 1024;
  options.deflateLevel = options.deflateLevel != null ? options.deflateLevel : 9;
  options.deflateStrategy = options.deflateStrategy != null ? options.deflateStrategy : 3;

  this.readable = true;
};
util.inherits(Packer, Stream);


Packer.prototype.pack = function(data, width, height, gamma) {

  // Signature
  this.emit('data', new Buffer(constants.PNG_SIGNATURE));
  this.emit('data', this._packIHDR(width, height));

  if (gamma) {
    this.emit('data', this._packGAMA(gamma));
  }

  // filter pixel data
  var filteredData = filter(data, width, height, this._options);

  // compress it
  var deflate = zlib.createDeflate({
    chunkSize: this._options.deflateChunkSize,
    level: this._options.deflateLevel,
    strategy: this._options.deflateStrategy
  });
  deflate.on('error', this.emit.bind(this, 'error'));

  deflate.on('data', function(compressedData) {
    this.emit('data', this._packIDAT(compressedData));
  }.bind(this));

  deflate.on('end', function() {
    this.emit('data', this._packIEND());
    this.emit('end');
  }.bind(this));

  deflate.end(filteredData);
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

Packer.prototype._packGAMA = function(gamma) {
  var buf = new Buffer(4);
  buf.writeUInt32BE(Math.floor(gamma * constants.GAMMA_DIVISION), 0);
  return this._packChunk(constants.TYPE_gAMA, buf);
};

Packer.prototype._packIHDR = function(width, height) {

  var buf = new Buffer(13);
  buf.writeUInt32BE(width, 0);
  buf.writeUInt32BE(height, 4);
  buf[8] = 8;
  buf[9] = 6; // colorType
  buf[10] = 0; // compression
  buf[11] = 0; // filter
  buf[12] = 0; // interlace

  return this._packChunk(constants.TYPE_IHDR, buf);
};

Packer.prototype._packIDAT = function(data) {
  return this._packChunk(constants.TYPE_IDAT, data);
};

Packer.prototype._packIEND = function() {
  return this._packChunk(constants.TYPE_IEND, null);
};
