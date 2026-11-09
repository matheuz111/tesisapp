import React from 'react';
import { Layers, Clock, Wrench, CheckCircle2, Camera } from 'lucide-react';
import type { DashboardStats } from '../../hooks/useServiceRequests';

interface SummaryCardsProps {
  stats: DashboardStats;
}

/**
 * SummaryCards — Tarjetas ejecutivas de KPIs operativos
 * - Grid responsivo de 5 tarjetas con elevación sutil y bordes redondeados.
 * - Cifras destacadas en monoespaciado tabular (`IBM Plex Mono`).
 * - Iconos en contenedores con fondo suave temático.
 * - Etiquetas y badges de estado con espaciado garantizado.
 */
export const SummaryCards: React.FC<SummaryCardsProps> = ({ stats }) => {
  return (
    <section className="kpi-cards-grid" aria-label="Indicadores operativos clave">
      {/* 1. Total Solicitudes */}
      <div className="kpi-card-item">
        <div className="kpi-card-icon icon-blue">
          <Layers size={18} />
        </div>
        <div className="kpi-card-body">
          <span className="kpi-card-label">Total Solicitudes</span>
          <div className="kpi-card-data-row">
            <span className="kpi-card-number mono-tabular">{stats.total}</span>
            <span className="kpi-card-pill pill-neutral">Base activa</span>
          </div>
        </div>
      </div>

      {/* 2. Por Atender / Pendientes */}
      <div className="kpi-card-item">
        <div className="kpi-card-icon icon-amber">
          <Clock size={18} />
        </div>
        <div className="kpi-card-body">
          <span className="kpi-card-label">Por Atender</span>
          <div className="kpi-card-data-row">
            <span className="kpi-card-number mono-tabular text-amber">{stats.pending}</span>
            <span className="kpi-card-pill pill-amber">Despacho</span>
          </div>
        </div>
      </div>

      {/* 3. En Ejecución */}
      <div className="kpi-card-item">
        <div className="kpi-card-icon icon-purple">
          <Wrench size={18} />
        </div>
        <div className="kpi-card-body">
          <span className="kpi-card-label">En Ejecución</span>
          <div className="kpi-card-data-row">
            <span className="kpi-card-number mono-tabular text-purple">{stats.inProgress}</span>
            <span className="kpi-card-pill pill-purple">En campo</span>
          </div>
        </div>
      </div>

      {/* 4. Culminadas */}
      <div className="kpi-card-item">
        <div className="kpi-card-icon icon-green">
          <CheckCircle2 size={18} />
        </div>
        <div className="kpi-card-body">
          <span className="kpi-card-label">Culminadas</span>
          <div className="kpi-card-data-row">
            <span className="kpi-card-number mono-tabular text-green">{stats.completed}</span>
            <span className="kpi-card-pill pill-green">{stats.completionRate}% éxito</span>
          </div>
        </div>
      </div>

      {/* 5. Auditoría de Fotos */}
      <div className="kpi-card-item">
        <div className="kpi-card-icon icon-cyan">
          <Camera size={18} />
        </div>
        <div className="kpi-card-body">
          <span className="kpi-card-label">Auditoría Fotos</span>
          <div className="kpi-card-data-row">
            <span className="kpi-card-number mono-tabular">{stats.photoEvidences}</span>
            <span className="kpi-card-pill pill-cyan">{stats.auditRate}% cobertura</span>
          </div>
        </div>
      </div>
    </section>
  );
};
