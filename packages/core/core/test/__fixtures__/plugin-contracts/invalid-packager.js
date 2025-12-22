const {Packager} = require('@atlaspack/plugin');

module.exports = new Packager({
  package() {
    // Invalid packager - returns wrong structure
    return {invalid: 'structure'};
  },
});
