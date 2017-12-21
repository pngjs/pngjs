export default function filterSub(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
  for (var x = 0; x < byteWidth; x++) {
    var left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
    var val = pxData[pxPos + x] - left;

    rawData[rawPos + x] = val;
  }
}
