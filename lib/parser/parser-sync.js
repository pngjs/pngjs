import zlib from 'zlib';
import inflateSync from '../sync-inflate';
import SyncReader from '../sync-reader';
import { parseSync as filterSync } from '../filter';
import dataToBitMap from '../dataToBitMap';
import formatNormaliser from '../format-normaliser';
import { Parser } from '../parser';

/* eslint-disable max-statements */
var hasSyncZlib = true;

export default function(buffer, options) {

  if (!hasSyncZlib) {
    throw new Error('To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0');
  }

  var err;
  function handleError(_err_) {
    err = _err_;
  }

  var metaData;
  function handleMetaData(_metaData_) {
    metaData = _metaData_;
  }

  function handleTransColor(transColor) {
    metaData.transColor = transColor;
  }

  function handlePalette(palette) {
    metaData.palette = palette;
  }

  var gamma;
  function handleGamma(_gamma_) {
    gamma = _gamma_;
  }

  var inflateDataList = [];
  function handleInflateData(inflatedData) {
    inflateDataList.push(inflatedData);
  }

  var reader = new SyncReader(buffer);

  var parser = new Parser(options, {
    read: reader.read.bind(reader),
    error: handleError,
    metadata: handleMetaData,
    gamma: handleGamma,
    palette: handlePalette,
    transColor: handleTransColor,
    inflateData: handleInflateData,
  });

  parser.start();
  reader.process();

  if (err) {
    throw err;
  }

  //join together the inflate datas
  var inflateData = Buffer.concat(inflateDataList);
  inflateDataList.length = 0;

  var inflatedData;
  if (metaData.interlace) {
    inflatedData = zlib.inflateSync(inflateData);
  }
  else {
    var rowSize = ((metaData.width * metaData.bpp * metaData.depth + 7) >> 3) + 1;
    var imageSize = rowSize * metaData.height;
    inflatedData = inflateSync(inflateData, { chunkSize: imageSize, maxLength: imageSize });
  }
  inflateData = null;

  if (!inflatedData || !inflatedData.length) {
    throw new Error('bad png - invalid inflate data response');
  }

  var unfilteredData = filterSync(inflatedData, metaData);
  inflateData = null;

  var bitmapData = dataToBitMap(unfilteredData, metaData);
  unfilteredData = null;

  var normalisedBitmapData = formatNormaliser(bitmapData, metaData);

  metaData.data = normalisedBitmapData;
  metaData.gamma = gamma || 0;

  return metaData;
}
