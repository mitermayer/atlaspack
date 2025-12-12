const {Reporter} = require('@atlaspack/plugin');
const fs = require('fs');
const path = require('path');

module.exports = new Reporter({
  report({event, options}) {
    const logFile = path.join(options.projectRoot, 'execution-log.txt');

    if (event.type === 'buildProgress') {
      fs.appendFileSync(logFile, `Phase: ${event.phase}\n`);
    } else if (event.type === 'log') {
      if (event.diagnostics) {
        for (let d of event.diagnostics) {
          if (typeof d.message === 'string') {
            if (d.message.includes('[CONSOLE]')) {
              fs.appendFileSync(logFile, `${d.message}\n`);
            }
            if (
              d.origin === 'resolver-log' ||
              d.origin === 'transformer-log' ||
              d.origin === 'packager-log' ||
              d.origin === 'optimizer-log'
            ) {
              fs.appendFileSync(logFile, `[${d.origin}] ${d.message}\n`);
            }
          }
        }
      }
    } else if (event.type === 'buildSuccess') {
      fs.appendFileSync(logFile, `Phase: buildSuccess\n`);
    }
  },
});
