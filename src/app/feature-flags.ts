const TRUTHY_FEATURE_FLAGS = ["1", "true", "yes", "on"];
const FALSY_FEATURE_FLAGS = ["0", "false", "no", "off"];

export function parseFeatureFlag(rawValue: string | undefined, defaultValue: boolean): boolean {
  if (rawValue === undefined) return defaultValue;

  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (TRUTHY_FEATURE_FLAGS.includes(normalized)) return true;
  if (FALSY_FEATURE_FLAGS.includes(normalized)) return false;

  return defaultValue;
}
