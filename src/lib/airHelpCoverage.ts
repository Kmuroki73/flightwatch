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
  configuredSupportedCountries: string = import.meta.env.VITE_AIRHELP_SUPPORTED_COUNTRIES ?? '',
): AirHelpCoverage {
  const supported = new Set<string>();
  for (const rawCountry of configuredSupportedCountries.split(',')) {
    const country = rawCountry.trim().toUpperCase();
    if (country) supported.add(country);
  }

  const candidates: string[] = [];
  for (const rawCountry of countryCodes) {
    if (typeof rawCountry !== 'string') continue;
    const country = rawCountry.trim().toUpperCase();
    if (country) candidates.push(country);
  }

  if (supported.size === 0 || candidates.length === 0) return 'not-confirmed';
  return candidates.some((country: string) => supported.has(country)) ? 'supported' : 'not-confirmed';
}

export function airHelpCoverageNote(coverage: AirHelpCoverage): string {
  return coverage === 'supported'
    ? 'AirHelp partner coverage is listed for this market. Claim acceptance depends on your route and circumstances.'
    : 'AirHelp partner coverage has not been confirmed for this market. You can still review your passenger rights.';
}
