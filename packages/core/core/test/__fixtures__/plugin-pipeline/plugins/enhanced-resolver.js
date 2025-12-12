const {Resolver} = require('@atlaspack/plugin');
const logger = require('@atlaspack/logger').default;
const fs = require('fs');
const path = require('path');

module.exports = new Resolver({
  resolve({specifier, options}) {
    logger.info({
      message: `Resolving ${specifier}`,
      origin: 'resolver-log',
    });

    // Handle absolute
    if (path.isAbsolute(specifier) && fs.existsSync(specifier)) {
      return {filePath: specifier};
    }

    // Handle relative to project root
    const absPath = path.join(options.projectRoot, specifier);
    if (fs.existsSync(absPath)) {
      return {filePath: absPath};
    }

    return null;
  },
});
