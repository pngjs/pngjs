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


var zlib = require('zlib'),
    SyncReader = require('./sync-reader'),
    FilterSync = require('./filter-sync'),
    Parser = require('./parser');


var ParserSync = module.exports = function(buffer, options) {

    var reader = new SyncReader(buffer);

    this._inflateDataList = [];
    this._parser = new Parser(options, {
        read: reader.read.bind(reader),
        error: this._handleError.bind(this),
        metadata: this._metaData.bind(this),
        gamma: this._gamma.bind(this),
        finished: function() {},
        inflateData: this._inflateData.bind(this),
        createData: this._createData.bind(this)
    });
    this._options = options;

    this._parser.start();
    reader.process();

    //join together the inflate datas
    var inflateData = Buffer.concat(this._inflateDataList);

    var data = zlib.inflateSync(inflateData);

    FilterSync.process(
      data,
      this._width, this._height,
      this._bpp,
      this._data,
      this._options
    );

    this.data = this._parser.reverseFiltered(this._data, this._width, this._height);
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

ParserSync.prototype._createData = function(width, height, bpp) {
    this._data = new Buffer(width * height * 4);
    this._bpp = bpp;
    this._width = width;
    this._height = height;
    return this._data;
};
