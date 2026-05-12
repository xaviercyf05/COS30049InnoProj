const path = require("path");
const sanitizeHtml = require("sanitize-html");
const service = require("./service");

function sanitizeContent(rawHtml) {
  return sanitizeHtml(rawHtml || "", {
    allowedTags: [
      "p",
      "br",
      "b",
      "strong",
      "i",
      "em",
      "u",
      "s",
      "blockquote",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "a",
      "code",
      "pre",
      "span",
      "img",
    ],
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      span: ["style"],
      p: ["style"],
    },
    allowedSchemes: ["http", "https", "mailto", "data"],
    allowedStyles: {
      "*": {
        "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
      },
    },
  });
}

function htmlToPlainText(html) {
  return sanitizeHtml(html || "", {
    allowedTags: [],
    allowedAttributes: {},
  }).trim();
}

async function createRichContent(req, res) {
  const { title, contentHtml } = req.body;

  if (!title || !String(title).trim()) {
    return res.status(400).json({
      success: false,
      message: "Title is required.",
    });
  }

  const safeHtml = sanitizeContent(contentHtml || "");
  const contentPlainText = htmlToPlainText(safeHtml);

  const contentId = await service.createContent({
    userId: req.user.userId,
    title: String(title).trim(),
    contentHtml: safeHtml,
    contentPlainText,
  });

  await service.addAttachments(contentId, req.files || []);

  const content = await service.getContentById(contentId);

  return res.status(201).json({
    success: true,
    message: "Rich content saved successfully.",
    data: content,
  });
}

async function getRichContent(req, res) {
  const { contentId } = req.params;
  const content = await service.getContentById(Number(contentId));

  if (!content) {
    return res.status(404).json({
      success: false,
      message: "Content not found.",
    });
  }

  const withUrls = {
    ...content,
    attachments: content.attachments.map((item) => ({
      ...item,
      publicUrl: path.posix.join("/storage", item.relativePath),
    })),
  };

  return res.json({
    success: true,
    data: withUrls,
  });
}

async function listRichContents(req, res) {
  const rows = await service.listContents(20);
  return res.json({
    success: true,
    data: rows,
  });
}

module.exports = {
  createRichContent,
  getRichContent,
  listRichContents,
};
