import { Env } from '../../types';
import { authenticate } from '../../utils/auth';
import { ensureSchema } from '../../utils/ensureSchema';
import { MenuItem } from '../owner/menu/index';
import { CafeSettingsRow } from '../owner/settings';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;

  try {
    await ensureSchema(env.DB);
    const [menuResult, settingsResult] = await Promise.all([
      env.DB.prepare(
        'SELECT * FROM menu_items WHERE is_available = 1 ORDER BY category ASC, name ASC'
      ).all<MenuItem>(),
      env.DB.prepare('SELECT * FROM cafe_settings WHERE id = 1').first<CafeSettingsRow>(),
    ]);

    return new Response(
      JSON.stringify({
        menu_items: menuResult.results || [],
        settings: settingsResult || {
          id: 1,
          cafe_name: 'Kimmo’s Kitchen',
          earn_points_per_unit: 10,
          earn_spend_unit: 100,
          point_redeem_value: 1.0,
          min_bill_for_redeem: 0,
          max_redeem_percent: 100,
          staff_max_bonus_points: 50,
          sms_enabled: 0,
          sms_api_key: null,
          sms_sender_id: null,
          sms_template: null,
          gst_enabled: 0,
          gst_rate: 5.0,
          gstin: null,
          packaging_charge: 0,
          last_backup_at: null,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to initialize counter data' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
