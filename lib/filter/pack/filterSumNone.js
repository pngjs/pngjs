export default function filterSumNone(pxData, pxPos, byteWidth) {
  var sum = 0;
  var length = pxPos + byteWidth;
  for (var i = pxPos; i < length; i++) {
    sum += Math.abs(pxData[i]);
  }
  return sum;
}
