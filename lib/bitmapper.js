var interlaceUtils = require('./interlace');

function bitRetriever(data, depth) {

  var leftOver = [];
  var i = 0;
  function split() {
    if (i === data.length) {
      throw new Error("Ran out of data");
    }
    var byte = data[i];
    i++;
    switch(depth) {
      default:
        throw new Error("unrecognised depth");
        break;
      case 16:
        var byte2 = data[i];
        i++;
        leftOver.push(((byte << 8) + byte2));
        break;
      case 4:
        var byte2 = byte & 0x0f;
        var byte1 = byte >> 4;
        leftOver.push(byte1, byte2);
        break;
      case 2:
        var byte4 = byte & 3;
        var byte3 = byte >> 2 & 3;
        var byte2 = byte >> 4 & 3;
        var byte1 = byte >> 6 & 3;
        leftOver.push(byte1, byte2, byte3, byte4);
        break;
      case 1:
        var byte8 = byte & 1;
        var byte7 = byte >> 1 & 1;
        var byte6 = byte >> 2 & 1;
        var byte5 = byte >> 3 & 1;
        var byte4 = byte >> 4 & 1;
        var byte3 = byte >> 5 & 1;
        var byte2 = byte >> 6 & 1;
        var byte1 = byte >> 7 & 1;
        leftOver.push(byte1, byte2, byte3, byte4, byte5, byte6, byte7, byte8);
        break;
    }
  }
  return {
    get: function(count) {
      while(leftOver.length < count) {
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
        throw new Error("extra data found");
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
    // TODO: could be more effecient and use a buffer but change how we write to use 16 bit write methods with index * 2
    pxData = new Array(width * height * 4);
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
    images = [{width: width, height: height}];
  }

  for(var imageIndex = 0; imageIndex < images.length; imageIndex++) {
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
              throw new Error("Ran out of data");
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
      throw new Error("extra data found");
    }
  } else {
    bits.end();
  }

  return pxData;
};

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