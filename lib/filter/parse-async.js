import ChunkStream from '../chunkstream';
import Filter from './parse';

export default class FilterAsync extends ChunkStream {
  constructor(bitmapInfo) {
    super();

    var buffers = [];
    var that = this;
    this._filter = new Filter(bitmapInfo, {
      read: this.read.bind(this),
      write: function(buffer) {
        buffers.push(buffer);
      },
      complete: function() {
        that.emit('complete', Buffer.concat(buffers));
      },
    });

    this._filter.start();
  }
}
