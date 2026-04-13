import React, { useRef, useMemo } from 'react';
import { WebView } from 'react-native-webview';
import { View, StyleSheet } from 'react-native';

export default function RichEditor({ value, onChange }) {
  const webViewRef = useRef(null);

  const htmlContent = useMemo(() => `
    <!DOCTYPE html>
    <html>
      <head>
        <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
        <script src="https://cdn.quilljs.com/1.3.6/quill.js"></script>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { margin: 0; padding: 0; background-color: white; }
          #editor { height: 250px; border: none; font-size: 16px; }
        </style>
      </head>
      <body>
        <div id="editor">${value || ''}</div>
        <script>
          var quill = new Quill('#editor', {
            theme: 'snow',
            modules: {
                toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'strike'],              // Added 'strike'
                ['blockquote', 'code-block'],              // Added Quote and Code
                ['image', 'video'],
                ['clean']
                ]
            }
          });
          quill.on('text-change', function() {
            window.ReactNativeWebView.postMessage(quill.root.innerHTML);
          });
        </script>
      </body>
    </html>
  `, []);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        onMessage={(event) => {
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
  container: { height: 350, backgroundColor: 'white', borderWidth: 1, borderColor: '#ddd' },
});