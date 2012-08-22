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
    Stream = require('stream'),
    Compress = require('./compress'),
    Filter = require('./filter');


var Parser = module.exports = function(options) {
    Stream.call(this);

    this._options = options;

    // this._compress = new Compress(options);
    // this._compress.on('error', this.emit.bind(this, 'error'));
    // this._compress.on('deflated', this._packData.bind(this));
};
util.inherits(Parser, Stream);


Parser.prototype._pack = function(width, height, data) {

    // Signature
    this.emit('data', new Buffer(signature));
    this.emit('data', this._packIHDR(width, height));

    // filter pixel data
    var data = this._filter.filter(data, width, height);

    // compress it
    this._compress.deflate(data);
};

Parser.prototype._packData = function(data) {

    // console.log('deflate', data.length);

    this.emit('data', this._packIDAT(data));
    this.emit('data', this._packIEND());
    this.emit('end');
};

Parser.prototype._packChunk = function(type, data) {

    var len = (data ? data.length : 0),
        buf = new Buffer(len + 12);

    buf.writeUInt32BE(len, 0);
    buf.writeUInt32BE(type, 4);

    if (data) data.copy(buf, 8);

    buf.writeInt32BE(crc32(buf.slice(4, buf.length - 4)), buf.length - 4);
    return buf;
};

Parser.prototype._packIHDR = function(width, height) {

    var buf = new Buffer(13);
    buf.writeUInt32BE(width, 0);
    buf.writeUInt32BE(height, 4);
    buf[8] = 8;
    buf[9] = 6; // colorType
    buf[10] = 0; // compression
    buf[11] = 0; // filter
    buf[12] = 0; // interlace

    return this._packChunk(TYPE_IHDR, buf);
};

Parser.prototype._packIDAT = function(data) {
    return this._packChunk(TYPE_IDAT, data);
};

Parser.prototype._packIEND = function() {
    return this._packChunk(TYPE_IEND, null);
};
