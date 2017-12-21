import pixelBppMap from './pixelBppMap';

export default function mapImageCustomBit(image, pxData, getPxPos, bpp, bits, maxBit) { // eslint-disable-line max-params
  const {
    width: imageWidth,
    height: imageHeight,
  } = image;
  let imagePass = image.index;
  for (let y = 0; y < imageHeight; y++) {
    for (let x = 0; x < imageWidth; x++) {
      let pixelData = bits.get(bpp);
      let pxPos = getPxPos(x, y, imagePass);

      for (let i = 0; i < 4; i++) {
        let idx = pixelBppMap[bpp][i];
        pxData[pxPos + i] = idx !== 0xff ? pixelData[idx] : maxBit;
      }
    }
    bits.resetAfterLine();
  }
}
