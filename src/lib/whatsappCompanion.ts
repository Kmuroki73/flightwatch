import { supabase } from '@/lib/supabase';

export type ConnectionStatus = 'not_connected' | 'pending_verification' | 'verified';

export type CompanionConnection = {
  status: ConnectionStatus;
  phone: string | null;
  notificationsEnabled: boolean;
  consentGivenAt: string | null;
  linkedAt: string | null;
  preferences: {
    notifyDelayChanges: boolean;
    notifyCancellationDiversion: boolean;
    notifyDepartureChanges: boolean;
    notifyArrivalUpdates: boolean;
  };
};

export type CompanionStatus = {
  connection: CompanionConnection | null;
  twilioConfigured: boolean;
};

export type CompanionError = { message: string; kind: 'not_configured' | 'conflict' | 'invalid' | 'auth' | 'unavailable' };

function companionUrl(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const custom = import.meta.env.VITE_WHATSAPP_LINK_FUNCTION_URL as string | undefined;
  if (custom) return custom;
  if (!supabaseUrl) throw new Error('Supabase is not configured.');
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/whatsapp-link`;
}

async function callLink(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!supabase) throw { kind: 'auth', message: 'Sign in to Songa first.' } as CompanionError;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) throw { kind: 'auth', message: 'Sign in to Songa first.' } as CompanionError;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionData.session.access_token}`,
  };
  const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (apiKey) headers.apikey = apiKey;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(companionUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload && typeof payload === 'object' && 'message' in payload && typeof (payload as { message?: unknown }).message === 'string'
        ? (payload as { message: string }).message
        : 'The WhatsApp service could not be reached.';
      const errorKind = payload && typeof payload === 'object' && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : 'unavailable';
      const kind: CompanionError['kind'] =
        errorKind === 'not_configured' ? 'not_configured'
        : errorKind === 'already_linked' || errorKind === 'phone_taken' || errorKind === 'not_verified' || errorKind === 'not_started' ? 'conflict'
        : errorKind === 'invalid_request' || errorKind === 'invalid_code' || errorKind === 'send_failed' ? 'invalid'
        : errorKind === 'unauthenticated' ? 'auth'
        : 'unavailable';
      throw { kind, message } as CompanionError;
    }
    if (!payload || typeof payload !== 'object') {
      throw { kind: 'unavailable', message: 'The WhatsApp service returned an unsupported response.' } as CompanionError;
    }
    return payload as Record<string, unknown>;
  } catch (error) {
    if (error && typeof error === 'object' && 'kind' in error) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw { kind: 'unavailable', message: 'The WhatsApp service took too long to respond.' } as CompanionError;
    }
    throw { kind: 'unavailable', message: 'The WhatsApp service could not be reached.' } as CompanionError;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function loadCompanionStatus(): Promise<CompanionStatus> {
  const payload = await callLink({ action: 'status' });
  const raw = payload.connection as Record<string, unknown> | null;
  let connection: CompanionConnection | null = null;
  if (raw && typeof raw === 'object') {
    const status = raw.status === 'verified' ? 'verified' : raw.status === 'pending_verification' ? 'pending_verification' : 'not_connected';
    if (status !== 'not_connected') {
      const prefs = (raw.preferences ?? {}) as Record<string, unknown>;
      connection = {
        status,
        phone: typeof raw.phone === 'string' ? raw.phone : null,
        notificationsEnabled: raw.notificationsEnabled === true,
        consentGivenAt: typeof raw.consentGivenAt === 'string' ? raw.consentGivenAt : null,
        linkedAt: typeof raw.linkedAt === 'string' ? raw.linkedAt : null,
        preferences: {
          notifyDelayChanges: prefs.notifyDelayChanges === true,
          notifyCancellationDiversion: prefs.notifyCancellationDiversion === true,
          notifyDepartureChanges: prefs.notifyDepartureChanges === true,
          notifyArrivalUpdates: prefs.notifyArrivalUpdates === true,
        },
      };
    }
  }
  return { connection, twilioConfigured: payload.twilioConfigured === true };
}

export async function startLinking(phone: string): Promise<{ phone: string; delivery: string }> {
  const payload = await callLink({ action: 'start', phone });
  return {
    phone: typeof payload.phone === 'string' ? payload.phone : phone,
    delivery: typeof payload.delivery === 'string' ? payload.delivery : 'whatsapp_message',
  };
}

export async function verifyLink(phone: string, code: string): Promise<void> {
  await callLink({ action: 'verify', phone, code });
}

export async function disconnectLink(): Promise<void> {
  await callLink({ action: 'disconnect' });
}

export async function savePreferences(
  connection: CompanionConnection,
  updates: { notificationsEnabled?: boolean; preferences?: Partial<CompanionConnection['preferences']> },
): Promise<void> {
  const body: Record<string, unknown> = { action: 'preferences' };
  if (updates.notificationsEnabled === true && !connection.notificationsEnabled) body.consent = true;
  if (updates.notificationsEnabled === false) body.consent = false;
  if (updates.preferences) {
    body.preferences = {
      notifyDelayChanges: updates.preferences.notifyDelayChanges ?? connection.preferences.notifyDelayChanges,
      notifyCancellationDiversion: updates.preferences.notifyCancellationDiversion ?? connection.preferences.notifyCancellationDiversion,
      notifyDepartureChanges: updates.preferences.notifyDepartureChanges ?? connection.preferences.notifyDepartureChanges,
      notifyArrivalUpdates: updates.preferences.notifyArrivalUpdates ?? connection.preferences.notifyArrivalUpdates,
    };
  }
  await callLink(body);
}
