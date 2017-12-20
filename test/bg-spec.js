#!/usr/bin/env node
'use strict';

var fs = require('fs');
var PNG = require('../lib/png').PNG;
var test = require('tape');
var bufferEqual = require('buffer-equal');

test('outputs background, created from scratch', function(t) {

  t.timeoutAfter(1000 * 60 * 5);

  var png = new PNG({
    width: 10,
    height: 10,
    filterType: -1
  });


  for (var y = 0; y < png.height; y++) {
    for (var x = 0; x < png.width; x++) {
      var idx = (png.width * y + x) << 2;

      var col = x < (png.width >> 1) ^ y < (png.height >> 1) ? 0xe5 : 0xff;

      png.data[idx] = col;
      png.data[idx + 1] = col;
      png.data[idx + 2] = col;
      png.data[idx + 3] = 0xff;
    }
  }

  png.pack().pipe(fs.createWriteStream(__dirname + '/bg.png'))
    .on('finish', function() {

      var out = fs.readFileSync(__dirname + '/bg.png');
      var ref = fs.readFileSync(__dirname + '/bg-ref.png');

      var isBufferEqual = bufferEqual(out, ref);
      t.ok(isBufferEqual, 'compares with working file ok');

      if (!isBufferEqual) {
        console.log(out.length, ref.length);
      }

      t.end();
    });
});
