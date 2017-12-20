import SyncReader from '../sync-reader';
import Filter from './parse';

export default function(inBuffer, bitmapInfo) {
  var outBuffers = [];
  var reader = new SyncReader(inBuffer);
  var filter = new Filter(bitmapInfo, {
    read: reader.read.bind(reader),
    write: function(bufferPart) {
      outBuffers.push(bufferPart);
    },
    complete: function() {
    },
  });

  filter.start();
  reader.process();

  return Buffer.concat(outBuffers);
}
