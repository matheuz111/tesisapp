import { useState, useEffect, useRef, type MouseEvent, type WheelEvent } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Download, Loader2, AlertTriangle } from 'lucide-react';

interface Props {
  imageUrl: string | null;
  title: string;
  onClose: () => void;
}

export const ImageLightboxModal = ({ imageUrl, title, onClose }: Props) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const [imgError, setImgError] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const [prevImageUrl, setPrevImageUrl] = useState(imageUrl);
  if (prevImageUrl !== imageUrl) {
    setPrevImageUrl(imageUrl);
    setImgLoading(true);
    setImgError(false);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }

  // Cerrar con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!imageUrl) return null;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.35, 4));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.35, 0.5));
  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="lightbox-backdrop" onClick={onClose}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        {/* Barra superior de herramientas */}
        <div className="lightbox-toolbar">
          <div className="lightbox-title-wrap">
            <span className="lightbox-title">{title}</span>
            <span className="lightbox-zoom-badge">{(zoom * 100).toFixed(0)}%</span>
          </div>

          <div className="lightbox-actions">
            <button
              type="button"
              className="lightbox-btn"
              onClick={handleZoomIn}
              title="Acercar (+)"
            >
              <ZoomIn size={18} />
            </button>
            <button
              type="button"
              className="lightbox-btn"
              onClick={handleZoomOut}
              title="Alejar (-)"
            >
              <ZoomOut size={18} />
            </button>
            <button
              type="button"
              className="lightbox-btn"
              onClick={handleReset}
              title="Restablecer tamaño normal"
            >
              <RotateCcw size={18} />
            </button>
            <a
              href={imageUrl}
              download={`${title.replace(/\s+/g, '_')}.jpg`}
              target="_blank"
              rel="noreferrer"
              className="lightbox-btn"
              title="Abrir / Descargar original"
            >
              <Download size={18} />
            </a>
            <button
              type="button"
              className="lightbox-btn lightbox-btn-close"
              onClick={onClose}
              title="Cerrar visor (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Contenedor de la Imagen con zoom interactivo y arrastre */}
        <div
          className="lightbox-viewport"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        >
          {imgLoading && !imgError && (
            <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: '#94a3b8' }}>
              <Loader2 size={36} className="spinner" />
              <span style={{ fontSize: '13px' }}>Cargando evidencia fotográfica...</span>
            </div>
          )}

          {imgError ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 30, textAlign: 'center', color: '#f87171' }}>
              <AlertTriangle size={42} strokeWidth={1.8} />
              <p style={{ margin: 0, fontWeight: 600, fontSize: '15px' }}>No se pudo cargar la imagen de evidencia</p>
              <span style={{ fontSize: '12px', color: '#94a3b8', maxWidth: 360 }}>
                El archivo no está disponible, la URL expiró o se produjo un error de red al descargar el recurso.
              </span>
            </div>
          ) : (
            <img
              src={imageUrl}
              alt={title}
              className="lightbox-image"
              onLoad={() => setImgLoading(false)}
              onError={() => {
                setImgLoading(false);
                setImgError(true);
              }}
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                display: imgLoading ? 'none' : 'block',
              }}
              draggable={false}
            />
          )}
        </div>

        <div className="lightbox-footer-hint">
          <span>Usa la rueda del ratón o los botones para hacer zoom. Arrastra la imagen para moverte.</span>
        </div>
      </div>
    </div>
  );
};
