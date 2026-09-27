import React from 'react';
import { Camera, Percent, RefreshCw, ShieldCheck } from 'lucide-react';
import type { DashboardStats } from '../../hooks/useServiceRequests';

interface SummaryCardsProps {
  stats: DashboardStats;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ stats }) => {
  return (
    <section className="kpi-grid-minimal">
      <div className="kpi-card-clean">
        <div className="kpi-clean-icon">
          <RefreshCw size={18} color="#2563eb" />
        </div>
        <div className="kpi-clean-body">
          <span className="kpi-clean-label">Total Solicitudes</span>
          <div className="kpi-clean-value-wrap">
            <span className="kpi-clean-value">{stats.total}</span>
            <span className="kpi-clean-sub">{stats.pending} por atender</span>
          </div>
        </div>
      </div>

      <div className="kpi-card-clean">
        <div className="kpi-clean-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
          <Percent size={18} color="#10b981" />
        </div>
        <div className="kpi-clean-body">
          <span className="kpi-clean-label">Tasa de Culminación</span>
          <div className="kpi-clean-value-wrap">
            <span className="kpi-clean-value">{stats.completionRate}%</span>
            <span className="kpi-clean-sub">{stats.completed} exitosas</span>
          </div>
        </div>
      </div>

      <div className="kpi-card-clean">
        <div className="kpi-clean-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
          <Camera size={18} color="#6366f1" />
        </div>
        <div className="kpi-clean-body">
          <span className="kpi-clean-label">Auditoría Fotográfica</span>
          <div className="kpi-clean-value-wrap">
            <span className="kpi-clean-value">{stats.auditRate}%</span>
            <span className="kpi-clean-sub">{stats.photoEvidences} con fotos</span>
          </div>
        </div>
      </div>

      <div className="kpi-card-clean">
        <div className="kpi-clean-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
          <ShieldCheck size={18} color="#f59e0b" />
        </div>
        <div className="kpi-clean-body">
          <span className="kpi-clean-label">Garantías Activas 30d</span>
          <div className="kpi-clean-value-wrap">
            <span className="kpi-clean-value">{stats.completed}</span>
            <span className="kpi-clean-sub">Respaldadas</span>
          </div>
        </div>
      </div>
    </section>
  );
};
