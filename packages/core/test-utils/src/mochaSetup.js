if (process.env.ATLASPACK_MOCHA_HANG_DEBUG === 'true') {
  const whyIsNodeRunning = require('why-is-node-running').default;
  // eslint-disable-next-line no-console
  console.log(`\n\n🛠️  Mocha process PID: ${process.pid}`);
  // eslint-disable-next-line no-console
  console.log(
    `🛠️  Run 'kill -SIGHUP ${process.pid}' to get information about open handles\n\n`,
  );

  process.on('SIGHUP', () => {
    whyIsNodeRunning();
  });

  const shouldAutoDump =
    process.env.ATLASPACK_MOCHA_HANG_DEBUG_AUTO_DUMP === 'true';

  if (shouldAutoDump) {
    // In debug mode, optionally dump open handles after a short delay.
    // This helps in environments where sending signals is not possible.
    const timer = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.log(
        '🛠️  ATLASPACK_MOCHA_HANG_DEBUG: dumping open handles after 10s',
      );
      whyIsNodeRunning();
    }, 10000);
    // Do not keep the process alive solely for this timer.
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  }
}

process.on('unhandledRejection', (reason) => {
  throw reason;
});
