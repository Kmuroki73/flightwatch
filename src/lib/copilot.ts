import type { DisruptionCategory, FlightPhase } from '@/types';

export type CarrierCountry = 'UK' | 'EU' | 'EEA' | 'CH' | 'Kenya' | 'US' | 'other';

export type LegalJurisdiction = {
  code: 'UK261' | 'EU261' | 'Kenya CAA' | 'US DOT' | 'General';
  title: string;
  thresholdNote: string;
  mealVoucherRight: string;
  claimBasis: string;
  routeCoverageNote: string;
};

export type CompensationEstimate = {
  amount: number;
  currency: 'GBP';
  basis: string;
};

export type CompensationAssessment = {
  jurisdiction: LegalJurisdiction;
  qualifiesForCompensation: boolean;
  qualifiesForCare: boolean;
  delayMinutes: number | null;
  reason: string;
  distanceKm: number | null;
  careThresholdMinutes: number | null;
  refundOptionAvailable: boolean;
  compensationEstimate: CompensationEstimate | null;
  limitations: string[];
};

type Airport = { country: string; latitude: number; longitude: number };

// A deliberately conservative reference set for common UK-first routes.
// Unknown airport codes are not guessed: add a maintained airport dataset before
// extending route-coverage or distance estimates to the full global network.
const AIRPORTS: Record<string, Airport> = {
  LHR: { country: 'GB', latitude: 51.4700, longitude: -0.4543 },
  LGW: { country: 'GB', latitude: 51.1537, longitude: -0.1821 },
  STN: { country: 'GB', latitude: 51.8850, longitude: 0.2350 },
  LTN: { country: 'GB', latitude: 51.8747, longitude: -0.3683 },
  LCY: { country: 'GB', latitude: 51.5053, longitude: 0.0553 },
  MAN: { country: 'GB', latitude: 53.3650, longitude: -2.2727 },
  EDI: { country: 'GB', latitude: 55.9500, longitude: -3.3725 },
  GLA: { country: 'GB', latitude: 55.8719, longitude: -4.4331 },
  BHX: { country: 'GB', latitude: 52.4539, longitude: -1.7480 },
  BRS: { country: 'GB', latitude: 51.3827, longitude: -2.7191 },
  NCL: { country: 'GB', latitude: 55.0375, longitude: -1.6917 },
  LPL: { country: 'GB', latitude: 53.3336, longitude: -2.8497 },
  ABZ: { country: 'GB', latitude: 57.2019, longitude: -2.1978 },
  BFS: { country: 'GB', latitude: 54.6575, longitude: -6.2158 },
  EMA: { country: 'GB', latitude: 52.8311, longitude: -1.3281 },
  CDG: { country: 'FR', latitude: 49.0097, longitude: 2.5479 },
  ORY: { country: 'FR', latitude: 48.7262, longitude: 2.3652 },
  AMS: { country: 'NL', latitude: 52.3105, longitude: 4.7683 },
  FRA: { country: 'DE', latitude: 50.0379, longitude: 8.5622 },
  MUC: { country: 'DE', latitude: 48.3538, longitude: 11.7861 },
  BER: { country: 'DE', latitude: 52.3667, longitude: 13.5033 },
  MAD: { country: 'ES', latitude: 40.4983, longitude: -3.5676 },
  BCN: { country: 'ES', latitude: 41.2974, longitude: 2.0833 },
  PMI: { country: 'ES', latitude: 39.5517, longitude: 2.7388 },
  FCO: { country: 'IT', latitude: 41.8003, longitude: 12.2389 },
  MXP: { country: 'IT', latitude: 45.6306, longitude: 8.7281 },
  LIN: { country: 'IT', latitude: 45.4451, longitude: 9.2767 },
  VCE: { country: 'IT', latitude: 45.5053, longitude: 12.3519 },
  ZRH: { country: 'CH', latitude: 47.4581, longitude: 8.5555 },
  GVA: { country: 'CH', latitude: 46.2381, longitude: 6.1089 },
  BRU: { country: 'BE', latitude: 50.9010, longitude: 4.4844 },
  CPH: { country: 'DK', latitude: 55.6181, longitude: 12.6561 },
  ARN: { country: 'SE', latitude: 59.6519, longitude: 17.9186 },
  OSL: { country: 'NO', latitude: 60.1939, longitude: 11.1004 },
  HEL: { country: 'FI', latitude: 60.3172, longitude: 24.9633 },
  DUB: { country: 'IE', latitude: 53.4264, longitude: -6.2499 },
  LIS: { country: 'PT', latitude: 38.7742, longitude: -9.1342 },
  OPO: { country: 'PT', latitude: 41.2421, longitude: -8.6781 },
  ATH: { country: 'GR', latitude: 37.9364, longitude: 23.9445 },
  PRG: { country: 'CZ', latitude: 50.1008, longitude: 14.2632 },
  WAW: { country: 'PL', latitude: 52.1657, longitude: 20.9671 },
  BUD: { country: 'HU', latitude: 47.4298, longitude: 19.2611 },
  VIE: { country: 'AT', latitude: 48.1103, longitude: 16.5697 },
  RIX: { country: 'LV', latitude: 56.9236, longitude: 23.9711 },
  TLL: { country: 'EE', latitude: 59.4133, longitude: 24.8328 },
  VNO: { country: 'LT', latitude: 54.6872, longitude: 25.2797 },
  OTP: { country: 'RO', latitude: 44.5711, longitude: 26.0850 },
  SOF: { country: 'BG', latitude: 42.6967, longitude: 23.4114 },
  ZAG: { country: 'HR', latitude: 45.7429, longitude: 16.0688 },
  LJU: { country: 'SI', latitude: 46.2237, longitude: 14.4576 },
  LUX: { country: 'LU', latitude: 49.6233, longitude: 6.2044 },
  JFK: { country: 'US', latitude: 40.6413, longitude: -73.7781 },
  EWR: { country: 'US', latitude: 40.6895, longitude: -74.1745 },
  BOS: { country: 'US', latitude: 42.3656, longitude: -71.0096 },
  ORD: { country: 'US', latitude: 41.9742, longitude: -87.9073 },
  IAD: { country: 'US', latitude: 38.9531, longitude: -77.4565 },
  LAX: { country: 'US', latitude: 33.9416, longitude: -118.4085 },
  SFO: { country: 'US', latitude: 37.6213, longitude: -122.3790 },
  MIA: { country: 'US', latitude: 25.7959, longitude: -80.2870 },
  ATL: { country: 'US', latitude: 33.6407, longitude: -84.4277 },
  DXB: { country: 'AE', latitude: 25.2532, longitude: 55.3657 },
  DOH: { country: 'QA', latitude: 25.2731, longitude: 51.6081 },
  AUH: { country: 'AE', latitude: 24.4330, longitude: 54.6511 },
  NBO: { country: 'KE', latitude: -1.3192, longitude: 36.9278 },
  CPT: { country: 'ZA', latitude: -33.9700, longitude: 18.6021 },
  JNB: { country: 'ZA', latitude: -26.1367, longitude: 28.2411 },
  SIN: { country: 'SG', latitude: 1.3644, longitude: 103.9915 },
  HKG: { country: 'HK', latitude: 22.3080, longitude: 113.9185 },
  HND: { country: 'JP', latitude: 35.5494, longitude: 139.7798 },
  NRT: { country: 'JP', latitude: 35.7720, longitude: 140.3929 },
  DEL: { country: 'IN', latitude: 28.5562, longitude: 77.1000 },
  BOM: { country: 'IN', latitude: 19.0896, longitude: 72.8656 },
};

