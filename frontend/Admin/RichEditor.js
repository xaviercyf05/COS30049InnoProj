import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

function sanitizeEditorHtml(rawHtml) {
  return String(rawHtml || '')
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
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/suneditor@3.1.2/dist/css/suneditor.min.css" />
        <script src="https://cdn.jsdelivr.net/npm/suneditor@3.1.2/dist/suneditor.min.js"></script>
        <style>
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }

          #editor {
            width: 100%;
          }

          .sun-editor {
            border: 1px solid #dce7d3;
            border-radius: 12px;
            overflow: visible;
            background: #ffffff;
          }

          .sun-editor .se-toolbar {
            border-bottom: 1px solid #dce7d3;
            background: linear-gradient(180deg, #f7fbf3 0%, #edf6e5 100%);
            padding: 8px;
          }

          .sun-editor .se-btn {
            border-radius: 8px;
            color: #315643;
          }

          .sun-editor .se-btn:enabled.active {
            background: #88a170;
            color: #ffffff;
          }

          .sun-editor .se-wrapper {
            min-height: 250px;
            max-height: 360px;
          }

          .sun-editor .se-wrapper-inner {
            min-height: 250px;
            max-height: 360px;
            background: #ffffff;
            color: #2f4a3d;
          }

          .sun-editor .sun-editor-editable {
            font-size: 15px;
            line-height: 1.65;
          }

          .sun-editor .sun-editor-editable img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
          }

          .sun-editor .se-resizing-container .se-resize-dot > span.tl,
          .sun-editor .se-resizing-container .se-resize-dot > span.tr,
          .sun-editor .se-resizing-container .se-resize-dot > span.bl,
          .sun-editor .se-resizing-container .se-resize-dot > span.br {
            width: 10px;
            height: 10px;
          }

          .sun-editor .se-resizing-bar {
            border-top: 1px solid #dce7d3;
            background: #f7fbf3;
          }
        </style>
      </head>
      <body>
        <div id="editor"></div>

        <script>
          (function () {
            var isApplyingExternalValue = false;

            function sanitizeEditorHtml(rawHtml) {
              return String(rawHtml || '')
                .replace(/<script[^>]*>[\\s\\S]*?<\\/script>/gi, '')
                .replace(/\\son[a-z]+="[^"]*"/gi, '')
                .replace(/\\son[a-z]+='[^']*'/gi, '');
            }

            function normalizeForCompare(rawHtml) {
              return String(rawHtml || '').replace(/\\s+/g, ' ').trim();
            }

            function getEditorHtml(editor) {
              if (editor && editor.$ && editor.$.html && editor.$.html.get) {
                return editor.$.html.get();
              }

              return editor && editor.$ && editor.$.frameContext && editor.$.frameContext.get('wysiwyg')
                ? editor.$.frameContext.get('wysiwyg').innerHTML
                : '';
            }

            function setEditorHtml(editor, html) {
              var sanitizedHtml = sanitizeEditorHtml(html) || '<p><br></p>';

              if (editor && editor.$ && editor.$.html && editor.$.html.set) {
                editor.$.html.set(sanitizedHtml);
                return true;
              }

              if (!editor || !editor.$ || !editor.$.frameContext) {
                return false;
              }

              var wysiwyg = editor.$.frameContext.get('wysiwyg');

              if (!wysiwyg) {
                return false;
              }

              wysiwyg.innerHTML = sanitizedHtml;
              return true;
            }

            var editor = SUNEDITOR.create(document.getElementById('editor'), {
              defaultTag: 'p',
              height: '300px',
              resizingBar: false,
              imageResizing: true,
              imageFileInput: true,
              videoFileInput: false,
              plugins: SUNEDITOR.plugins,
              buttonList: [
                ['undo', 'redo'],
                ['blockStyle', 'fontSize'],
                ['bold', 'italic', 'underline', 'strike', 'removeFormat'],
                ['fontColor', 'backgroundColor'],
                ['align', 'list', 'hr'],
                ['link', 'image', 'video', 'table'],
                ['codeView', 'showBlocks']
              ],
              defaultStyle: "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; color: #2f4a3d;",
              onChange: function(contents) {
                if (isApplyingExternalValue) {
                  return;
                }

                window.ReactNativeWebView.postMessage(sanitizeEditorHtml(contents));
              }
            });

            // Compatibility fallback: also set the onChange handler after creation
            try {
              editor.onChange = function(contents) {
                if (isApplyingExternalValue) {
                  return;
                }

                window.ReactNativeWebView.postMessage(sanitizeEditorHtml(contents));
              };
            } catch (_e) {
              // ignore if unsupported
            }

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

      <Text style={styles.tipText}>
        Use toolbar buttons for media, tables, and formatting. Image resizing works directly in the
        editor.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 540,
    backgroundColor: 'transparent',
  },
  tipText: {
    marginTop: 6,
    fontSize: 12,
    color: '#5f705f',
    lineHeight: 16,
  },
});