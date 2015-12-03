'use strict';

var zlib = require('zlib');
var constants = require('./constants');
var Packer = require('./packer');

module.exports = function(metaData, opt) {
  var options = opt || {};
  options.deflateChunkSize = options.deflateChunkSize || 32 * 1024;
  options.deflateLevel = options.deflateLevel != null ? options.deflateLevel : 9;
  options.deflateStrategy = options.deflateStrategy != null ? options.deflateStrategy : 3;
  options.inputHasAlpha = options.inputHasAlpha != null ? options.inputHasAlpha : true;
  options.deflateFactory = options.deflateFactory || zlib.createDeflate;
  options.bitDepth = options.bitDepth || 8;
  options.colorType = (typeof options.colorType === 'number') ? options.colorType : constants.COLORTYPE_COLOR_ALPHA;

  if (options.colorType !== constants.COLORTYPE_COLOR && options.colorType !== constants.COLORTYPE_COLOR_ALPHA) {
    throw new Error('option color type:' + options.colorType + ' is not supported at present');
  }
  if (options.bitDepth !== 8) {
    throw new Error('option bit depth:' + options.bitDepth + ' is not supported at present');
  }

  var packer = new Packer(options);

  var chunks = [];

  // Signature
  chunks.push(new Buffer(constants.PNG_SIGNATURE));

  // Header
  chunks.push(packer.packIHDR(metaData.width, metaData.height));

  if (metaData.gamma) {
    chunks.push(packer.packGAMA(metaData.gamma));
  }

  var filteredData = packer.filterData(metaData.data, metaData.width, metaData.height);

  // compress it
  var compressedData = zlib.deflateSync(filteredData);
  filteredData = null;

  if (!compressedData || !compressedData.length) {
    throw new Error('bad png - invalid compressed data response');
  }
  chunks.push(packer.packIDAT(compressedData));

  // End
  chunks.push(packer.packIEND());

  return Buffer.concat(chunks);
};
