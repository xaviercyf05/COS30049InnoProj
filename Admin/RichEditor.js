import React, { useRef, useMemo, useEffect } from 'react';
import { WebView } from 'react-native-webview';
import { View, StyleSheet } from 'react-native';

export default function RichEditor({ value, onChange }) {
  const webViewRef = useRef(null);
  const lastSyncedValueRef = useRef(value || '');

  const htmlContent = useMemo(() => `
    <!DOCTYPE html>
    <html>
      <head>
        <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
        <script src="https://cdn.quilljs.com/1.3.6/quill.js"></script>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { margin: 0; padding: 0; background: #fff; }
          #editor { min-height: 250px; border: none; font-size: 16px; }

          .ql-toolbar.ql-snow {
            border: none !important;
            border-bottom: 1px solid #E6E6E6 !important;
            background: #fff;
          }

          .ql-container.ql-snow {
            border: none !important;
            min-height: 250px;
          }

          .ql-editor {
            min-height: 250px;
          }
        </style>
      </head>
      <body>
        <div id="editor"></div>
        <script>
          var quill = new Quill('#editor', {
            theme: 'snow',
            modules: {
                toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic','underline', 'strike'],
                ['blockquote', 'code-block'],
                [{ list: 'ordered' }, { list: 'bullet' }],
                ['image', 'video'],
                ['clean']
                ]
            }
          });

          window.__setEditorHtml = function(nextHtml) {
            if (typeof nextHtml !== 'string') return;
            if (quill.root.innerHTML !== nextHtml) {
              quill.root.innerHTML = nextHtml;
            }
          };

          quill.on('text-change', function() {
            window.ReactNativeWebView.postMessage(quill.root.innerHTML);
          });
        </script>
      </body>
    </html>
  `, []);

  useEffect(() => {
    const nextValue = value || '';
    if (nextValue === lastSyncedValueRef.current) {
      return;
    }

    lastSyncedValueRef.current = nextValue;
    const escaped = JSON.stringify(nextValue);

    webViewRef.current?.injectJavaScript(`
      if (window.__setEditorHtml) {
        window.__setEditorHtml(${escaped});
      }
      true;
    `);
  }, [value]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        onMessage={(event) => {
          lastSyncedValueRef.current = event.nativeEvent.data || '';
          if (onChange) onChange(event.nativeEvent.data);
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        // This allows users to pick photos from their gallery on Android
        allowsInlineMediaPlayback={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 350, backgroundColor: 'transparent' },
});
