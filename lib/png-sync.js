import { ParserSync as parse } from './parser';
import { PackerSync as pack } from './packer';

export const read = function(buffer, options) {
  return parse(buffer, options || {});
};

export const write = function(png, options) {
  return pack(png, options);
};
