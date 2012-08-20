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
    events = require('events');


var Filter = module.exports = function(options) {
    events.EventEmitter.call(this);

    this._options = options;
    options.filterType = 'filterType' in options ? options.filterType : -1;

    this._width = 0;
    this._height = 0;

    this._filters = {
        0: this._filterNone.bind(this),
        1: this._filterSub.bind(this),
        2: this._filterUp.bind(this),
        3: this._filterAvg.bind(this),
        4: this._filterPaeth.bind(this)
    };

};
util.inherits(Filter, events.EventEmitter);


Filter.prototype.prepare = function(width, height, type) {

    if (type != 0)
        throw new Error('Unsupported filter method');

    this.width = width;
    this.height = height;
};

Filter.prototype.unfilter = function(rawData, Bpp) {

    var pxLineLength = this.width << 2,
        rawLineLength = this.width * Bpp + 1,
        pxData = new Buffer(pxLineLength * this.height);

    for (var y = 0; y < this.height; y++) {

        var rawRowPos = rawLineLength * y + 1,
            pxRowPos = y * pxLineLength,
            filter = rawData[rawRowPos - 1];


        if (filter == 0) {
            for (var x = 0; x < this.width; x++) {
                var pxPos = pxRowPos + (x << 2),
                    rawPos = rawRowPos + x * Bpp;

                for (var i = 0; i < Bpp; i++)
                    pxData[pxPos + i] = rawData[rawPos + i];
            }

        } else if (filter == 1) {
            for (var x = 0; x < this.width; x++) {
                var pxPos = pxRowPos + (x << 2),
                    rawPos = rawRowPos + x * Bpp;

                for (var i = 0; i < Bpp; i++) {
                    var left = x > 0 ? pxData[pxPos + i - 4] : 0;
                    pxData[pxPos + i] = rawData[rawPos + i] + left;
                }
            }

        } else if (filter == 2) {
            for (var x = 0; x < this.width; x++) {
                var pxPos = pxRowPos + (x << 2),
                    rawPos = rawRowPos + x * Bpp;

                for (var i = 0; i < Bpp; i++) {
                    var up = y > 0 ? pxData[pxPos - pxLineLength + i] : 0;
                    pxData[pxPos + i] = rawData[rawPos + i] + up;
                }
            }

        } else if (filter == 3) {
            for (var x = 0; x < this.width; x++) {
                var pxPos = pxRowPos + (x << 2),
                    rawPos = rawRowPos + x * Bpp;

                for (var i = 0; i < Bpp; i++) {
                    var left = x > 0 ? pxData[pxPos + i - 4] : 0,
                        up = y > 0 ? pxData[pxPos - pxLineLength + i] : 0;

                    pxData[pxPos + i] = rawData[rawPos + i]
                        + Math.floor((left + up) / 2);
                }
            }

        } else if (filter == 4) {
            for (var x = 0; x < this.width; x++) {
                var pxPos = pxRowPos + (x << 2),
                    rawPos = rawRowPos + x * Bpp;

                for (var i = 0; i < Bpp; i++) {
                    var left = x > 0 ? pxData[pxPos + i - 4] : 0,
                        up = y > 0 ? pxData[pxPos - pxLineLength + i] : 0,
                        upLeft = x > 0 && y > 0
                                ? pxData[pxPos - pxLineLength + i - 4] : 0;

                    pxData[pxPos + i] = rawData[rawPos + i]
                        + PaethPredictor(left, up, upLeft)
                }
            }
        }
    }

    // expand data to 32 bit
    for (var y = 0; y < this.height; y++) {
        var pxRowPos = y * pxLineLength;

        if (Bpp == 1) { // L
            for (var x = 0; x < this.width; x++) {
                var pxPos = pxRowPos + (x << 2);

                pxData[pxPos + 1] = pxData[pxPos + 2] = pxData[pxPos];
                pxData[pxPos + 3] = 0xff;
            }

        } else if (Bpp == 2) { // LA
            for (var x = 0; x < this.width; x++) {
                var pxPos = pxRowPos + (x << 2);

                pxData[pxPos + 3] = pxData[pxPos + 1];
                pxData[pxPos + 1] = pxData[pxPos + 2] = pxData[pxPos];
            }

        } else if (Bpp == 3) { // RGB
            for (var x = 0; x < this.width; x++) {
                var pxPos = pxRowPos + (x << 2);

                pxData[pxPos + 3] = 0xff;
            }

        } // else RGBA
    }

    return pxData;
};


