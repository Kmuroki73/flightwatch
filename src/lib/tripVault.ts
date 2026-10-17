import type { Flight } from '@/types';
import { supabase } from '@/lib/supabase';

export type TripDocumentKind = 'boarding_pass' | 'receipt';

export type TripDocument = {
  id: string;
  kind: TripDocumentKind;
  flightNumber: string | null;
  travelDate: string | null;
  seatNumber: string | null;
  boardingGroup: string | null;
  cabinClass: string | null;
  merchant: string | null;
  totalAmount: number | null;
  currency: string | null;
  category: string | null;
  fileName: string | null;
  createdAt: string;
};

type TripDocumentRow = {
  id: string;
  kind: TripDocumentKind;
  flight_number: string | null;
  travel_date: string | null;
  seat_number: string | null;
  boarding_group: string | null;
  cabin_class: string | null;
  merchant: string | null;
  total_amount: number | null;
  currency: string | null;
  category: string | null;
  file_name: string | null;
  created_at: string;
};

export async function loadTripDocuments(): Promise<TripDocument[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('trip_documents')
    .select('id, kind, flight_number, travel_date, seat_number, boarding_group, cabin_class, merchant, total_amount, currency, category, file_name, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as TripDocumentRow[]).map(rowToDocument);
}

export async function saveTripDocument(input: Omit<TripDocument, 'id' | 'createdAt'>): Promise<TripDocument> {
  if (!supabase) throw new Error('Sign in to store documents in your Trip Workspace.');
  const { data, error } = await supabase
    .from('trip_documents')
    .insert({
      kind: input.kind,
      flight_number: input.flightNumber,
      travel_date: input.travelDate,
      seat_number: input.seatNumber,
      boarding_group: input.boardingGroup,
      cabin_class: input.cabinClass,
      merchant: input.merchant,
      total_amount: input.totalAmount,
      currency: input.currency,
      category: input.category,
      file_name: input.fileName,
    })
    .select('id, kind, flight_number, travel_date, seat_number, boarding_group, cabin_class, merchant, total_amount, currency, category, file_name, created_at')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('The document could not be saved.');
  return rowToDocument(data as TripDocumentRow);
}

export async function deleteTripDocument(id: string): Promise<void> {
  if (!supabase) throw new Error('Sign in to manage your Trip Workspace.');
  const { error } = await supabase.from('trip_documents').delete().eq('id', id);
  if (error) throw error;
}

export async function joinWhatsAppEarlyAccess(email: string): Promise<void> {
  if (!supabase) throw new Error('The early-access list is not available right now.');
  const { error } = await supabase.from('whatsapp_early_access').insert({ email });
  if (error) {
    if (error.code === '23505') throw new Error('That email is already on the early-access list.');
    throw new Error('The early-access list could not be reached. Please try again.');
  }
}

export function rowToDocument(row: TripDocumentRow): TripDocument {
  return {
    id: row.id,
    kind: row.kind,
    flightNumber: row.flight_number,
    travelDate: row.travel_date,
    seatNumber: row.seat_number,
    boardingGroup: row.boarding_group,
    cabinClass: row.cabin_class,
    merchant: row.merchant,
    totalAmount: row.total_amount == null ? null : Number(row.total_amount),
    currency: row.currency,
    category: row.category,
    fileName: row.file_name,
    createdAt: row.created_at,
  };
}

export function documentsToCsv(documents: TripDocument[]): string {
  const header = 'type,flight,date,seat,group,cabin,merchant,total,currency,category,file,logged_at';
  const rows = documents.map((doc) => [
    doc.kind,
    doc.flightNumber ?? '',
    doc.travelDate ?? '',
    doc.seatNumber ?? '',
    doc.boardingGroup ?? '',
    doc.cabinClass ?? '',
    doc.merchant ?? '',
    doc.totalAmount ?? '',
    doc.currency ?? '',
    doc.category ?? '',
    doc.fileName ?? '',
    doc.createdAt,
  ].map(csvEscape).join(','));
  return [header, ...rows].join('\n');
}

function csvEscape(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function documentFromFlightSample(flight: Flight, kind: TripDocumentKind, fileName: string): Omit<TripDocument, 'id' | 'createdAt'> {
  if (kind === 'boarding_pass') {
    return {
      kind,
      flightNumber: flight.flightNumber,
      travelDate: flight.date.slice(0, 10),
      seatNumber: '14A',
      boardingGroup: 'Group 2',
      cabinClass: 'Economy',
      merchant: null,
      totalAmount: null,
      currency: null,
      category: null,
      fileName,
    };
  }
  return {
    kind,
    flightNumber: flight.flightNumber,
    travelDate: flight.date.slice(0, 10),
    seatNumber: null,
    boardingGroup: null,
    cabinClass: null,
    merchant: 'Airport Bistro',
    totalAmount: 24.5,
    currency: 'EUR',
    category: 'Meal',
    fileName,
  };
}
