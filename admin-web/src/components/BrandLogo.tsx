import logoImg from '../assets/logo-maestro.webp';

interface Props {
  height?: number;
  className?: string;
}

export const BrandLogo = ({ height = 36, className }: Props) => {
  return (
    <div
      className={`brand-logo-container ${className || ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
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
