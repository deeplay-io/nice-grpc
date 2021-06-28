const jspb = require('google-protobuf');

jspb.DEBUG = true;
global.COMPILED = false;

module.exports = {
  test(val) {
    return val instanceof jspb.Message;
  },
  serialize(val, config, indentation, depth, refs, printer) {
    const plainConstructor = getPlainConstructor(val.constructor);

    return printer(new plainConstructor(val), config, indentation, depth, refs);
  },
};

function getPlainConstructor(messageConstructor) {
  let plainConstructor = plainConstructorsCache.get(messageConstructor);

  if (plainConstructor != null) {
    return plainConstructor;
  }

  const displayName = messageConstructor.displayName.replace(/^proto\./, '');

  plainConstructor = {
    [displayName]: function (value) {
      Object.assign(this, value.toObject());
    },
  }[displayName];

  plainConstructorsCache.set(messageConstructor, plainConstructor);

  return plainConstructor;
}

const plainConstructorsCache = new Map();
