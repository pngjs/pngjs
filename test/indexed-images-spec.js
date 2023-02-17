let fs = require("fs");
let PNG = require("../lib/png").PNG;
let test = require("tape");

let noLargeOption = process.argv.indexOf("nolarge") >= 0;

fs.readdir(__dirname + "/in/", function (err, files) {
  if (err) throw err;

  files = files.filter(function (file) {
    return (
      (!noLargeOption || !file.match(/large/i)) &&
      Boolean(file.match(/.*[in]3.*\.png$/i))
    );
  });

  console.log("Rewriting images");

  files.forEach(function (file) {
    let expectedError = false;
    if (file.match(/^x/)) {
      expectedError = true;
    }

    test("rewrite sync - " + file, function (t) {
      t.timeoutAfter(1000 * 60 * 5);

      let data = fs.readFileSync(__dirname + "/in/" + file);
      let png;
      try {
        png = PNG.sync.read(data, { keepIndexed: true });
      } catch (e) {
        if (!expectedError) {
          t.fail(
            "Unexpected error parsing.." +
              file +
              "\n" +
              e.message +
              "\n" +
              e.stack
          );
        } else {
          t.pass("completed");
        }
        return t.end();
      }

      if (expectedError) {
        t.fail("Sync: Error expected, parsed fine .. - " + file);
        return t.end();
      }

      if (png.colorType !== 3) {
        t.fail(
          "this test can only handle indexed images, this file is not: " + file
        );
        return t.end();
      }
      let outpng = new PNG();
      outpng.gamma = png.gamma;
      outpng.palette = png.palette;
      outpng.data = png.data;
      outpng.width = png.width;
      outpng.height = png.height;

      let outData = PNG.sync.write(outpng, {
        bitDepth: png.depth,
        colorType: png.colorType,
        inputColorType: 3,
        filterType: 0, // to match source files
      });

      // We can't match against the source file because differences in the
      // compressor implementation result in larger files, so instead we reopen
      // the new file and check the pixel data against the original.
      console.log("Reading back rewritten image");
      let png2;
      try {
        png2 = PNG.sync.read(outData, { keepIndexed: true });
      } catch (e) {
        t.fail(
          "Unexpected error parsing newly generated file\n" +
            e.message +
            "\n" +
            e.stack
        );
        return t.end();
      }

      if (png2.colorType !== 3) {
        t.fail("file was not written as indexed when it was supposed to be");
        return t.end();
      }

      if (png2.depth !== png.depth) {
        t.fail(
          "file was written at depth " +
            png2.depth +
            " but it was supposed to be " +
            png.depth
        );
        return t.end();
      }

      // Compare the palette
      for (
        let i = 0;
        i < Math.max(png.palette.length, png2.palette.length);
        i++
      ) {
        for (let c = 0; c < 4; c++) {
          if (png.palette[i][c] != png2.palette[i][c]) {
            let component = ["red", "green", "blue", "alpha"];
            t.fail(
              "Palette entry " +
                i +
                " " +
                component[c] +
                " component was not written correctly (expected " +
                png.palette[i][c] +
                ", got " +
                png2.palette[i][c] +
                ")"
            );
            return t.end();
          }
        }
      }

      for (let i = 0; i < Math.max(png.data.length, png2.data.length); i++) {
        if (png.data[i] !== png2.data[i]) {
          t.fail(
            "Error at pixel index " +
              i +
              ": expected indexed color " +
              png.data[i] +
              ", got " +
              png2.data[i]
          );

          // Save incorrectly rewritten file for debugging.
          //fs.writeFileSync("out.png", outData);

          return t.end();
        }
      }

      t.pass("completed");
      return t.end();
    });
  });
});
