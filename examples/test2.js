#!/usr/bin/env node

var fs = require('fs'),
    PNG = require('../lib/png').PNG;


var png = new PNG({
        filterType: 4
    }),
    src = fs.createReadStream(process.argv[2]),
    dst = fs.createWriteStream(process.argv[3] || 'out.png');


png.on('parsed', function() {

    for (var y = 0; y < png.height; y++) {
        for (var x = 0; x < png.width; x++) {
            var idx = (png.width * y + x) << 2;

            // invert color
            png.data[idx] = 255 - png.data[idx];
            png.data[idx+1] = 255 - png.data[idx+1];
            png.data[idx+2] = 255 - png.data[idx+2];

            // and reduce opacity
            png.data[idx+3] = png.data[idx+3] >> 1;
        }
    }

    png.pack();
});

src.pipe(png).pipe(dst);
