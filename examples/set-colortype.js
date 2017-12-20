import fs from 'fs';
import { PNG } from '../lib/png';

const w = 320;
const h = 200;

let bitmapWithoutAlpha = new Buffer(w * h * 3);
let ofs = 0;
for (let i = 0; i < bitmapWithoutAlpha.length; i += 3) {
  bitmapWithoutAlpha[ofs++] = 0xff;
  bitmapWithoutAlpha[ofs++] = i % 0xff;
  bitmapWithoutAlpha[ofs++] = (i / 3) % 0xff;
}

let png = new PNG({
  width: w,
  height: h,
  bitDepth: 8,
  colorType: 2,
  inputHasAlpha: false,
});

png.data = bitmapWithoutAlpha;
png.pack().pipe(fs.createWriteStream('colortype2.png'));

png = new PNG({
  width: w,
  height: h,
  bitDepth: 8,
  colorType: 6,
  inputHasAlpha: false,
});

png.data = bitmapWithoutAlpha;
png.pack().pipe(fs.createWriteStream('colortype6.png'));
