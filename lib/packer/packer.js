import constants from '../constants';
import CrcStream from '../crc';
import bitPacker from '../bitpacker';
import { Pack as filter } from '../filter';
import zlib from 'zlib';

export default class Packer {
  constructor(options) {
    this._options = options;

    options.deflateChunkSize = options.deflateChunkSize || 32 * 1024;
    options.deflateLevel = options.deflateLevel ? options.deflateLevel : 9;
    options.deflateStrategy = options.deflateStrategy ? options.deflateStrategy : 3;
    options.inputHasAlpha = options.inputHasAlpha ? options.inputHasAlpha : true;
    options.deflateFactory = options.deflateFactory || zlib.createDeflate;
    options.bitDepth = options.bitDepth || 8;
    // This is outputColorType
    options.colorType = (typeof options.colorType === 'number') ? options.colorType : constants.COLORTYPE_COLOR_ALPHA;
    options.inputColorType = (typeof options.inputColorType === 'number') ? options.inputColorType : constants.COLORTYPE_COLOR_ALPHA;

    if ([
      constants.COLORTYPE_GRAYSCALE,
      constants.COLORTYPE_COLOR,
      constants.COLORTYPE_COLOR_ALPHA,
      constants.COLORTYPE_ALPHA,
    ].indexOf(options.colorType) === -1) {
      throw new Error('option color type:' + options.colorType + ' is not supported at present');
    }
    if ([
      constants.COLORTYPE_GRAYSCALE,
      constants.COLORTYPE_COLOR,
      constants.COLORTYPE_COLOR_ALPHA,
      constants.COLORTYPE_ALPHA,
    ].indexOf(options.inputColorType) === -1) {
      throw new Error('option input color type:' + options.inputColorType + ' is not supported at present');
    }
    if (options.bitDepth !== 8 && options.bitDepth !== 16) {
      throw new Error('option bit depth:' + options.bitDepth + ' is not supported at present');
    }
  }

  getDeflateOptions() {
    return {
      chunkSize: this._options.deflateChunkSize,
      level: this._options.deflateLevel,
      strategy: this._options.deflateStrategy,
    };
  }

  createDeflate() {
    return this._options.deflateFactory(this.getDeflateOptions());
  }

  filterData(data, width, height) {
    // convert to correct format for filtering (e.g. right bpp and bit depth)
    var packedData = bitPacker(data, width, height, this._options);

    // filter pixel data
    var bpp = constants.COLORTYPE_TO_BPP_MAP[this._options.colorType];
    var filteredData = filter(packedData, width, height, this._options, bpp);
    return filteredData;
  }

  _packChunk(type, data) {

    var len = (data ? data.length : 0);
    var buf = new Buffer(len + 12);

    buf.writeUInt32BE(len, 0);
    buf.writeUInt32BE(type, 4);

    if (data) {
      data.copy(buf, 8);
    }

    buf.writeInt32BE(CrcStream.crc32(buf.slice(4, buf.length - 4)), buf.length - 4);
    return buf;
  }

  packGAMA(gamma) {
    var buf = new Buffer(4);
    buf.writeUInt32BE(Math.floor(gamma * constants.GAMMA_DIVISION), 0);
    return this._packChunk(constants.TYPE_gAMA, buf);
  }

  packIHDR(width, height) {

    var buf = new Buffer(13);
    buf.writeUInt32BE(width, 0);
    buf.writeUInt32BE(height, 4);
    buf[8] = this._options.bitDepth; // Bit depth
    buf[9] = this._options.colorType; // colorType
    buf[10] = 0; // compression
    buf[11] = 0; // filter
    buf[12] = 0; // interlace

    return this._packChunk(constants.TYPE_IHDR, buf);
  }

  packIDAT(data) {
    return this._packChunk(constants.TYPE_IDAT, data);
  }

  packIEND() {
    return this._packChunk(constants.TYPE_IEND, null);
  }
}
