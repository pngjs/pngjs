function bitRetriever(data, depth) {

  var leftOver = [];
  var i = 0;
  function split() {
    var byte = data[i];
    i++;
    switch(depth) {
      default:
        throw new Error("unrecognised depth");
        break;
/*      case 8:
        leftOver.push(byte);
        break;*/
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
      var returner;
      if (depth === 8) {
        returner = data.slice(i, i + count);
        i += count;
        return returner;
      }
      while(leftOver.length < count) {
        split();
      }
      returner = leftOver.slice(0, count);
      leftOver = leftOver.slice(count);
      return returner;
    },
    resetAfterLine: function() {
      leftOver.length = 0;
    }
  };
}

exports.dataToBitMap = function(data, width, height, bpp, depth) {
  if (depth !== 8) {
    var bits = bitRetriever(data, depth);
  }
  var pxData = new Buffer(width * height * 4);
  var pxPos = 0;
  var maxBit = Math.pow(2, depth) - 1;
  var rawPos = 0;
  var pixelData;

  for(var y = 0; y < height; y++) {
    for(var x = 0; x < width; x++) {
      if (depth !== 8) {
        pixelData = bits.get(bpp);
      }
      for (var i = 0; i < 4; i++) {
        var idx = pixelBppMap[bpp][i];
        if (depth === 8) {
          pxData[pxPos] = idx !== 0xff ? data[idx + rawPos] : maxBit;
        } else {
          pxData[pxPos] = idx !== 0xff ? pixelData[idx] : maxBit;
        }
        pxPos++;
      }
      rawPos += bpp;
    }
    if (depth !== 8) {
      bits.resetAfterLine();
    }
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