#!/usr/bin/env node

let fs = require("fs"),
  PNG = require("../lib/png").PNG;

let png = new PNG({
    filterType: -1,
  }),
  src = fs.createReadStream(process.argv[2]),
  dst = fs.createWriteStream(process.argv[3] || "out.png");

png.on("parsed", function () {
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      let idx = (png.width * y + x) << 2;

      if (
        Math.abs(png.data[idx] - png.data[idx + 1]) <= 1 &&
        Math.abs(png.data[idx + 1] - png.data[idx + 2]) <= 1
      )
        png.data[idx] = png.data[idx + 1] = png.data[idx + 2];
    }
  }

  png.pack().pipe(dst);
});

src.pipe(png);
