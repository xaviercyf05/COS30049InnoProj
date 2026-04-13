module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // If a library is looking for this, we provide a "null" placeholder
      // but only do this if the empty plugins: [] didn't work.
    ],
    // This tells Babel to skip trying to compile things that shouldn't be there
    ignore: [ /node_modules\/.*\/node_modules/ ] 
  };
};