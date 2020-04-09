let PNG = require("../lib/png").PNG;
let fs = require("fs");

let newfile = new PNG({ width: 10, height: 10 });

for (let y = 0; y < newfile.height; y++) {
  for (let x = 0; x < newfile.width; x++) {
    let idx = (newfile.width * y + x) << 2;

    let col =
      (x < newfile.width >> 1) ^ (y < newfile.height >> 1) ? 0xe5 : 0xff;

    newfile.data[idx] = col;
    newfile.data[idx + 1] = col;
    newfile.data[idx + 2] = col;
    newfile.data[idx + 3] = 0xff;
  }
}

newfile
  .pack()
  .pipe(fs.createWriteStream(__dirname + "/newfile.png"))
  .on("finish", function () {
    console.log("Written!");
  });
