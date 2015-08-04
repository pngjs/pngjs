// Copyright (c) 2012 Kuba Niegowski
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

'use strict';

var interlaceUtils = require('./interlace');

function getByteWidth(width, bpp, depth) {
  var byteWidth = width * bpp;
  if (depth !== 8) {
    byteWidth = Math.ceil(byteWidth / (8 / depth));
  }
  return byteWidth;
}

function paethPredictor(left, above, upLeft) {

  var paeth = left + above - upLeft;
  var pLeft = Math.abs(paeth - left);
  var pAbove = Math.abs(paeth - above);
  var pUpLeft = Math.abs(paeth - upLeft);

  if (pLeft <= pAbove && pLeft <= pUpLeft) {
    return left;
  }
  if (pAbove <= pUpLeft) {
    return above;
  }
  return upLeft;
}


var Filter = module.exports = function(width, height, Bpp, depth, interlace, options, dependencies) {

  this._width = width;
  this._height = height;
  this._Bpp = Bpp; //TODO rename
  this._depth = depth;
  this._options = options;

  if (!('filterType' in options) || options.filterType === -1) {
    options.filterType = [0, 1, 2, 3, 4];
  }
  else if (typeof options.filterType === 'number') {
    options.filterType = [options.filterType];
  }

  this._filters = {
    0: this._filterNone.bind(this),
    1: this._filterSub.bind(this),
    2: this._filterUp.bind(this),
    3: this._filterAvg.bind(this),
    4: this._filterPaeth.bind(this)
  };

  this.read = dependencies.read;
  this.write = dependencies.write;
  this.complete = dependencies.complete;

  this._imageIndex = 0;
  this._images = [];
  if (interlace) {
    var passes = interlaceUtils.getImagePasses(width, height);
    for (var i = 0; i < passes.length; i++) {
      this._images.push({
        byteWidth: getByteWidth(passes[i].width, Bpp, depth),
        height: passes[i].height,
        lineIndex: 0
      });
    }
  }
  else {
    this._images.push({
      byteWidth: getByteWidth(width, Bpp, depth),
      height: height,
      lineIndex: 0
    });
  }
};

Filter.prototype.start = function() {
  this.read(this._images[this._imageIndex].byteWidth + 1, this._reverseFilterLine.bind(this));
};

Filter.prototype._reverseFilterLine = function(rawData) {

  var currentImage = this._images[this._imageIndex];
  var line = new Buffer(currentImage.byteWidth);

  var filter = rawData[0];

  // when filtering the line we look at the pixel to the left
  // the spec also says it is done on a byte level regardless of the number of pixels
  // so if the depth is byte compatible (8 or 16) we subtract the bpp in order to compare back
  // a pixel rather than just a different byte part. However if we are sub byte, we ignore.
  var xComparison;
  if (this._depth === 8) {
    xComparison = this._Bpp;
  }
  else if (this._depth === 16) {
    xComparison = this._Bpp * 2;
  }
  else {
    xComparison = 1;
  }
  var xBiggerThan = xComparison - 1;

  for (var x = 0; x < currentImage.byteWidth; x++) {
    var rawByte = rawData[1 + x];
    switch (filter) {
      case 0:
        line[x] = rawByte;
        break;
      case 1:
        var f1Left = x > xBiggerThan ? line[x - xComparison] : 0;
        line[x] = rawByte + f1Left;
        break;
      case 2:
        var f2Up = this._lastLine ? this._lastLine[x] : 0;
        line[x] = rawByte + f2Up;
        break;
      case 3:
        var f3Up = this._lastLine ? this._lastLine[x] : 0;
        var f3Left = x > xBiggerThan ? line[x - xComparison] : 0;
        var f3Add = Math.floor((f3Left + f3Up) / 2);
        line[x] = rawByte + f3Add;
        break;
      case 4:
        var f4Up = this._lastLine ? this._lastLine[x] : 0;
        var f4Left = x > xBiggerThan ? line[x - xComparison] : 0;
        var f4UpLeft = x > xBiggerThan && this._lastLine
          ? this._lastLine[x - xComparison] : 0;
        var f4Add = paethPredictor(f4Left, f4Up, f4UpLeft);
        line[x] = rawByte + f4Add;
        break;
      default:
        throw new Error('Unrecognised filter type - ' + filter);
    }

    //if (x === 5) {
    //    console.log("R", line[3], "G", line[4], "B", line[5]);
    //}
  }

  this.write(line);

  currentImage.lineIndex++;
  if (currentImage.lineIndex >= currentImage.height) {
    this._lastLine = null;
    this._imageIndex++;
    currentImage = this._images[this._imageIndex];
  }
  else {
    this._lastLine = line;
  }

  if (currentImage) {
    this.read(currentImage.byteWidth + 1, this._reverseFilterLine.bind(this));
  }
  else {
    this.complete(this._width, this._height);
  }
};

