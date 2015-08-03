
var fs = require('fs'),
    PNG = require('../lib/png').PNG;

module.exports = function(done) {

    fs.readdir(__dirname + '/in/', function (err, files) {
        if (err) throw err;

        files = files.filter(function(file) {
            return Boolean(file.match(/\.png$/i));
        });

        console.log("Converting images");

        var asyncSaved = 0;

        files.forEach(function (file) {



            var expectedError = false;
            if (file.match(/^x/)) {
                expectedError = true;
            }

            var syncError = true;
            var data = fs.readFileSync(__dirname + '/in/' + file);
            try {
                var png = PNG.sync.read(data);
            } catch (e) {
                if (!expectedError) {
                    console.log("Unexpected error parsing.." + file);
                    console.log(e);
                    console.log(e.stack);
                    syncError = true;
                }
            }

            if (!syncError) {
                if (expectedError) {
                    console.log("Error expected, parsed fine ..", file);
                }

                var outpng = new PNG();
                //PNG.adjustGamma(png);
                outpng.data = png.data;
                outpng.width = png.width;
                outpng.height = png.height;
                outpng.pack()
                  .pipe(fs.createWriteStream(__dirname + '/outsync/' + file));
            }

            fs.createReadStream(__dirname + '/in/' + file)
              .pipe(new PNG())
              .on('error', function (err) {
                  if (!expectedError) {
                      console.log("Error reading " + file, err);
                  }
                  asyncSaved++;
                  if (asyncSaved === files.length) {
                      done();
                  }
              })
              .on('parsed', function () {

                  if (expectedError) {
                      console.log("Error expected, parsed fine", file);
                  }
                  //this.adjustGamma();

                  this.pack()
                    .on("end", function() {
                        asyncSaved++;
                        if (asyncSaved === files.length) {
                            done();
                        }
                    })
                  .pipe(fs.createWriteStream(__dirname + '/out/' + file))

              });

        });
    });
}
