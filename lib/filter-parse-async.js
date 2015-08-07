'use strict';

var util = require('util');
var ChunkStream = require('./chunkstream');
var Filter = require('./filter-parse');


var FilterAsync = module.exports = function(width, height, Bpp, depth, interlace) {
  ChunkStream.call(this);

  var buffers = [];
  var that = this;
  this._filter = new Filter(width, height, Bpp, depth, interlace, {
    read: this.read.bind(this),
    complete: function() {
      that.emit('complete', Buffer.concat(buffers), width, height);
    },
    write: function(buffer) {
      buffers.push(buffer);
    }
  });

  this._filter.start();
};
util.inherits(FilterAsync, ChunkStream);
