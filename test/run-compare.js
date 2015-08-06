require("./http-server");

var path = require('path');
var childProcess = require('child_process');
var phantomjs = require('phantomjs');
var binPath = phantomjs.path;

var childArgs = [
  path.join(__dirname, 'phantom-compare.js')
];

try {
  console.log("Comparing in PhantomJS");

  childProcess.execFile(binPath, childArgs, function (err, stdout, stderr) {

    // handle results
    console.log("Comparison Test Results:");
    console.log(stdout);
    process.exit(err ? 1 : 0);
  });
} catch (e) {
  console.log("Error starting phantomjs");
}