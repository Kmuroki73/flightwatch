export type AirHelpCoverage = 'supported' | 'not-confirmed';

export type JourneyForRights = {
  departureCountryCode?: string;
  arrivalCountryCode?: string;
  operatingCarrier?: string;
  disruptionType?: 'delay' | 'cancellation' | 'denied-boarding' | 'missed-connection' | 'other';
};

/**
 * Partner coverage is deliberately separate from legal eligibility.
 * Configure only countries explicitly confirmed by the current affiliate agreement.
 * A supported country is not a promise that an individual claim qualifies.
 */
export function getAirHelpCoverage(
  countryCodes: Array<string | undefined>,
  configuredSupportedCountries = import.meta.env.VITE_AIRHELP_SUPPORTED_COUNTRIES ?? '',
): AirHelpCoverage {
  const supported = new Set(configuredSupportedCountries.split(',').map((value) => value.trim().toUpperCase()).filter(Boolean));
  const candidates = countryCodes.map((value) => value?.trim().toUpperCase()).filter((value): value is string => Boolean(value));
  if (!supported.size || !candidates.length) return 'not-confirmed';
  return candidates.some((country) => supported.has(country)) ? 'supported' : 'not-confirmed';
}

export function airHelpCoverageNote(coverage: AirHelpCoverage): string {
  return coverage === 'supported'
    ? 'AirHelp partner coverage is listed for this market. Claim acceptance depends on your route and circumstances.'
    : 'AirHelp partner coverage has not been confirmed for this market. You can still review your passenger rights.';
}
