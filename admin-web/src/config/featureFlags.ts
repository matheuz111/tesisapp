import type { FeatureFlags } from '../types/canonical';

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  ENABLE_OPERATIONAL_MAP_V2: true,
  ENABLE_PROVIDER_PRESENCE: true,
  ENABLE_DYNAMIC_PRICING_POLICIES: true,
  ENABLE_BACKGROUND_LOCATION_CONSENT: true,
  ENABLE_AI_DISPATCH_TRIAGE: false,
  ENABLE_META_WHATSAPP_INTEGRATION: false,
};

export const FEATURE_FLAGS = DEFAULT_FEATURE_FLAGS;

export function getFeatureFlag<K extends keyof FeatureFlags>(flag: K): boolean {
  return DEFAULT_FEATURE_FLAGS[flag];
}
