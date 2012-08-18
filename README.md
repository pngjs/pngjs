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
    }),
    src = fs.createReadStream(process.argv[2]),
    dst = fs.createWriteStream(process.argv[3]);

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

    png.pack();
});

src.pipe(png).pipe(dst);
```
For more examples see `examples` folder.

Documentation
================

Currently only true color mode with 8-bit color depth (per color) with alpha
is supported. PNG cannot parse and create images with palette of colors.
Interlaced mode is not supported either.

## PNG
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

Changelog
============

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
