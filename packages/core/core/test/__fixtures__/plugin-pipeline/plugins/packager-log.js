const {Packager} = require('@atlaspack/plugin');
const logger = require('@atlaspack/logger').default;

module.exports = new Packager({
  package({bundle}) {
    logger.info({
      message: `Packaging bundle ${bundle.id}`,
      origin: 'packager-log',
    });

    // Get the main entry and create bundle content
    const mainEntry = bundle.getMainEntry();
    const content = mainEntry ? mainEntry.getFilePath() : '';

    return {
      contents: content,
      map: null,
    };
  },
});
