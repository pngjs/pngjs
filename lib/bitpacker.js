"use strict";

let constants = require("./constants");

module.exports = function (dataIn, width, height, options) {
  let outHasAlpha =
    [constants.COLORTYPE_COLOR_ALPHA, constants.COLORTYPE_ALPHA].indexOf(
      options.colorType
    ) !== -1;
  if (options.colorType === options.inputColorType) {
    let bigEndian = (function () {
      let buffer = new ArrayBuffer(2);
      new DataView(buffer).setInt16(0, 256, true /* littleEndian */);
      // Int16Array uses the platform's endianness.
      return new Int16Array(buffer)[0] !== 256;
    })();
    // If no need to convert to grayscale and alpha is present/absent in both, take a fast route
    if (options.bitDepth === 8 || (options.bitDepth === 16 && bigEndian)) {
      return dataIn;
    }
  }

  // map to a UInt16 array if data is 16bit, fix endianness below
  let data = options.bitDepth !== 16 ? dataIn : new Uint16Array(dataIn.buffer);

  let maxValue = 255;
  let inBpp = constants.COLORTYPE_TO_BPP_MAP[options.inputColorType];
  if (inBpp === 4 && !options.inputHasAlpha) {
    inBpp = 3;
  }
  let outBpp = constants.COLORTYPE_TO_BPP_MAP[options.colorType];
  if (options.bitDepth === 16) {
    maxValue = 65535;
    outBpp *= 2;
  }

  let byteWidth = width * outBpp;
  let pixelsPerByte = 1;
  if (options.bitDepth < 8) {
    pixelsPerByte = 8 / options.bitDepth;
    // Account for padding as each scanline must start on a byte boundary.
    byteWidth = Math.ceil((width * options.bitDepth) / 8);
  }
  let outData = Buffer.alloc(byteWidth * height);

  let inIndex = 0;
  let outIndex = 0;

  let bgColor = options.bgColor || {};
  if (bgColor.red === undefined) {
    bgColor.red = maxValue;
  }
  if (bgColor.green === undefined) {
    bgColor.green = maxValue;
  }
  if (bgColor.blue === undefined) {
    bgColor.blue = maxValue;
  }

  // getPixel() can't handle this combo
  if (
    options.inputColorType == constants.COLORTYPE_PALETTE_COLOR &&
    options.inputHasAlpha
  ) {
    throw new Error("alpha channel is not supported for indexed images");
  }
  if (
    options.inputColorType != constants.COLORTYPE_PALETTE_COLOR &&
    options.colorType == constants.COLORTYPE_PALETTE_COLOR
  ) {
    throw new Error(
      "cannot convert non-indexed image to indexed (if the source" +
        " image is indexed, remember to set the inputColorType option to 3)"
    );
  }

  function getPixel() {
    let red;
    let green;
    let blue;
    let alpha = maxValue;
    switch (options.inputColorType) {
      case constants.COLORTYPE_COLOR_ALPHA:
        alpha = data[inIndex + 3];
        red = data[inIndex];
        green = data[inIndex + 1];
        blue = data[inIndex + 2];
        break;
      case constants.COLORTYPE_COLOR:
        red = data[inIndex];
        green = data[inIndex + 1];
        blue = data[inIndex + 2];
        break;
      case constants.COLORTYPE_ALPHA:
        alpha = data[inIndex + 1];
        red = data[inIndex];
        green = red;
        blue = red;
        break;
      case constants.COLORTYPE_PALETTE_COLOR:
      case constants.COLORTYPE_GRAYSCALE:
        red = data[inIndex];
        green = red;
        blue = red;
        break;
      default:
        throw new Error(
          "input color type:" +
            options.inputColorType +
            " is not supported at present"
        );
    }

    if (options.inputHasAlpha) {
      if (!outHasAlpha) {
        alpha /= maxValue;
        red = Math.min(
          Math.max(Math.round((1 - alpha) * bgColor.red + alpha * red), 0),
          maxValue
        );
        green = Math.min(
          Math.max(Math.round((1 - alpha) * bgColor.green + alpha * green), 0),
          maxValue
        );
        blue = Math.min(
          Math.max(Math.round((1 - alpha) * bgColor.blue + alpha * blue), 0),
          maxValue
        );
      }
    }
    return { red: red, green: green, blue: blue, alpha: alpha };
  }

  // This is only used for COLORTYPE_PALETTE_COLOR but we put it here so it
  // doesn't get recalculated for each pixel.
  let validBitmask = (1 << options.bitDepth) - 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rgba = getPixel();

      switch (options.colorType) {
        case constants.COLORTYPE_COLOR_ALPHA:
        case constants.COLORTYPE_COLOR:
          if (options.bitDepth === 8) {
            outData[outIndex] = rgba.red;
            outData[outIndex + 1] = rgba.green;
            outData[outIndex + 2] = rgba.blue;
            if (outHasAlpha) {
              outData[outIndex + 3] = rgba.alpha;
            }
          } else {
            outData.writeUInt16BE(rgba.red, outIndex);
            outData.writeUInt16BE(rgba.green, outIndex + 2);
            outData.writeUInt16BE(rgba.blue, outIndex + 4);
            if (outHasAlpha) {
              outData.writeUInt16BE(rgba.alpha, outIndex + 6);
            }
          }
          break;
        case constants.COLORTYPE_ALPHA:
        case constants.COLORTYPE_GRAYSCALE: {
          // Convert to grayscale and alpha
          let grayscale = (rgba.red + rgba.green + rgba.blue) / 3;
          if (options.bitDepth === 8) {
            outData[outIndex] = grayscale;
            if (outHasAlpha) {
              outData[outIndex + 1] = rgba.alpha;
            }
          } else {
            outData.writeUInt16BE(grayscale, outIndex);
            if (outHasAlpha) {
              outData.writeUInt16BE(rgba.alpha, outIndex + 2);
            }
          }
          break;
        }
        case constants.COLORTYPE_PALETTE_COLOR: {
          if (options.bitDepth === 8) {
            outData[outIndex] = rgba.red;
          } else {
            let shift =
              8 -
              options.bitDepth -
              options.bitDepth * (outIndex % pixelsPerByte);
            outData[(outIndex / pixelsPerByte) >>> 0] |=
              (rgba.red & validBitmask) << shift;
          }
          break;
        }
        default:
          throw new Error("unrecognised color Type " + options.colorType);
      }

      inIndex += inBpp;
      outIndex += outBpp;
    }

    if (
      options.colorType === constants.COLORTYPE_PALETTE_COLOR &&
      options.bitDepth < 8
    ) {
      // At the end of each scanline, start at the next byte boundary.
      outIndex += (pixelsPerByte - (outIndex % pixelsPerByte)) % pixelsPerByte;
    }
  }

  return outData;
};
