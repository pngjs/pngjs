import pixelBppMap from './pixelBppMap';

export default function mapImage8Bit(image, pxData, getPxPos, bpp, data, rawPos) { // eslint-disable-line max-params
  const imageWidth = image.width;
  const imageHeight = image.height;
  let imagePass = image.index;
  for (let y = 0; y < imageHeight; y++) {
    for (let x = 0; x < imageWidth; x++) {
      let pxPos = getPxPos(x, y, imagePass);

      for (let i = 0; i < 4; i++) {
        let idx = pixelBppMap[bpp][i];
        if (idx === 0xff) {
          pxData[pxPos + i] = 0xff;
        }
        else {
          let dataPos = idx + rawPos;
          if (dataPos === data.length) { // eslint-disable-line
            throw new Error('Ran out of data');
          }
          pxData[pxPos + i] = data[dataPos];
        }
      }
      rawPos += bpp; //eslint-disable-line no-param-reassign
    }
  }
  return rawPos;
}
