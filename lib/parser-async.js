// Copyright (c) 2012 Kuba Niegowski
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

'use strict';


var util = require('util'),
    zlib = require('zlib'),
    ChunkStream = require('./chunkstream'),
    FilterAsync = require('./filter-async'),
    Parser = require('./parser');


var ParserAsync = module.exports = function(options) {
    ChunkStream.call(this);

    this._parser = new Parser(options, {
        read: this.read.bind(this),
        error: this.emit.bind(this, "error"),
        metadata: this.emit.bind(this, "metadata"),
        gamma: this.emit.bind(this, "gamma"),
        finished: this._finished.bind(this),
        inflateData: this._inflateData.bind(this),
        createData: this._createData.bind(this)
    });
    this._options = options;
    this.writable = true;

    this.on('error', this._handleError.bind(this));
    this._parser.start();
};
util.inherits(ParserAsync, ChunkStream);


ParserAsync.prototype._handleError = function() {

    this.writable = false;

    this.destroy();

    if (this._inflate && this._inflate.destroy) {
        this._inflate.destroy();
    }
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

ParserAsync.prototype._createData = function(width, height, bpp) {
    this._data = new Buffer(width * height * 4);
    this._filter = new FilterAsync(
      width, height,
      bpp,
      this._data,
      this._options
    );
    return this._data;
};

ParserAsync.prototype._finished = function(data) {
    // no more data to inflate
    this._inflate.end();
    this.destroySoon();
};

ParserAsync.prototype._complete = function(data, width, height) {

    data = this._parser.reverseFiltered(data, width, height);

    this.emit('parsed', data);
};
