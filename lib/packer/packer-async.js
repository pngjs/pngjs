import Stream from 'stream';
import constants from '../constants';
import Packer from './packer';

export default class PackerAsync extends Stream {
  constructor(opt) {
    super();

    var options = opt || {};

    this._packer = new Packer(options);
    // create deflater
    this._deflate = this._packer.createDeflate();

    this.readable = true;
  }

  pack(data, width, height, gamma) {
    // Signature
    this.emit('data', new Buffer(constants.PNG_SIGNATURE));
    this.emit('data', this._packer.packIHDR(width, height));

    if (gamma) {
      this.emit('data', this._packer.packGAMA(gamma));
    }

    const filteredData = this._packer.filterData(data, width, height);
    this.deflate(filteredData);
  }

  deflate(filteredData) {
    // Bind this error to the deflater
    this._deflate.on('error', this.emit.bind(this, 'error'));

    this._deflate.on('data', function(compressedData) {
      this.emit('data', this._packer.packIDAT(compressedData));
    }.bind(this));

    this._deflate.on('end', function() {
      this.emit('data', this._packer.packIEND());
      this.emit('end');
    }.bind(this));

    this._deflate.end(filteredData);
  }
}
