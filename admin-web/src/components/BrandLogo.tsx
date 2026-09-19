import logoImg from '../assets/logo-maestro.png';

interface Props {
  height?: number;
  className?: string;
}

export const BrandLogo = ({ height = 36, className }: Props) => {
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: '#ffffff',
        padding: '3px 8px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        border: '1px solid #e2e8f0',
        height: height + 8,
      }}
      title="MaestroADomicilio.com · Reparamos Tu Hogar"
    >
      <img
        src={logoImg}
        alt="Maestro a Domicilio Logo"
        style={{
          height: `${height}px`,
          width: 'auto',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </div>
  );
};
