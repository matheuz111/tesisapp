import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Search, ShieldCheck, ShieldX } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { formatCertificateCode, normalizeCertificateCode, resolveCertificateState } from '../services/warrantyCertificateModel';
import { getPublicCertificate, registerScan, type WarrantyCertificate } from '../services/warrantyCertificateService';

type Lookup =
  | { kind: 'loading' }
  | { kind: 'notfound' }
  | { kind: 'error' }
  | { kind: 'found'; certificate: WarrantyCertificate };

const CENTRAL_PHONE = '924-167-911';

const formatDate = (millis: number | null) =>
  millis ? new Date(millis).toLocaleDateString('es-PE', { dateStyle: 'long' }) : '—';

const BANNERS = {
  ACTIVE: { Icon: ShieldCheck, cls: 'is-active', title: 'Garantía vigente', text: 'Este certificado es auténtico y su cobertura sigue activa.' },
  EXPIRED: { Icon: AlertTriangle, cls: 'is-expired', title: 'Garantía vencida', text: 'Este certificado es auténtico, pero su período de cobertura ya terminó.' },
  REVOKED: { Icon: ShieldX, cls: 'is-revoked', title: 'Certificado anulado', text: 'Este certificado ya no es válido. Comunícate con la central para más información.' },
} as const;

/**
 * Página pública a la que lleva el QR del certificado. No requiere sesión. Solo muestra lo mínimo:
 * estado, servicio, titular enmascarado y fechas. Nunca teléfono, dirección ni datos del técnico.
 */
export const VerifyCertificatePage = ({ rawCode }: { rawCode: string }) => {
  const code = normalizeCertificateCode(rawCode);
  const [lookup, setLookup] = useState<Lookup>({ kind: 'loading' });
  const [typed, setTyped] = useState('');
  const [typedError, setTypedError] = useState('');

  // La página no debe aparecer en buscadores: cada certificado es privado de quien lo recibió.
  useEffect(() => {
    document.title = 'Verificación de garantía · Maestro a Domicilio';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);

  useEffect(() => {
    if (!code) return;
    let active = true;
    getPublicCertificate(code)
      .then((certificate) => {
        if (!active) return;
        if (!certificate) { setLookup({ kind: 'notfound' }); return; }
        setLookup({ kind: 'found', certificate });
        void registerScan(code);
      })
      .catch(() => { if (active) setLookup({ kind: 'error' }); });
    return () => { active = false; };
  }, [code]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = normalizeCertificateCode(typed);
    if (!normalized) { setTypedError('El código tiene 16 letras y números, por ejemplo GAR-ABCD-EFGH-JKMN-PQRS.'); return; }
    window.location.assign(`/verificar/${normalized}`);
  };

  const showForm = !code || lookup.kind === 'notfound';
  const state = lookup.kind === 'found' ? resolveCertificateState(lookup.certificate) : null;
  const banner = state ? BANNERS[state] : null;

  return (
    <main className="verify-page">
      <div className="verify-card">
        <header className="verify-header">
          <BrandLogo height={40} />
          <h1>Verificación de garantía</h1>
        </header>

        {code && lookup.kind === 'loading' ? (
          <p className="verify-status" role="status">Verificando certificado…</p>
        ) : null}

        {code && lookup.kind === 'error' ? (
          <p className="verify-banner is-expired" role="alert">
            No pudimos consultar el certificado. Revisa tu conexión e inténtalo de nuevo.
          </p>
        ) : null}

        {banner && lookup.kind === 'found' ? (
          <>
            <section className={`verify-banner ${banner.cls}`} role="status" aria-live="polite">
              <banner.Icon size={28} aria-hidden="true" />
              <div>
                <strong>{banner.title}</strong>
                <p>{banner.text}</p>
              </div>
            </section>

            <dl className="verify-details">
              <div><dt>Código</dt><dd className="mono-tabular">{formatCertificateCode(lookup.certificate.code)}</dd></div>
              <div><dt>Servicio</dt><dd>{lookup.certificate.serviceLabel}</dd></div>
              <div><dt>Titular</dt><dd>{lookup.certificate.clientMasked}</dd></div>
              <div><dt>Emitido el</dt><dd>{formatDate(lookup.certificate.issuedAt)}</dd></div>
              <div><dt>Cobertura</dt><dd>{formatDate(lookup.certificate.validFrom)} al {formatDate(lookup.certificate.validUntil)}</dd></div>
              {state === 'REVOKED' ? <div><dt>Anulado el</dt><dd>{formatDate(lookup.certificate.revokedAt)}</dd></div> : null}
            </dl>
          </>
        ) : null}

        {code && lookup.kind === 'notfound' ? (
          <p className="verify-banner is-revoked" role="alert">
            <ShieldX size={24} aria-hidden="true" />
            <span><strong>No encontramos este certificado.</strong> Revisa que el código esté completo. Si el problema continúa, el documento podría no ser auténtico.</span>
          </p>
        ) : null}

        {showForm ? (
          <form className="verify-form" onSubmit={submit}>
            <label htmlFor="verify-code">Escribe el código del certificado</label>
            <div className="verify-form-row">
              <input
                id="verify-code"
                value={typed}
                onChange={(e) => { setTyped(e.target.value); setTypedError(''); }}
                placeholder="GAR-XXXX-XXXX-XXXX-XXXX"
                autoComplete="off"
                autoCapitalize="characters"
                aria-invalid={typedError ? true : undefined}
                aria-describedby={typedError ? 'verify-code-error' : undefined}
              />
              <button type="submit" className="btn btn-primary"><Search size={16} aria-hidden="true" /> Verificar</button>
            </div>
            {typedError ? <p id="verify-code-error" className="verify-error" role="alert">{typedError}</p> : null}
          </form>
        ) : null}

        <footer className="verify-footer">
          <CheckCircle2 size={14} aria-hidden="true" />
          <span>Por privacidad solo mostramos datos parciales. Para consultas, llama a la central: <strong className="mono-tabular">{CENTRAL_PHONE}</strong>.</span>
        </footer>
      </div>
    </main>
  );
};
