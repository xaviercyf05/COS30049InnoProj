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

  if (editor?.$?.html?.set) {
    editor.$.html.set(sanitizedHtml);
    return true;
  }

  const wysiwyg = editor?.$?.frameContext?.get('wysiwyg');

  if (!wysiwyg) {
    return false;
  }

  wysiwyg.innerHTML = sanitizedHtml;
  return true;
}

export default function RichEditor({ value, onChange }) {
  const hostRef = useRef(null);
  const editorRef = useRef(null);
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

  const editorOptions = useMemo(
    () => ({
      defaultTag: 'p',
      height: '320px',
      buttonList: EDITOR_BUTTON_LIST,
      imageResizing: true,
      imageFileInput: true,
      videoFileInput: false,
      resizingBar: false,
      defaultStyle:
        "font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 15px; color: #2f4a3d;",
    }),
    []
  );

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
        ...editorOptions,
        plugins: editorFactory.plugins || {},
      });
      editorRef.current = editor;
      setLoadState('ready');

      editor.onChange = (contents) => {
        if (isApplyingExternalValueRef.current) {
          return;
        }

        if (onChangeRef.current) {
          onChangeRef.current(sanitizeEditorHtml(contents));
        }
      };

      const initialContent = latestValueRef.current;
      if (initialContent) {
        isApplyingExternalValueRef.current = true;
        setEditorHtml(editor, initialContent);
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

      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, [editorOptions]);

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
          overflow: hidden;
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
          max-width: 100%;
          height: auto;
          border-radius: 8px;
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