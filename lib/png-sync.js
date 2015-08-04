'use strict';


var Parser = require('./parser-sync');


exports.read = function(buffer, options) {

  var parser = new Parser(buffer, options || {});

  if (parser.err) {
    throw parser.err;
  }

  return {
    data: parser.data,
    width: parser._width,
    height: parser._height,
    gamma: parser.gamma || 0
  };
};
