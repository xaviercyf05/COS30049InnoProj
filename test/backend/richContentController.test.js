const test = require("node:test");
const assert = require("node:assert/strict");

const serviceModulePath = require.resolve("../../feature_modules/rich-content/service");
const controllerModulePath = require.resolve("../../feature_modules/rich-content/controller");

function loadController(fakeService) {
  delete require.cache[serviceModulePath];
  delete require.cache[controllerModulePath];
  require.cache[serviceModulePath] = {
    id: serviceModulePath,
    filename: serviceModulePath,
    loaded: true,
    exports: fakeService,
  };

  const controller = require("../../feature_modules/rich-content/controller");

  delete require.cache[serviceModulePath];
  delete require.cache[controllerModulePath];

  return controller;
}

function createResponseMock() {
  return {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
}

test("createRichContent validates title and sanitizes content before persistence", async () => {
  let createArgs = null;
  let addAttachmentsArgs = null;
  const controller = loadController({
    createContent: async (args) => {
      createArgs = args;
      return 777;
    },
    addAttachments: async (contentId, files) => {
      addAttachmentsArgs = { contentId, files };
    },
    getContentById: async (contentId) => ({ contentId, title: "Saved" }),
    listContents: async () => [],
  });

  const invalidRes = createResponseMock();
  await controller.createRichContent({ body: { title: "   " }, user: { userId: 9 }, files: [] }, invalidRes);

  assert.equal(invalidRes.statusCode, 400);
  assert.deepEqual(invalidRes.payload, { success: false, message: "Title is required." });

  const res = createResponseMock();
  await controller.createRichContent(
    {
      body: {
        title: "  My guide  ",
        contentHtml: '<script>alert(1)</script><p style="text-align:center">Hello <a href="https://example.com" onclick="evil()">world</a></p>',
      },
      user: { userId: 42 },
      files: [{ filename: "a.png" }],
    },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.payload, {
    success: true,
    message: "Rich content saved successfully.",
    data: { contentId: 777, title: "Saved" },
  });
  assert.equal(createArgs.userId, 42);
  assert.equal(createArgs.title, "My guide");
  assert.equal(createArgs.contentHtml.includes("<script>"), false);
  assert.equal(createArgs.contentHtml.includes("onclick"), false);
  assert.equal(createArgs.contentPlainText, "Hello world");
  assert.deepEqual(addAttachmentsArgs, { contentId: 777, files: [{ filename: "a.png" }] });
});

test("getRichContent and listRichContents return shaped responses", async () => {
  const controller = loadController({
    createContent: async () => 1,
    addAttachments: async () => {},
    getContentById: async (contentId) => {
      if (contentId === 100) {
        return {
          contentId: 100,
          title: "Guide",
          attachments: [
            { attachmentId: 1, relativePath: "guide/file.png", originalFileName: "file.png" },
          ],
        };
      }

      return null;
    },
    listContents: async () => ([{ contentId: 100, title: "Guide" }]),
  });

  const notFoundRes = createResponseMock();
  await controller.getRichContent({ params: { contentId: "999" } }, notFoundRes);
  assert.equal(notFoundRes.statusCode, 404);
  assert.deepEqual(notFoundRes.payload, { success: false, message: "Content not found." });

  const foundRes = createResponseMock();
  await controller.getRichContent({ params: { contentId: "100" } }, foundRes);
  assert.equal(foundRes.statusCode, null);
  assert.deepEqual(foundRes.payload, {
    success: true,
    data: {
      contentId: 100,
      title: "Guide",
      attachments: [
        {
          attachmentId: 1,
          relativePath: "guide/file.png",
          originalFileName: "file.png",
          publicUrl: "/storage/guide/file.png",
        },
      ],
    },
  });

  const listRes = createResponseMock();
  await controller.listRichContents({}, listRes);
  assert.deepEqual(listRes.payload, {
    success: true,
    data: [{ contentId: 100, title: "Guide" }],
  });
});
