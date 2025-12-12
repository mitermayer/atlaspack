const {Reporter} = require('@atlaspack/plugin');
const fs = require('fs');
const path = require('path');

module.exports = new Reporter({
  report({event, options}) {
    const logFile = path.join(options.projectRoot, 'reporter-events.log');

    // Validate event structure and log it
    const eventData = {
      type: event.type,
      hasTimestamp: !!event.time,
      hasPhase: !!event.phase,
      timestamp: event.time || null,
    };

    fs.appendFileSync(logFile, JSON.stringify(eventData) + '\n');
  },
});
