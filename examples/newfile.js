var PNG = require("../lib/png").PNG;

var newfile = new PNG({width:10,height:10});

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

newfile.pack()
  .pipe(fs.createWriteStream(__dirname + '/newfile.png'))
  .on('finish', function() {
    console.log('bitmap:', this.data);
    console.log('end !');
  });
