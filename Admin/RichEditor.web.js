import React, { useEffect, useRef } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

export default function RichEditor({ value, onChange }) {
  const containerRef = useRef(null);
  const quillRef = useRef(null);

  useEffect(() => {
    if (containerRef.current && !quillRef.current) {
      quillRef.current = new Quill(containerRef.current, {
        theme: 'snow',
        modules: {
          toolbar: [
            [{ header: [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            ['blockquote', 'code-block'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['image', 'video'],
            ['clean']
          ]
        }
      });

      if (value) {
        quillRef.current.root.innerHTML = value;
      }

      quillRef.current.on('text-change', () => {
        const html = quillRef.current.root.innerHTML;
        if (onChange) onChange(html);
      });
    }
  }, []);

  return (
    <div className="editor-wrapper">

      <div ref={containerRef} />

      {/* ⭐ IMPORTANT: scoped styling */}
      <style>{`
        .editor-wrapper .ql-toolbar {
          border: none !important;
          border-bottom: 1px solid #E6E6E6 !important;
          border-top-left-radius: 0;
          border-top-right-radius: 0;
          background: #fff;
        }

        .editor-wrapper .ql-container {
          border: none !important;
          border-top: none !important;
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
          min-height: 250px;
        }

        .editor-wrapper .ql-editor {
          min-height: 250px;
        }
      `}</style>

    </div>
  );
}