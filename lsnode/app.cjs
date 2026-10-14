// LiteSpeed Node.js Selector loads a CommonJS entrypoint.
import('../server/index.js').catch(() => {
  console.error('CryptoBot startup failed');
  process.exit(1);
});
