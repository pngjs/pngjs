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

var util = require('util'),
    zlib = require('zlib'),
    ChunkStream = require('./chunkstream');


var Filter = module.exports = function(width, height, Bpp, data, options) {
    ChunkStream.call(this);

    this._width = width;
    this._height = height;
    this._Bpp = Bpp;
    this._data = data;
    this._options = options;

    this._line = 0;

    options.filterTypes = options.filterTypes || [0,1,2,3,4];
    this._filters = {};
    for (var filterType in options.filterTypes) {
        switch (filterType) {
            case '0':
                this._filters[filterType] = this._filterNone.bind(this);
                break;
            case '1':
                this._filters[filterType] = this._filterSub.bind(this);
                break;
            case '2':
                this._filters[filterType] = this._filterUp.bind(this);
                break;
            case '3':
                this._filters[filterType] = this._filterAvg.bind(this);
                break;
            case '4':
                this._filters[filterType] = this._filterPaeth.bind(this);
                break;
            default:
        }
    }

    this.read(this._width * Bpp + 1, this._reverseFilterLine.bind(this));
};
util.inherits(Filter, ChunkStream);


var pixelBppMap = {
    1: { // L
        0: 0,
        1: 0,
        2: 0,
        3: 0xff,
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

Filter.prototype._reverseFilterLine = function(rawData) {

    var pxData = this._data,
        pxLineLength = this._width << 2,
        pxRowPos = this._line * pxLineLength,
        filter = rawData[0];

    if (filter == 0) {
        for (var x = 0; x < this._width; x++) {
            var pxPos = pxRowPos + (x << 2),
                rawPos = 1 + x * this._Bpp;

            for (var i = 0; i < 4; i++) {
                var idx = pixelBppMap[this._Bpp][i];
                pxData[pxPos + i] = idx != 0xff ? rawData[rawPos + idx] : 0xff;
            }
        }

    } else if (filter == 1) {
        for (var x = 0; x < this._width; x++) {
            var pxPos = pxRowPos + (x << 2),
                rawPos = 1 + x * this._Bpp;

            for (var i = 0; i < 4; i++) {
                var idx = pixelBppMap[this._Bpp][i],
                    left = x > 0 ? pxData[pxPos + i - 4] : 0;

                pxData[pxPos + i] = idx != 0xff ? rawData[rawPos + idx] + left : 0xff;
            }
        }

    } else if (filter == 2) {
        for (var x = 0; x < this._width; x++) {
            var pxPos = pxRowPos + (x << 2),
                rawPos = 1 + x * this._Bpp;

            for (var i = 0; i < 4; i++) {
                var idx = pixelBppMap[this._Bpp][i],
                    up = this._line > 0 ? pxData[pxPos - pxLineLength + i] : 0;

                pxData[pxPos + i] = idx != 0xff ? rawData[rawPos + idx] + up : 0xff;
            }

        }

    } else if (filter == 3) {
        for (var x = 0; x < this._width; x++) {
            var pxPos = pxRowPos + (x << 2),
                rawPos = 1 + x * this._Bpp;

            for (var i = 0; i < 4; i++) {
                var idx = pixelBppMap[this._Bpp][i],
                    left = x > 0 ? pxData[pxPos + i - 4] : 0,
                    up = this._line > 0 ? pxData[pxPos - pxLineLength + i] : 0,
                    add = Math.floor((left + up) / 2);

                 pxData[pxPos + i] = idx != 0xff ? rawData[rawPos + idx] + add : 0xff;
            }

        }

    } else if (filter == 4) {
        for (var x = 0; x < this._width; x++) {
            var pxPos = pxRowPos + (x << 2),
                rawPos = 1 + x * this._Bpp;

            for (var i = 0; i < 4; i++) {
                var idx = pixelBppMap[this._Bpp][i],
                    left = x > 0 ? pxData[pxPos + i - 4] : 0,
                    up = this._line > 0 ? pxData[pxPos - pxLineLength + i] : 0,
                    upLeft = x > 0 && this._line > 0
                            ? pxData[pxPos - pxLineLength + i - 4] : 0,
                    add = PaethPredictor(left, up, upLeft);

                pxData[pxPos + i] = idx != 0xff ? rawData[rawPos + idx] + add : 0xff;
            }
        }
    }


    this._line++;

    if (this._line < this._height)
        this.read(this._width * this._Bpp + 1, this._reverseFilterLine.bind(this));
    else
        this.emit('complete', this._data, this._width, this._height);
};




Filter.prototype.filter = function() {

    var pxData = this._data,
        rawData = new Buffer(((this._width << 2) + 1) * this._height);

    for (var y = 0; y < this._height; y++) {

        // find best filter for this line (with lowest sum of values)
        var min = Infinity,
            sel = 0;

        for (var f in this._filters) {
            var sum = this._filters[f](pxData, y, null);
            if (sum < min) {
                sel = f;
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
