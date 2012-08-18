#!/usr/bin/env node

var fs = require('fs'),
    PNG = require('../lib/png').PNG;


fs.readFile(process.argv[2], function(err, data) {
    if (err) throw err;

    var png = new PNG();
    png.parse(data, function(err) {
        if (err) console.log(err.stack);

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

        png.pipe(fs.createWriteStream(process.argv[3] || 'out.png'));
        png.pack();
    });
});
