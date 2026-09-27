import { FeatureFlags } from '../types/canonical';

/**
 * Global Feature Flags for Maestro a Domicilio Operating System.
 * Controlled rollout for Fases 0, 1, 2, and forward phases.
 */
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  ENABLE_OPERATIONAL_MAP_V2: true,
  ENABLE_PROVIDER_PRESENCE: true,
  ENABLE_DYNAMIC_PRICING_POLICIES: true,
  ENABLE_BACKGROUND_LOCATION_CONSENT: true,
  ENABLE_AI_DISPATCH_TRIAGE: false, // Phase 6
  ENABLE_META_WHATSAPP_INTEGRATION: false, // Phase 5
};

export const FEATURE_FLAGS = DEFAULT_FEATURE_FLAGS;

export function getFeatureFlag<K extends keyof FeatureFlags>(flag: K): boolean {
  return DEFAULT_FEATURE_FLAGS[flag];
}
