
var fs = require('fs'),
    PNG = require('../lib/png').PNG;

module.exports = function(done) {

    fs.readdir(__dirname + '/in/', function (err, files) {
        if (err) throw err;

        files = files.filter(function(file) {
            return Boolean(file.match(/\.png$/i));
        });

        console.log("Converting images");

        var completed = 0;
        var expected = files.length * 2;
        function complete() {
            completed++;
            if (expected === completed) {
                done();
            }
        }

        files.forEach(function (file) {

            var expectedError = false;
            if (file.match(/^x/)) {
                expectedError = true;
            }

            var syncError = false;
            var data = fs.readFileSync(__dirname + '/in/' + file);
            try {
                var png = PNG.sync.read(data);
            } catch (e) {
                if (!expectedError) {
                    console.log("Unexpected error parsing.." + file);
                    console.log(e);
                    console.log(e.stack);
                }
                syncError = true;
                complete();
            }

            if (!syncError) {
                if (expectedError) {
                    console.log("Error expected, parsed fine ..", file);
                    complete();
                } else {

                    var outpng = new PNG();
                    //PNG.adjustGamma(png);
                    outpng.data = png.data;
                    outpng.width = png.width;
                    outpng.height = png.height;
                    outpng.pack()
                      .pipe(fs.createWriteStream(__dirname + '/outsync/' + file)
                        .on("finish", function () {
                            complete();
                        }));
                }
            }

            fs.createReadStream(__dirname + '/in/' + file)
              .pipe(new PNG())
              .on('error', function (err) {
                  if (!expectedError) {
                      console.log("Error reading " + file, err);
                  }
                  complete();
              })
              .on('parsed', function () {

                  if (expectedError) {
                      console.log("Error expected, parsed fine", file);
                  }
                  //this.adjustGamma();

                  this.pack()
                  .pipe(
                    fs.createWriteStream(__dirname + '/out/' + file)
                      .on("finish", function() {
                          complete();
                      }));

              });

        });
    });
}
