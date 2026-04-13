import React, { useEffect, useRef } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

export default function RichEditor({ value, onChange }) {
  const containerRef = useRef(null);
  const quillRef = useRef(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (containerRef.current && !quillRef.current) {
      quillRef.current = new Quill(containerRef.current, {
        theme: 'snow',
        modules: {
            toolbar: [
            [{ header: [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'], // Added 'strike'
            ['blockquote', 'code-block'],              // Added Quote and Code
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
        const html = quillRef.current.root.innerHTML;
        if (onChange) onChange(html);
      });

      isInitialized.current = true;
    }
  }, []);

  return (
    <div style={{ backgroundColor: 'white' }}>
      <div ref={containerRef} style={{ minHeight: '250px' }} />
    </div>
  );
}