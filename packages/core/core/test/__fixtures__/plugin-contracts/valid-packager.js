const {Packager} = require('@atlaspack/plugin');

module.exports = new Packager({
  package({bundle}) {
    // Valid packager - returns proper structure
    const mainEntry = bundle.getMainEntry();
    const content = mainEntry ? mainEntry.getFilePath() : '';

    return {
      contents: content,
      map: null,
    };
  },
});
