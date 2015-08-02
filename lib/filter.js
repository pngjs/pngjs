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

var Filter = module.exports = function(width, height, Bpp, depth, interlace, options, dependencies) {

    this._width = width;
    this._height = height;
    this._Bpp = Bpp;
    this._depth = depth;
    this._options = options;

    if (!('filterType' in options) || options.filterType == -1) {
        options.filterType = [0, 1, 2, 3, 4];
    } else if (typeof options.filterType == 'number') {
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
        for(var i = 0; i < passes.length; i++) {
            this._images.push({
                byteWidth: getByteWidth(passes[i].width, Bpp, depth),
                height: passes[i].height,
                lineIndex: 0
            });
        }
    } else {
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

    var xComparison = this._depth >= 8 ? ((this._depth === 16) ? this._Bpp * 2 : this._Bpp) : 1;
    var xBiggerThan = xComparison - 1;

    for (var x = 0; x < currentImage.byteWidth; x++) {
        var rawByte = rawData[1 + x];
        switch(filter) {
            case 0:
                line[x] = rawByte;
                break;
            case 1:
                var left = x > xBiggerThan ? line[x - xComparison] : 0;
                line[x] = rawByte + left;
                break;
            case 2:
                var up = this._lastLine ? this._lastLine[x] : 0;
                line[x] = rawByte + up;
                break;
            case 3:
                var up = this._lastLine ? this._lastLine[x] : 0;
                var left = x > xBiggerThan ? line[x - xComparison] : 0;
                var add = Math.floor((left + up) / 2);
                line[x] = rawByte + add;
                break;
            case 4:
                var up = this._lastLine ? this._lastLine[x] : 0;
                var left = x > xBiggerThan ? line[x - xComparison] : 0;
                var upLeft = x > xBiggerThan && this._lastLine
                        ? this._lastLine[x - xComparison] : 0;
                var add = PaethPredictor(left, up, upLeft);
                line[x] = rawByte + add;
                break;
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
    } else {
        this._lastLine = line;
    }

    if (currentImage) {
        this.read(currentImage.byteWidth + 1, this._reverseFilterLine.bind(this));
    } else {
        this.complete(this._width, this._height);
    }
};


Filter.prototype.filter = function(pxData) {

    var rawData = new Buffer(((this._width << 2) + 1) * this._height);

    for (var y = 0; y < this._height; y++) {

        // find best filter for this line (with lowest sum of values)
        var filterTypes = this._options.filterType,
            min = Infinity,
            sel = 0;

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

    var pxRowLength = this._width << 2,
        rawRowLength = pxRowLength + 1,
        sum = 0;

    if (!rawData) {
        for (var x = 0; x < pxRowLength; x++)
            sum += Math.abs(pxData[y * pxRowLength + x]);

    } else {
        rawData[y * rawRowLength] = 0;
        pxData.copy(rawData, rawRowLength * y + 1, pxRowLength * y, pxRowLength * (y + 1));
    }

    return sum;
};

Filter.prototype._filterSub = function(pxData, y, rawData) {

    var pxRowLength = this._width << 2,
        rawRowLength = pxRowLength + 1,
        sum = 0;

    if (rawData)
        rawData[y * rawRowLength] = 1;

    for (var x = 0; x < pxRowLength; x++) {

        var left = x >= 4 ? pxData[y * pxRowLength + x - 4] : 0,
            val = pxData[y * pxRowLength + x] - left;

        if (!rawData) sum += Math.abs(val);
        else rawData[y * rawRowLength + 1 + x] = val;
    }
    return sum;
};

Filter.prototype._filterUp = function(pxData, y, rawData) {

    var pxRowLength = this._width << 2,
        rawRowLength = pxRowLength + 1,
        sum = 0;

    if (rawData)
        rawData[y * rawRowLength] = 2;

    for (var x = 0; x < pxRowLength; x++) {

        var up = y > 0 ? pxData[(y - 1) * pxRowLength + x] : 0,
            val = pxData[y * pxRowLength + x] - up;

        if (!rawData) sum += Math.abs(val);
        else rawData[y * rawRowLength + 1 + x] = val;
    }
    return sum;
};

Filter.prototype._filterAvg = function(pxData, y, rawData) {

    var pxRowLength = this._width << 2,
        rawRowLength = pxRowLength + 1,
        sum = 0;

    if (rawData)
        rawData[y * rawRowLength] = 3;

    for (var x = 0; x < pxRowLength; x++) {

        var left = x >= 4 ? pxData[y * pxRowLength + x - 4] : 0,
            up = y > 0 ? pxData[(y - 1) * pxRowLength + x] : 0,
            val = pxData[y * pxRowLength + x] - ((left + up) >> 1);

        if (!rawData) sum += Math.abs(val);
        else rawData[y * rawRowLength + 1 + x] = val;
    }
    return sum;
};

Filter.prototype._filterPaeth = function(pxData, y, rawData) {

    var pxRowLength = this._width << 2,
        rawRowLength = pxRowLength + 1,
        sum = 0;

    if (rawData)
        rawData[y * rawRowLength] = 4;

    for (var x = 0; x < pxRowLength; x++) {

        var left = x >= 4 ? pxData[y * pxRowLength + x - 4] : 0,
            up = y > 0 ? pxData[(y - 1) * pxRowLength + x] : 0,
            upLeft = x >= 4 && y > 0 ? pxData[(y - 1) * pxRowLength + x - 4] : 0,
            val = pxData[y * pxRowLength + x] - PaethPredictor(left, up, upLeft);

        if (!rawData) sum += Math.abs(val);
        else rawData[y * rawRowLength + 1 + x] = val;
    }
    return sum;
};



var PaethPredictor = function(left, above, upLeft) {

    var p = left + above - upLeft,
        pLeft = Math.abs(p - left),
        pAbove = Math.abs(p - above),
        pUpLeft = Math.abs(p - upLeft);

    if (pLeft <= pAbove && pLeft <= pUpLeft) return left;
    else if (pAbove <= pUpLeft) return above;
    else return upLeft;
};
