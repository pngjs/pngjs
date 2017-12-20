'use strict';
/* eslint-disable no-console */
require('./http-server');

import path from 'path';
import childProcess from 'child_process';
import phantomjs from 'phantomjs-prebuilt';
var binPath = phantomjs.path;

var childArgs = [
  path.join(__dirname, 'phantom-compare.js')
];

try {
  console.log('\nComparing in PhantomJS');

  childProcess.execFile(binPath, childArgs, function(err, stdout) {

    // handle results
    console.log('Comparison Test Results:');
    console.log(stdout);
    console.log(err);
    process.exit(err ? 1 : 0);
  });
}
catch (err) {
  console.log('Error starting phantomjs');
}
