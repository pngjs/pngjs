
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
            file.match(/^basn3p(01|02|04)/) // 2/4/16 colour palette
        ) {
            expectedError = true;
        }

        if (!expectedError) {
            var data = fs.readFileSync(__dirname + '/in/' + file);
            var png = PNG.sync.read(data);

            var outpng = new PNG();
            PNG.adjustGamma(png);
            outpng.data = png.data;
            outpng.width = png.width;
            outpng.height = png.height;
            outpng.pack()
              .pipe(fs.createWriteStream(__dirname + '/outsync/' + file));
        }

        fs.createReadStream(__dirname + '/in/' + file)
            .pipe(new PNG())
            .on('error', function(err) {
              if (!expectedError) {
                  console.log("Error reading " + file, err);
              }
            })
            .on('parsed', function() {

                if (expectedError) {
                    console.log("Error expected, parsed fine", file);
                }

                this.adjustGamma();

                this.pack()
                  .pipe(fs.createWriteStream(__dirname + '/out/' + file));

            });

    });
});
