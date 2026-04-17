import React, { useEffect, useRef } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

export default function RichEditor({ value, onChange }) {
  const containerRef = useRef(null);
  const quillRef = useRef(null);
  const isApplyingExternalValueRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || quillRef.current) {
      return;
    }

    quillRef.current = new Quill(containerRef.current, {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          ['blockquote', 'code-block'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['image', 'video'],
          ['clean'],
        ],
      },
    });

    if (value) {
      quillRef.current.root.innerHTML = value;
    }

    quillRef.current.on('text-change', () => {
      if (isApplyingExternalValueRef.current) {
        return;
      }

      const html = quillRef.current.root.innerHTML;
      if (onChange) {
        onChange(html);
      }
    });
  }, [onChange, value]);

  useEffect(() => {
    if (!quillRef.current) {
      return;
    }

    const nextValue = value || '';
    const currentValue = quillRef.current.root.innerHTML;

    if (currentValue === nextValue) {
      return;
    }

    isApplyingExternalValueRef.current = true;
    quillRef.current.root.innerHTML = nextValue;
    isApplyingExternalValueRef.current = false;
  }, [value]);

  return (
    <div className="editor-wrapper">
      <div ref={containerRef} />

      <style>{`
        .editor-wrapper .ql-toolbar {
          border: none !important;
          border-bottom: 1px solid #E6E6E6 !important;
          background: #fff;
        }

        .editor-wrapper .ql-container {
          border: none !important;
          border-top: none !important;
          min-height: 250px;
        }

        .editor-wrapper .ql-editor {
          min-height: 250px;
        }
      `}</style>
    </div>
  );
}
