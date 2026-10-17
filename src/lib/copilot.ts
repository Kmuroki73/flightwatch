import type { DisruptionCategory, FlightPhase } from '@/types';

export type LegalJurisdiction = {
  code: 'EU261' | 'Kenya CAA' | 'US DOT' | 'General';
  title: string;
  thresholdNote: string;
  mealVoucherRight: string;
  claimBasis: string;
};

export type CompensationAssessment = {
  jurisdiction: LegalJurisdiction;
  qualifiesForCompensation: boolean;
  qualifiesForCare: boolean;
  delayMinutes: number | null;
  reason: string;
};

export function determineJurisdiction(carrierCountry: 'EU' | 'Kenya' | 'US' | 'other', departureAirport: string, arrivalAirport: string): LegalJurisdiction {
  const euAirports = isEuAirport(departureAirport) || isEuAirport(arrivalAirport);
  if (euAirports || carrierCountry === 'EU') {
    return {
      code: 'EU261',
      title: 'EU Regulation 261/2004',
      thresholdNote: 'Compensation applies from a 3-hour arrival delay at final destination, unless caused by extraordinary circumstances.',
      mealVoucherRight: 'After a 2-hour delay (by flight distance), the airline must provide meals, refreshments and communication.',
      claimBasis: 'Article 5 (care) and Article 7 (compensation).',
    };
  }
  if (carrierCountry === 'Kenya') {
    return {
      code: 'Kenya CAA',
      title: 'Kenya Civil Aviation (Consumer Protection) Regulations',
      thresholdNote: 'Care obligations typically apply from 2 hours; compensation depends on the operator policy and cause.',
      mealVoucherRight: 'Meals and refreshments are commonly provided for significant delays at the airline service desk.',
      claimBasis: 'KCAA consumer protection regulations and operator conditions of carriage.',
    };
  }
  if (carrierCountry === 'US') {
    return {
      code: 'US DOT',
      title: 'US Department of Transportation rules',
      thresholdNote: 'There is no federal compensation mandate for delays; airlines set their own commitments.',
      mealVoucherRight: 'Request meal vouchers under the airline customer service plan for long tarmac or gate delays.',
      claimBasis: 'The operating carrier\'s published customer service plan.',
    };
  }
  return {
    code: 'General',
    title: 'Operating carrier conditions of carriage',
    thresholdNote: 'Care during delays is governed by the carrier\'s conditions of carriage and local aviation rules.',
    mealVoucherRight: 'Ask the airline service desk about meal and refreshment support for long delays.',
    claimBasis: 'The operating carrier\'s conditions of carriage.',
  };
}

export function assessCompensation(input: {
  disruption: DisruptionCategory;
  phase: FlightPhase;
  arrivalDelayMinutes: number | null;
  departureDelayMinutes: number | null;
  jurisdiction: LegalJurisdiction;
}): CompensationAssessment {
  const delayMinutes = input.arrivalDelayMinutes ?? input.departureDelayMinutes;
  const cancelled = input.disruption === 'cancelled';
  const delayed3h = delayMinutes != null && delayMinutes >= 180;
  const qualifiesForCompensation = (input.jurisdiction.code === 'EU261' || input.jurisdiction.code === 'Kenya CAA') && (cancelled || delayed3h);
  const qualifiesForCare = cancelled || (delayMinutes != null && delayMinutes >= 120);
  return {
    jurisdiction: input.jurisdiction,
    qualifiesForCompensation,
    qualifiesForCare,
    delayMinutes,
    reason: cancelled
      ? 'A confirmed cancellation triggers care obligations immediately and compensation where the regulation applies and no extraordinary circumstances are invoked.'
      : delayed3h
        ? 'The reported arrival delay meets the 3-hour compensation threshold.'
        : delayMinutes != null
          ? 'The current delay is below the compensation threshold, but care rights may still apply.'
          : 'No verified delay duration is available yet, so compensation cannot be assessed.',
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
  const { delayMinutes } = input.assessment;
  const delayText = delayMinutes != null ? `${Math.round(delayMinutes / 60 * 10) / 10} hours (${delayMinutes} minutes)` : 'a significant delay';
  return [
    `To: ${input.assessment.jurisdiction.code === 'EU261' ? 'Airline Passenger Rights Desk' : 'Airline Service Desk'}`,
    '',
    `Subject: Claim for care and compensation - Flight ${input.flightNumber}, ${input.date}`,
    '',
    `Dear Sir or Madam,`,
    '',
    `On ${input.date}, flight ${input.flightNumber} from ${input.from} to ${input.to} was ${input.assessment.reason.toLowerCase().startsWith('a confirmed cancellation') ? 'cancelled' : `delayed by ${delayText}`}.`,
    input.bookingReference ? `Booking reference: ${input.bookingReference}.` : '',
    '',
    `Under ${input.assessment.jurisdiction.title} (${input.assessment.jurisdiction.claimBasis}) I request:`,
    `1. Meal and refreshment vouchers${input.assessment.qualifiesForCare ? '' : ' as applicable'} at the airport service desk.`,
    input.assessment.qualifiesForCompensation
      ? '2. The statutory compensation payment for this disruption.'
      : '2. A written explanation of the cause of this disruption.',
    '3. Confirmation of any rebooking or refund options available to me.',
    '',
    'Please respond within the statutory response period.',
    '',
    'Kind regards,',
    '[Your name]',
  ].filter(Boolean).join('\n');
}

export function carrierCountryFromCode(airlineCode: string): 'EU' | 'Kenya' | 'US' | 'other' {
  const euCarriers = ['BA', 'LH', 'AF', 'KL', 'IB', 'FR', 'SK', 'AZ', 'TP', 'EW', 'LS'];
  const usCarriers = ['AA', 'DL', 'UA', 'WN', 'B6', 'AS'];
  if (euCarriers.includes(airlineCode)) return 'EU';
  if (usCarriers.includes(airlineCode)) return 'US';
  if (airlineCode === 'KQ') return 'Kenya';
  return 'other';
}

function isEuAirport(code: string): boolean {
  const euHubs = ['LHR', 'LGW', 'STN', 'CDG', 'ORY', 'AMS', 'FRA', 'MUC', 'MAD', 'BCN', 'FCO', 'DUB', 'LIS', 'ZRH', 'VIE', 'CPH', 'ARN', 'OSL', 'HEL', 'BRU'];
  return euHubs.includes(code.toUpperCase());
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
    `✈️ Songa Flight Companion`,
    `${flight.flightNumber} · ${flight.origin.city} → ${flight.destination.city}`,
    `Status: ${flight.status}`,
    flight.statusDetail,
  ];
  if (gateModule) {
    lines.push('', `🚶 Gate-to-gate: from ${gateModule.arrivalGate} to ${gateModule.target} — about ${gateModule.transitMinutes} min walk.`);
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
      target: `Gate ${input.connectingGate}`,
      targetKind: 'connecting gate',
      transitMinutes: Math.min(45, Math.max(5, gateGap * perGate + 8)),
      steps: [
        `Leave the aircraft at ${input.arrivalGate} and follow the connecting flights signs.`,
        'Pass security/transfer control if your connection requires it.',
        `Walk to Gate ${input.connectingGate} - allow time for the terminal shuttle if signs indicate one.`,
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
      `Leave the aircraft at ${input.arrivalGate}.`,
      'Follow the Arrivals / Baggage claim signs for your terminal.',
      'Collect your bags, then clear customs through the green or red channel.',
    ],
  };
}
