// Expo push delivery.
//
// Uses the Expo Push API, which fans out to APNs and FCM. Tokens that Expo
// reports as invalid are removed so a dead device does not keep costing a
// request on every send (§28).

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  channelId?: string;
  badge?: number;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

/**
 * Send messages in batches of 100, the documented Expo limit.
 * Returns the tokens Expo reported as permanently unusable.
 */
export const sendPushMessages = async (messages: PushMessage[]): Promise<string[]> => {
  const deadTokens: string[] = [];
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept-encoding': 'gzip, deflate',
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      console.error('expo push failed', response.status, await response.text());
      continue;
    }

    const payload = (await response.json()) as { data?: ExpoTicket[] };
    (payload.data ?? []).forEach((ticket, index) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        const token = batch[index]?.to;
        if (token) deadTokens.push(token);
      }
    });
  }

  return deadTokens;
};
