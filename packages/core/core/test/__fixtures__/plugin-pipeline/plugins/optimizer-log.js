const {Optimizer} = require('@atlaspack/plugin');
const logger = require('@atlaspack/logger').default;

module.exports = new Optimizer({
  optimize({bundle}) {
    logger.info({
      message: `Optimizing bundle ${bundle.id}`,
      origin: 'optimizer-log',
    });

    // Return optimized bundle (in this case, just pass through)
    return bundle;
  },
});
