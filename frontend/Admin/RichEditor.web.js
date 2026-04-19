import React, { useEffect, useRef, useState } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

const MIN_WIDTH_PERCENT = 10;
const MAX_WIDTH_PERCENT = 100;
const MIN_IMAGE_DIMENSION_PX = 24;
const MAX_IMAGE_DIMENSION_PX = 2400;
const PRESET_IMAGE_WIDTHS = [
  { label: 'Small', value: 30 },
  { label: 'Medium', value: 50 },
  { label: 'Large', value: 75 },
  { label: 'Full', value: 100 },
];

function clampWidthPercent(value) {
  const numericValue = Number.parseFloat(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Math.min(MAX_WIDTH_PERCENT, Math.max(MIN_WIDTH_PERCENT, Math.round(numericValue)));
}

function clampImageDimensionPx(value) {
  const numericValue = Number.parseFloat(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Math.min(
    MAX_IMAGE_DIMENSION_PX,
    Math.max(MIN_IMAGE_DIMENSION_PX, Math.round(numericValue))
  );
}

function normalizeImageWidthInput(rawInput) {
  const normalized = String(rawInput || '').trim();

  if (!normalized) {
    return '';
  }

  const widthMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*(px|%)?$/i);

  if (!widthMatch) {
    return null;
  }

  const numericWidth = Number.parseFloat(widthMatch[1]);

  if (!Number.isFinite(numericWidth) || numericWidth <= 0) {
    return null;
  }

  const widthUnit = (widthMatch[2] || 'px').toLowerCase();

  if (widthUnit === '%') {
    return `${Math.min(100, Math.max(1, Math.round(numericWidth)))}%`;
  }

  return `${Math.round(numericWidth)}px`;
}

function parseImageWidthPercent(imageElement, editorWidth) {
  if (!imageElement || !editorWidth) {
    return null;
  }

  const inlineWidth = String(imageElement.style.width || '').trim();

  if (inlineWidth.endsWith('%')) {
    const parsedPercent = clampWidthPercent(inlineWidth.replace('%', ''));
    return parsedPercent;
  }

  const imagePixelWidth = imageElement.getBoundingClientRect().width;

  if (!Number.isFinite(imagePixelWidth) || imagePixelWidth <= 0) {
    return null;
  }

  return clampWidthPercent((imagePixelWidth / editorWidth) * 100);
}

function sanitizeEditorHtml(rawHtml) {
  const normalizedHtml = typeof rawHtml === 'string' ? rawHtml : '';

  if (!normalizedHtml || typeof document === 'undefined') {
    return normalizedHtml;
  }

  const scratch = document.createElement('div');
  scratch.innerHTML = normalizedHtml;

  scratch.querySelectorAll('.image-resize-handle').forEach((node) => {
    node.remove();
  });

  scratch.querySelectorAll('img.image-selected').forEach((imageNode) => {
    imageNode.classList.remove('image-selected');
  });

  return scratch.innerHTML;
}

export default function RichEditor({ value, onChange }) {
  const containerRef = useRef(null);
  const quillRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const editorRootRef = useRef(null);
  const resizeHandleRef = useRef(null);
  const selectedImageRef = useRef(null);
  const dragStateRef = useRef(null);
  const isApplyingExternalValueRef = useRef(false);
  const [selectedImagePercent, setSelectedImagePercent] = useState(null);
  const [selectedImageWidthPx, setSelectedImageWidthPx] = useState(null);
  const [selectedImageHeightPx, setSelectedImageHeightPx] = useState(null);

  const hasSelectedImage =
    Number.isFinite(selectedImageWidthPx) && Number.isFinite(selectedImageHeightPx);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const emitEditorHtml = () => {
    if (quillRef.current && onChangeRef.current) {
      onChangeRef.current(sanitizeEditorHtml(quillRef.current.root.innerHTML));
    }
  };

  const clearSelectedImageHighlight = () => {
    if (selectedImageRef.current) {
      selectedImageRef.current.classList.remove('image-selected');
    }
  };

  const hideResizeHandle = () => {
    if (resizeHandleRef.current) {
      resizeHandleRef.current.style.display = 'none';
    }
  };

  const positionResizeHandle = () => {
    const selectedImage = selectedImageRef.current;
    const resizeHandle = resizeHandleRef.current;
    const editorRoot = editorRootRef.current;

    if (!selectedImage || !resizeHandle || !editorRoot) {
      hideResizeHandle();
      return;
    }

    const imageRect = selectedImage.getBoundingClientRect();
    const editorRect = editorRoot.getBoundingClientRect();

    const left =
      imageRect.left - editorRect.left + editorRoot.scrollLeft + imageRect.width - 8;
    const top =
      imageRect.top - editorRect.top + editorRoot.scrollTop + imageRect.height - 8;

    resizeHandle.style.left = `${Math.max(0, left)}px`;
    resizeHandle.style.top = `${Math.max(0, top)}px`;
    resizeHandle.style.display = 'block';
  };

  const syncSelectedImageMetrics = () => {
    const selectedImage = selectedImageRef.current;
    const editorRoot = editorRootRef.current;

    if (!selectedImage || !editorRoot) {
      setSelectedImagePercent(null);
      setSelectedImageWidthPx(null);
      setSelectedImageHeightPx(null);
      return;
    }

    const parsedPercent = parseImageWidthPercent(selectedImage, editorRoot.clientWidth);
    const renderedRect = selectedImage.getBoundingClientRect();

    setSelectedImagePercent(parsedPercent);
    setSelectedImageWidthPx(clampImageDimensionPx(renderedRect.width));
    setSelectedImageHeightPx(clampImageDimensionPx(renderedRect.height));
  };

  const clearSelectedImage = () => {
    clearSelectedImageHighlight();
    selectedImageRef.current = null;
    hideResizeHandle();
    setSelectedImagePercent(null);
    setSelectedImageWidthPx(null);
    setSelectedImageHeightPx(null);
  };

  const selectImage = (imageElement) => {
    if (!imageElement || imageElement.tagName !== 'IMG') {
      clearSelectedImage();
      return;
    }

    if (selectedImageRef.current && selectedImageRef.current !== imageElement) {
      selectedImageRef.current.classList.remove('image-selected');
    }

    selectedImageRef.current = imageElement;
    selectedImageRef.current.classList.add('image-selected');
    selectedImageRef.current.style.maxWidth = '100%';
    selectedImageRef.current.style.height = 'auto';
    selectedImageRef.current.style.objectFit = 'contain';
    selectedImageRef.current.removeAttribute('width');
    selectedImageRef.current.removeAttribute('height');

    syncSelectedImageMetrics();
    positionResizeHandle();
  };

  const applyWidthPercent = (rawPercent, shouldEmit = true) => {
    const selectedImage = selectedImageRef.current;

    if (!selectedImage) {
      return;
    }

    const clampedPercent = clampWidthPercent(rawPercent);

    if (clampedPercent === null) {
      return;
    }

    selectedImage.style.width = `${clampedPercent}%`;
    selectedImage.style.maxWidth = '100%';
    selectedImage.style.height = 'auto';
    selectedImage.style.objectFit = 'contain';
    selectedImage.removeAttribute('width');
    selectedImage.removeAttribute('height');

    syncSelectedImageMetrics();
    positionResizeHandle();

    if (shouldEmit) {
      emitEditorHtml();
    }
  };

  const applyAutoWidth = () => {
    const selectedImage = selectedImageRef.current;

    if (!selectedImage) {
      return;
    }

    selectedImage.style.width = '';
    selectedImage.style.maxWidth = '100%';
    selectedImage.style.height = 'auto';
    selectedImage.style.objectFit = 'contain';
    selectedImage.removeAttribute('width');
    selectedImage.removeAttribute('height');

    syncSelectedImageMetrics();
    positionResizeHandle();
    emitEditorHtml();
  };

  const applyWidthPx = (rawWidthPx, shouldEmit = true) => {
    const editorRoot = editorRootRef.current;

    if (!editorRoot || editorRoot.clientWidth <= 0) {
      return;
    }

    const clampedWidthPx = clampImageDimensionPx(rawWidthPx);

    if (clampedWidthPx === null) {
      return;
    }

    const nextPercent = (clampedWidthPx / editorRoot.clientWidth) * 100;
    applyWidthPercent(nextPercent, shouldEmit);
  };

  const applyHeightPx = (rawHeightPx, shouldEmit = true) => {
    const selectedImage = selectedImageRef.current;

    if (!selectedImage) {
      return;
    }

    const clampedHeightPx = clampImageDimensionPx(rawHeightPx);

    if (clampedHeightPx === null) {
      return;
    }

    const naturalWidth = selectedImage.naturalWidth || selectedImage.getBoundingClientRect().width;
    const naturalHeight =
      selectedImage.naturalHeight || selectedImage.getBoundingClientRect().height;

    if (!Number.isFinite(naturalWidth) || !Number.isFinite(naturalHeight) || naturalHeight <= 0) {
      return;
    }

    const aspectRatio = naturalWidth / naturalHeight;
    applyWidthPx(clampedHeightPx * aspectRatio, shouldEmit);
  };

  const applyCustomWidth = () => {
    const selectedImage = selectedImageRef.current;

    if (!selectedImage) {
      return;
    }

    const currentWidth = selectedImage.style.width || '';
    const nextWidthInput = window.prompt(
      'Set image width (e.g., 320px or 70%). Leave blank to reset.',
      currentWidth
    );

    if (nextWidthInput === null) {
      return;
    }

    const normalizedWidth = normalizeImageWidthInput(nextWidthInput);

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

    const editorRoot = editorRootRef.current;

    if (!editorRoot) {
      return;
    }

    const pixelWidth = Number.parseFloat(normalizedWidth.replace('px', ''));

    if (!Number.isFinite(pixelWidth) || pixelWidth <= 0) {
      return;
    }

    const nextPercent = (pixelWidth / editorRoot.clientWidth) * 100;
    applyWidthPercent(nextPercent);
  };

  const normalizeRenderedImages = (shouldEmit = false) => {
    const editorRoot = editorRootRef.current;

    if (!editorRoot) {
      return;
    }

    let didChange = false;
    const imageNodes = editorRoot.querySelectorAll('img');

    imageNodes.forEach((imageNode) => {
      imageNode.style.maxWidth = '100%';
      imageNode.style.height = 'auto';
      imageNode.style.objectFit = 'contain';

      const inlineWidth = String(imageNode.style.width || '').trim();
      const hasWidthAttribute = imageNode.hasAttribute('width');
      const hasHeightAttribute = imageNode.hasAttribute('height');

      if (hasWidthAttribute) {
        imageNode.removeAttribute('width');
        didChange = true;
      }

      if (hasHeightAttribute) {
        imageNode.removeAttribute('height');
        didChange = true;
      }

      if (!inlineWidth && !hasWidthAttribute) {
        imageNode.style.width = '60%';
        didChange = true;
      }
    });

    if (shouldEmit && didChange && !isApplyingExternalValueRef.current) {
      emitEditorHtml();
    }
  };

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
      quillRef.current.root.innerHTML = sanitizeEditorHtml(value);
    }

    const editorRoot = quillRef.current.root;
    editorRoot.style.position = 'relative';
    editorRootRef.current = editorRoot;

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'image-resize-handle';
    resizeHandle.style.display = 'none';
    resizeHandleRef.current = resizeHandle;
    editorRoot.appendChild(resizeHandle);

    normalizeRenderedImages(false);

    const startResize = (clientX) => {
      const selectedImage = selectedImageRef.current;

      if (!selectedImage) {
        return;
      }

      dragStateRef.current = {
        startX: clientX,
        startWidthPx: selectedImage.getBoundingClientRect().width,
      };
    };

    const resizeFromPointer = (clientX) => {
      const dragState = dragStateRef.current;
      const editorRootNode = editorRootRef.current;

      if (!dragState || !editorRootNode) {
        return;
      }

      const nextWidthPx = dragState.startWidthPx + (clientX - dragState.startX);
      const nextPercent = (nextWidthPx / editorRootNode.clientWidth) * 100;
      applyWidthPercent(nextPercent, false);
    };

    const stopResize = () => {
      if (!dragStateRef.current) {
        return;
      }

      dragStateRef.current = null;
      emitEditorHtml();
    };

    const handleEditorClick = (event) => {
      const target = event?.target;

      if (target === resizeHandleRef.current) {
        return;
      }

      if (target && target.tagName === 'IMG') {
        selectImage(target);
        return;
      }

      clearSelectedImage();
    };

    const handleMouseDown = (event) => {
      event.preventDefault();
      event.stopPropagation();
      startResize(event.clientX);
    };

    const handleTouchStart = (event) => {
      if (!event.touches?.length) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      startResize(event.touches[0].clientX);
    };

    const handleMouseMove = (event) => {
      resizeFromPointer(event.clientX);
    };

    const handleTouchMove = (event) => {
      if (!event.touches?.length) {
        return;
      }

      event.preventDefault();
      resizeFromPointer(event.touches[0].clientX);
    };

    const handleWindowResize = () => {
      syncSelectedImageMetrics();
      positionResizeHandle();
    };

    editorRoot.addEventListener('click', handleEditorClick);
    editorRoot.addEventListener('scroll', positionResizeHandle);
    resizeHandle.addEventListener('mousedown', handleMouseDown);
    resizeHandle.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResize);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', stopResize);
    window.addEventListener('resize', handleWindowResize);

    quillRef.current.on('text-change', () => {
      if (isApplyingExternalValueRef.current) {
        return;
      }

      emitEditorHtml();
      positionResizeHandle();
      syncSelectedImageMetrics();
      normalizeRenderedImages(false);
    });

    return () => {
      editorRoot.removeEventListener('click', handleEditorClick);
      editorRoot.removeEventListener('scroll', positionResizeHandle);
      resizeHandle.removeEventListener('mousedown', handleMouseDown);
      resizeHandle.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopResize);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', stopResize);
      window.removeEventListener('resize', handleWindowResize);
      clearSelectedImageHighlight();
      resizeHandle.remove();

      selectedImageRef.current = null;
      dragStateRef.current = null;
      resizeHandleRef.current = null;
      editorRootRef.current = null;
      quillRef.current = null;

      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  useEffect(() => {
    if (!quillRef.current) {
      return;
    }

    const nextValue = sanitizeEditorHtml(value || '');
    const currentValue = sanitizeEditorHtml(quillRef.current.root.innerHTML);

    if (currentValue === nextValue) {
      return;
    }

    isApplyingExternalValueRef.current = true;
    quillRef.current.root.innerHTML = nextValue;
    isApplyingExternalValueRef.current = false;
    normalizeRenderedImages(false);
    clearSelectedImage();
  }, [value]);

  return (
    <div className="editor-wrapper">
      <div className="image-tools-panel">
        <div className="image-tools-row">
          {PRESET_IMAGE_WIDTHS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={!hasSelectedImage}
              className={`size-chip ${selectedImagePercent === preset.value ? 'active' : ''}`}
              onClick={() => applyWidthPercent(preset.value)}
            >
              {preset.label}
            </button>
          ))}

          <button
            type="button"
            disabled={!hasSelectedImage}
            className="size-chip"
            onClick={applyAutoWidth}
          >
            Auto
          </button>

          <button
            type="button"
            disabled={!hasSelectedImage}
            className="size-chip"
            onClick={applyCustomWidth}
          >
            Custom
          </button>
        </div>

        <div className="image-tools-row image-tools-slider-row">
          <span className="slider-label">Scale</span>
          <input
            type="range"
            min={MIN_WIDTH_PERCENT}
            max={MAX_WIDTH_PERCENT}
            value={hasSelectedImage ? (selectedImagePercent ?? 50) : 50}
            disabled={!hasSelectedImage}
            onChange={(event) => applyWidthPercent(event.target.value)}
          />
          <input
            type="number"
            min={MIN_WIDTH_PERCENT}
            max={MAX_WIDTH_PERCENT}
            value={hasSelectedImage ? (selectedImagePercent ?? '') : ''}
            disabled={!hasSelectedImage}
            onChange={(event) => applyWidthPercent(event.target.value)}
          />
          <span className="slider-suffix">%</span>
        </div>

        <div className="image-tools-row image-tools-dimension-row">
          <span className="slider-label">W</span>
          <input
            type="number"
            min={MIN_IMAGE_DIMENSION_PX}
            max={MAX_IMAGE_DIMENSION_PX}
            value={hasSelectedImage ? selectedImageWidthPx : ''}
            disabled={!hasSelectedImage}
            onChange={(event) => applyWidthPx(event.target.value)}
          />
          <span className="slider-suffix">px</span>

          <span className="slider-label">H</span>
          <input
            type="number"
            min={MIN_IMAGE_DIMENSION_PX}
            max={MAX_IMAGE_DIMENSION_PX}
            value={hasSelectedImage ? selectedImageHeightPx : ''}
            disabled={!hasSelectedImage}
            onChange={(event) => applyHeightPx(event.target.value)}
          />
          <span className="slider-suffix">px</span>
        </div>

        <div className="image-tools-meta">
          {hasSelectedImage
            ? 'Tip: width and height stay in proportion to avoid stretching.'
            : 'Click an image in the editor to open resize tools.'}
        </div>
      </div>

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
          max-height: 380px;
        }

        .editor-wrapper .ql-editor {
          min-height: 250px;
          max-height: 380px;
          position: relative;
        }

        .editor-wrapper .ql-editor img {
          max-width: 100%;
          height: auto;
          cursor: pointer;
        }

        .editor-wrapper .ql-editor img.image-selected {
          outline: 2px solid #86A071;
          outline-offset: 2px;
          border-radius: 4px;
        }

        .editor-wrapper .image-resize-handle {
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
        }

        .editor-wrapper .image-tools-panel {
          margin-bottom: 10px;
          border: 1px solid #DEE9D6;
          border-radius: 10px;
          background: #F7FBF3;
          padding: 10px;
        }

        .editor-wrapper .image-tools-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
        }

        .editor-wrapper .image-tools-slider-row {
          margin-top: 8px;
        }

        .editor-wrapper .image-tools-dimension-row {
          margin-top: 8px;
        }

        .editor-wrapper .size-chip {
          border: 1px solid #D4E2CB;
          background: #EDF6E5;
          color: #315643;
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .editor-wrapper .size-chip.active {
          background: #88A170;
          border-color: #88A170;
          color: #FFFFFF;
        }

        .editor-wrapper .size-chip:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .editor-wrapper .slider-label,
        .editor-wrapper .slider-suffix {
          font-size: 12px;
          font-weight: 700;
          color: #3E5A47;
        }

        .editor-wrapper input[type='range'] {
          flex: 1;
          min-width: 120px;
        }

        .editor-wrapper input[type='number'] {
          width: 64px;
          border: 1px solid #D4E2CB;
          border-radius: 6px;
          padding: 4px 6px;
          font-size: 12px;
          font-weight: 700;
          color: #315643;
          background: #FFFFFF;
        }

        .editor-wrapper .image-tools-meta {
          margin-top: 8px;
          font-size: 12px;
          color: #5F705F;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}
