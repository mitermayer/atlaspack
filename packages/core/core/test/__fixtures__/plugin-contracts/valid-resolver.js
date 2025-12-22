const {Resolver} = require('@atlaspack/plugin');
const fs = require('fs');
const path = require('path');

module.exports = new Resolver({
  resolve({specifier, options}) {
    if (specifier === './test.js') {
      const filePath = path.join(options.projectRoot, 'test.js');
      if (fs.existsSync(filePath)) {
        return {filePath};
      }
    }
    return null;
  },
});
