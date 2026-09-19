import { useState, useMemo } from 'react';
import { X, Search, BookOpen, Clock, ShieldCheck, Tag, Check, ArrowRight, Sparkles, Filter } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectService?: (serviceName: string, suggestedFee: number) => void;
}

interface BaremoItem {
  id: string;
  category: 'Gasfitería' | 'Electricidad' | 'Pintura' | 'Cerrajería' | 'Línea Blanca' | 'Albañilería';
  title: string;
  description: string;
  estimatedMinutes: number;
  priceRange: string;
  baseFee: number;
  complexity: 'Baja' | 'Media' | 'Alta';
  warranty: string;
}

const BAREMO_DATA: BaremoItem[] = [
  // Gasfitería
  {
    id: 'g1',
    category: 'Gasfitería',
    title: 'Detección y Reparación de Fuga en Llave de Paso',
    description: 'Reemplazo de vástago, empaquetaduras o cambio completo de llave de paso 1/2" a 3/4".',
    estimatedMinutes: 35,
    priceRange: 'S/. 50 - 80',
    baseFee: 60,
    complexity: 'Media',
    warranty: '30 días sobre hermeticidad',
  },
  {
    id: 'g2',
    category: 'Gasfitería',
    title: 'Destape Mecánico de Inodoro / Trampa Desagüe',
    description: 'Desatoro con sonda espiral y presurización hidráulica en red de desagüe sanitario.',
    estimatedMinutes: 45,
    priceRange: 'S/. 60 - 90',
    baseFee: 75,
    complexity: 'Media',
    warranty: '30 días por obstrucción normal',
  },
  {
    id: 'g3',
    category: 'Gasfitería',
    title: 'Instalación de Termoeléctrica / Rapigás',
    description: 'Fijación mural, conexión a red de agua fría/caliente con mangueras flexibles y prueba de presión.',
    estimatedMinutes: 60,
    priceRange: 'S/. 90 - 140',
    baseFee: 110,
    complexity: 'Alta',
    warranty: '30 días en empalmes y soporte',
  },
  // Electricidad
  {
    id: 'e1',
    category: 'Electricidad',
    title: 'Detección de Cortocircuito y Fuga a Tierra',
    description: 'Megado de líneas, aislamiento de circuitos y balanceo en tablero de distribución.',
    estimatedMinutes: 50,
    priceRange: 'S/. 70 - 110',
    baseFee: 85,
    complexity: 'Alta',
    warranty: '30 días en circuito intervenido',
  },
  {
    id: 'e2',
    category: 'Electricidad',
    title: 'Instalación de Interruptor Termomagnético / Diferencial',
    description: 'Montaje en riel DIN, peinado de cables y calibración según amperaje del circuito.',
    estimatedMinutes: 30,
    priceRange: 'S/. 45 - 70',
    baseFee: 55,
    complexity: 'Media',
    warranty: '30 días de funcionamiento',
  },
  {
    id: 'e3',
    category: 'Electricidad',
    title: 'Instalación de Luminaria LED / Ventilador de Techo',
    description: 'Fijación con tarugos, conexión a caja octogonal y prueba de encendido con control.',
    estimatedMinutes: 40,
    priceRange: 'S/. 40 - 75',
    baseFee: 50,
    complexity: 'Baja',
    warranty: '30 días de soporte eléctrico',
  },
  // Cerrajería
  {
    id: 'c1',
    category: 'Cerrajería',
    title: 'Apertura de Puerta de Emergencia (Sin daño)',
    description: 'Ganzuado y descompresión de pestillo en cerraduras residenciales.',
    estimatedMinutes: 25,
    priceRange: 'S/. 60 - 90',
    baseFee: 70,
    complexity: 'Media',
    warranty: '30 días en ajuste de cilindro',
  },
  {
    id: 'c2',
    category: 'Cerrajería',
    title: 'Cambio e Instalación de Cerradura de Alta Seguridad',
    description: 'Cajeado en madera/metal, fijación de escudo antipánico y duplicado de llaves computarizadas.',
    estimatedMinutes: 45,
    priceRange: 'S/. 80 - 130',
    baseFee: 95,
    complexity: 'Alta',
    warranty: '30 días en mecanismo y anclaje',
  },
  // Línea Blanca
  {
    id: 'l1',
    category: 'Línea Blanca',
    title: 'Mantenimiento Preventivo de Lavadora Automática',
    description: 'Limpieza de tina, calibración de fajas, revisión de bomba de desagüe y electroválvula.',
    estimatedMinutes: 60,
    priceRange: 'S/. 70 - 120',
    baseFee: 80,
    complexity: 'Media',
    warranty: '30 días en mano de obra',
  },
  {
    id: 'l2',
    category: 'Línea Blanca',
    title: 'Carga de Gas Refrigerante y Cambio de Relé / Filtro',
    description: 'Vacío de sistema con bomba de vacío, presurización R134a/R600a y prueba térmica.',
    estimatedMinutes: 75,
    priceRange: 'S/. 90 - 150',
    baseFee: 110,
    complexity: 'Alta',
    warranty: '30 días sobre recarga y sello',
  },
  // Pintura
  {
    id: 'p1',
    category: 'Pintura',
    title: 'Empaste y Pintado de Paño / Pared con Humedad',
    description: 'Raspado de salitre, sellador anti-humedad, 2 capas de pasta mural y látex lavable.',
    estimatedMinutes: 90,
    priceRange: 'S/. 80 - 140',
    baseFee: 100,
    complexity: 'Media',
    warranty: '30 días sobre adherencia',
  },
];

