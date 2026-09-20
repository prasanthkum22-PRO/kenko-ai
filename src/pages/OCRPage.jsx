import { useState, useRef, useEffect, useCallback } from 'react';
import { extractOCR } from '../services/api';
import { extractWithGeminiVision } from '../services/geminiService';
import { getApiError } from '../utils/helpers';
import {
  IconScan,
  IconDoc,
  IconUpload,
  IconArrowRight,
  IconRefresh,
  IconX,
  IconCheck,
  IconClipboard,
  IconPrinter,
  IconAlert,
} from '../components/icons';

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

const STATE = {
  IDLE: 'IDLE',
  IMAGE_SELECTED: 'IMAGE_SELECTED',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
};

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function confClass(confidence) {
  if (confidence >= 0.85) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}

export default function OCRPage() {
  const [uiState, setUiState] = useState(STATE.IDLE);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [ocrResult, setOcrResult] = useState(null);
  const [editableLines, setEditableLines] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [cameraWarning, setCameraWarning] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [googleApiKey, setGoogleApiKey] = useState(
    () => localStorage.getItem('kenko_google_ai_key') || ''
  );
  const [keyInput, setKeyInput] = useState(googleApiKey);

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const copyTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const revokePreview = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [previewUrl]);

  const handleSaveApiKey = (keyToSave) => {
    const cleanKey = (keyToSave || '').trim();
    setGoogleApiKey(cleanKey);
    setKeyInput(cleanKey);
    if (cleanKey) {
      localStorage.setItem('kenko_google_ai_key', cleanKey);
    } else {
      localStorage.removeItem('kenko_google_ai_key');
    }
  };

  const handleFileSelected = useCallback(
    (file) => {
      setValidationError('');
      setError('');
      setCameraWarning('');

      if (!file) return;

      const mime = (file.type || '').toLowerCase();
      if (!ALLOWED_TYPES.includes(mime)) {
        setValidationError(
          `Unsupported file type: "${file.type || 'unknown'}". Please use a JPEG, PNG, or WEBP image.`
        );
        return;
      }

      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setValidationError(
          `Unsupported file extension "${ext}". Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
        );
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setValidationError(
          `File is too large (${formatSize(file.size)}). Maximum allowed size is ${MAX_FILE_SIZE_MB} MB.`
        );
        return;
      }

      if (file.size === 0) {
        setValidationError('The selected file is empty. Please choose a valid image.');
        return;
      }

      revokePreview();
      const url = URL.createObjectURL(file);
      setSelectedFile(file);
      setPreviewUrl(url);
      setOcrResult(null);
      setUiState(STATE.IMAGE_SELECTED);
    },
    [revokePreview]
  );

  const handleCameraClick = () => {
    setValidationError('');
    setCameraWarning('');
    cameraInputRef.current?.click();
  };

  const handleGalleryClick = () => {
    setValidationError('');
    galleryInputRef.current?.click();
  };

  const onInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileSelected(file);
  };

  const handleRetake = () => {
    revokePreview();
    setSelectedFile(null);
    setOcrResult(null);
    setError('');
    setValidationError('');
    setCameraWarning('');
    setUiState(STATE.IDLE);
  };

  const handleExtract = async () => {
    if (!selectedFile || uiState === STATE.PROCESSING) return;

    setUiState(STATE.PROCESSING);
    setError('');

    const activeKey = googleApiKey.trim() || keyInput.trim();

    try {
      let result = null;

      if (activeKey) {
        try {
          result = await extractWithGeminiVision(selectedFile, activeKey);
          if (!googleApiKey) handleSaveApiKey(activeKey);
        } catch (geminiErr) {
          console.warn('Direct Gemini call note:', geminiErr);
          result = await extractOCR(selectedFile, null, activeKey);
        }
      } else {
        result = await extractOCR(selectedFile, null, null);
      }

      if (!result || typeof result !== 'object') {
        throw new Error('Invalid response from the OCR service.');
      }

      const lines = Array.isArray(result.lines) ? result.lines : [];
      setEditableLines(lines);
      setText(
        result.text || lines.map((l) => l.text || '').join('\n') || 'No text was extracted.'
      );
      setOcrResult(result);
      setUiState(STATE.SUCCESS);
    } catch (err) {
      let message = getApiError(err);

      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        message = 'The OCR request timed out. The backend may be starting up. Please try again.';
      } else if (!navigator.onLine || err.message?.includes('Network Error')) {
        message =
          'Network error. Please check your internet connection and ensure the backend is running.';
      } else if (err.response?.status === 503 || err.response?.status === 0) {
        message = 'Backend is offline. Please start the FastAPI server and try again.';
      }

      setError(message);
      setUiState(STATE.ERROR);
    }
  };

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopySuccess(false), 2500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopySuccess(true);
      copyTimerRef.current = setTimeout(() => setCopySuccess(false), 2500);
    }
  };

  const handleExport = () => {
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ocr-result.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleScanAnother = () => {
    revokePreview();
    setSelectedFile(null);
    setOcrResult(null);
    setEditableLines([]);
    setText('');
    setError('');
    setValidationError('');
    setCopySuccess(false);
    setUiState(STATE.IDLE);
  };

  const handleLineChange = (idx, value) => {
    const updated = editableLines.map((line, i) => (i === idx ? { ...line, text: value } : line));
    setEditableLines(updated);
    setText(updated.map((line) => line.text || '').join('\n'));
  };

  return (
    <div className="ocr-page" id="ocr-page">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        id="ocr-camera-input"
        className="hidden"
        onChange={onInputChange}
        aria-hidden="true"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        id="ocr-gallery-input"
        className="hidden"
        onChange={onInputChange}
        aria-hidden="true"
      />

      <div className="flex flex-col items-center gap-2 text-center animate-fade-in">
        <div className="ocr-header-icon">
          <IconScan size={28} />
        </div>
        <h1 className="ocr-title">
          <span className="text-gradient">Medical</span> Document Scanner
        </h1>
        <p className="ocr-subtitle">
          Extract text from reports, prescriptions, and lab results using AI-powered OCR
        </p>
      </div>

      {uiState === STATE.IDLE && (
        <div
          className="ocr-upload-card animate-fade-in"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center gap-1 mb-3 text-center">
            <h2 className="text-lg font-semibold">Scan your medical document</h2>
            <p className="text-sm text-muted">Upload a prescription, report, or lab result image.</p>
          </div>

          <div
            className="empty-state"
            style={{ borderColor: dragActive ? 'var(--color-primary)' : undefined }}
            onClick={handleGalleryClick}
          >
            <span className="empty-icon">
              <IconUpload size={22} />
            </span>
            <p className="empty-title">Drag &amp; drop your document here</p>
            <p className="empty-description">
              or click to browse files. JPEG, PNG, and WEBP images up to 10 MB.
            </p>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                handleGalleryClick();
              }}
            >
              <IconDoc size={15} />
              Browse Files
            </button>
          </div>

          <div className="flex flex-col gap-3 mt-3">
            <button
              id="ocr-camera-btn"
              className="ocr-capture-btn"
              onClick={handleCameraClick}
              aria-label="Take a photo of a medical document"
              type="button"
            >
              <span className="ocr-btn-icon-wrap">
                <IconScan size={20} />
              </span>
              <span className="flex flex-col gap-1" style={{ flex: 1, textAlign: 'left' }}>
                <span className="text-sm font-semibold">Take Photo</span>
                <span className="text-xs text-muted">Use your device camera</span>
              </span>
              <IconArrowRight size={18} />
            </button>

            <button
              id="ocr-gallery-btn"
              className="ocr-capture-btn"
              onClick={handleGalleryClick}
              aria-label="Choose an image from your gallery"
              type="button"
            >
              <span className="ocr-btn-icon-wrap">
                <IconDoc size={20} />
              </span>
              <span className="flex flex-col gap-1" style={{ flex: 1, textAlign: 'left' }}>
                <span className="text-sm font-semibold">Choose from Gallery</span>
                <span className="text-xs text-muted">Existing image, JPEG, PNG, WEBP</span>
              </span>
              <IconArrowRight size={18} />
            </button>
          </div>

          {cameraWarning && (
            <div className="alert alert-warning flex items-start gap-2 mt-3" role="alert">
              <IconAlert size={16} />
              <p className="text-xs">{cameraWarning}</p>
            </div>
          )}

          {validationError && (
            <div className="alert alert-danger flex items-start gap-2 mt-3" role="alert">
              <IconAlert size={16} />
              <p className="text-xs">{validationError}</p>
            </div>
          )}
        </div>
      )}

      {uiState === STATE.IMAGE_SELECTED && selectedFile && previewUrl && (
        <div className="ocr-preview-card animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold">Image Preview</h2>
            <button id="ocr-retake-btn" type="button" className="btn btn-ghost btn-sm" onClick={handleRetake}>
              <IconX size={14} />
              Retake
            </button>
          </div>

          <div
            className="flex items-center justify-center overflow-hidden rounded-lg"
            style={{
              background: 'var(--color-bg-inset)',
              border: '1px solid var(--color-border)',
              minHeight: 220,
            }}
          >
            <img
              src={previewUrl}
              alt="Medical document preview"
              className="w-full"
              style={{ objectFit: 'contain', maxHeight: 420 }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="kpi-icon">
              <IconDoc size={16} />
            </span>
            <span className="text-sm font-medium truncate" style={{ maxWidth: '55%' }}>
              {selectedFile.name}
            </span>
            <span className="badge badge-secondary">{formatSize(selectedFile.size)}</span>
          </div>

          {validationError && (
            <div className="alert alert-danger flex items-start gap-2 mt-3" role="alert">
              <IconAlert size={16} />
              <p className="text-xs">{validationError}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button id="ocr-extract-btn" type="button" className="btn btn-primary" onClick={handleExtract}>
              <IconScan size={16} />
              Extract Text
            </button>
          </div>
        </div>
      )}

      {uiState === STATE.PROCESSING && (
        <div className="ocr-preview-card animate-fade-in" role="status" aria-live="polite">
          <div className="ocr-processing-wrap">
            <div className="loading-spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">Extracting Text...</h2>
              <p className="text-sm text-muted">Please wait while the OCR engine analyzes your document.</p>
              <p className="text-xs text-muted">First run may take longer while models load.</p>
            </div>
          </div>
        </div>
      )}

      {uiState === STATE.ERROR && (
        <div className="ocr-preview-card animate-fade-in" role="alert">
          <div className="ocr-error-wrap">
            <IconAlert size={30} className="text-danger" />
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">OCR Failed</h2>
              <p className="text-sm text-secondary">{error}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {selectedFile && (
                <button
                  id="ocr-retry-btn"
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleExtract}
                >
                  <IconRefresh size={15} />
                  Try Again
                </button>
              )}
              <button
                id="ocr-reset-btn"
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleScanAnother}
              >
                Scan Different Document
              </button>
            </div>
          </div>
        </div>
      )}

      {uiState === STATE.SUCCESS && ocrResult && (
        <div className="ocr-result-card animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="kpi-icon">
                <IconClipboard size={16} />
              </span>
              <h2 className="text-lg font-semibold">Extracted Text</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge badge-primary">
                {ocrResult.line_count} line{ocrResult.line_count !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-muted">{ocrResult.processing_time_ms} ms</span>
            </div>
          </div>

          <div className="divider" />

          {text ? (
            <textarea
              id="ocr-result-text"
              className="ocr-text-box"
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="Extracted text from medical document"
            />
          ) : (
            <div className="empty-state">
              <span className="empty-icon">
                <IconDoc size={22} />
              </span>
              <p className="empty-title">No text detected</p>
              <p className="empty-description">
                The image may be too blurry or low resolution. Try retaking with better lighting.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 mt-4">
            {text && (
              <button id="ocr-copy-btn" type="button" className="btn btn-secondary btn-sm" onClick={handleCopy}>
                {copySuccess ? (
                  <>
                    <IconCheck size={15} />
                    Copied!
                  </>
                ) : (
                  <>
                    <IconClipboard size={15} />
                    Copy Text
                  </>
                )}
              </button>
            )}
            {text && (
              <button
                id="ocr-export-btn"
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleExport}
              >
                <IconPrinter size={15} />
                Export .txt
              </button>
            )}
            <button
              id="ocr-scan-another-btn"
              type="button"
              className="btn btn-primary btn-sm ml-auto"
              onClick={handleScanAnother}
            >
              <IconRefresh size={15} />
              Scan Another Document
            </button>
          </div>

          {editableLines.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold">Detected Lines ({editableLines.length})</h3>
                <span className="text-xs text-muted">Edit to correct OCR output</span>
              </div>
              <div className="ocr-lines-list">
                {editableLines.map((line, idx) => (
                  <div key={idx} className="ocr-line-row">
                    <input
                      className="input"
                      style={{ padding: '4px 8px', fontSize: 'var(--font-size-sm)' }}
                      value={line.text || ''}
                      onChange={(e) => handleLineChange(idx, e.target.value)}
                      aria-label={`Line ${idx + 1} text`}
                    />
                    <span className={`ocr-conf ${confClass(line.confidence ?? 0)}`}>
                      {((line.confidence ?? 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}