const {Transformer} = require('@atlaspack/plugin');

module.exports = new Transformer({
  transform({asset}) {
    // Valid transformer - returns array of assets
    return [asset];
  },
});
