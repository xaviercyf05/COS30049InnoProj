import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../node_modules/suneditor/dist/suneditor.min.js';
import '../node_modules/suneditor/dist/suneditor.min.css';
import '../node_modules/suneditor/dist/suneditor-contents.min.css';

const EDITOR_BUTTON_LIST = [
  ['undo', 'redo'],
  ['blockStyle', 'fontSize'],
  ['bold', 'italic', 'underline', 'strike', 'removeFormat'],
  ['fontColor', 'backgroundColor'],
  ['align', 'list', 'hr'],
  ['link', 'image', 'video', 'table'],
  ['codeView', 'showBlocks', 'fullScreen'],
];

function sanitizeEditorHtml(rawHtml) {
  return String(rawHtml || '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+="[^"]*"/gi, '')
    .replace(/\son[a-z]+='[^']*'/gi, '');
}

function parseYouTubeStartTime(rawValue) {
  const value = String(rawValue || '').trim();

  if (!value) {
    return null;
  }

  if (/^\d+$/.test(value)) {
    return value;
  }

  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);

  if (!match) {
    return null;
  }

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;

  return totalSeconds > 0 ? String(totalSeconds) : null;
}

function normalizeYouTubeEmbedSrc(src) {
  const rawSrc = String(src || '').trim();

  if (!rawSrc) {
    return rawSrc;
  }

  let url;

  try {
    url = new URL(rawSrc, 'https://www.youtube.com');
  } catch (_error) {
    return rawSrc;
  }

  const host = url.hostname.toLowerCase();
  const isYouTubeHost =
    host === 'youtube.com' ||
    host.endsWith('.youtube.com') ||
    host === 'youtu.be' ||
    host.endsWith('.youtu.be');

  if (!isYouTubeHost) {
    return rawSrc;
  }

  let videoId = '';

  if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
    videoId = url.pathname.replace(/^\//, '').split('/')[0];
  } else if (url.pathname.startsWith('/embed/')) {
    videoId = url.pathname.split('/')[2] || '';
  } else if (url.pathname.startsWith('/shorts/')) {
    videoId = url.pathname.split('/')[2] || '';
  } else if (url.pathname === '/watch') {
    videoId = url.searchParams.get('v') || '';
  }

  if (!videoId) {
    return rawSrc;
  }

  const embedUrl = new URL(`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`);
  const startTime = parseYouTubeStartTime(url.searchParams.get('t') || url.searchParams.get('start'));

  url.searchParams.forEach((value, key) => {
    if (['v', 'feature', 'ab_channel', 'si', 'list', 'index', 'pp', 't', 'start'].includes(key)) {
      return;
    }

    embedUrl.searchParams.set(key, value);
  });

  if (startTime) {
    embedUrl.searchParams.set('start', startTime);
  }

  return embedUrl.toString();
}

function normalizeVideoEmbedNode(mediaNode) {
  if (!mediaNode || mediaNode.tagName !== 'IFRAME') {
    return;
  }

  const currentSrc = mediaNode.getAttribute('src');
  const normalizedSrc = normalizeYouTubeEmbedSrc(currentSrc);

  if (normalizedSrc !== currentSrc) {
    mediaNode.setAttribute('src', normalizedSrc);
  }

  mediaNode.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  mediaNode.setAttribute('loading', 'lazy');
  mediaNode.setAttribute(
    'allow',
    'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
  );
  mediaNode.setAttribute('allowfullscreen', 'true');
}

function extractYouTubeIdFromSrc(src) {
  try {
    const url = new URL(src, 'https://www.youtube.com');
    const host = url.hostname.toLowerCase();
    if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
      return url.pathname.replace(/^\//, '').split('/')[0] || null;
    }

    if (url.pathname.startsWith('/embed/')) {
      return url.pathname.split('/')[2] || null;
    }

    if (url.pathname.startsWith('/shorts/')) {
      return url.pathname.split('/')[2] || null;
    }

    if (url.pathname === '/watch') {
      return url.searchParams.get('v') || null;
    }

    return null;
  } catch (_e) {
    return null;
  }
}