//TODO pull out
Filter.prototype.filter = function(pxData) {

  var rawData = new Buffer(((this._width << 2) + 1) * this._height);

  for (var y = 0; y < this._height; y++) {

    // find best filter for this line (with lowest sum of values)
    var filterTypes = this._options.filterType;
    var min = Infinity;
    var sel = 0;

    for (var i = 0; i < filterTypes.length; i++) {
      var sum = this._filters[filterTypes[i]](pxData, y, null);
      if (sum < min) {
        sel = filterTypes[i];
        min = sum;
      }
    }

    this._filters[sel](pxData, y, rawData);
  }
  return rawData;
};

Filter.prototype._filterNone = function(pxData, y, rawData) {

  var pxRowLength = this._width << 2;
  var rawRowLength = pxRowLength + 1;
  var sum = 0;

  if (!rawData) {
    for (var x = 0; x < pxRowLength; x++) {
      sum += Math.abs(pxData[y * pxRowLength + x]);
    }

  }
  else {
    rawData[y * rawRowLength] = 0;
    pxData.copy(rawData, rawRowLength * y + 1, pxRowLength * y, pxRowLength * (y + 1));
  }

  return sum;
};

Filter.prototype._filterSub = function(pxData, y, rawData) {

  var pxRowLength = this._width << 2;
  var rawRowLength = pxRowLength + 1;
  var sum = 0;

  if (rawData) {
    rawData[y * rawRowLength] = 1;
  }

  for (var x = 0; x < pxRowLength; x++) {

    var left = x >= 4 ? pxData[y * pxRowLength + x - 4] : 0;
    var val = pxData[y * pxRowLength + x] - left;

    if (!rawData) {
      sum += Math.abs(val);
    }
    else {
      rawData[y * rawRowLength + 1 + x] = val;
    }
  }
  return sum;
};

Filter.prototype._filterUp = function(pxData, y, rawData) {

  var pxRowLength = this._width << 2;
  var rawRowLength = pxRowLength + 1;
  var sum = 0;

  if (rawData) {
    rawData[y * rawRowLength] = 2;
  }

  for (var x = 0; x < pxRowLength; x++) {

    var up = y > 0 ? pxData[(y - 1) * pxRowLength + x] : 0;
    var val = pxData[y * pxRowLength + x] - up;

    if (!rawData) {
      sum += Math.abs(val);
    }
    else {
      rawData[y * rawRowLength + 1 + x] = val;
    }
  }
  return sum;
};

Filter.prototype._filterAvg = function(pxData, y, rawData) {

  var pxRowLength = this._width << 2;
  var rawRowLength = pxRowLength + 1;
  var sum = 0;

  if (rawData) {
    rawData[y * rawRowLength] = 3;
  }

  for (var x = 0; x < pxRowLength; x++) {

    var left = x >= 4 ? pxData[y * pxRowLength + x - 4] : 0;
    var up = y > 0 ? pxData[(y - 1) * pxRowLength + x] : 0;
    var val = pxData[y * pxRowLength + x] - ((left + up) >> 1);

    if (!rawData) {
      sum += Math.abs(val);
    }
    else {
      rawData[y * rawRowLength + 1 + x] = val;
    }
  }
  return sum;
};

Filter.prototype._filterPaeth = function(pxData, y, rawData) {

  var pxRowLength = this._width << 2;
  var rawRowLength = pxRowLength + 1;
  var sum = 0;

  if (rawData) {
    rawData[y * rawRowLength] = 4;
  }

  for (var x = 0; x < pxRowLength; x++) {

    var left = x >= 4 ? pxData[y * pxRowLength + x - 4] : 0;
    var up = y > 0 ? pxData[(y - 1) * pxRowLength + x] : 0;
    var upLeft = x >= 4 && y > 0 ? pxData[(y - 1) * pxRowLength + x - 4] : 0;
    var val = pxData[y * pxRowLength + x] - paethPredictor(left, up, upLeft);

    if (!rawData) {
      sum += Math.abs(val);
    }
    else {
      rawData[y * rawRowLength + 1 + x] = val;
    }
  }
  return sum;
};