const CATEGORIES_CONFIG = [
  { name: 'TODOS', icon: '📋' },
  { name: 'Gasfitería', icon: '🚰' },
  { name: 'Electricidad', icon: '⚡' },
  { name: 'Cerrajería', icon: '🔑' },
  { name: 'Línea Blanca', icon: '🧺' },
  { name: 'Pintura', icon: '🎨' },
];

const getCategoryClass = (cat: string) => {
  switch (cat) {
    case 'Gasfitería': return 'cat-gasfiteria';
    case 'Electricidad': return 'cat-electricidad';
    case 'Cerrajería': return 'cat-cerrajeria';
    case 'Línea Blanca': return 'cat-linea-blanca';
    case 'Pintura': return 'cat-pintura';
    default: return 'cat-gasfiteria';
  }
};

export const BaremoCatalogModal = ({ isOpen, onClose, onSelectService }: Props) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = useMemo(() => {
    return BAREMO_DATA.filter((item) => {
      if (selectedCategory !== 'TODOS' && item.category !== selectedCategory) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        return (
          item.title.toLowerCase().includes(term) ||
          item.description.toLowerCase().includes(term) ||
          item.category.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [selectedCategory, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 860 }}>
        {/* Header con estilo Material Dialog */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="login-icon-badge" style={{ padding: 8, margin: 0, background: 'rgba(2, 132, 199, 0.12)' }}>
              <BookOpen size={20} color="#0284c7" />
            </div>
            <div>
              <h2>Catálogo Técnico y Baremo de Tarifas Estandarizadas</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Tarifario oficial normado de mano de obra, tiempos de cuadrilla y coberturas de garantía 30d
              </p>
            </div>
          </div>
          <button type="button" className="btn-close" onClick={onClose} title="Cerrar">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body modal-scrollable">
          {/* Barra de Filtros y Búsqueda Angular Material Style */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {/* Input de Búsqueda Material Outlined Pill */}
            <div className="mat-search-container">
              <Search size={18} className="mat-search-icon" />
              <input
                type="text"
                className="mat-search-input"
                placeholder="Buscar servicio normado (ej. fuga, diferencial, desatoro, chapa)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
              {searchTerm && (
                <button
                  type="button"
                  className="mat-search-clear"
                  onClick={() => setSearchTerm('')}
                  title="Limpiar búsqueda"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Chips de Categorías (Material Filter Chips) */}
            <div className="mat-chip-list">
              {CATEGORIES_CONFIG.map((cat) => {
                const isSelected = selectedCategory === cat.name;
                return (
                  <button
                    key={cat.name}
                    type="button"
                    className={`mat-filter-chip ${isSelected ? 'mat-chip-selected' : ''}`}
                    onClick={() => setSelectedCategory(cat.name)}
                  >
                    <span className="mat-chip-icon">{cat.icon}</span>
                    <span>{cat.name}</span>
                    {isSelected && <Check size={14} className="mat-chip-check" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Estado Vacío Material */}
          {filteredItems.length === 0 ? (
            <div className="table-empty" style={{ padding: '36px 20px', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Filter size={24} color="var(--text-muted)" />
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
                No se encontraron servicios que coincidan
              </h3>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>
                Prueba buscando otro término o seleccionando la categoría "TODOS".
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: 12, borderRadius: 20 }}
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('TODOS');
                }}
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            /* Grilla de Ítems del Baremo (Material Cards) */
            <div className="baremo-grid">
              {filteredItems.map((item) => (
                <div key={item.id} className="baremo-card">
                  <div>
                    <div className="baremo-card-header">
                      <span className={`baremo-category-badge ${getCategoryClass(item.category)}`}>
                        {item.category}
                      </span>
                      <span className="baremo-price-badge">{item.priceRange}</span>
                    </div>

                    <h3 className="baremo-title">{item.title}</h3>
                    <p className="baremo-desc">{item.description}</p>
                  </div>

                  <div>
                    <div className="baremo-meta-row">
                      <div className="baremo-meta-item" title="Tiempo promedio estimado de cuadrilla">
                        <Clock size={13} color="var(--primary)" />
                        <span>~{item.estimatedMinutes} min</span>
                      </div>
                      <div className="baremo-meta-item" title="Nivel de complejidad técnica">
                        <Tag size={13} color="var(--text-muted)" />
                        <span>Dificultad: <strong>{item.complexity}</strong></span>
                      </div>
                      <div className="baremo-meta-item" style={{ color: '#16a34a', borderColor: 'rgba(22, 163, 74, 0.25)' }} title="Póliza de garantía estándar">
                        <ShieldCheck size={13} color="#16a34a" />
                        <span>{item.warranty}</span>
                      </div>
                    </div>

                    {onSelectService && (
                      <button
                        type="button"
                        className="baremo-select-btn"
                        onClick={() => {
                          onSelectService(item.title, item.baseFee);
                          onClose();
                        }}
                      >
                        <Sparkles size={14} />
                        <span>Usar Servicio en Cotización</span>
                        <ArrowRight size={14} style={{ marginLeft: 'auto' }} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Material con Indicadores */}
        <div className="modal-footer" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Mostrando <strong>{filteredItems.length}</strong> de {BAREMO_DATA.length} servicios normados
          </span>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ borderRadius: 20 }}>
            Cerrar Catálogo
          </button>
        </div>
      </div>
    </div>
  );
};
