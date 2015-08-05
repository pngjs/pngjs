'use strict';


var zlib = require('zlib');
var SyncReader = require('./sync-reader');
var FilterSync = require('./filter-sync');
var Parser = require('./parser');
var bitmapper = require('./bitmapper');


var ParserSync = module.exports = function(buffer, options) {

  var reader = new SyncReader(buffer);

  this._inflateDataList = [];
  this._parser = new Parser(options, {
    read: reader.read.bind(reader),
    error: this._handleError.bind(this),
    metadata: this._metaData.bind(this),
    gamma: this._gamma.bind(this),
    finished: function() {
    },
    inflateData: this._inflateData.bind(this),
    createData: this._createData.bind(this)
  });
  this._options = options;

  this._parser.start();
  reader.process();

  //join together the inflate datas
  var inflateData = Buffer.concat(this._inflateDataList);

  var data = zlib.inflateSync(inflateData);

  data = FilterSync.process(
    data,
    this._width, this._height,
    this._bpp,
    this._depth,
    this._interlace,
    this._options
  );

  this._data = bitmapper.dataToBitMap(data, this._width, this._height,
    this._bpp,
    this._depth,
    this._interlace);
  // todo yuck
  this.data = this._parser.reverseFiltered(this._data, this._depth, this._width, this._height);
};

ParserSync.prototype._handleError = function(err) {
  this.err = err;
};

ParserSync.prototype._metaData = function(metaData) {
  this.metaData = metaData;
};

ParserSync.prototype._gamma = function(gamma) {
  this.gamma = gamma;
};

ParserSync.prototype._inflateData = function(data) {
  this._inflateDataList.push(data);
};

ParserSync.prototype._createData = function(width, height, bpp, depth, interlace) {
  this._data = new Buffer(width * height * 4);
  this._bpp = bpp;
  this._width = width;
  this._height = height;
  this._depth = depth;
  this._interlace = interlace;
  return this._data;
};
