import { PNG } from '../lib/png';
import fs from 'fs';

var newfile = new PNG({ width: 10, height: 10 });

for (var y = 0; y < newfile.height; y++) {
  for (var x = 0; x < newfile.width; x++) {
    var idx = (newfile.width * y + x) << 2;

    var col = x < (newfile.width >> 1) ^ y < (newfile.height >> 1) ? 0xe5 : 0xff;

    newfile.data[idx] = col;
    newfile.data[idx + 1] = col;
    newfile.data[idx + 2] = col;
    newfile.data[idx + 3] = 0xff;
  }
}

newfile.pack()
  .pipe(fs.createWriteStream(__dirname + '/newfile.png'))
  .on('finish', function() {
    console.log('Written!');
  });
