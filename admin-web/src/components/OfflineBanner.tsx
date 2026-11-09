import React from 'react';
import { WifiOff } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export const OfflineBanner: React.FC = () => {
  const isOnline = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div
      role="alert"
      className="offline-banner"
      style={{
        backgroundColor: '#FEF3C7',
        color: '#92400E',
        borderBottom: '1px solid #FDE68A',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        fontSize: '13px',
        fontWeight: 600,
        position: 'sticky',
        top: 0,
        zIndex: 9999,
      }}
    >
      <WifiOff size={16} color="#92400E" />
      <span>
        Sin conexión a internet · Modo de solo consulta activa. Las modificaciones y asignaciones están deshabilitadas para garantizar marcas de tiempo oficiales del servidor.
      </span>
    </div>
  );
};
