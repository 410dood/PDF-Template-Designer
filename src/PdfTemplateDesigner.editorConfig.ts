type Properties = unknown[];

export function getProperties(
  _values: Record<string, unknown>,
  defaultConfiguration: Properties
): Properties {
  // Keep all properties visible and rely on property groups in XML for mode guidance.
  return defaultConfiguration;
}
