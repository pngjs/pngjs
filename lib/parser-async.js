'use strict';

var util = require('util');
var zlib = require('zlib');
var ChunkStream = require('./chunkstream');
var FilterAsync = require('./filter-async');
var Parser = require('./parser');
var bitmapper = require('./bitmapper');
var formatNormaliser = require('./format-normaliser');

var ParserAsync = module.exports = function(options) {
  ChunkStream.call(this);

  this._parser = new Parser(options, {
    read: this.read.bind(this),
    error: this._handleError.bind(this),
    metadata: this.emit.bind(this, 'metadata'),
    gamma: this.emit.bind(this, 'gamma'),
    finished: this._finished.bind(this),
    inflateData: this._inflateData.bind(this),
    bitmapInfo: this._handleBitmapInfo.bind(this)
  });
  this._options = options;
  this.writable = true;

  this._parser.start();
};
util.inherits(ParserAsync, ChunkStream);


ParserAsync.prototype._handleError = function(err) {

  this.emit('error', err);

  this.writable = false;

  this.destroy();

  if (this._inflate && this._inflate.destroy) {
    this._inflate.destroy();
  }

  this.errord = true;
};

ParserAsync.prototype._inflateData = function(data) {
  if (!this._inflate) {
    this._inflate = zlib.createInflate();

    this._inflate.on('error', this.emit.bind(this, 'error'));
    this._filter.on('complete', this._complete.bind(this));

    this._inflate.pipe(this._filter);
  }
  this._inflate.write(data);
};

ParserAsync.prototype._handleBitmapInfo = function(width, height, bpp, depth, interlace) {

  this._bpp = bpp;
  this._depth = depth;
  this._interlace = interlace;

  this._filter = new FilterAsync(
    width, height,
    bpp,
    depth,
    interlace,
    this._options
  );
};

ParserAsync.prototype._finished = function() {
  if (this.errord) {
    return;
  }

  if (!this._inflate) {
    this.emit('error', 'No Inflate block');
  }
  else {
    // no more data to inflate
    this._inflate.end();
  }
  this.destroySoon();
};

ParserAsync.prototype._complete = function(filteredData, width, height) {

  if (this.errord) {
    return;
  }

  try {
    var bitmapData = bitmapper.dataToBitMap(filteredData, width, height,
      this._bpp,
      this._depth,
      this._interlace);

    // todo not bitmap data any more
    bitmapData = formatNormaliser(bitmapData, {
      depth: this._depth, // TODO always store in this format
      width: width,
      height: height,
      colorType: this._parser._colorType,
      palette: this._parser._palette,
      transColor: this._parser._transColor });
  }
  catch (ex) {
    this._handleError(ex);
    return;
  }

  this.emit('parsed', bitmapData);
};
