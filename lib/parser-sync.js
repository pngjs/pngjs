'use strict';


var zlib = require('zlib');
var SyncReader = require('./sync-reader');
var FilterSync = require('./filter-sync');
var Parser = require('./parser');
var bitmapper = require('./bitmapper');
var formatNormaliser = require('./format-normaliser');


module.exports = function(buffer, options) {

  var err;
  function handleError(_err_) {
    err = _err_;
  }

  var data, bpp, width, height, depth, interlace;
  function handleBitmapInfo(_width_, _height_, _bpp_, _depth_, _interlace_) {

    bpp = _bpp_;
    width = _width_;
    height = _height_;
    depth = _depth_;
    interlace = _interlace_;

    data = new Buffer(width * height * 4);
  }

  var metaData;
  function handleMetaData(_metaData_) {
    metaData = _metaData_;
  }

  var gamma;
  function handleGamma(_gamma_) {
    gamma = _gamma_;
  }

  var inflateDataList = [];
  function handleInflateData(inflatedData) {
    inflateDataList.push(inflatedData);
  }

  var reader = new SyncReader(buffer);

  var parser = new Parser(options, {
    read: reader.read.bind(reader),
    error: handleError,
    metadata: handleMetaData,
    gamma: handleGamma,
    inflateData: handleInflateData,
    bitmapInfo: handleBitmapInfo
  });

  parser.start();
  reader.process();

  if (err) {
    throw err;
  }

  //join together the inflate datas
  var inflateData = Buffer.concat(inflateDataList);
  inflateDataList.length = 0;

  var inflatedData = zlib.inflateSync(inflateData);
  inflateData = null;

  if (!inflatedData || !inflatedData.length) {
    throw new Error('bad png - invalid inflate data response');
  }

  var unfilteredData = FilterSync.process(
    inflatedData,
    width,
    height,
    bpp,
    depth,
    interlace,
    options
  );
  inflateData = null;

  var bitmapData = bitmapper.dataToBitMap(unfilteredData, width, height,
    bpp,
    depth,
    interlace);
  unfilteredData = null;

  var normalisedBitmapData = formatNormaliser(bitmapData, {
    depth: depth, // TODO always store in this format
    width: width,
    height: height,
    colorType: parser._colorType, //TODO event this
    palette: parser._palette,
    transColor: parser._transColor });

  metaData.data = normalisedBitmapData;
  metaData.gamma = gamma || 0;

  return metaData;
};

