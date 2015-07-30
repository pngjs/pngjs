
var fs = require('fs'),
    PNG = require('../lib/png').PNG;


fs.readdir(__dirname + '/in/', function(err, files) {
    if (err) throw err;

    files.forEach(function(file) {

        if (!file.match(/\.png$/i))
            return;

        var expectedError = false;
        if (file.match(/^x/) ||
            file.match(/^...i/) || // interlace
            file.match(/^......(01|02|04|16)/) || // 1/2/4/16 bit
            file.match(/^basn3p(01|02|04)/) || // 2/4/16 colour palette
            file.match(/^s/) // odd sizes
        ) {
            expectedError = true;
        }

        fs.createReadStream(__dirname + '/in/' + file)
            .pipe(new PNG())
            .on('error', function() {
              if (!expectedError) {
                  console.log("Error reading " + file);
              }
            })
            .on('parsed', function() {

                if (expectedError) {
                    console.log("Error expected, parsed fine", file);
                }

                if (this.gamma) {
                    for (var y = 0; y < this.height; y++) {
                        for (var x = 0; x < this.width; x++) {
                            var idx = (this.width * y + x) << 2;

                            for (var i = 0; i < 3; i++) {
                                var sample = this.data[idx + i] / 255;
                                sample = Math.pow(sample, 1 / 2.2 / this.gamma);
                                this.data[idx + i] = Math.round(sample * 255);
                            }
                        }
                    }
                }

                this.pack()
                    .pipe(fs.createWriteStream(__dirname + '/out/' + file));

            });

    });
});
