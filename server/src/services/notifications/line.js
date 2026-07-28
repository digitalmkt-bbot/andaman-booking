import { config } from '../../config.js';

/**
 * LINE Messaging API push. Requires the user to have a linked LINE userId.
 * Here we assume a `lineUserId` could be stored on the user in a real deployment;
 * this adapter simply demonstrates the call. Uses global fetch (Node 18+).
 */
export async function sendLine({ user, text }) {
  if (!config.integrations.line.enabled || !config.integrations.line.token) return;
  const lineUserId = user.lineUserId;
  if (!lineUserId) return; // no linked LINE account

  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.integrations.line.token}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: 'text', text }],
    }),
  });
  if (!res.ok) throw new Error(`LINE push failed: ${res.status}`);
}
