export default function filterAvg(
  pxData,
  pxPos,
  byteWidth,
  rawData,
  rawPos,
  bpp
) {
  for (var x = 0; x < byteWidth; x++) {
    var left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
    var up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
    var val = pxData[pxPos + x] - ((left + up) >> 1);

    rawData[rawPos + x] = val;
  }
}
