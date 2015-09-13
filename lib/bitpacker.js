'use strict';

var constants = require('./constants');

module.exports = function(data, width, height, options) {
  var outHasAlpha = options.colorType === constants.COLORTYPE_COLOR_ALPHA;
  if (options.inputHasAlpha && outHasAlpha) {
    return data;
  }
  if (!options.inputHasAlpha && !outHasAlpha) {
    return data;
  }

  var outBpp = outHasAlpha ? 4 : 3;
  var outData = new Buffer(width * height * outBpp);
  var inBpp = options.inputHasAlpha ? 4 : 3;
  var inIndex = 0;
  var outIndex = 0;

  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      var red = data[inIndex];
      var green = data[inIndex + 1];
      var blue = data[inIndex + 2];

      var alpha;
      if (options.inputHasAlpha) {
        alpha = data[inIndex + 3];
      }
      else {
        alpha = 255;
      }

      outData[outIndex] = red;
      outData[outIndex + 1] = green;
      outData[outIndex + 2] = blue;
      if (outHasAlpha) {
        outData[outIndex + 3] = alpha;
      }

      inIndex += inBpp;
      outIndex += outBpp;
    }
  }

  return outData;
};