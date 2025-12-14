const {Transformer} = require('@atlaspack/plugin');
const logger = require('@atlaspack/logger').default;

module.exports = new Transformer({
  transform({asset}) {
    logger.info({
      message: `Transforming ${asset.filePath}`,
      origin: 'transformer-log',
    });

    // Add metadata to asset for testing
    asset.meta.transformed = true;
    asset.meta.transformerName = 'enhanced-transformer';

    return [asset];
  },
});
