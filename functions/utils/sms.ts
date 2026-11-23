import { CafeSettingsRow } from '../api/owner/settings';

export interface SmsVariables {
  cafe_name: string;
  customer_name: string;
  bill_amount: number;
  points_redeemed: number;
  points_earned: number;
  points_balance: number;
}

export interface SmsResult {
  status: 'sent' | 'preview_only' | 'disabled' | 'failed';
  message: string;
  error?: string;
}

/**
 * Replaces template variables and dispatches SMS if configured.
 * Safely wrapped so network or provider errors never fail the order.
 */
export async function sendLoyaltySms(
  settings: CafeSettingsRow | null,
  customer: { name: string; phone: string; sms_consent: number },
  variables: SmsVariables
): Promise<SmsResult> {
  const defaultTemplate =
    'Thank you for visiting {{cafe_name}}! Bill: Rs.{{bill_amount}} | Points Earned: {{points_earned}} | Available Balance: {{points_balance}} pts.';

  const rawTemplate = settings?.sms_template?.trim() || defaultTemplate;

  // Render template
  const rendered = rawTemplate
    .replace(/\{\{cafe_name\}\}/g, variables.cafe_name || 'Kimmo’s Kitchen')
    .replace(/\{\{customer_name\}\}/g, variables.customer_name || 'Customer')
    .replace(/\{\{bill_amount\}\}/g, String(variables.bill_amount))
    .replace(/\{\{points_redeemed\}\}/g, String(variables.points_redeemed))
    .replace(/\{\{points_earned\}\}/g, String(variables.points_earned))
    .replace(/\{\{points_balance\}\}/g, String(variables.points_balance));

  // Check consent and system toggle
  if (!settings || settings.sms_enabled !== 1) {
    return {
      status: 'disabled',
      message: rendered,
    };
  }

  if (customer.sms_consent !== 1) {
    return {
      status: 'disabled',
      message: `${rendered} (SMS skipped: customer opted out of SMS)`,
    };
  }

  // If no API key is set, keep as preview_only
  if (!settings.sms_api_key || settings.sms_api_key.trim().length === 0) {
    return {
      status: 'preview_only',
      message: rendered,
    };
  }

  // If API key is present, attempt dispatch to SMS provider (e.g., MSG91 or generic webhook)
  try {
    const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
    const senderId = settings.sms_sender_id?.trim() || 'CAFEDL';

    // Dispatches to standard REST SMS endpoint
    const response = await fetch('https://api.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: settings.sms_api_key.trim(),
      },
      body: JSON.stringify({
        sender: senderId,
        recipients: [
          {
            mobiles: cleanPhone,
            message: rendered,
          },
        ],
      }),
    });

    if (response.ok) {
      return { status: 'sent', message: rendered };
    } else {
      const errText = await response.text();
      return {
        status: 'failed',
        message: rendered,
        error: `Gateway returned status ${response.status}: ${errText.slice(0, 100)}`,
      };
    }
  } catch (err: any) {
    // SMS failures should never roll back completed checkout
    return {
      status: 'failed',
      message: rendered,
      error: err.message || 'Network error dispatching SMS',
    };
  }
}
