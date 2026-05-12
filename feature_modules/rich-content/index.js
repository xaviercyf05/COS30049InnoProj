const richContentRoutes = require("./routes");
const { ensureStorageDir } = require("./storage");

function initRichContentStorage() {
  return ensureStorageDir();
}

module.exports = {
  router: richContentRoutes.router,
  initRichContentStorage,
};
