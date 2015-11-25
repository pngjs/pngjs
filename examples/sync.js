#!/usr/bin/env node

var fs = require('fs'),
  PNG = require('../lib/png').PNG;


var srcFname = process.argv[2],
  dstFname = process.argv[3] || 'out.png';

// Read a PNG file
var data = fs.readFileSync(srcFname);
// Parse it
var png = PNG.sync.read(data, {
  filterType: -1
});
// Pack it back into a PNG data
var buff = PNG.sync.write(png);
// Write a PNG file
fs.writeFileSync(dstFname, buff);