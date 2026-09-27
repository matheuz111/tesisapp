import type { OperationalZone, PricingPolicy } from '../types/canonical';

export const DEFAULT_TECHNICAL_VISIT_POLICY: PricingPolicy = {
  id: 'POL-VISIT-2026-BASE',
  name: 'Tarifa Estándar de Visita Técnica y Diagnóstico',
  zone: 'ALL',
  specialty: 'ALL',
  defaultVisitFeeCents: 5000, // S/ 50.00
  currency: 'PEN',
  isActive: true,
  effectiveFrom: '2026-01-01',
  effectiveTo: '2026-12-31',
  conditions: [
    'Incluye traslado y diagnóstico técnico en sitio',
    'Monto deducible del presupuesto final si el cliente aprueba la reparación',
    'Válido en Lima Norte, Lima Centro, Lima Sur, Lima Este y Callao',
    'Cancelación sin costo hasta 30 minutos antes de la hora programada',
  ],
  deductibleFromTotal: true,
};

export const ACTIVE_POLICIES: PricingPolicy[] = [
  DEFAULT_TECHNICAL_VISIT_POLICY,
  {
    id: 'POL-VISIT-CALLAO-2026',
    name: 'Tarifa Visita Callao / Ventanilla',
    zone: 'CALLAO',
    specialty: 'ALL',
    defaultVisitFeeCents: 5000,
    currency: 'PEN',
    isActive: true,
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    conditions: [
      'Incluye traslado y diagnóstico técnico en Callao y Ventanilla',
      'Monto 100% deducible de la mano de obra',
    ],
    deductibleFromTotal: true,
  },
];

export function resolvePricingPolicy(
  zone?: OperationalZone,
  specialty?: string,
  nowIso: string = new Date().toISOString()
): PricingPolicy {
  const currentDate = nowIso.slice(0, 10);

  if (zone && specialty) {
    const match = ACTIVE_POLICIES.find(
      (p) =>
        p.isActive &&
        p.zone === zone &&
        p.specialty.toUpperCase() === specialty.toUpperCase() &&
        p.effectiveFrom <= currentDate &&
        (!p.effectiveTo || p.effectiveTo >= currentDate)
    );
    if (match) return match;
  }

  if (zone) {
    const zoneMatch = ACTIVE_POLICIES.find(
      (p) =>
        p.isActive &&
        p.zone === zone &&
        p.specialty === 'ALL' &&
        p.effectiveFrom <= currentDate &&
        (!p.effectiveTo || p.effectiveTo >= currentDate)
    );
    if (zoneMatch) return zoneMatch;
  }

  return DEFAULT_TECHNICAL_VISIT_POLICY;
}

export function formatPriceCents(cents: number): string {
  return `S/. ${(cents / 100).toFixed(2)}`;
}

export function getDefaultVisitFee(zone?: OperationalZone, specialty?: string): number {
  const policy = resolvePricingPolicy(zone, specialty);
  return centsToSoles(policy.defaultVisitFeeCents);
}

export function getFormattedVisitFee(
  policyOrZone?: PricingPolicy | OperationalZone,
  specialty?: string
): string {
  let policy: PricingPolicy;
  if (typeof policyOrZone === 'object' && policyOrZone !== null && 'defaultVisitFeeCents' in policyOrZone) {
    policy = policyOrZone;
  } else {
    policy = resolvePricingPolicy(policyOrZone as OperationalZone | undefined, specialty);
  }
  const priceStr = formatPriceCents(policy.defaultVisitFeeCents);
  return policy.deductibleFromTotal
    ? `Visita técnica: ${priceStr} (Deducible)`
    : `Visita técnica: ${priceStr}`;
}

export function solesToCents(soles: number | string): number {
  const num = typeof soles === 'string' ? parseFloat(soles) : soles;
  if (isNaN(num) || num < 0) return 0;
  return Math.round(num * 100);
}

export function centsToSoles(cents: number): number {
  if (!cents || isNaN(cents)) return 0;
  return Number((cents / 100).toFixed(2));
}

/**
 * Extracts canonical pricing amount in soles, safely handling both canonical and legacy formats.
 */
export function getPricingAmountInSoles(
  pricing?: {
    amountCents?: number;
    price?: number;
  } | null,
  priceAgreed?: string
): number {
  if (pricing?.amountCents) {
    return pricing.amountCents / 100;
  }
  if (typeof pricing?.price === 'number') {
    return pricing.price;
  }
  if (priceAgreed) {
    const match = priceAgreed.match(/(\d+(\.\d+)?)/);
    if (match) return parseFloat(match[1]);
  }
  return getDefaultVisitFee();
}

/**
 * Canonical pricing adapter for backwards compatibility with legacy requests.
 */
export function resolveRequestCanonicalPricing(
  req: {
    pricing?: { amountCents?: number; price?: number } | null;
    technicalVisitFee?: number | null;
    price_agreed?: string | null;
    zone?: OperationalZone;
    specialty?: string;
  }
): { fee: number; formatted: string; amountCents: number } {
  if (req?.pricing?.amountCents) {
    const fee = centsToSoles(req.pricing.amountCents);
    return {
      fee,
      formatted: req.price_agreed || `S/. ${fee.toFixed(2)}`,
      amountCents: req.pricing.amountCents,
    };
  }

  if (typeof req?.technicalVisitFee === 'number' && req.technicalVisitFee > 0) {
    return {
      fee: req.technicalVisitFee,
      formatted: req.price_agreed || `Visita técnica: S/. ${req.technicalVisitFee.toFixed(2)} (Deducible)`,
      amountCents: solesToCents(req.technicalVisitFee),
    };
  }

  const defaultFee = getDefaultVisitFee(req?.zone, req?.specialty);
  return {
    fee: defaultFee,
    formatted: req?.price_agreed || getFormattedVisitFee(req?.zone, req?.specialty),
    amountCents: solesToCents(defaultFee),
  };
}
