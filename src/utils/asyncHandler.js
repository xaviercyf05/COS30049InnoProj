const util = require('util');

function asyncHandler(handler) {
  if (typeof handler !== 'function') {
    console.error('asyncHandler expected a function but received:', typeof handler, util.inspect(handler, { depth: 2 }));
    throw new TypeError('asyncHandler: handler is not a function');
  }

  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
