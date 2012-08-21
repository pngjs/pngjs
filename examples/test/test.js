
var fs = require('fs'),
    PNG = require('pngjs').PNG;


fs.readdir(__dirname + '/img/', function(err, files) {
    if (err) throw err;

    for (var i = 0; i < files.length; i++) {

        if (!files[i].match(/\.png$/i))
            continue;

        fs.createReadStream(__dirname + '/img/' + files[i])
            .pipe(new PNG())
            .on('parsed', function() {

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

                this.pack();
            }).pipe(fs.createWriteStream(__dirname + '/out/' + files[i]));
    }
});
