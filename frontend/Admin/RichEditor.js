import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

function sanitizeEditorHtml(rawHtml) {
  if (typeof rawHtml !== 'string') {
    return '';
  }

  const normalized = rawHtml.trim();

  if (!normalized || normalized === '[object HTMLDivElement]' || normalized === '[object Object]') {
    return '';
  }

  return normalized
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+="[^"]*"/gi, '')
    .replace(/\son[a-z]+='[^']*'/gi, '');
}

export default function RichEditor({ value, onChange }) {
  const webViewRef = useRef(null);
  const lastSyncedValueRef = useRef('');

  const pushEditorValueToWebView = (nextValue) => {
    const escapedValue = JSON.stringify(sanitizeEditorHtml(nextValue));

    webViewRef.current?.injectJavaScript(`
      if (window.__setEditorHtml) {
        window.__setEditorHtml(${escapedValue});
      }
      true;
    `);
  };

  const htmlContent = useMemo(
    () => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          html, body {
            margin: 0;
            padding: 0;
            height: 100%;
            background: #f7faf5;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }

          body {
            box-sizing: border-box;
          }

          #shell {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            min-height: 300px;
            border: 1px solid #d9e6d1;
            border-radius: 16px;
            overflow: hidden;
            background: #ffffff;
            box-shadow: 0 10px 26px rgba(63, 88, 52, 0.08);
          }

          #hero {
            padding: 12px 14px 10px;
            border-bottom: 1px solid #e6efe0;
            background: linear-gradient(180deg, #fbfdf8 0%, #f1f7ea 100%);
          }

          #heroTitle {
            margin: 0 0 4px;
            font-size: 15px;
            font-weight: 800;
            color: #2f4a3d;
          }

          #heroText {
            margin: 0;
            font-size: 12px;
            line-height: 1.45;
            color: #647564;
          }

          #toolbar {
            display: flex;
            flex-wrap: nowrap;
            gap: 8px;
            padding: 10px 10px 8px;
            border-bottom: 1px solid #e6efe0;
            background: #f8fbf5;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }

          #toolbar::-webkit-scrollbar {
            display: none;
          }

          .toolbar-group {
            display: flex;
            gap: 6px;
            align-items: center;
            flex: 0 0 auto;
            padding-right: 8px;
            border-right: 1px solid #e3eadc;
            margin-right: 2px;
          }

          .toolbar-group:last-child {
            border-right: 0;
            padding-right: 0;
            margin-right: 0;
          }

          .toolbar-label {
            font-size: 12px;
            font-weight: 700;
            color: #4a604d;
            white-space: nowrap;
          }

          #blockStyle {
            appearance: none;
            border: 1px solid #cad8c1;
            border-radius: 12px;
            padding: 9px 12px;
            min-height: 38px;
            background: #ffffff;
            color: #2f4a3d;
            font-size: 13px;
            font-weight: 700;
          }

          .tool-btn {
            appearance: none;
            border: 1px solid #cad8c1;
            border-radius: 999px;
            background: #ffffff;
            color: #315643;
            font-size: 13px;
            font-weight: 700;
            line-height: 1;
            padding: 9px 12px;
            min-height: 38px;
            flex: 0 0 auto;
          }

          .tool-btn svg {
            width: 18px;
            height: 18px;
            display: block;
            fill: none;
            stroke: currentColor;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
          }

          .tool-btn .filled-icon {
            fill: currentColor;
            stroke: none;
          }

          .sr-only {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
          }

          .tool-btn:active,
          .tool-btn.is-active {
            background: #86a371;
            color: #ffffff;
            border-color: #86a371;
            transform: translateY(1px);
          }

          #editor {
            flex: 1;
            width: 100%;
            min-height: 260px;
            padding: 16px;
            outline: none;
            overflow-y: auto;
            color: #2f4a3d;
            font-size: 15px;
            line-height: 1.7;
            box-sizing: border-box;
            -webkit-user-select: text;
            user-select: text;
          }

          #editor:empty:before {
            content: attr(data-placeholder);
            color: #91a091;
          }

          #editor img {
            max-width: 100%;
            height: auto;
            border-radius: 10px;
          }

          #editor iframe,
          #editor video {
            max-width: 100%;
            border: 0;
            border-radius: 10px;
          }

          #editor table {
            width: 100%;
            border-collapse: collapse;
            margin: 6px 0;
          }

          #editor td,
          #editor th {
            border: 1px solid #d7e3cf;
            padding: 8px;
            vertical-align: top;
          }

          #editor blockquote {
            margin: 10px 0;
            padding: 10px 12px;
            border-left: 4px solid #86a371;
            background: #f8fbf5;
            color: #3f5a46;
            border-radius: 0 10px 10px 0;
          }

          #editor pre {
            margin: 10px 0;
            padding: 12px;
            border-radius: 12px;
            background: #1f2b23;
            color: #edf4ea;
            overflow: auto;
          }

          #editor a {
            color: #3b6d51;
            text-decoration: underline;
          }

          .video-container {
            position: relative;
            width: 100%;
            padding-bottom: 56.25%;
            height: 0;
            overflow: hidden;
            border-radius: 10px;
            background: #f0f4ec;
          }

          .video-container iframe {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
          }

          #footer {
            padding: 10px 14px 12px;
            border-top: 1px solid #eef3ea;
            background: #fcfefb;
            font-size: 11px;
            line-height: 1.4;
            color: #657467;
          }
        </style>
      </head>
      <body>
        <div id="shell">

          <div id="toolbar" role="toolbar" aria-label="Rich text formatting toolbar">
            <div class="toolbar-group">
              <button class="tool-btn" data-cmd="undo" type="button" aria-label="Undo" title="Undo">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14l-4-4 4-4"></path><path d="M5 10h8a5 5 0 0 1 0 10H9"></path></svg>
                <span class="sr-only">Undo</span>
              </button>
              <button class="tool-btn" data-cmd="redo" type="button" aria-label="Redo" title="Redo">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 14l4-4-4-4"></path><path d="M19 10h-8a5 5 0 0 0 0 10h4"></path></svg>
                <span class="sr-only">Redo</span>
              </button>
            </div>

            <div class="toolbar-group">
              <button class="tool-btn" data-cmd="bold" type="button" aria-label="Bold" title="Bold">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h6a3 3 0 0 1 0 6H7z"></path><path d="M7 11h7a3 3 0 0 1 0 6H7z"></path></svg>
                <span class="sr-only">Bold</span>
              </button>
              <button class="tool-btn" data-cmd="italic" type="button" aria-label="Italic" title="Italic">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5h8"></path><path d="M6 19h8"></path><path d="M14 5l-4 14"></path></svg>
                <span class="sr-only">Italic</span>
              </button>
              <button class="tool-btn" data-cmd="underline" type="button" aria-label="Underline" title="Underline">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v6a5 5 0 0 0 10 0V5"></path><path d="M5 19h14"></path></svg>
                <span class="sr-only">Underline</span>
              </button>
              <button class="tool-btn" data-cmd="strikeThrough" type="button" aria-label="Strike" title="Strike">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"></path><path d="M8 7a3 3 0 0 1 3-2h2a3 3 0 0 1 3 2"></path><path d="M8 17a3 3 0 0 0 3 2h2a3 3 0 0 0 3-2"></path></svg>
                <span class="sr-only">Strike</span>
              </button>
            </div>

            <div class="toolbar-group">
              <span class="toolbar-label">Style</span>
              <select id="blockStyle">
                <option value="p">Paragraph</option>
                <option value="h1">Heading 1</option>
                <option value="h2">Heading 2</option>
                <option value="blockquote">Quote</option>
                <option value="pre">Code</option>
              </select>
            </div>

            <div class="toolbar-group">
              <button class="tool-btn" data-cmd="insertUnorderedList" type="button" aria-label="Bullets" title="Bullets">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="7" r="1.5" class="filled-icon"></circle><circle cx="6" cy="12" r="1.5" class="filled-icon"></circle><circle cx="6" cy="17" r="1.5" class="filled-icon"></circle><path d="M10 7h8M10 12h8M10 17h8"></path></svg>
                <span class="sr-only">Bullets</span>
              </button>
              <button class="tool-btn" data-cmd="insertOrderedList" type="button" aria-label="Numbered" title="Numbered">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h3"></path><path d="M6.5 5.5V10"></path><path d="M5.5 17h3"></path><path d="M5.5 15l3 2.2L5.5 19"></path><path d="M11 7h8M11 12h8M11 17h8"></path></svg>
                <span class="sr-only">Numbered</span>
              </button>
              <button class="tool-btn" data-cmd="removeFormat" type="button" aria-label="Clear formatting" title="Clear formatting">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7l12 12M18 7l-12 12"></path><path d="M5 20h14"></path></svg>
                <span class="sr-only">Clear</span>
              </button>
            </div>

            <div class="toolbar-group">
              <button class="tool-btn" data-action="link" type="button" aria-label="Link" title="Link">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="3"></circle><circle cx="16" cy="12" r="3"></circle><path d="M11 12h2M8 9v6M16 9v6"></path></svg>
                <span class="sr-only">Link</span>
              </button>
              <button class="tool-btn" data-action="image" type="button" aria-label="Image" title="Image">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"></rect><path d="M8 11l2.5 2.5L14 10l4 5"></path><circle cx="9" cy="9" r="1.25" class="filled-icon"></circle></svg>
                <span class="sr-only">Image</span>
              </button>
              <button class="tool-btn" data-action="video" type="button" aria-label="Video" title="Video">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="12" height="12" rx="2"></rect><path d="M16 10l4-3v10l-4-3"></path><path d="M9 9l4 3-4 3z" class="filled-icon"></path></svg>
                <span class="sr-only">Video</span>
              </button>
              <button class="tool-btn" data-action="table" type="button" aria-label="Table" title="Table">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"></rect><path d="M4 10h16M4 15h16M10 5v14M16 5v14"></path></svg>
                <span class="sr-only">Table</span>
              </button>
            </div>
          </div>

          <div id="editor" contenteditable="true" data-placeholder="Write your content here..."></div>
        </div>

        <script>
          (function () {
            var isApplyingExternalValue = false;
            var editor = document.getElementById('editor');
            var toolbar = document.getElementById('toolbar');
            var blockStyle = document.getElementById('blockStyle');
            var savedRange = null;
            var activeButtons = Array.prototype.slice.call(toolbar.querySelectorAll('button[data-cmd]'));

            function sanitizeEditorHtml(rawHtml) {
              return String(rawHtml || '')
                .replace(/<script[^>]*>[\\s\\S]*?<\\/script>/gi, '')
                .replace(/\\son[a-z]+="[^"]*"/gi, '')
                .replace(/\\son[a-z]+='[^']*'/gi, '');
            }

            function normalizeForCompare(rawHtml) {
              return sanitizeEditorHtml(rawHtml).replace(/\s+/g, ' ').trim();
            }

            function getEditorHtml() {
              return editor ? editor.innerHTML : '';
            }

            function setEditorHtml(html) {
              if (!editor) {
                return false;
              }

              editor.innerHTML = sanitizeEditorHtml(html) || '<p><br></p>';
              return true;
            }

            function saveSelection() {
              var selection = window.getSelection();

              if (selection && selection.rangeCount > 0) {
                savedRange = selection.getRangeAt(0);
              }
            }

            function restoreSelection() {
              if (!savedRange) {
                return;
              }

              var selection = window.getSelection();

              if (!selection) {
                return;
              }

              selection.removeAllRanges();
              selection.addRange(savedRange);
            }

            function postEditorValue() {
              if (isApplyingExternalValue) {
                return;
              }

              window.ReactNativeWebView.postMessage(sanitizeEditorHtml(getEditorHtml()));
            }

            function updateToolbarState() {
              var stateMap = {
                bold: false,
                italic: false,
                underline: false,
                strikeThrough: false,
              };

              try {
                stateMap.bold = document.queryCommandState('bold');
                stateMap.italic = document.queryCommandState('italic');
                stateMap.underline = document.queryCommandState('underline');
                stateMap.strikeThrough = document.queryCommandState('strikeThrough');
              } catch (_e) {
                // ignore unsupported state queries
              }

              activeButtons.forEach(function (button) {
                var command = button.getAttribute('data-cmd');
                button.classList.toggle('is-active', Boolean(stateMap[command]));
              });

              if (blockStyle) {
                try {
                  var currentBlock = String(document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, '');
                  if (currentBlock === 'div') {
                    currentBlock = 'p';
                  }

                  blockStyle.value = ['p', 'h1', 'h2', 'blockquote', 'pre'].indexOf(currentBlock) >= 0 ? currentBlock : 'p';
                } catch (_e2) {
                  blockStyle.value = 'p';
                }
              }
            }

            function focusEditor() {
              if (editor && editor.focus) {
                editor.focus();
              }
            }

            function insertHtmlAtCursor(html) {
              restoreSelection();
              focusEditor();

              try {
                document.execCommand('insertHTML', false, html);
              } catch (_e) {
                editor.insertAdjacentHTML('beforeend', html);
              }

              saveSelection();
              updateToolbarState();
              postEditorValue();
            }

            function execEditorCommand(command, value) {
              restoreSelection();
              focusEditor();

              try {
                document.execCommand(command, false, value || null);
              } catch (_e) {
                // ignore unsupported commands
              }

              saveSelection();
              updateToolbarState();
              postEditorValue();
            }

            function applyBlockStyle(value) {
              var normalizedValue = String(value || 'p').trim().toLowerCase();
              restoreSelection();
              focusEditor();

              try {
                document.execCommand('formatBlock', false, '<' + normalizedValue + '>');
              } catch (_e) {
                // ignore unsupported commands
              }

              saveSelection();
              updateToolbarState();
              postEditorValue();
            }

            function promptForUrl(message, placeholder) {
              var result = window.prompt(message, placeholder || '');
              return typeof result === 'string' ? result.trim() : '';
            }

            toolbar.addEventListener('mousedown', function (event) {
              if (event.target && event.target.tagName === 'BUTTON') {
                event.preventDefault();
              }
            });

            editor.addEventListener('mouseup', saveSelection);
            editor.addEventListener('keyup', function () {
              saveSelection();
              updateToolbarState();
            });
            editor.addEventListener('input', function () {
              saveSelection();
              updateToolbarState();
              postEditorValue();
            });
            editor.addEventListener('blur', function () {
              saveSelection();
              postEditorValue();
            });

            try {
              document.addEventListener('selectionchange', function () {
                if (!document.activeElement || document.activeElement !== editor) {
                  return;
                }

                saveSelection();
                updateToolbarState();
              });
            } catch (_e) {
              // ignore if unavailable
            }

            if (blockStyle) {
              blockStyle.addEventListener('change', function () {
                applyBlockStyle(blockStyle.value);
              });
            }

                toolbar.addEventListener('click', function (event) {
                  var button = event.target && event.target.closest ? event.target.closest('button') : null;

                  if (!button) {
                    return;
                  }

                  var command = button.getAttribute('data-cmd');
                  var action = button.getAttribute('data-action');

                  if (command) {
                    execEditorCommand(command);
                    return;
                  }

                  if (action === 'link') {
                    var linkUrl = promptForUrl('Enter a link URL');

                    if (!linkUrl) {
                      return;
                    }

                    execEditorCommand('createLink', linkUrl);
                    return;
                  }

                  if (action === 'image') {
                    var imageUrl = promptForUrl('Enter an image URL');

                    if (!imageUrl) {
                      return;
                    }

                    insertHtmlAtCursor('<img src="' + imageUrl.replace(/"/g, '&quot;') + '" alt="Image" />');
                    postEditorValue();
                    return;
                  }

                  if (action === 'video') {
                    var videoUrl = promptForUrl('Enter an iframe embed URL');

                    if (!videoUrl) {
                      return;
                    }

                    insertHtmlAtCursor(
                      '<div class="video-container"><iframe src="' +
                        videoUrl.replace(/"/g, '&quot;') +
                        '" allowfullscreen></iframe></div>'
                    );
                    postEditorValue();
                    return;
                  }

                  if (action === 'table') {
                    insertHtmlAtCursor(
                      '<table><tbody><tr><td>Cell 1</td><td>Cell 2</td></tr><tr><td>Cell 3</td><td>Cell 4</td></tr></tbody></table>'
                    );
                    postEditorValue();
                  }
                });

                window.__setEditorHtml = function(nextHtml) {
                  if (typeof nextHtml !== 'string') {
                    return;
                  }

                  var sanitizedHtml = sanitizeEditorHtml(nextHtml);
                  var currentHtml = sanitizeEditorHtml(getEditorHtml(editor));

                  if (normalizeForCompare(sanitizedHtml) === normalizeForCompare(currentHtml)) {
                    return;
                  }

                  isApplyingExternalValue = true;
                  setEditorHtml(editor, sanitizedHtml);
                  isApplyingExternalValue = false;
                };

                try {
                  editor.setAttribute('spellcheck', 'true');
                } catch (_e) {}

                setEditorHtml(value);
                saveSelection();
                updateToolbarState();

                // Compatibility fallback for mobile browsers that require an explicit initial render.
                window.setTimeout(function () {
                  if (!editor.innerHTML || !editor.innerHTML.trim()) {
                    editor.innerHTML = '<p><br></p>';
                  }

                  saveSelection();
                  updateToolbarState();
                  postEditorValue();
                }, 0);
          })();
        </script>
      </body>
    </html>
  `,
    []
  );

  useEffect(() => {
    const nextValue = sanitizeEditorHtml(value);

    if (nextValue === lastSyncedValueRef.current) {
      return;
    }

    lastSyncedValueRef.current = nextValue;
    pushEditorValueToWebView(nextValue);
  }, [value]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={styles.webView}
        nestedScrollEnabled
        scrollEnabled
        showsVerticalScrollIndicator
        onLoadEnd={() => {
          const nextValue = sanitizeEditorHtml(value);
          pushEditorValueToWebView(nextValue);
        }}
        onMessage={(event) => {
          const nextValue = sanitizeEditorHtml(event.nativeEvent.data || '');
          lastSyncedValueRef.current = nextValue;

          if (onChange) {
            onChange(nextValue);
          }
        }}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 620,
    backgroundColor: 'transparent',
  },
  headerCopy: {
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2f4a3d',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: '#667866',
  },
  webView: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
  },
  tipText: {
    marginTop: 8,
    fontSize: 12,
    color: '#5f705f',
    lineHeight: 16,
  },
});