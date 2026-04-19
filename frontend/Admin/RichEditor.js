import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

export default function RichEditor({ value, onChange }) {
  const webViewRef = useRef(null);
  const lastSyncedValueRef = useRef('');

  const pushEditorValueToWebView = (nextValue) => {
    const escaped = JSON.stringify(nextValue || '');

    webViewRef.current?.injectJavaScript(`
      if (window.__setEditorHtml) {
        window.__setEditorHtml(${escaped});
      }
      true;
    `);
  };

  const htmlContent = useMemo(
    () => `
    <!DOCTYPE html>
    <html>
      <head>
        <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
        <script src="https://cdn.quilljs.com/1.3.6/quill.js"></script>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          html, body { margin: 0; padding: 0; background: #fff; }
          body { overflow-y: auto; -webkit-overflow-scrolling: touch; }
          #editor { height: 240px; border: none; font-size: 16px; }

          .ql-toolbar.ql-snow {
            border: none !important;
            border-bottom: 1px solid #E6E6E6 !important;
            background: #fff;
          }

          .ql-container.ql-snow {
            border: none !important;
            height: 240px;
            max-height: 240px;
          }

          .ql-editor {
            height: 100%;
            min-height: 100%;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            position: relative;
          }

          .ql-editor img {
            max-width: 100%;
            height: auto;
            cursor: pointer;
          }

          .ql-editor img.image-selected {
            outline: 2px solid #86A071;
            outline-offset: 2px;
            border-radius: 4px;
          }

          .image-resize-handle {
            position: absolute;
            width: 14px;
            height: 14px;
            border-radius: 3px;
            border: 1px solid #6E8B6D;
            background: #EAF4E2;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
            cursor: nwse-resize;
            z-index: 20;
            touch-action: none;
            display: none;
          }

          #image-size-toolbar {
            margin: 8px 8px 10px;
            padding: 8px;
            border-radius: 10px;
            border: 1px solid #DEE9D6;
            background: #F7FBF3;
          }

          #image-size-toolbar .toolbar-row {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 6px;
          }

          #image-size-toolbar .toolbar-row + .toolbar-row {
            margin-top: 8px;
          }

          #image-size-toolbar button {
            border: 1px solid #D4E2CB;
            background: #EDF6E5;
            color: #315643;
            border-radius: 999px;
            padding: 4px 10px;
            font-size: 12px;
            font-weight: 700;
          }

          #image-size-toolbar button.active {
            background: #88A170;
            border-color: #88A170;
            color: #FFFFFF;
          }

          #image-size-toolbar button:disabled {
            opacity: 0.45;
          }

          #image-size-toolbar input[type='range'] {
            flex: 1;
            min-width: 110px;
          }

          #image-size-toolbar input[type='number'] {
            width: 62px;
            border: 1px solid #D4E2CB;
            border-radius: 6px;
            padding: 4px 6px;
            font-size: 12px;
            font-weight: 700;
            color: #315643;
            background: #FFFFFF;
          }

          #image-size-meta {
            margin-top: 6px;
            font-size: 11px;
            color: #5f705f;
            line-height: 1.4;
          }

          #image-size-toolbar.disabled #image-size-meta {
            color: #7B8A7B;
          }
        </style>
      </head>
      <body>
        <div id="editor"></div>

        <div id="image-size-toolbar" class="disabled">
          <div class="toolbar-row" id="preset-buttons-row">
            <button type="button" data-preset="30">Small</button>
            <button type="button" data-preset="50">Medium</button>
            <button type="button" data-preset="75">Large</button>
            <button type="button" data-preset="100">Full</button>
            <button type="button" data-preset="auto">Auto</button>
            <button type="button" data-preset="custom">Custom</button>
          </div>

          <div class="toolbar-row">
            <span style="font-size:12px;font-weight:700;color:#3E5A47;">Width</span>
            <input id="image-width-range" type="range" min="10" max="100" value="50" />
            <input id="image-width-number" type="number" min="10" max="100" value="50" />
            <span style="font-size:12px;font-weight:700;color:#3E5A47;">%</span>
          </div>

          <div id="image-size-meta">Tap an image in the editor to open resize tools.</div>
        </div>

        <script>
          var MIN_WIDTH_PERCENT = 10;
          var MAX_WIDTH_PERCENT = 100;

          function clampWidthPercent(value) {
            var numericValue = parseFloat(value);

            if (!isFinite(numericValue)) {
              return null;
            }

            return Math.min(MAX_WIDTH_PERCENT, Math.max(MIN_WIDTH_PERCENT, Math.round(numericValue)));
          }

          function normalizeImageWidthInput(rawInput) {
            var normalized = String(rawInput || '').trim();

            if (!normalized) {
              return '';
            }

            var widthMatch = normalized.match(/^(\\d+(?:\\.\\d+)?)\\s*(px|%)?$/i);

            if (!widthMatch) {
              return null;
            }

            var numericWidth = parseFloat(widthMatch[1]);

            if (!isFinite(numericWidth) || numericWidth <= 0) {
              return null;
            }

            var widthUnit = (widthMatch[2] || 'px').toLowerCase();

            if (widthUnit === '%') {
              return Math.min(100, Math.max(1, Math.round(numericWidth))) + '%';
            }

            return Math.round(numericWidth) + 'px';
          }

          function parseImageWidthPercent(imageElement, editorWidth) {
            if (!imageElement || !editorWidth) {
              return null;
            }

            var inlineWidth = String(imageElement.style.width || '').trim();

            if (inlineWidth.endsWith('%')) {
              return clampWidthPercent(inlineWidth.replace('%', ''));
            }

            var pixelWidth = imageElement.getBoundingClientRect().width;

            if (!isFinite(pixelWidth) || pixelWidth <= 0) {
              return null;
            }

            return clampWidthPercent((pixelWidth / editorWidth) * 100);
          }

          var quill = new Quill('#editor', {
            theme: 'snow',
            modules: {
              toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                ['blockquote', 'code-block'],
                [{ list: 'ordered' }, { list: 'bullet' }],
                ['image', 'video'],
                ['clean']
              ]
            }
          });

          var editorRoot = quill.root;
          editorRoot.style.position = 'relative';

          var toolbar = document.getElementById('image-size-toolbar');
          var presetButtons = Array.prototype.slice.call(
            document.querySelectorAll('#preset-buttons-row button[data-preset]')
          );
          var widthRangeInput = document.getElementById('image-width-range');
          var widthNumberInput = document.getElementById('image-width-number');
          var toolbarMeta = document.getElementById('image-size-meta');

          var resizeHandle = document.createElement('div');
          resizeHandle.className = 'image-resize-handle';
          editorRoot.appendChild(resizeHandle);

          var activeImage = null;
          var activeWidthPercent = null;
          var dragState = null;

          function sanitizeEditorHtml(rawHtml) {
            var normalizedHtml = typeof rawHtml === 'string' ? rawHtml : '';

            if (!normalizedHtml) {
              return normalizedHtml;
            }

            var scratch = document.createElement('div');
            scratch.innerHTML = normalizedHtml;

            Array.prototype.forEach.call(
              scratch.querySelectorAll('.image-resize-handle'),
              function(node) {
                node.remove();
              }
            );

            Array.prototype.forEach.call(
              scratch.querySelectorAll('img.image-selected'),
              function(imageNode) {
                imageNode.classList.remove('image-selected');
              }
            );

            return scratch.innerHTML;
          }

          function emitEditorHtml() {
            window.ReactNativeWebView.postMessage(sanitizeEditorHtml(quill.root.innerHTML));
          }

          function clearSelectedImageHighlight() {
            if (activeImage) {
              activeImage.classList.remove('image-selected');
            }
          }

          function hideResizeHandle() {
            resizeHandle.style.display = 'none';
          }

          function positionResizeHandle() {
            if (!activeImage) {
              hideResizeHandle();
              return;
            }

            var imageRect = activeImage.getBoundingClientRect();
            var editorRect = editorRoot.getBoundingClientRect();

            var left = imageRect.left - editorRect.left + editorRoot.scrollLeft + imageRect.width - 8;
            var top = imageRect.top - editorRect.top + editorRoot.scrollTop + imageRect.height - 8;

            resizeHandle.style.left = Math.max(0, left) + 'px';
            resizeHandle.style.top = Math.max(0, top) + 'px';
            resizeHandle.style.display = 'block';
          }

          function updateToolbarState() {
            var hasSelection = !!activeImage;

            toolbar.classList.toggle('disabled', !hasSelection);

            presetButtons.forEach(function(button) {
              var presetValue = button.getAttribute('data-preset');
              button.disabled = !hasSelection;

              var isActiveButton =
                presetValue !== 'auto' &&
                presetValue !== 'custom' &&
                String(activeWidthPercent || '') === String(presetValue);

              button.classList.toggle('active', isActiveButton);
            });

            widthRangeInput.disabled = !hasSelection;
            widthNumberInput.disabled = !hasSelection;

            if (hasSelection && isFinite(activeWidthPercent)) {
              widthRangeInput.value = String(activeWidthPercent);
              widthNumberInput.value = String(activeWidthPercent);
              toolbarMeta.textContent = 'Tip: drag the image corner handle or use presets/slider to resize.';
            } else {
              widthRangeInput.value = '50';
              widthNumberInput.value = '50';
              toolbarMeta.textContent = 'Tap an image in the editor to open resize tools.';
            }
          }

          function syncActiveWidthPercent() {
            if (!activeImage) {
              activeWidthPercent = null;
              updateToolbarState();
              return;
            }

            activeWidthPercent = parseImageWidthPercent(activeImage, editorRoot.clientWidth);
            updateToolbarState();
          }

          function clearActiveImage() {
            clearSelectedImageHighlight();
            activeImage = null;
            activeWidthPercent = null;
            hideResizeHandle();
            updateToolbarState();
          }

          function selectImage(imageElement) {
            if (!imageElement || imageElement.tagName !== 'IMG') {
              clearActiveImage();
              return;
            }

            if (activeImage && activeImage !== imageElement) {
              activeImage.classList.remove('image-selected');
            }

            activeImage = imageElement;
            activeImage.classList.add('image-selected');
            activeImage.style.maxWidth = '100%';
            activeImage.style.height = 'auto';

            syncActiveWidthPercent();
            positionResizeHandle();
          }

          function applyWidthPercent(rawPercent, shouldEmit) {
            if (!activeImage) {
              return;
            }

            var clampedPercent = clampWidthPercent(rawPercent);

            if (clampedPercent === null) {
              return;
            }

            activeImage.style.width = clampedPercent + '%';
            activeImage.style.maxWidth = '100%';
            activeImage.style.height = 'auto';
            activeWidthPercent = clampedPercent;

            updateToolbarState();
            positionResizeHandle();

            if (shouldEmit !== false) {
              emitEditorHtml();
            }
          }

          function applyAutoWidth() {
            if (!activeImage) {
              return;
            }

            activeImage.style.width = '';
            activeImage.style.maxWidth = '100%';
            activeImage.style.height = 'auto';

            syncActiveWidthPercent();
            positionResizeHandle();
            emitEditorHtml();
          }

          function applyCustomWidth() {
            if (!activeImage) {
              return;
            }

            var currentWidth = activeImage.style.width || '';
            var nextWidthInput = window.prompt(
              'Set image width (e.g., 320px or 70%). Leave blank to reset.',
              currentWidth
            );

            if (nextWidthInput === null) {
              return;
            }

            var normalizedWidth = normalizeImageWidthInput(nextWidthInput);

            if (normalizedWidth === null) {
              window.alert('Invalid width. Use values like 320px or 70%.');
              return;
            }

            if (!normalizedWidth) {
              applyAutoWidth();
              return;
            }

            if (normalizedWidth.endsWith('%')) {
              applyWidthPercent(normalizedWidth.replace('%', ''));
              return;
            }

            var pixelWidth = parseFloat(normalizedWidth.replace('px', ''));

            if (!isFinite(pixelWidth) || pixelWidth <= 0) {
              return;
            }

            var nextPercent = (pixelWidth / editorRoot.clientWidth) * 100;
            applyWidthPercent(nextPercent);
          }

          function startResize(clientX) {
            if (!activeImage) {
              return;
            }

            dragState = {
              startX: clientX,
              startWidthPx: activeImage.getBoundingClientRect().width,
            };
          }

          function resizeFromPointer(clientX) {
            if (!dragState) {
              return;
            }

            var nextWidthPx = dragState.startWidthPx + (clientX - dragState.startX);
            var nextPercent = (nextWidthPx / editorRoot.clientWidth) * 100;
            applyWidthPercent(nextPercent, false);
          }

          function stopResize() {
            if (!dragState) {
              return;
            }

            dragState = null;
            emitEditorHtml();
          }

          editorRoot.addEventListener('click', function(event) {
            var target = event && event.target;

            if (target === resizeHandle) {
              return;
            }

            if (target && target.tagName === 'IMG') {
              selectImage(target);
              return;
            }

            clearActiveImage();
          });

          toolbar.addEventListener('click', function(event) {
            var target = event && event.target;

            if (!target || target.tagName !== 'BUTTON' || !activeImage) {
              return;
            }

            var presetValue = target.getAttribute('data-preset');

            if (presetValue === 'auto') {
              applyAutoWidth();
              return;
            }

            if (presetValue === 'custom') {
              applyCustomWidth();
              return;
            }

            applyWidthPercent(presetValue);
          });

          widthRangeInput.addEventListener('input', function(event) {
            if (!activeImage) {
              return;
            }

            applyWidthPercent(event.target.value);
          });

          widthNumberInput.addEventListener('change', function(event) {
            if (!activeImage) {
              return;
            }

            applyWidthPercent(event.target.value);
          });

          resizeHandle.addEventListener('mousedown', function(event) {
            event.preventDefault();
            event.stopPropagation();
            startResize(event.clientX);
          });

          resizeHandle.addEventListener('touchstart', function(event) {
            if (!event.touches || !event.touches.length) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();
            startResize(event.touches[0].clientX);
          }, { passive: false });

          document.addEventListener('mousemove', function(event) {
            resizeFromPointer(event.clientX);
          });

          document.addEventListener('mouseup', function() {
            stopResize();
          });

          document.addEventListener('touchmove', function(event) {
            if (!event.touches || !event.touches.length) {
              return;
            }

            event.preventDefault();
            resizeFromPointer(event.touches[0].clientX);
          }, { passive: false });

          document.addEventListener('touchend', function() {
            stopResize();
          });

          editorRoot.addEventListener('scroll', function() {
            positionResizeHandle();
          });

          window.addEventListener('resize', function() {
            syncActiveWidthPercent();
            positionResizeHandle();
          });

          window.__setEditorHtml = function(nextHtml) {
            if (typeof nextHtml !== 'string') return;

            var sanitizedHtml = sanitizeEditorHtml(nextHtml);

            if (quill.root.innerHTML !== sanitizedHtml) {
              quill.root.innerHTML = sanitizedHtml;
            }

            clearActiveImage();
          };

          quill.on('text-change', function() {
            emitEditorHtml();
            syncActiveWidthPercent();
            positionResizeHandle();
          });

          updateToolbarState();
        </script>
      </body>
    </html>
  `,
    []
  );

  useEffect(() => {
    const nextValue = value || '';
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
          const nextValue = value || '';
          pushEditorValueToWebView(nextValue);
        }}
        onMessage={(event) => {
          lastSyncedValueRef.current = event.nativeEvent.data || '';
          if (onChange) {
            onChange(event.nativeEvent.data);
          }
        }}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
      />
      <Text style={styles.tipText}>
        Tap an image to open resize tools, then use presets, slider, or drag corner handle.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 520,
    backgroundColor: 'transparent',
  },
  tipText: {
    marginTop: 6,
    fontSize: 12,
    color: '#5f705f',
    lineHeight: 16,
  },
});
