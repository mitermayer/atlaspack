const {Transformer} = require('@atlaspack/plugin');

module.exports = new Transformer({
  transform() {
    // Invalid transformer - returns non-array
    return {not: 'an array'};
  },
});
