var fs = require('fs');
var PNG = require("../lib/png").PNG;
var w = 320;
var h = 200;

var bitmapWithoutAlpha = new Buffer(w * h * 3);
var ofs=0;
for (var i = 0; i < bitmapWithoutAlpha.length; i+=3) {
    bitmapWithoutAlpha[ofs++] = 0xff;
    bitmapWithoutAlpha[ofs++] = i % 0xff;
    bitmapWithoutAlpha[ofs++] = (i/3) % 0xff;
}

var png = new PNG({
  width: w,
  height:h,
  bitDepth: 8,
  colorType: 2,
  inputHasAlpha: false
});

png.data = bitmapWithoutAlpha;
png.pack().pipe(fs.createWriteStream('colortype2.png'));

var png = new PNG({
  width: w,
  height:h,
  bitDepth: 8,
  colorType: 6,
  inputHasAlpha: false
});

png.data = bitmapWithoutAlpha;
png.pack().pipe(fs.createWriteStream('colortype6.png'));