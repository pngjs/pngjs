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
    zlib = require('zlib'),
    helpers = require('./helpers'),
    constants = require('./constants'),
    Filter = require('./filter');


var Parser = module.exports = function(options) {
    Stream.call(this);

    this._options = options;
    options.checkCRC = options.checkCRC !== false;

    this._hasIHDR = false;
    this._hasIEND = false;

    this._stream = new ReadStream();
    this._inflate = null;

    // input flags/metadata
    this._palette = [];
    this._colorType = 0;
    this._width = 0;
    this._height = 0;

    this._chunks = {};
    this._chunks[constants.TYPE_IHDR] = this._handleIHDR.bind(this);
    this._chunks[constants.TYPE_IEND] = this._handleIEND.bind(this);
    this._chunks[constants.TYPE_IDAT] = this._handleIDAT.bind(this);
    this._chunks[constants.TYPE_PLTE] = this._handlePLTE.bind(this);
    this._chunks[constants.TYPE_tRNS] = this._handleTRNS.bind(this);
    this._chunks[constants.TYPE_gAMA] = this._handleGAMA.bind(this);

    this.writable = true;

    this.on('error', this._handleError.bind(this));

    this._handleSignature();
};
util.inherits(Parser, Stream);


Parser.prototype.write = function(data) {
    this._stream.write(data);
};

Parser.prototype.end = function(data) {
    this._stream.end(data);
};

Parser.prototype._handleError = function() {

    this.writable = false;
    this._stream.destroy();

    if (this._inflate)
        this._inflate.destroy();
};

Parser.prototype._handleSignature = function() {
    this._stream.read(constants.PNG_SIGNATURE.length,
        this._parseSignature.bind(this)
    );
};

Parser.prototype._parseSignature = function(data) {

    var signature = constants.PNG_SIGNATURE;

    for (var i = 0; i < signature.length; i++)
        if (data[i] != signature[i]) {
            this.emit('error', new Error('Invalid file signature'));
            return;
        }
    }
    this._stream.read(8, this._parseChunkBegin.bind(this));
};

Parser.prototype._parseChunkBegin = function(data) {

    // chunk content length
    var length = data.readUInt32BE(0);

    // chunk type
    var type = data.readUInt32BE(4),
        name = '';
    for (var i = 4; i < 8; i++)
        name += String.fromCharCode(data[i]);

    // chunk flags
    var ancillary  = !!(data[4] & 0x20),  // or critical
        priv       = !!(data[5] & 0x20),  // or public
        safeToCopy = !!(data[7] & 0x20);  // or unsafe

    if (!this._hasIHDR && type != constants.TYPE_IHDR) {
        this.emit('error', new Error('Expected IHDR on beggining'));
        return;
    }

    if (this._chunks[type]) {
        return this._chunks[type](length);

    } else if (!ancillary) {
        this.emit('error', new Error('Unsupported critical chunk type ' + name));
        return;
    }
};

Parser.prototype._handleChunkEnd = function() {
    this._stream.read(4, this._parseChunkEnd.bind(this));
};

Parser.prototype._parseChunkEnd = function(data) {

    var fileCrc = data.readInt32BE(0);

//     // calc CRC (of chunk type and content)
//     var calcCrc = helpers.crc32(data.slice(idx - 4, idx + length)),
//         content = data.slice(idx, idx + length);
//     idx += length;

//     // read CRC
//     var fileCrc = data.readInt32BE(idx);
//     idx += 4;

//     // and check CRC
//     if (this._options.checkCRC && calcCrc != fileCrc)
//         throw new Error('Crc error');

    // TODO: calc crc on stream

    if (this._hasIEND) {
        this._stream.destroy();

    } else {
        this._stream.read(8, this._parseChunkBegin.bind(this));
    }
};


Parser.prototype._handleIHDR = function(length) {
    this._stream.read(length, this._parseIHDR.bind(this));
};
Parser.prototype._parseIHDR = function(data) {

    var width = data.readUInt32BE(0),
        height = data.readUInt32BE(4),
        depth = data[8],
        colorType = data[9], // bits: 1 palette, 2 color, 4 alpha
        compr = data[10],
        filter = data[11],
        interlace = data[12];

    console.log('    width', width, 'height', height,
        'depth', depth, 'colorType', colorType,
        'compr', compr, 'filter', filter, 'interlace', interlace
    );

    if (depth != 8) {
        this.emit('error', new Error('Unsupported bit depth ' + depth));
        return;
    }
    if (compr != 0) {
        this.emit('error', new Error('Unsupported compression method'));
        return;
    }
    if (filter != 0) {
        this.emit('error', new Error('Unsupported filter method'));
        return;
    }
    if (interlace != 0) {
        this.emit('error', new Error('Unsupported interlace method'));
        return;
    }

    this._colorType = colorType;
    this._width = width;
    this._height = height;
    this._hasIHDR = true;

    this.emit('metadata', {
        width: width,
        height: height,
        palette: !!(colorType & constants.COLOR_PALETTE),
        color: !!(colorType & constants.COLOR_COLOR),
        alpha: !!(colorType & constants.COLOR_ALPHA)
    });

    this._handleChunkEnd();
};


Parser.prototype._handlePLTE = function(length) {
    this._stream.read(length, this._parsePLTE.bind(this));
};
Parser.prototype._parsePLTE = function(data) {

    var entries = Math.floor(data.length / 3);
    console.log('Palette:', entries);

    for (var i = 0; i < entries; i++) {
        this._palette.push([
            data.readUInt8(i * 3),
            data.readUInt8(i * 3 + 1),
            data.readUInt8(i * 3 + 2 ),
            0xff
        ]);
    }

    this._handleChunkEnd();
};

Parser.prototype._handleTRNS = function(length) {
    this._stream.read(length, this._parseTRNS.bind(this));
};
Parser.prototype._parseTRNS = function(data) {

    // palette
    if (this._colorType == 3) {
        if (this._palette.length == 0) {
            this.emit('error', new Error('Transparency chunk must be after palette'));
            return;
        }
        if (data.length > this._palette.length) {
            this.emit('error', new Error('More transparent colors than palette size'));
            return;
        }
        for (var i = 0; i < this._palette.length; i++) {
            this._palette[i][3] = i < data.length ? data.readUInt8(i) : 0xff;
        }
    }

    // for colorType 0 (grayscale) and 2 (rgb)
    // there might be one gray/color defined as transparent

    this._handleChunkEnd();
};

Parser.prototype._handleGAMA = function(length) {
    this._stream.read(length, this._parseGAMA.bind(this));
};
Parser.prototype._parseGAMA = function(data) {

    this.emit('gamma', data.readUInt32BE(0) / 100000);

    this._handleChunkEnd();
};

Parser.prototype._handleIDAT = function(length) {
    this._stream.read(-length, this._parseIDAT.bind(this, length));
};
Parser.prototype._parseIDAT = function(lenght, data) {

    if (this._colorType == 3 && this._palette.length == 0)
        throw new Error('Expected palette not found');

    if (!this._inflate) {
        this._inflate = zlib.createInflate();

        this._inflate.on('error', this.emit.bind(this, 'error'));
        //this._inflate.pipe(filter);
    }

    this._inflate.write(data);
    length -= data.length;

    if (length > 0)
        this._handleIDAT(length);
    else
        this._handleChunkEnd();
};


Parser.prototype._handleIEND = function(length) {
    this._stream.read(length, this._parseIEND.bind(this));
};
Parser.prototype._parseIEND = function(data) {

    // no more data to inflate
    this._inflate.end();

    this._hasIEND = true;
    this._handleChunkEnd();
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
