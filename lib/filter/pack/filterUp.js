export default function filterUp(pxData, pxPos, byteWidth, rawData, rawPos) {
  for (var x = 0; x < byteWidth; x++) {
    var up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
    var val = pxData[pxPos + x] - up;

    rawData[rawPos + x] = val;
  }
}
