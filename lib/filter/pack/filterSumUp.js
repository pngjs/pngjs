export default function filterSumUp(pxData, pxPos, byteWidth) {
  var sum = 0;
  var length = pxPos + byteWidth;
  for (var x = pxPos; x < length; x++) {
    var up = pxPos > 0 ? pxData[x - byteWidth] : 0;
    var val = pxData[x] - up;

    sum += Math.abs(val);
  }

  return sum;
}
