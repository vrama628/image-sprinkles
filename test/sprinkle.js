'use strict'

const expect = require('chai').expect,
      Jimp = require('jimp');

const sprinkle = require('..');

describe('::dist', function() {
  it('calculates the euclidean distance between two number arrays.', function() {
    expect(sprinkle.dist([1, 2], [4, 6])).to.equal(5);
  });
});

describe('::averageColor(sourceJimp, x, y, width, height)', function() {
  it("returns the average color of the given region of the given image, in the form of an RGBA array.", function() {
    let image = new Jimp(3, 3);
    image.scan(1, 1, 2, 2, (x, y, idx) => {
      image.bitmap.data[idx] = x + y + 1;
    });
    let color = sprinkle.averageColor(image, 1, 1, 2, 2);
    expect(color).to.deep.equal([4, 0, 0, 0]);
  });

  it("uses the nearest in-bounds pixels when given a partially out-of-bounds region.", function() {
    let image = new Jimp(3, 3);
    image.scan(1, 1, 2, 2, (x, y, idx) => {
      image.bitmap.data[idx] = x + y + 1;
    });
    let color = sprinkle.averageColor(image, 2, 1, 2, 2);
    expect(color).to.deep.equal([4.5, 0, 0, 0]);
  });

  it("uses the nearest in-bounds pixels when given a fully out-of-bounds region.", function() {
    let image = new Jimp(3, 3);
    image.scan(1, 1, 2, 2, (x, y, idx) => {
      image.bitmap.data[idx] = x + y + 1;
    });
    let color = sprinkle.averageColor(image, 3, 3, 2, 2);
    expect(color).to.deep.equal([5, 0, 0, 0]);
  });
});

describe('::squareTile(sourceJimp, x, y, width)', function() {
  it('creates a 4-way gradient image based on the given region of sourceJimp.', function() {
    let image = new Jimp(4, 4);
    image.scan(0, 0, 2, 4, (x, y, idx) => {
      image.bitmap.data[idx] = 16;
    });
    let tile = sprinkle.squareTile(image, 0, 0, 4);
    expect(tile.bitmap.width).to.equal(4);
    expect(tile.bitmap.height).to.equal(4);
    expect(tile.bitmap.data[4]).to.be.below(tile.bitmap.data[0]);
    expect(tile.bitmap.data[8]).to.be.below(tile.bitmap.data[4]);
    expect(tile.bitmap.data[12]).to.be.below(tile.bitmap.data[8]);
  });
});