'use strict';

var constants = require('./constants');

module.exports = function(data, width, height, options) {
  var outHasAlpha = [constants.COLORTYPE_COLOR_ALPHA, constants.COLORTYPE_ALPHA].indexOf(options.colorType) !== -1;

  if ([constants.COLORTYPE_GRAYSCALE, constants.COLORTYPE_ALPHA].indexOf(options.colorType) === -1) {
    // If no need to convert to grayscale and alpha is present/absent in both, take a fast route
    if (options.inputHasAlpha && outHasAlpha) {
      return data;
    }
    if (!options.inputHasAlpha && !outHasAlpha) {
      return data;
    }
  }

  var outBpp = constants.COLORTYPE_TO_BPP_MAP[options.colorType];
  var outData = new Buffer(width * height * outBpp);
  var inBpp = options.inputHasAlpha ? 4 : 3;
  var inIndex = 0;
  var outIndex = 0;

  var bgColor = options.bgColor || {};
  if (bgColor.red === undefined) {
    bgColor.red = 255;
  }
  if (bgColor.green === undefined) {
    bgColor.green = 255;
  }
  if (bgColor.blue === undefined) {
    bgColor.blue = 255;
  }

  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      var red = data[inIndex];
      var green = data[inIndex + 1];
      var blue = data[inIndex + 2];

      var alpha;
      if (options.inputHasAlpha) {
        alpha = data[inIndex + 3];
        if (!outHasAlpha) {
          alpha /= 255;
          red = Math.min(Math.max(Math.round((1 - alpha) * bgColor.red + alpha * red), 0), 255);
          green = Math.min(Math.max(Math.round((1 - alpha) * bgColor.green + alpha * green), 0), 255);
          blue = Math.min(Math.max(Math.round((1 - alpha) * bgColor.blue + alpha * blue), 0), 255);
        }
      }
      else {
        alpha = 255;
      }

      switch (options.colorType) {
        case constants.COLORTYPE_COLOR_ALPHA:
        case constants.COLORTYPE_COLOR:
          outData[outIndex] = red;
          outData[outIndex + 1] = green;
          outData[outIndex + 2] = blue;
          if (outHasAlpha) {
            outData[outIndex + 3] = alpha;
          }
          break;
        case constants.COLORTYPE_ALPHA:
        case constants.COLORTYPE_GRAYSCALE:
          // Convert to grayscale and alpha
          var grayscale = (red + green + blue) / 3;
          outData[outIndex] = grayscale;
          if (outHasAlpha) {
            outData[outIndex + 1] = alpha;
          }
          break;
      }

      inIndex += inBpp;
      outIndex += outBpp;
    }
  }

  return outData;
};
