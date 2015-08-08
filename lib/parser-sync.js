'use strict';


var zlib = require('zlib');
var SyncReader = require('./sync-reader');
var FilterSync = require('./filter-parse-sync');
var Parser = require('./parser');
var bitmapper = require('./bitmapper');
var formatNormaliser = require('./format-normaliser');


module.exports = function(buffer, options) {

  var err;
  function handleError(_err_) {
    err = _err_;
  }

  var metaData, bitmapInfo;
  function handleMetaData(_metaData_) {
    metaData = _metaData_;
    bitmapInfo = Object.create(metaData);
  }

  function handleTransColor(transColor) {
    bitmapInfo.transColor = transColor;
  }

  function handlePalette(palette) {
    bitmapInfo.palette = palette;
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
    palette: handlePalette,
    transColor: handleTransColor,
    inflateData: handleInflateData
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

  var unfilteredData = FilterSync.process(inflatedData, bitmapInfo);
  inflateData = null;

  var bitmapData = bitmapper.dataToBitMap(unfilteredData, bitmapInfo);
  unfilteredData = null;

  var normalisedBitmapData = formatNormaliser(bitmapData, bitmapInfo);

  metaData.data = normalisedBitmapData;
  metaData.gamma = gamma || 0;

  return metaData;
};

