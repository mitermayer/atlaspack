const {Resolver} = require('@atlaspack/plugin');

module.exports = new Resolver({
  resolve() {
    // Invalid resolver - returns wrong structure
    return {invalid: 'structure'};
  },
});
