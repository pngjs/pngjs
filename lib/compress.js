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
    events = require('events');


var Compress = module.exports = function(options) {
    events.EventEmitter.call(this);

    this._options = options;
    options.deflateChunkSize = options.deflateChunkSize || 32 * 1024;
    options.deflateLevel = options.deflateLevel || 9;

    this._inflate = null;
};
util.inherits(Compress, events.EventEmitter);


Compress.prototype.prepareInflate = function(type) {

    if (type != 0)
        throw new Error('Unsupported compression method');

    this._inflate = zlib.createInflate();

    bufferStream(this._inflate, function(data) {
        this._inflate = null;
        this.emit('inflated', data);
    }.bind(this));

    this._inflate.on('error', this.emit.bind(this, 'error'));
};

Compress.prototype.writeInflate = function(data) {
    this._inflate.write(data);
};

Compress.prototype.endInflate = function() {
    this._inflate.end();
};

Compress.prototype.deflate = function(data) {

    var deflate = zlib.createDeflate({
            chunkSize: this._options.deflateChunkSize,
            level: this._options.deflateLevel
        });

    bufferStream(deflate, function(data) {
        this.emit('deflated', data);
    }.bind(this));

    deflate.on('error', this.emit.bind(this, 'error'));

    deflate.end(data);
};

function bufferStream(stream, callback) {

    var buffers = [],
        length = 0;

    stream.on('data', function(data) {
        buffers.push(data);
        length += data.length;
    });

    stream.on('end', function() {
        callback(Buffer.concat(buffers, length));
    });

    return stream;
};
