'use strict';

var interlaceUtils = require('./interlace');

var pixelBppMap = {
  1: { // L
    0: 0,
    1: 0,
    2: 0,
    3: 0xff
  },
  2: { // LA
    0: 0,
    1: 0,
    2: 0,
    3: 1
  },
  3: { // RGB
    0: 0,
    1: 1,
    2: 2,
    3: 0xff
  },
  4: { // RGBA
    0: 0,
    1: 1,
    2: 2,
    3: 3
  }
};

function bitRetriever(data, depth) {

  var leftOver = [];
  var i = 0;

  function split() {
    if (i === data.length) {
      throw new Error('Ran out of data');
    }
    var byte = data[i];
    i++;
    var byte8, byte7, byte6, byte5, byte4, byte3, byte2, byte1;
    switch (depth) {
      default:
        throw new Error('unrecognised depth');
      case 16:
        byte2 = data[i];
        i++;
        leftOver.push(((byte << 8) + byte2));
        break;
      case 4:
        byte2 = byte & 0x0f;
        byte1 = byte >> 4;
        leftOver.push(byte1, byte2);
        break;
      case 2:
        byte4 = byte & 3;
        byte3 = byte >> 2 & 3;
        byte2 = byte >> 4 & 3;
        byte1 = byte >> 6 & 3;
        leftOver.push(byte1, byte2, byte3, byte4);
        break;
      case 1:
        byte8 = byte & 1;
        byte7 = byte >> 1 & 1;
        byte6 = byte >> 2 & 1;
        byte5 = byte >> 3 & 1;
        byte4 = byte >> 4 & 1;
        byte3 = byte >> 5 & 1;
        byte2 = byte >> 6 & 1;
        byte1 = byte >> 7 & 1;
        leftOver.push(byte1, byte2, byte3, byte4, byte5, byte6, byte7, byte8);
        break;
    }
  }

  return {
    get: function(count) {
      while (leftOver.length < count) {
        split();
      }
      var returner = leftOver.slice(0, count);
      leftOver = leftOver.slice(count);
      return returner;
    },
    resetAfterLine: function() {
      leftOver.length = 0;
    },
    end: function() {
      if (i !== data.length) {
        // todo these exceptions should be emitting errors
        throw new Error('extra data found');
      }
    }
  };
}

exports.dataToBitMap = function(data, width, height, bpp, depth, interlace) {

  if (depth !== 8) {
    var bits = bitRetriever(data, depth);
  }
  var pxData;
  if (depth <= 8) {
    pxData = new Buffer(width * height * 4);
  } else {
    pxData = new Uint16Array(width * height * 4);
  }
  var maxBit = Math.pow(2, depth) - 1;
  var rawPos = 0;
  var pixelData;
  var images;
  var getPxPos;

  if (interlace) {
    images = interlaceUtils.getImagePasses(width, height);
    getPxPos = interlaceUtils.getInterlaceIterator(width, height);
  } else {
    var nonInterlacedPxPos = 0;
    getPxPos = function() {
      var returner = nonInterlacedPxPos;
      nonInterlacedPxPos += 4;
      return returner;
    };
    images = [{ width: width, height: height }];
  }

  for (var imageIndex = 0; imageIndex < images.length; imageIndex++) {
    var imageWidth = images[imageIndex].width;
    var imageHeight = images[imageIndex].height;
    var imagePass = images[imageIndex].index;
    for (var y = 0; y < imageHeight; y++) {
      for (var x = 0; x < imageWidth; x++) {
        if (depth !== 8) {
          pixelData = bits.get(bpp);
        }
        var pxPos = getPxPos(x, y, imagePass);
        //console.log(x,y,imageIndex, pxPos);
        for (var i = 0; i < 4; i++) {
          var idx = pixelBppMap[bpp][i];
          if (depth === 8) {
            if (i === data.length) {
              throw new Error('Ran out of data');
            }
            pxData[pxPos + i] = idx !== 0xff ? data[idx + rawPos] : maxBit;
          } else {
            pxData[pxPos + i] = idx !== 0xff ? pixelData[idx] : maxBit;
          }
        }
        //console.log("R", pxData[pxPos], "G", pxData[pxPos + 1], "B", pxData[pxPos + 2], "A", pxData[pxPos + 3]);
        rawPos += bpp;
      }
      if (depth !== 8) {
        bits.resetAfterLine();
      }
    }
  }
  if (depth === 8) {
    if (rawPos !== data.length) {
      throw new Error('extra data found');
    }
  } else {
    bits.end();
  }

  return pxData;
};
