import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}

/**
 * SidePanel — Panel lateral deslizante (Drawer)
 * Reemplaza los modales intrusivos para mantener visible la tabla de despacho.
 * - En escritorio (>=1024px): ancho 560px fijado a la derecha con backdrop semitransparente.
 * - En móvil/tablet (<768px): hoja a pantalla completa (100dvh).
 * - Cierre accesible con tecla 'Escape', clic exterior en backdrop y botón 'X'.
 */
export const SidePanel: React.FC<SidePanelProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  icon,
  children,
  footer,
  width = '560px',
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElement.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    // Foco inicial en el panel
    const focusable = panelRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable) {
      setTimeout(() => focusable.focus(), 50);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      if (previouslyFocusedElement.current) {
        previouslyFocusedElement.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="sidepanel-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <aside
        ref={panelRef}
        className="sidepanel-container"
        style={{ '--sidepanel-width': width } as React.CSSProperties}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Cabecera Fija */}
        <header className="sidepanel-header">
          <div className="sidepanel-header-main">
            {icon && <div className="sidepanel-header-icon">{icon}</div>}
            <div className="sidepanel-header-text">
              <div className="sidepanel-title-row">
                <h2 className="sidepanel-title">{title}</h2>
                {badge}
              </div>
              {subtitle && <p className="sidepanel-subtitle">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            className="sidepanel-close-btn"
            onClick={onClose}
            aria-label="Cerrar panel lateral"
            title="Cerrar (Esc)"
          >
            <X size={18} />
          </button>
        </header>

        {/* Cuerpo con Scroll Interno */}
        <div className="sidepanel-body">
          {children}
        </div>

        {/* Pie de Acciones Fijo */}
        {footer && (
          <footer className="sidepanel-footer">
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );
};
