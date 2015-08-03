/*global phantom:true*/

'use strict';

var page = require('webpage').create();

var last = new Date();
var timeout = 10000;

setInterval(function() {
  var results = page.evaluate(function(){
    if (window.isFinished && window.isFinished()) {
      return window.results;
    }
  });

  if (results) {
    var success = true;
    for(var i = 0; i < results.length; i++) {
      var result = results[i];
      console.log(result.name, result.success);
      success = success && result.success;
    }

    phantom.exit(success ? 0 : 1);
    return;
  }

  if (new Date() - last > timeout) {
    phantom.exit();
  }
}, 100);

page.onConsoleMessage = function(msg, lineNum, sourceId) {
  //console.log('CONSOLE: ' + msg);
};

page.onError = function(msg, trace) {
  console.log('error.onError', msg, trace);
  phantom.exit();
};

phantom.onError = function(msg, trace) {
  console.log('error.onError', msg, trace);
  phantom.exit();
};

page.open("http://localhost:8000");
