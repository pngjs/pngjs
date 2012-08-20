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
    Stream = require('stream'),
    Compress = require('./compress'),
    Filter = require('./filter');


var signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

var TYPE_IHDR = 0x49484452;
var TYPE_IEND = 0x49454e44;
var TYPE_IDAT = 0x49444154;
var TYPE_PLTE = 0x504c5445;
var TYPE_tRNS = 0x74524e53;
var TYPE_gAMA = 0x67414d41;

var COLOR_PALETTE = 1;
var COLOR_COLOR = 2;
var COLOR_ALPHA = 4;


var Parser = module.exports = function(options) {
    Stream.call(this);

    this._options = options;
    options.checkCRC = options.checkCRC !== false;

    this._hasIHDR = false;
    this._hasIEND = false;

    // input flags
    this._palette = [];
    this._colorType = 0;

    this._chunks = {};
    this._chunks[TYPE_IHDR] = this._parseIHDR.bind(this);
    this._chunks[TYPE_IEND] = this._parseIEND.bind(this);
    this._chunks[TYPE_IDAT] = this._parseIDAT.bind(this);
    this._chunks[TYPE_PLTE] = this._parsePLTE.bind(this);
    this._chunks[TYPE_tRNS] = this._parseTRNS.bind(this);
    this._chunks[TYPE_gAMA] = this._parseGAMA.bind(this);

    this._compress = new Compress(options);
    this._filter = new Filter(options);

    this._initCompress();
};
util.inherits(Parser, Stream);

Parser.prototype._initCompress = function() {

    this._compress.on('error', this.emit.bind(this, 'error'));

    this._compress.on('deflated', this._packData.bind(this));
    this._compress.on('inflated', this._unfilter.bind(this));
};

Parser.prototype._parse = function(data) {

    var idx = 0;

    try {
        // check PNG file signature
        while (idx < signature.length) {
            if (data[idx] != signature[idx]) {
                throw new Error('Invalid file signature');
            }
            idx++;
        }
        //console.log('Signature is ok');

        // iterate chunks
        while (idx < data.length) {
            idx = this._parseChunk(data, idx);
        }
    }
    catch(err) {
        this.emit('error', err);
    }
};

Parser.prototype._pack = function(width, height, data) {

    // Signature
    this.emit('data', new Buffer(signature));
    this.emit('data', this._packIHDR(width, height));

    // filter pixel data
    var data = this._filter.filter(data, width, height);

    // compress it
    this._compress.deflate(data);
};

Parser.prototype._packData = function(data) {

    // console.log('deflate', data.length);

    this.emit('data', this._packIDAT(data));
    this.emit('data', this._packIEND());
    this.emit('end');
};

Parser.prototype._unfilter = function(data) {

    // expand data to 32 bit depending on colorType
    if (this._colorType == 0) { // L
        data = this._filter.unfilter(data, 1); // 1 Bpp

    } else if (this._colorType == 2) { // RGB
        data = this._filter.unfilter(data, 3); // 3 Bpp

    } else if (this._colorType == 3) { // I
        data = this._filter.unfilter(data, 1); // 1 Bpp

        // use values fom palette
        var pxLineLength = this.width << 2;

        for (var y = 0; y < this.height; y++) {
            var pxRowPos = y * pxLineLength;

            for (var x = 0; x < this.width; x++) {
                var pxPos = pxRowPos + (x << 2),
                    color = this._palette[data[pxPos]];

                for (var i = 0; i < 4; i++)
                    data[pxPos + i] = color[i];
            }
        }

    } else if (this._colorType == 4) { // LA
        data = this._filter.unfilter(data, 2); // 2 Bpp

    } else if (this._colorType == 6) { // RGBA
        data = this._filter.unfilter(data, 4); // 4 Bpp

    } else throw new Error('Unsupported color type');

    this.emit('parsed', data);
};