const EU_EEA_AND_SWISS_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
  'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'CH',
]);

export function getAirportCountryCode(airportCode: string): string | null {
  return AIRPORTS[airportCode.trim().toUpperCase()]?.country ?? null;
}

export function getFlightDistanceKm(originCode: string, destinationCode: string): number | null {
  const origin = AIRPORTS[originCode.trim().toUpperCase()];
  const destination = AIRPORTS[destinationCode.trim().toUpperCase()];
  if (!origin || !destination) return null;

  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(destination.latitude - origin.latitude);
  const longitudeDelta = radians(destination.longitude - origin.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(origin.latitude)) * Math.cos(radians(destination.latitude))
    * Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function determineJurisdiction(
  carrierCountry: CarrierCountry,
  departureAirport: string,
  arrivalAirport: string,
): LegalJurisdiction {
  const departureCountry = getAirportCountryCode(departureAirport);
  const arrivalCountry = getAirportCountryCode(arrivalAirport);

  // UK261 is a UK regime after EU exit. A UK departure is covered regardless
  // of carrier nationality. A flight arriving in the UK is covered when
  // operated by a UK or EU/EEA carrier.
  if (departureCountry === 'GB' || (arrivalCountry === 'GB' && (carrierCountry === 'UK' || carrierCountry === 'EU'))) {
    return {
      code: 'UK261',
      title: 'UK Regulation (EC) No 261/2004 (UK261)',
      thresholdNote: 'For a delay claim, the passenger generally needs to reach the final destination at least 3 hours late. Cancellation eligibility depends on notice, rerouting and cause.',
      mealVoucherRight: 'Care thresholds depend on expected departure delay and flight distance: 2 hours up to 1,500 km, 3 hours from 1,500–3,500 km, and 4 hours above 3,500 km.',
      claimBasis: 'UK261, including Articles 5, 6, 7, 8 and 9, as applicable to the route and disruption.',
      routeCoverageNote: 'UK route coverage indicated from the mapped departure/arrival airport and operating-carrier category. Confirm the itinerary and operating carrier before relying on this assessment.',
    };
  }

  // EU261 applies to departures from the EU/EEA/Switzerland regardless of
  // carrier and to qualifying arrivals in that area on an EU/EEA/Swiss carrier.
  if ((departureCountry && EU_EEA_AND_SWISS_COUNTRIES.has(departureCountry))
      || (arrivalCountry && EU_EEA_AND_SWISS_COUNTRIES.has(arrivalCountry) && ['EU', 'EEA', 'CH'].includes(carrierCountry))) {
    return {
      code: 'EU261',
      title: 'EU Regulation 261/2004 (EU261)',
      thresholdNote: 'For long-delay compensation, arrival at the final destination is generally at least 3 hours late. Cancellation and extraordinary-circumstance rules also apply.',
      mealVoucherRight: 'Care thresholds depend on expected departure delay and flight distance. Check the applicable national enforcement guidance.',
      claimBasis: 'Regulation (EC) No 261/2004, including Articles 5, 6, 7, 8 and 9, as applicable.',
      routeCoverageNote: 'EU/EEA/Swiss route coverage is indicated from the mapped airports and carrier category. Confirm the itinerary and operating carrier.',
    };
  }

  if (carrierCountry === 'Kenya') {
    return {
      code: 'Kenya CAA',
      title: 'Kenya Civil Aviation consumer-protection rules',
      thresholdNote: 'A route-specific assessment is required. Applicable assistance and compensation depend on the current regulation, carrier and circumstances.',
      mealVoucherRight: 'Ask the operating airline for its applicable care and assistance policy. This tool does not calculate a Kenyan statutory threshold.',
      claimBasis: 'Applicable Kenya Civil Aviation consumer-protection rules and the operating carrier conditions of carriage.',
      routeCoverageNote: 'This is a general Kenya-related carrier indicator, not a legal determination that Kenyan rules govern the itinerary.',
    };
  }

  if (carrierCountry === 'US') {
    return {
      code: 'US DOT',
      title: 'US Department of Transportation / carrier policy',
      thresholdNote: 'US federal rules do not create a general fixed cash-compensation entitlement for ordinary delays. Rights depend on the disruption and airline policy.',
      mealVoucherRight: 'Check the operating carrier customer-service commitments and refund rules for the specific disruption.',
      claimBasis: 'Applicable US DOT rules and the operating carrier customer-service plan.',
      routeCoverageNote: 'A US carrier code alone does not establish that US law governs the journey.',
    };
  }

  const unknownRoute = !departureCountry || !arrivalCountry;
  return {
    code: 'General',
    title: 'Route-specific passenger-rights review needed',
    thresholdNote: 'Songa could not confidently determine the applicable passenger-rights regime from the available airport and operating-carrier data.',
    mealVoucherRight: 'Ask the operating airline for its care, rebooking and refund options while the route is checked.',
    claimBasis: 'The route, operating carrier, ticket conditions and local passenger-rights rules must be reviewed.',
    routeCoverageNote: unknownRoute
      ? 'One or both airport codes are outside the current verified airport reference set. No jurisdiction has been inferred.'
      : 'The current route/carrier combination does not establish UK261 or EU261 coverage from the supported rules.',
  };
}

export function assessCompensation(input: {
  disruption: DisruptionCategory;
  phase: FlightPhase;
  arrivalDelayMinutes: number | null;
  departureDelayMinutes: number | null;
  jurisdiction: LegalJurisdiction;
  distanceKm?: number | null;
}): CompensationAssessment {
  const arrivalDelay = input.arrivalDelayMinutes;
  const departureDelay = input.departureDelayMinutes;
  const cancelled = input.disruption === 'cancelled';
  const distanceKm = input.distanceKm ?? null;
  const distanceBand = distanceKm == null
    ? null
    : distanceKm < 1500 ? 'short'
      : distanceKm <= 3500 ? 'medium' : 'long';
  const careThresholdMinutes = distanceBand === 'short' ? 120
    : distanceBand === 'medium' ? 180
      : distanceBand === 'long' ? 240 : null;

  const isUkOrEu = input.jurisdiction.code === 'UK261' || input.jurisdiction.code === 'EU261';
  const qualifiesForCompensation = isUkOrEu
    ? cancelled || (arrivalDelay != null && arrivalDelay >= 180)
    : input.jurisdiction.code === 'Kenya CAA'
      ? cancelled || (arrivalDelay != null && arrivalDelay >= 180)
      : false;

  let qualifiesForCare = false;
  if (cancelled) {
    qualifiesForCare = isUkOrEu;
  } else if (isUkOrEu && careThresholdMinutes != null && departureDelay != null) {
    qualifiesForCare = departureDelay >= careThresholdMinutes;
  }

  const refundOptionAvailable = isUkOrEu && departureDelay != null && departureDelay >= 300;
  let compensationEstimate: CompensationEstimate | null = null;
  if (input.jurisdiction.code === 'UK261' && !cancelled && arrivalDelay != null && qualifiesForCompensation && distanceBand && distanceKm != null) {
    const amount = distanceBand === 'short' ? 220
      : distanceBand === 'medium' ? 350
        : arrivalDelay != null && arrivalDelay < 240 ? 260 : 520;
    compensationEstimate = {
      amount,
      currency: 'GBP',
      basis: distanceBand === 'long' && amount === 260
        ? 'Long-haul UK261 estimate for an arrival delay between 3 and 4 hours.'
        : 'UK261 distance band estimate before checking any permitted rerouting reduction.',
    };
  }

  const limitations: string[] = [];
  if (isUkOrEu) {
    limitations.push('Compensation is not automatic. The operating carrier may rely on extraordinary circumstances where the law permits.');
    if (cancelled) limitations.push('For cancellation, check when the passenger was notified and the arrival time offered by any alternative flight.');
    if (distanceKm == null) limitations.push('The route distance is not available from the built-in airport reference set, so Songa has not estimated a compensation amount or care threshold.');
    if (arrivalDelay == null && !cancelled) limitations.push('A departure delay is not a substitute for the verified arrival delay used in a long-delay compensation assessment.');
  }

  let reason: string;
  if (input.jurisdiction.code === 'UK261') {
    if (cancelled) {
      reason = 'The cancellation may give rise to care, rerouting or refund rights and possibly compensation. Notice period, alternative-flight timing and the reason for cancellation must be checked.';
    } else if (arrivalDelay != null && arrivalDelay >= 180) {
      reason = 'The reported arrival delay has reached the general 3-hour UK261 compensation threshold. The airline cause, final arrival time, itinerary and any rerouting reduction still need review.';
    } else if (arrivalDelay != null) {
      reason = 'The reported arrival delay is below the general 3-hour UK261 compensation threshold. Care rights use the expected departure delay and a separate distance-based threshold.';
    } else {
      reason = 'No verified arrival-delay duration is available, so Songa cannot assess the UK261 long-delay compensation threshold.';
    }
  } else if (input.jurisdiction.code === 'EU261') {
    reason = cancelled
      ? 'The cancellation may give rise to care, rerouting or refund rights and possibly compensation. Notice period, alternative-flight timing and extraordinary circumstances must be checked.'
      : arrivalDelay != null && arrivalDelay >= 180
        ? 'The reported arrival delay has reached the general 3-hour EU261 compensation threshold. The operating carrier, route and extraordinary-circumstance rules still need review.'
        : 'No verified arrival delay meeting the general 3-hour EU261 threshold is available. Care uses a separate departure-delay threshold.';
  } else {
    reason = 'This route needs a jurisdiction-specific review. Songa will not infer a compensation entitlement from a departure delay or carrier nationality alone.';
  }

  return {
    jurisdiction: input.jurisdiction,
    qualifiesForCompensation,
    qualifiesForCare,
    delayMinutes: arrivalDelay,
    reason,
    distanceKm,
    careThresholdMinutes,
    refundOptionAvailable,
    compensationEstimate,
    limitations,
  };
}

export function buildClaimText(input: {
  flightNumber: string;
  date: string;
  from: string;
  to: string;
  assessment: CompensationAssessment;
  bookingReference?: string;
}): string {
  const { assessment } = input;
  const arrivalDelay = assessment.delayMinutes != null
    ? Math.round(assessment.delayMinutes / 60 * 10) / 10 + ' hours'
    : 'an unconfirmed delay';
  const lines = [
    'To: Operating airline customer relations / passenger-rights team',
    '',
    'Subject: Request for review of disruption - Flight ' + input.flightNumber + ', ' + input.date,
    '',
    'Dear Customer Relations Team,',
    '',
    'I am requesting a written review of the disruption to flight ' + input.flightNumber + ' from ' + input.from + ' to ' + input.to + ' on ' + input.date + '.',
    'Booking reference: ' + (input.bookingReference || '[Add booking reference]') + '.',
    'Reported disruption: ' + (assessment.jurisdiction.code === 'UK261' || assessment.jurisdiction.code === 'EU261' ? assessment.reason : 'Please confirm the disruption and the passenger-rights rules applicable to this itinerary.'),
    'Available timing information: ' + arrivalDelay + ' reported delay. Please confirm the actual arrival delay at the final destination.',
    '',
    'Please provide:',
    '1. The specific operational reason for the delay or cancellation.',
    '2. Details of any care, refreshments, accommodation, rerouting or refund options available to me.',
    '3. Confirmation of whether compensation is payable under ' + assessment.jurisdiction.title + ', including the calculation and any reason for refusal.',
    '',
    'I understand that eligibility depends on the route, operating carrier, actual arrival time, notice and rerouting details, and any applicable extraordinary circumstances. This message is a request for assessment, not a statement that compensation has already been approved.',
    '',
    'Kind regards,',
    '[Your name]',
  ];
  return lines.join('\n');
}

export function carrierCountryFromCode(airlineCode: string): CarrierCountry {
  const code = airlineCode.trim().toUpperCase();
  const ukCarriers = ['BA', 'BAW', 'VS', 'VIR', 'U2', 'EZY', 'LS', 'EXS', 'LM', 'LOG', 'BY', 'TOM'];
  const euCarriers = ['LH', 'DLH', 'OS', 'AUA', 'SN', 'BEL', 'KL', 'AF', 'AFR', 'FR', 'RYR', 'EI', 'EIN', 'IB', 'IBE', 'VY', 'VLG', 'TP', 'TAP', 'AZ', 'ITY', 'SK', 'SAS', 'AY', 'FIN', 'BT', 'BTI', 'LO', 'LOT', 'OK', 'OU', 'A3'];
  const eeaCarriers = ['DY', 'NOZ', 'WF'];
  const usCarriers = ['AA', 'DL', 'UA', 'WN', 'B6', 'AS'];
  if (ukCarriers.includes(code)) return 'UK';
  if (euCarriers.includes(code)) return 'EU';
  if (eeaCarriers.includes(code)) return 'EEA';
  if (code === 'LX' || code === 'SWR') return 'CH';
  if (usCarriers.includes(code)) return 'US';
  if (code === 'KQ') return 'Kenya';
  return 'other';
}

export function buildWhatsAppPreview(flight: {
  flightNumber: string;
  airline: string;
  origin: { code: string; city: string };
  destination: { code: string; city: string };
  status: string;
  statusDetail: string;
}, gateModule: { arrivalGate: string; target: string; transitMinutes: number } | null, claim?: { qualifies: boolean; text: string } | null): string {
  const lines = [
    '✈️ Songa Flight Companion',
    flight.flightNumber + ' · ' + flight.origin.city + ' → ' + flight.destination.city,
    'Status: ' + flight.status,
    flight.statusDetail,
  ];
  if (gateModule) {
    lines.push('', '🚶 Gate-to-gate: from ' + gateModule.arrivalGate + ' to ' + gateModule.target + ' — about ' + gateModule.transitMinutes + ' min walk.');
  }
  if (claim?.qualifies) {
    lines.push('', '📋 Your rights: this disruption may qualify for care or compensation. Your claim draft is ready in the dashboard.');
  }
  return lines.join('\n');
}

export type GateNavigation = {
  arrivalGate: string;
  target: string;
  targetKind: 'connecting gate' | 'baggage claim';
  transitMinutes: number;
  steps: string[];
};

export function buildGateNavigation(input: { arrivalGate: string; connectingGate?: string; terminalWalkMinutesPerGate?: number }): GateNavigation {
  const perGate = input.terminalWalkMinutesPerGate ?? 4;
  if (input.connectingGate) {
    const fromLetter = input.arrivalGate.replace(/[^A-Z]/gi, '') || 'A';
    const toLetter = input.connectingGate.replace(/[^A-Z]/gi, '') || 'A';
    const gateGap = Math.abs((toLetter.charCodeAt(0) || 65) - (fromLetter.charCodeAt(0) || 65)) || 1;
    return {
      arrivalGate: input.arrivalGate,
      target: 'Gate ' + input.connectingGate,
      targetKind: 'connecting gate',
      transitMinutes: Math.min(45, Math.max(5, gateGap * perGate + 8)),
      steps: [
        'Leave the aircraft at ' + input.arrivalGate + ' and follow the connecting flights signs.',
        'Pass security/transfer control if your connection requires it.',
        'Walk to Gate ' + input.connectingGate + ' - allow time for the terminal shuttle if signs indicate one.',
        'Check the departure boards once more before boarding.',
      ],
    };
  }
  return {
    arrivalGate: input.arrivalGate,
    target: 'Baggage claim & exits',
    targetKind: 'baggage claim',
    transitMinutes: Math.min(30, Math.max(6, perGate * 3 + 6)),
    steps: [
      'Leave the aircraft at ' + input.arrivalGate + '.',
      'Follow the Arrivals / Baggage claim signs for your terminal.',
      'Collect your bags, then clear customs through the green or red channel.',
    ],
  };
}
