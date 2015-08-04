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

var util = require('util');
var ChunkStream = require('./chunkstream');
var Filter = require('./filter');


var FilterAsync = module.exports = function(width, height, Bpp, depth, interlace, options) {
  ChunkStream.call(this);

  var buffers = [];
  var that = this;
  this._filter = new Filter(width, height, Bpp, depth, interlace, options, {
    read: this.read.bind(this),
    complete: function() {
      that.emit('complete', Buffer.concat(buffers), width, height)
    },
    write: function(buffer) {
      buffers.push(buffer);
    }
  });

  this._filter.start();
};
util.inherits(FilterAsync, ChunkStream);
