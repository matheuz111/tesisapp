import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

export interface RowAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

interface RowActionsMenuProps {
  /** Nombre de la fila para el lector de pantalla: "Más acciones de SOL-POST-0010". */
  label: string;
  actions: RowAction[];
}

const MENU_WIDTH = 220;

/**
 * Menú "Más acciones" de una fila. Se dibuja en un portal con posición fija para que el
 * contenedor de la tabla no lo recorte, y se maneja con teclado (flechas, Inicio/Fin, Esc).
 */
export const RowActionsMenu: React.FC<RowActionsMenuProps> = ({ label, actions }) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // Posición bajo el botón; si no cabe abajo, se abre hacia arriba.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const estimatedHeight = actions.length * 40 + 12;
    const openUp = rect.bottom + estimatedHeight > window.innerHeight - 8;
    setPosition({
      top: openUp ? Math.max(8, rect.top - estimatedHeight - 4) : rect.bottom + 4,
      left: Math.min(window.innerWidth - MENU_WIDTH - 8, Math.max(8, rect.right - MENU_WIDTH)),
    });
  }, [open, actions.length]);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) close(false);
    };
    const onDismiss = () => close(false);
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('scroll', onDismiss, true);
    window.addEventListener('resize', onDismiss);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('scroll', onDismiss, true);
      window.removeEventListener('resize', onDismiss);
    };
  }, [open, close]);

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') { event.stopPropagation(); close(); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); items[(index + 1) % items.length]?.focus(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); items[(index - 1 + items.length) % items.length]?.focus(); }
    else if (event.key === 'Home') { event.preventDefault(); items[0]?.focus(); }
    else if (event.key === 'End') { event.preventDefault(); items[items.length - 1]?.focus(); }
    else if (event.key === 'Tab') close(false);
  };

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className="rq-icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title="Más acciones"
        onClick={(e) => { e.stopPropagation(); setOpen((value) => !value); }}
        onKeyDown={(e) => { e.stopPropagation(); }}
      >
        <MoreHorizontal size={18} />
      </button>

      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              className="rq-menu"
              role="menu"
              aria-label={label}
              style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
              onKeyDown={onMenuKeyDown}
              onClick={(e) => e.stopPropagation()}
            >
              {actions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  role="menuitem"
                  className="rq-menu-item"
                  onClick={() => { close(false); action.onSelect(); }}
                >
                  {action.icon}
                  <span>{action.label}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
};
