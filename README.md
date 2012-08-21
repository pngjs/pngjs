About
========
Simple PNG encoder/decoder for Node.js with no native dependencies.

Installation
===============
```
$ npm install pngjs
```

Example
==========
```js
var fs = require('fs'),
    PNG = require('pngjs').PNG;

var png = new PNG({
    filterType: 4
});

png.on('parsed', function() {

    for (var y = 0; y < png.height; y++) {
        for (var x = 0; x < png.width; x++) {
            var idx = (png.width * y + x) << 2;

            // invert color
            png.data[idx] = 255 - png.data[idx];
            png.data[idx+1] = 255 - png.data[idx+1];
            png.data[idx+2] = 255 - png.data[idx+2];

            // and reduce opacity
            png.data[idx+3] = png.data[idx+3] >> 1;
        }
    }

    png.pipe(fs.createWriteStream('out.png'));

    png.pack();
});

fs.createReadStream('in.png').pipe(png);
```
For more examples see `examples` folder.

Documentation
================

As input any color type is accepted (grayscale, rgb, palette, grayscale with alpha, rgb with alpha) but 8 bit per sample (channel) is the only supported bit depth. Interlaced mode is not supported.

Supported ancillary chunks
------------------
- `gAMA` - gamma,
- `tRNS` - transparency (but only for paletted image)


## Class: PNG
`PNG` is readable and writeable `Stream`.

### Options
- `width` - `int`
- `height` - `int`
- `checkCRC` - `boolean` default: `true`
- `deflateChunkSize` - `int` default: 32 kB
- `deflateLevel` - `int` default: 9
- `filterType` - `int` default: -1 (auto)

### Event: "parsed"
`function(data) { }`

### png.pack()
Starts converting data to PNG file Stream

### png.parse(data, [callback])
Parses PNG file data. Alternatively you can stream data to PNG.

Optional `callback` is once called on `error` or `parsed`. The callback gets
two arguments `(err, data)`.

### Property: width

### Property: height

### Property: data
Buffer of image pixel data. Every pixel consists 4 bytes: R, G, B, A (opacity).

### Property: gamma

Changelog
============

### 0.2.0-alpha - 21 Aug 2012
  - Input added palette, grayscale, no alpha support
  - Better scanline filter selection

### 0.1.0-alpha - 19 Aug 2012
  - First version

License
=========

(The MIT License)

Copyright (c) 2012 Kuba Niegowski

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