Parser.prototype._parseChunk = function(data, idx) {

    if (this._hasIEND)
        throw new Error('Not expected chunk after IEND');

    // chunk size (only content)
    var length = data.readUInt32BE(idx);
    idx += 4;

    // chunk type
    var type = data.readUInt32BE(idx),
        ancillary = !!(data[idx] & 0x20),  // or critical
        priv = !!(data[idx+1] & 0x20),  // or public
        safeToCopy = !!(data[idx+3] & 0x20),  // or unsafe
        name = '';
    for (var i = 0; i < 4; i++)
        name += String.fromCharCode(data[idx+i]);
    idx += 4;

    // console.log('chunk ', name, length);

    // calc CRC (of chunk type and content)
    var calcCrc = crc32(data.slice(idx - 4, idx + length)),
        content = data.slice(idx, idx + length);
    idx += length;

    // read CRC
    var fileCrc = data.readInt32BE(idx);
    idx += 4;

    // and check CRC
    if (this._options.checkCRC && calcCrc != fileCrc)
        throw new Error('Crc error');


    if (!this._hasIHDR && type != TYPE_IHDR)
        throw new Error('Expected IHDR on beggining');

    if (this._chunks[type]) {
        this._chunks[type](content);

    } else if (!ancillary)
        throw new Error('Unsupported critical chunk type ' + name);
    // else
    //     console.log('Ignoring chunk', name, type.toString(16));

    return idx;
};

Parser.prototype._packChunk = function(type, data) {

    var len = (data ? data.length : 0),
        buf = new Buffer(len + 12);

    buf.writeUInt32BE(len, 0);
    buf.writeUInt32BE(type, 4);

    if (data) data.copy(buf, 8);

    buf.writeInt32BE(crc32(buf.slice(4, buf.length - 4)), buf.length - 4);
    return buf;
};


Parser.prototype._parseIHDR = function(data) {

    var width = data.readUInt32BE(0),
        height = data.readUInt32BE(4),
        depth = data[8],
        colorType = data[9], // 1 palette, 2 color, 4 alpha
        compr = data[10],
        filter = data[11],
        interlace = data[12];

    // console.log('    width', width, 'height', height,
    //     'depth', depth, 'colorType', colorType,
    //     'compr', compr, 'filter', filter, 'interlace', interlace
    // );

    if (depth != 8)
        throw new Error('Unsupported bit depth ' + depth);
    if (interlace != 0)
        throw new Error('Unsupported interlace method');

    this._colorType = colorType;

    this._compress.prepareInflate(compr);
    this._filter.prepare(width, height, filter);

    this._hasIHDR = true;

    this.emit('metadata', width, height);
};

Parser.prototype._packIHDR = function(width, height) {

    var buf = new Buffer(13);
    buf.writeUInt32BE(width, 0);
    buf.writeUInt32BE(height, 4);
    buf[8] = 8;
    buf[9] = 6; // colorType
    buf[10] = 0; // compression
    buf[11] = 0; // filter
    buf[12] = 0; // interlace

    return this._packChunk(TYPE_IHDR, buf);
};


Parser.prototype._parsePLTE = function(data) {

    var entries = Math.floor(data.length / 3);
    // console.log('Palette:', entries);

    for (var i = 0; i < entries; i++) {
        this._palette.push([
            data.readUInt8(i * 3),
            data.readUInt8(i * 3 + 1),
            data.readUInt8(i * 3 + 2 ),
            0xff
        ]);
    }
};

Parser.prototype._parseTRNS = function(data) {

    // palette
    if (this._colorType == 3) {
        if (this._palette.length == 0)
            throw new Error('Transparency chunk must be after palette');

        if (data.length > this._palette.length)
            throw new Error('More transparent colors than palette size');

        for (var i = 0; i < this._palette.length; i++)
            this._palette[i][3] = i < data.length ? data.readUInt8(i) : 0xff;
    }

    // for colorType 0 (grayscale) and 2 (rgb)
    // there might be one gray/color defined as transparent
};

Parser.prototype._parseGAMA = function(data) {
    this.emit('gamma', data.readUInt32BE(0) / 100000);
};

Parser.prototype._parseIDAT = function(data) {

    if (this._colorType == 3 && this._palette.length == 0)
        throw new Error('Expected palette not found');

    this._compress.writeInflate(data);
};

Parser.prototype._packIDAT = function(data) {
    return this._packChunk(TYPE_IDAT, data);
};


Parser.prototype._parseIEND = function(data) {

    // no more data to inflate
    this._compress.endInflate();

    this._hasIEND = true;
};

Parser.prototype._packIEND = function() {
    return this._packChunk(TYPE_IEND, null);
};








// prepare crc table as in PNG Specification
var crcTable = [];

for (var i = 0; i < 256; i++) {
    var c = i;
    for (var j = 0; j < 8; j++) {
        if (c & 1) {
            c = 0xedb88320 ^ (c >>> 1);
        } else {
            c = c >>> 1;
        }
    }
    crcTable[i] = c;
}

function crc32(buf) {

    var crc = -1;
    for (var i = 0; i < buf.length; i++) {
        crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return crc ^ -1;
}

