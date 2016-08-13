'use strict';

const Jimp = require('jimp'),
      _ = require('underscore');

const clamp = (n, a, b) => Math.max(a, Math.min(n, b));
const dist = _.compose(
              Math.sqrt,
              _.partial(_.reduce, _, (a, b) => a+b),
              _.partial(
                _.map,
                _,
                dims => _.reduce(dims, (a, b) => Math.pow(a-b, 2))
              ),
              _.zip
            );
function dist2(x1, y1, x2, y2) {
  let dx = x2-x1, dy = y2-y1;
  return Math.sqrt(dx*dx + dy*dy);
}

/**
 * computes the average color of a rectangular region of an image.
 * @param {Jimp} sourceJimp   the image to get the color from
 * @param {Number} x          the x-coordinate of the region's upper-left corner
 * @param {Number} y          the y-coordinate of the region's upper-left corner
 * @param {Number} width      the width of the region
 * @param {Number} height     the height of the region
 * @return {Number Array}     a 4-length array of numbers between 0 and 255,
 *                              where 0=red, 1=green, 2=blue, 3=alpha,
 *                              representing the computed average color.
 */
function averageColor(sourceJimp, x, y, width, height) {
  let count = 0, sums = [0, 0, 0, 0],
      boundedX = clamp(x, 0, sourceJimp.bitmap.width - 1),
      boundedY = clamp(y, 0, sourceJimp.bitmap.height - 1),
      boundedW = clamp(width, 0, sourceJimp.bitmap.width - boundedX),
      boundedH = clamp(height, 0, sourceJimp.bitmap.height - boundedY);
  
  sourceJimp.scan(boundedX, boundedY, boundedW, boundedH, (x, y, idx) => {
    count++;
    sums[0] += sourceJimp.bitmap.data[idx];
    sums[1] += sourceJimp.bitmap.data[idx + 1];
    sums[2] += sourceJimp.bitmap.data[idx + 2];
    sums[3] += sourceJimp.bitmap.data[idx + 3];
  });
  
  return sums.map(x => x / count);
}

/**
 * creates a 4-way gradient square image based on part of another image. 
 * @param {Jimp}    sourceJimp  the image to base the gradient on
 * @param {Number}  x           the x-coordinate of the source square's
 *                                upper-left corner
 * @param {Number}  y           the y-coordinate of the source square's
 *                                upper-left corner
 * @param {Number}  width       the width/height of the source square
 * @param {Number}  [newWidth]  the width/height of the output square. Defaults
 *                                to width.
 * @return {Jimp}               a 4-way gradient square based on the colors of
 *                                the source square and the size of newWidth.
 */
function squareTile(sourceJimp, x, y, width, newWidth) {
  if (newWidth === undefined) newWidth = width;
  
  let colors = [
        [x, y, x + width/2, y + width/2],
        [x + width/2, y, x + width - width/2, y + width/2],
        [x, y + width/2, x + width - width/2, y + width - width/2],
        [x + width/2, y + width/2, x + width - width/2, y + width - width/2]
      ].map(([x, y, w, h]) => averageColor(sourceJimp, x, y, w, h));
  
  let tile = new Jimp(newWidth, newWidth),
      corners = [[0, 0], [newWidth, 0], [0, newWidth], [newWidth, newWidth]],
      weights = [0, 0, 0, 0], weightSum = 0, color = [0, 0, 0, 0];
  
  tile.scan(0, 0, newWidth, newWidth, (x1, y1, idx) => {
    weightSum = 0;
    corners.forEach(([x2, y2], i) => {
      weights[i] = 1 / (dist2(x1, y1, x2, y2) + 1);
      weightSum += weights[i];
    });
    weights.forEach((weight, i) => weights[i] = weight/weightSum);

    color.forEach((oldVal, i) => {
      color[i] = 
          colors[0][i] * weights[0]
        + colors[1][i] * weights[1]
        + colors[2][i] * weights[2]
        + colors[3][i] * weights[3];
    })

    tile.bitmap.data[idx + 0] = color[0];
    tile.bitmap.data[idx + 1] = color[1];
    tile.bitmap.data[idx + 2] = color[2];
    tile.bitmap.data[idx + 3] = color[3];
  });

  return tile;
}

/**
 * creates a randomly tiled rendition of a source image.
 * @param  {[type]} sourceJimp          the source image
 * @param  {Number} options.iterations  the number of tiles to add
 * @param  {Number} options.opacity     the opacity of each tile (0 to 1)
 * @param  {Number} options.scale       the size of the new image relative to
 *                                        the original
 * @param  {Number} options.blur        the factor by which tile size is smaller
 *                                        than the whole image's size
 * @return {Jimp}                       the tiled image
 */
function squareTiles(sourceJimp, {iterations, opacity, scale, blur}) {
  let positions = new Array(iterations),
      image = new Jimp( Math.round(sourceJimp.bitmap.width * scale),
                        Math.round(sourceJimp.bitmap.height * scale)  );

  // add image background
  let bgWidth = Math.max(image.bitmap.width, image.bitmap.height),
      [bgX, bgY] = [Math.round(image.bitmap.width/2 - bgWidth/2),
                    Math.round(image.bitmap.height/2 - bgWidth/2)];
  image.composite(squareTile(sourceJimp, bgX, bgY, bgWidth), bgX, bgY);

  for (let i = 0; i < iterations; i++) {
    let sideLength = Math.round(
      (Math.random() + 1)
      * ((sourceJimp.bitmap.width + sourceJimp.bitmap.height) / 2)
      / blur
    );

    let [x, y] = [
      Math.random() * sourceJimp.bitmap.width - sideLength / 2,
      Math.random() * sourceJimp.bitmap.height - sideLength / 2,
    ].map(Math.round);

    positions[i] = [x, y, sideLength];
  }

  positions.forEach(([x, y, sideLength]) => {
    process.stdout.write('.');

    let tile = squareTile(
      sourceJimp, 
      x, 
      y, 
      sideLength,
      Math.round(sideLength * scale)
    );

    tile.opacity(opacity);
    image.composite(tile, x, y);
  });

  return image;
}

module.exports = (filename, options) => {
  let {iterations, opacity, scale, blur} = options || {};
  
  Jimp.read(filename).then(image =>
    squareTiles(image, {
      iterations: iterations || 1000,
      opacity: opacity || 0.5,
      scale: scale || 1,
      blur: blur || 8
    }).write('TILED' + filename));
};

module.exports.dist = dist;
module.exports.averageColor = averageColor;
module.exports.squareTile = squareTile;
module.exports.squareTiles = squareTiles;