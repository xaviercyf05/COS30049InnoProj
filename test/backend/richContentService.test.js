const test = require("node:test");
const assert = require("node:assert/strict");

const dbModulePath = require.resolve("../../src/config/db");
const serviceModulePath = require.resolve("../../feature_modules/rich-content/service");

function loadService(fakeQuery) {
  delete require.cache[dbModulePath];
  delete require.cache[serviceModulePath];
  require.cache[dbModulePath] = {
    id: dbModulePath,
    filename: dbModulePath,
    loaded: true,
    exports: { query: fakeQuery },
  };

  const service = require("../../feature_modules/rich-content/service");

  delete require.cache[serviceModulePath];
  delete require.cache[dbModulePath];

  return service;
}

test("rich-content service writes content and attachments and maps content lookups", async () => {
  const calls = [];
  const fakeQuery = async (sql, params = []) => {
    const normalized = String(sql).replace(/\s+/g, " ").trim();
    calls.push({ normalized, params });

    if (normalized.startsWith("INSERT INTO RichContents")) {
      return [{ insertId: 501 }];
    }

    if (normalized.startsWith("INSERT INTO RichContentAttachments")) {
      return [{ affectedRows: params[0].length }];
    }

    if (normalized.startsWith("SELECT ContentID, CreatedByUserID, Title, ContentHtml, ContentPlainText, CreatedAt, UpdatedAt")) {
      if (params[0] !== 501) {
        return [[]];
      }

      return [[{
        ContentID: 501,
        CreatedByUserID: 9,
        Title: "Guide",
        ContentHtml: "<p>Guide</p>",
        ContentPlainText: "Guide",
        CreatedAt: "2026-05-29T00:00:00.000Z",
        UpdatedAt: "2026-05-29T00:00:00.000Z",
      }]];
    }

    if (normalized.startsWith("SELECT AttachmentID, OriginalFileName")) {
      return [[
        {
          AttachmentID: 1,
          OriginalFileName: "photo.jpg",
          StoredFileName: "stored-photo.jpg",
          MimeType: "image/jpeg",
          FileSizeBytes: 1234,
          RelativePath: "stored-photo.jpg",
          CreatedAt: "2026-05-29T00:00:00.000Z",
        },
        {
          AttachmentID: 2,
          OriginalFileName: "notes.png",
          StoredFileName: "stored-notes.png",
          MimeType: "image/png",
          FileSizeBytes: 2048,
          RelativePath: "stored-notes.png",
          CreatedAt: "2026-05-29T00:00:01.000Z",
        },
      ]];
    }

    if (normalized.startsWith("SELECT ContentID, CreatedByUserID, Title, ContentPlainText, CreatedAt, UpdatedAt")) {
      return [[
        { ContentID: 501, CreatedByUserID: 9, Title: "Guide", ContentPlainText: "Guide content preview", CreatedAt: "2026-05-29T00:00:00.000Z", UpdatedAt: "2026-05-29T00:00:00.000Z" },
        { ContentID: 500, CreatedByUserID: 8, Title: "Older", ContentPlainText: "Older content preview", CreatedAt: "2026-05-28T00:00:00.000Z", UpdatedAt: "2026-05-28T00:00:00.000Z" },
      ]];
    }

    throw new Error(`Unhandled SQL in rich-content service test: ${normalized}`);
  };

  const service = loadService(fakeQuery);

  const createdId = await service.createContent({
    userId: 9,
    title: "Guide",
    contentHtml: "<p>Guide</p>",
    contentPlainText: "Guide",
  });

  assert.equal(createdId, 501);

  await service.addAttachments(501, [
    {
      originalname: "photo.jpg",
      filename: "stored-photo.jpg",
      mimetype: "image/jpeg",
      size: 1234,
    },
    {
      originalname: "notes.png",
      filename: "stored-notes.png",
      mimetype: "image/png",
      size: 2048,
    },
  ]);

  const fullContent = await service.getContentById(501);
  assert.deepEqual(fullContent, {
    contentId: 501,
    createdByUserId: 9,
    title: "Guide",
    contentHtml: "<p>Guide</p>",
    contentPlainText: "Guide",
    createdAt: "2026-05-29T00:00:00.000Z",
    updatedAt: "2026-05-29T00:00:00.000Z",
    attachments: [
      {
        attachmentId: 1,
        originalFileName: "photo.jpg",
        storedFileName: "stored-photo.jpg",
        mimeType: "image/jpeg",
        fileSizeBytes: 1234,
        relativePath: "stored-photo.jpg",
        createdAt: "2026-05-29T00:00:00.000Z",
      },
      {
        attachmentId: 2,
        originalFileName: "notes.png",
        storedFileName: "stored-notes.png",
        mimeType: "image/png",
        fileSizeBytes: 2048,
        relativePath: "stored-notes.png",
        createdAt: "2026-05-29T00:00:01.000Z",
      },
    ],
  });

  const list = await service.listContents(20);
  assert.deepEqual(list, [
    {
      contentId: 501,
      createdByUserId: 9,
      title: "Guide",
      contentPreview: "Guide content preview",
      createdAt: "2026-05-29T00:00:00.000Z",
      updatedAt: "2026-05-29T00:00:00.000Z",
    },
    {
      contentId: 500,
      createdByUserId: 8,
      title: "Older",
      contentPreview: "Older content preview",
      createdAt: "2026-05-28T00:00:00.000Z",
      updatedAt: "2026-05-28T00:00:00.000Z",
    },
  ]);

  const missing = await service.getContentById(9999);
  assert.equal(missing, null);

  assert.equal(calls.some((call) => call.normalized.startsWith("INSERT INTO RichContents")), true);
  assert.equal(calls.some((call) => call.normalized.startsWith("INSERT INTO RichContentAttachments")), true);
});

test("addAttachments returns early when there are no files", async () => {
  let called = false;
  const service = loadService(async () => {
    called = true;
    return [[]];
  });

  await service.addAttachments(1, []);
  await service.addAttachments(1, null);

  assert.equal(called, false);
});