function createEditorPlaceholderForIframe(doc, iframeEl) {
  const src = iframeEl.getAttribute('src') || '';
  const id = extractYouTubeIdFromSrc(src);

  const placeholder = doc.createElement('div');
  placeholder.className = 'video-placeholder';
  placeholder.setAttribute('data-original-iframe', iframeEl.outerHTML);

  if (id) {
    const thumb = doc.createElement('img');
    thumb.src = `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
    thumb.alt = 'Video thumbnail';
    thumb.className = 'video-thumb';
    placeholder.appendChild(thumb);
  } else {
    // Generic fallback box
    placeholder.textContent = 'Video';
  }

  // Decorative play overlay
  const overlay = doc.createElement('div');
  overlay.className = 'video-play-overlay';
  overlay.innerHTML = '<svg viewBox="0 0 120 120" width="48" height="48" fill="rgba(255,255,255,0.95)"><path d="M40 30 L90 60 L40 90 Z"/></svg>';
  placeholder.appendChild(overlay);

  return placeholder;
}

function createLiveIframeFromPlaceholder(doc, placeholder) {
  const originalIframeMarkup = placeholder.getAttribute('data-original-iframe');

  if (!originalIframeMarkup) {
    return null;
  }

  const container = doc.createElement('div');
  container.innerHTML = originalIframeMarkup;
  const iframe = container.firstElementChild;

  if (!iframe || iframe.tagName !== 'IFRAME') {
    return null;
  }

  normalizeVideoEmbedNode(iframe);
  iframe.classList.add('video-live-iframe');
  return iframe;
}

function activateVideoPlaceholder(placeholder) {
  const wrapper = placeholder?.closest?.('.video-container');
  const parentDocument = placeholder?.ownerDocument;

  if (!wrapper || !parentDocument) {
    return false;
  }

  const liveIframe = createLiveIframeFromPlaceholder(parentDocument, placeholder);

  if (!liveIframe) {
    return false;
  }

  wrapper.classList.add('video-container--active');
  wrapper.replaceChild(liveIframe, placeholder);
  return true;
}

function restorePlaceholdersToIframes(html) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(html || ''), 'text/html');
    const placeholders = Array.from(doc.querySelectorAll('div.video-placeholder'));

    placeholders.forEach((ph) => {
      const orig = ph.getAttribute('data-original-iframe');
      if (orig) {
        const container = doc.createElement('div');
        container.innerHTML = orig;
        const iframe = container.firstElementChild;
        if (iframe) {
          ph.parentNode.replaceChild(iframe, ph);
        }
      }
    });

    return doc.body.innerHTML;
  } catch (_e) {
    return String(html || '');
  }
}

function prepareHtmlForEditor(rawHtml) {
  try {
    const html = String(rawHtml || '');
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    doc.querySelectorAll('img').forEach((img) => {
      const styleText = img.getAttribute('style') || '';
      const styleWidth = styleText.match(/width:\s*([^;]+)/i)?.[1];
      const widthAttr = img.getAttribute('width');
      const widthValue = styleWidth || (widthAttr && /^\d+$/.test(widthAttr) ? `${widthAttr}px` : widthAttr);

      if (widthValue && widthValue !== 'auto' && widthValue !== '100%') {
        img.style.width = widthValue;
      }

      img.style.maxWidth = 'none';
      img.style.height = 'auto';
    });

    doc.querySelectorAll('iframe, video, embed').forEach((mediaNode) => {
      // Normalize iframe src/attrs first
      normalizeVideoEmbedNode(mediaNode);

      const parent = mediaNode.parentElement;
      if (parent && parent.classList && parent.classList.contains('video-container')) {
        return;
      }

      const wrapper = doc.createElement('div');
      wrapper.className = 'video-container';

      const styleText = mediaNode.getAttribute('style') || '';
      const styleWidth = styleText.match(/width:\s*([^;]+)/i)?.[1];
      const styleHeight = styleText.match(/height:\s*([^;]+)/i)?.[1];
      const widthAttr = mediaNode.getAttribute('width');
      const heightAttr = mediaNode.getAttribute('height');
      const widthValue = styleWidth || (widthAttr && /^\d+$/.test(widthAttr) ? `${widthAttr}px` : widthAttr);
      const heightValue = styleHeight || (heightAttr && /^\d+$/.test(heightAttr) ? `${heightAttr}px` : heightAttr);

      if (widthValue && widthValue !== 'auto' && widthValue !== '100%') {
        wrapper.style.width = widthValue;
      }

      if (heightValue && heightValue !== 'auto' && heightValue !== '100%') {
        wrapper.style.paddingBottom = '0';
        wrapper.style.height = heightValue;
      }

      // Replace the live iframe with an editor-only placeholder so the editor retains control
      let appendNode = mediaNode;
      if (mediaNode.tagName === 'IFRAME') {
        try {
          appendNode = createEditorPlaceholderForIframe(doc, mediaNode);
        } catch (_err) {
          appendNode = mediaNode;
        }
      }

      mediaNode.parentNode.insertBefore(wrapper, mediaNode);
      wrapper.appendChild(appendNode);
      if (appendNode !== mediaNode) {
        // keep original iframe stored on placeholder via data-original-iframe
      }
    });

    return doc.body.innerHTML;
  } catch (_e) {
    return String(rawHtml || '');
  }
}

function resolveSunEditorInstance() {
  const candidate = typeof window !== 'undefined' ? window.SUNEDITOR : globalThis.SUNEDITOR;

  if (candidate && typeof candidate.create === 'function') {
    return candidate;
  }

  return null;
}

function getEditorHtml(editor) {
  if (editor?.$?.html?.get) {
    return editor.$.html.get();
  }

  return editor?.$?.frameContext?.get('wysiwyg')?.innerHTML || '';
}

function setEditorHtml(editor, html) {
  const sanitizedHtml = sanitizeEditorHtml(html) || '<p><br></p>';
  const preparedHtml = prepareHtmlForEditor(sanitizedHtml) || sanitizedHtml;

  if (editor?.$?.html?.set) {
    editor.$.html.set(preparedHtml);
    return true;
  }

  const wysiwyg = editor?.$?.frameContext?.get('wysiwyg');

  if (!wysiwyg) {
    return false;
  }

  wysiwyg.innerHTML = preparedHtml;
  return true;
}

export default function RichEditor({ value, onChange }) {
  const hostRef = useRef(null);
  const editorRef = useRef(null);
  const editorObserverRef = useRef(null);
  const editorInteractionCleanupRef = useRef(null);
  const initialMediaSyncTimeoutRef = useRef(null);
  const valueMediaSyncTimeoutRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const isApplyingExternalValueRef = useRef(false);
  const latestValueRef = useRef(sanitizeEditorHtml(value));
  const [loadState, setLoadState] = useState('loading');

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    latestValueRef.current = sanitizeEditorHtml(value);
  }, [value]);

  const emitEditorContentChange = (contents) => {
    const restored = restorePlaceholdersToIframes(contents);
    const sanitized = sanitizeEditorHtml(restored);

    if (isApplyingExternalValueRef.current) {
      return;
    }

    if (sanitized === latestValueRef.current) {
      return;
    }

    latestValueRef.current = sanitized;

    if (onChangeRef.current) {
      onChangeRef.current(sanitized);
    }
  };

  const clearPendingMediaSync = (timeoutRef) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    if (!hostRef.current || editorRef.current) {
      return undefined;
    }

    setLoadState('loading');

    try {
      const editorFactory = resolveSunEditorInstance();

      if (!editorFactory) {
        setLoadState('error');
        return undefined;
      }

      const editor = editorFactory.create(hostRef.current, {
        defaultTag: 'p',
        height: '320px',
        buttonList: EDITOR_BUTTON_LIST,
        imageResizing: true,
        imageFileInput: true,
        videoFileInput: false,
        resizingBar: false,
        imageSizeUnit: '%',
        defaultStyle:
          "font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 15px; color: #2f4a3d;",
        onChange: (contents) => {
          emitEditorContentChange(contents);
        },
        plugins: editorFactory.plugins || {},
      });
      editorRef.current = editor;
      setLoadState('ready');

      const syncTarget = editor?.$?.frameContext?.get?.('wysiwyg') || null;

      if (syncTarget && typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(() => {
          emitEditorContentChange(getEditorHtml(editor));
        });

        observer.observe(syncTarget, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
        });

        editorObserverRef.current = observer;
      }

      if (syncTarget) {
        const handleVideoPreviewClick = (event) => {
          const placeholder = event.target?.closest?.('.video-placeholder');

          if (!placeholder || !syncTarget.contains(placeholder)) {
            return;
          }

          if (activateVideoPlaceholder(placeholder)) {
            event.preventDefault();
            event.stopPropagation();
            emitEditorContentChange(getEditorHtml(editor));
          }
        };

        syncTarget.addEventListener('click', handleVideoPreviewClick, true);
        syncTarget.addEventListener('pointerdown', handleVideoPreviewClick, true);

        editorInteractionCleanupRef.current = () => {
          syncTarget.removeEventListener('click', handleVideoPreviewClick, true);
          syncTarget.removeEventListener('pointerdown', handleVideoPreviewClick, true);
        };
      }

      try {
        editor.onChange = (contents) => {
          emitEditorContentChange(contents);
        };
      } catch (_err) {
        // Ignore if assignment not supported
      }

      const initialContent = latestValueRef.current;
      if (initialContent) {
        isApplyingExternalValueRef.current = true;
        setEditorHtml(editor, initialContent);
        clearPendingMediaSync(initialMediaSyncTimeoutRef);
        
        // Extract and reapply image widths and video dimensions after SunEditor renders
        initialMediaSyncTimeoutRef.current = setTimeout(() => {
          try {
            if (!editorRef.current || editorRef.current !== editor) {
              return;
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(initialContent, 'text/html');
            const savedImgs = Array.from(doc.querySelectorAll('img'));
            const savedVideos = Array.from(doc.querySelectorAll('iframe, video, embed'));
            
            const wysiwyg = editor?.$?.frameContext?.get('wysiwyg');
            if (wysiwyg) {
              // Reapply image widths
              if (savedImgs.length > 0) {
                const editorImgs = Array.from(wysiwyg.querySelectorAll('img'));
                
                editorImgs.forEach((editorImg, idx) => {
                  const savedImg = savedImgs[idx];
                  if (savedImg) {
                    // Extract width from inline style or width attribute
                    let savedWidth = savedImg.getAttribute('style') ? 
                      savedImg.getAttribute('style').match(/width:\s*([^;]+)/i)?.[1] : null;
                    
                    if (!savedWidth) {
                      const widthAttr = savedImg.getAttribute('width');
                      if (widthAttr) {
                        savedWidth = /^\d+$/.test(widthAttr) ? `${widthAttr}px` : widthAttr;
                      }
                    }
                    
                    if (savedWidth && savedWidth.trim() && savedWidth !== 'auto' && savedWidth !== '100%') {
                      console.log(`[RichEditor] Applying width "${savedWidth}" to image ${idx}`);
                      editorImg.style.width = savedWidth;
                      editorImg.style.maxWidth = 'none';
                      editorImg.style.height = 'auto';
                    }
                  }
                });
              }
              
            }
          } catch (err) {
            console.warn('[RichEditor] Error applying media dimensions:', err);
          }
        }, 200);
        
        isApplyingExternalValueRef.current = false;
      }
    } catch (error) {
      console.error('SunEditor failed to initialize:', error);
      if (isMounted) {
        setLoadState('error');
      }
    }

    return () => {
      isMounted = false;
      clearPendingMediaSync(initialMediaSyncTimeoutRef);
      clearPendingMediaSync(valueMediaSyncTimeoutRef);

      if (editorObserverRef.current) {
        editorObserverRef.current.disconnect();
        editorObserverRef.current = null;
      }

      if (editorInteractionCleanupRef.current) {
        editorInteractionCleanupRef.current();
        editorInteractionCleanupRef.current = null;
      }

      const editor = editorRef.current;
      editorRef.current = null;

      if (editor) {
        editor.destroy();
      }
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    const nextContent = sanitizeEditorHtml(value);
    const currentContent = sanitizeEditorHtml(getEditorHtml(editor));

    if (nextContent === currentContent) {
      return;
    }

    isApplyingExternalValueRef.current = true;
    setEditorHtml(editor, nextContent);
    clearPendingMediaSync(valueMediaSyncTimeoutRef);
    
    // Reapply image widths and video dimensions after content updates
    valueMediaSyncTimeoutRef.current = setTimeout(() => {
      try {
        if (!editorRef.current || editorRef.current !== editor) {
          return;
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(nextContent, 'text/html');
        const savedImgs = Array.from(doc.querySelectorAll('img'));
        const savedVideos = Array.from(doc.querySelectorAll('iframe, video, embed'));
        
        const wysiwyg = editor?.$?.frameContext?.get('wysiwyg');
        if (wysiwyg) {
          // Reapply image widths
          if (savedImgs.length > 0) {
            const editorImgs = Array.from(wysiwyg.querySelectorAll('img'));
            
            editorImgs.forEach((editorImg, idx) => {
              const savedImg = savedImgs[idx];
              if (savedImg) {
                // Extract width from inline style or width attribute
                let savedWidth = savedImg.getAttribute('style') ? 
                  savedImg.getAttribute('style').match(/width:\s*([^;]+)/i)?.[1] : null;
                
                if (!savedWidth) {
                  const widthAttr = savedImg.getAttribute('width');
                  if (widthAttr) {
                    savedWidth = /^\d+$/.test(widthAttr) ? `${widthAttr}px` : widthAttr;
                  }
                }
                
                if (savedWidth && savedWidth.trim() && savedWidth !== 'auto' && savedWidth !== '100%') {
                  editorImg.style.width = savedWidth;
                  editorImg.style.maxWidth = 'none';
                  editorImg.style.height = 'auto';
                }
              }
            });
          }
          
        }
      } catch (err) {
        console.warn('[RichEditor] Error applying media dimensions on value change:', err);
      }
    }, 200);
    
    isApplyingExternalValueRef.current = false;
  }, [value]);

  return (
    <div className="rich-editor-shell">
      <div className="editor-host" ref={hostRef} />

      {loadState !== 'ready' ? (
        <div className={`editor-status ${loadState}`}>
          {loadState === 'error'
            ? 'Unable to load the rich editor. Check your network connection.'
            : 'Loading rich editor...'}
        </div>
      ) : null}
      <style>{`
        .rich-editor-shell .editor-host {
          min-height: 320px;
        }

        .rich-editor-shell .editor-status {
          margin: 8px 2px 0;
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 12px;
          line-height: 1.4;
          color: #2f4a3d;
          background: #f7fbf3;
          border: 1px dashed #dce7d3;
        }

        .rich-editor-shell .editor-status.error {
          color: #7a2b2b;
          background: #fff3f3;
          border-color: #f2c9c9;
        }

        .rich-editor-shell .sun-editor {
          border: 1px solid #dce7d3;
          border-radius: 12px;
          overflow: visible;
          background: #ffffff;
          box-shadow: 0 2px 8px rgba(46, 107, 77, 0.08);
        }

        .rich-editor-shell .sun-editor .se-toolbar {
          border-bottom: 1px solid #dce7d3;
          background: linear-gradient(180deg, #f7fbf3 0%, #edf6e5 100%);
          padding: 8px;
        }

        .rich-editor-shell .sun-editor .se-btn {
          border-radius: 8px;
          color: #315643;
          transition: background-color 0.15s ease;
        }

        .rich-editor-shell .sun-editor .se-btn:enabled:hover {
          background: #e5f0dd;
        }

        .rich-editor-shell .sun-editor .se-btn:enabled.active {
          background: #88a170;
          color: #ffffff;
        }

        .rich-editor-shell .sun-editor .se-list-layer,
        .rich-editor-shell .sun-editor .se-dialog {
          border: 1px solid #dce7d3;
          border-radius: 10px;
          box-shadow: 0 10px 30px rgba(34, 62, 47, 0.16);
        }

        .rich-editor-shell .sun-editor .se-wrapper {
          min-height: 260px;
          max-height: 380px;
        }

        .rich-editor-shell .sun-editor .se-wrapper-inner {
          min-height: 260px;
          max-height: 380px;
          background: #ffffff;
          color: #2f4a3d;
        }

        .rich-editor-shell .sun-editor .sun-editor-editable {
          font-size: 15px;
          line-height: 1.65;
        }

        .rich-editor-shell .sun-editor .sun-editor-editable img {
          border-radius: 8px;
        }
        .rich-editor-shell .sun-editor .sun-editor-editable img {
          border-radius: 8px;
        }

        .rich-editor-shell .sun-editor .sun-editor-editable img[style*="width"] {
          max-width: none !important;
        }

        .rich-editor-shell .sun-editor .sun-editor-editable iframe,
        .rich-editor-shell .sun-editor .sun-editor-editable video,
        .rich-editor-shell .sun-editor .sun-editor-editable embed {
          border-radius: 8px;
          min-height: 360px;
        }

        .rich-editor-shell .sun-editor .sun-editor-editable iframe[style*="width"],
        .rich-editor-shell .sun-editor .sun-editor-editable video[style*="width"],
        .rich-editor-shell .sun-editor .sun-editor-editable embed[style*="width"] {
          max-width: none !important;
        }

        .rich-editor-shell .sun-editor .sun-editor-editable .video-container {
          position: relative;
          width: 100%;
          padding-bottom: 56.25%;
          height: 0;
          overflow: hidden;
        }

        .rich-editor-shell .sun-editor .sun-editor-editable .video-container iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          min-height: unset;
          border-radius: 8px;
          pointer-events: none;
        }

        .rich-editor-shell .sun-editor .sun-editor-editable .video-container--active iframe {
          pointer-events: auto;
          width: 100% !important;
          height: 100% !important;
          min-width: 0 !important;
          min-height: 0 !important;
          max-width: none !important;
          max-height: none !important;
        }

        .rich-editor-shell .sun-editor .sun-editor-editable .video-container .video-placeholder {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: block;
          cursor: pointer;
        }

        .rich-editor-shell .sun-editor .sun-editor-editable .video-container .video-placeholder img {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          margin: auto;
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          background: #000;
          display: block;
        }

        .rich-editor-shell .sun-editor .sun-editor-editable .video-container .video-play-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .rich-editor-shell .sun-editor .sun-editor-editable .video-container .video-play-overlay,
        .rich-editor-shell .sun-editor .sun-editor-editable .video-container .video-placeholder {
          pointer-events: auto;
        }

        .rich-editor-shell .sun-editor .se-resizing-container .se-resize-dot > span.tl,
        .rich-editor-shell .sun-editor .se-resizing-container .se-resize-dot > span.tr,
        .rich-editor-shell .sun-editor .se-resizing-container .se-resize-dot > span.bl,
        .rich-editor-shell .sun-editor .se-resizing-container .se-resize-dot > span.br {
          width: 10px;
          height: 10px;
        }

        .rich-editor-shell .sun-editor .se-resizing-bar {
          border-top: 1px solid #dce7d3;
          background: #f7fbf3;
        }

        .rich-editor-shell .editor-tip {
          margin: 8px 2px 0;
          color: #5f705f;
          font-size: 12px;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}