#!/usr/bin/env node
import fs from 'fs';
import { PNG } from '../lib/png';

const srcFname = process.argv[2];
const dstFname = process.argv[3] || 'out.png';

// Read a PNG file
const data = fs.readFileSync(srcFname);
// Parse it
const png = PNG.sync.read(data, {
  filterType: -1,
});

// Pack it back into a PNG data
const buff = PNG.sync.write(png);

// Write a PNG file
fs.writeFileSync(dstFname, buff);
