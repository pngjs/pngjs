'use strict';

var SyncReader = require('./sync-reader');
var Filter = require('./filter-parse');


exports.process = function(inBuffer, width, height, Bpp, depth, interlace) {

  var outBuffers = [];
  var reader = new SyncReader(inBuffer);
  var filter = new Filter(width, height, Bpp, depth, interlace, {
    read: reader.read.bind(reader),
    write: function(bufferPart) {
      outBuffers.push(bufferPart);
    },
    complete: function() {
    }
  });

  filter.start();
  reader.process();

  return Buffer.concat(outBuffers);
};