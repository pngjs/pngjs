import fs from 'fs';
import { PNG } from '../lib/png';
import test from 'tape';

var noLargeOption = process.argv.indexOf('nolarge') >= 0;

fs.readdir(__dirname + '/in/', function(err, orgFiles) {
  if (err) {
    throw err;
  }

  const files = orgFiles.filter(function(file) {
    return (!noLargeOption || !file.match(/large/i)) && Boolean(file.match(/\.png$/i));
  });

  files.forEach(function(file) {

    var expectedError = false;
    if (file.match(/^x/)) {
      expectedError = true;
    }

    test('convert sync - ' + file, function(t) {
      t.timeoutAfter(1000 * 60 * 5);

      var data = fs.readFileSync(__dirname + '/in/' + file);
      try {
        var png = PNG.sync.read(data);
      }
      catch (e) {
        if (!expectedError) {
          t.fail('Unexpected error parsing..' + file + '\n' + e.message + '\n' + e.stack);
        }
        else {
          t.pass('completed');
        }
        return t.end();
      }

      if (expectedError) {
        t.fail('Sync: Error expected, parsed fine .. - ' + file);
        return t.end();
      }

      var outpng = new PNG();
      outpng.gamma = png.gamma;
      outpng.data = png.data;
      outpng.width = png.width;
      outpng.height = png.height;
      const outFileName = __dirname + '/outsync/' + file;
      outpng.pack()
        .pipe(fs.createWriteStream(outFileName)
          .on('finish', function() {
            if (fs.existsSync(outFileName)) {
              t.pass('completed');
            }
            else {
              t.fail('No file created');
            }
            t.end();
          }));
    });

    test('convert async - ' + file, function(t) {
      t.timeoutAfter(1000 * 60 * 5);

      fs.createReadStream(__dirname + '/in/' + file)
        .pipe(new PNG())
        .on('error', function(error) {
          if (!expectedError) {
            t.fail('Async: Unexpected error parsing..' + file + '\n' + error.message + '\n' + error.stack);
          }
          else {
            t.pass('completed');
          }
          t.end();
        })
        .on('parsed', function() {

          if (expectedError) {
            t.fail('Async: Error expected, parsed fine ..' + file);
            return t.end();
          }

          const outFileName = __dirname + '/out/' + file;
          // eslint-disable-next-line
          this.pack()
            .pipe(
              fs.createWriteStream(outFileName)
                .on('finish', function() {
                  if (fs.existsSync(outFileName)) {
                    t.pass(`completed`);
                  }
                  else {
                    t.fail('No file created');
                  }
                  t.end();
                }));
        });
    });
  });
});