Filter.prototype.filter = function(pxData, width, height) {

    var rawData = new Buffer(((width << 2) + 1) * height);

    for (var y = 0; y < height; y++) {

        // find best filter for this line (with lowest sum of values)
        if (this._options.filterType == -1) {
            var min = Infinity,
                sel = 0;

            for (var f in this._filters) {
                var sum = this._filters[f](pxData, y, width, height, null);
                if (sum < min) {
                    sel = f;
                    min = sum;
                }
            }

        } else {
            sel = this._options.filterType;
        }
        this._filters[sel](pxData, y, width, height, rawData);
    }
    return rawData;
};

Filter.prototype._filterNone = function(pxData, y, width, height, rawData) {

    var pxRowLength = width << 2,
        rawRowLength = pxRowLength + 1,
        sum = 0;

    if (!rawData) {
        for (var x = 0; x < pxRowLength; x++)
            sum += pxData[y * pxRowLength + x];

    } else {
        rawData[y * rawRowLength] = 0;
        pxData.copy(rawData, rawRowLength * y + 1, pxRowLength * y, pxRowLength * (y + 1));
    }

    return sum;
};

Filter.prototype._filterSub = function(pxData, y, width, height, rawData) {

    var pxRowLength = width << 2,
        rawRowLength = pxRowLength + 1,
        sum = 0;

    if (rawData)
        rawData[y * rawRowLength] = 1;

    for (var x = 0; x < pxRowLength; x++) {

        var left = x >= 4 ? pxData[y * pxRowLength + x - 4] : 0,
            val = pxData[y * pxRowLength + x] - left;

        if (!rawData) sum += val;
        else rawData[y * rawRowLength + 1 + x] = val;
    }
    return sum;
};

Filter.prototype._filterUp = function(pxData, y, width, height, rawData) {

    var pxRowLength = width << 2,
        rawRowLength = pxRowLength + 1,
        sum = 0;

    if (rawData)
        rawData[y * rawRowLength] = 2;

    for (var x = 0; x < pxRowLength; x++) {

        var up = y > 0 ? pxData[(y - 1) * pxRowLength + x] : 0,
            val = pxData[y * pxRowLength + x] - up;

        if (!rawData) sum += val;
        else rawData[y * rawRowLength + 1 + x] = val;
    }
    return sum;
};

Filter.prototype._filterAvg = function(pxData, y, width, height, rawData) {

    var pxRowLength = width << 2,
        rawRowLength = pxRowLength + 1,
        sum = 0;

    if (rawData)
        rawData[y * rawRowLength] = 3;

    for (var x = 0; x < pxRowLength; x++) {

        var left = x >= 4 ? pxData[y * pxRowLength + x - 4] : 0,
            up = y > 0 ? pxData[(y - 1) * pxRowLength + x] : 0,
            val = pxData[y * pxRowLength + x] - ((left + up) >> 1);

        if (!rawData) sum += val;
        else rawData[y * rawRowLength + 1 + x] = val;
    }
    return sum;
};

Filter.prototype._filterPaeth = function(pxData, y, width, height, rawData) {

    var pxRowLength = width << 2,
        rawRowLength = pxRowLength + 1,
        sum = 0;

    if (rawData)
        rawData[y * rawRowLength] = 4;

    for (var x = 0; x < pxRowLength; x++) {

        var left = x >= 4 ? pxData[y * pxRowLength + x - 4] : 0,
            up = y > 0 ? pxData[(y - 1) * pxRowLength + x] : 0,
            upLeft = x >= 4 && y > 0 ? pxData[(y - 1) * pxRowLength + x - 4] : 0,
            val = pxData[y * pxRowLength + x] - PaethPredictor(left, up, upLeft);

        if (!rawData) sum += val;
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
