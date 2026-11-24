import { Env } from '../../types';
import { requireOwner } from '../../utils/auth';

export interface CafeSettingsRow {
  id: number;
  cafe_name: string;
  earn_points_per_unit: number;
  earn_spend_unit: number;
  point_redeem_value: number;
  min_bill_for_redeem: number;
  max_redeem_percent: number;
  staff_max_bonus_points: number;
  sms_enabled: number;
  sms_api_key: string | null;
  sms_sender_id: string | null;
  sms_template: string | null;
  gst_enabled: number;
  gst_rate: number;
  gstin: string | null;
  packaging_charge: number;
  last_backup_at: string | null;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requireOwner(request, env);
  if (auth instanceof Response) return auth;

  try {
    const settings = await env.DB.prepare('SELECT * FROM cafe_settings WHERE id = 1').first<CafeSettingsRow>();
    if (!settings) {
      return new Response(
        JSON.stringify({ error: 'Settings not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(settings), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to fetch settings' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requireOwner(request, env);
  if (auth instanceof Response) return auth;

  try {
    const body = (await request.json()) as Partial<CafeSettingsRow>;

    const cafeName = body.cafe_name?.trim() || 'Kimmo’s Kitchen';
    const earnPointsPerUnit = Number(body.earn_points_per_unit ?? 10);
    const earnSpendUnit = Number(body.earn_spend_unit ?? 100);
    const pointRedeemValue = Number(body.point_redeem_value ?? 1.0);
    const minBillForRedeem = Number(body.min_bill_for_redeem ?? 0);
    const maxRedeemPercent = Number(body.max_redeem_percent ?? 100);
    const staffMaxBonusPoints = Math.floor(Number(body.staff_max_bonus_points ?? 50));
    const smsEnabled = body.sms_enabled ? 1 : 0;
    const smsApiKey = body.sms_api_key?.trim() || null;
    const smsSenderId = body.sms_sender_id?.trim() || null;
    const smsTemplate = body.sms_template?.trim() || null;
    const gstEnabled = body.gst_enabled ? 1 : 0;
    const gstRate = Math.max(0, Number(body.gst_rate ?? 5.0));
    const gstin = body.gstin?.trim() || null;
    const packagingCharge = Math.max(0, Number(body.packaging_charge ?? 0));

    // Strict validation bounds
    if (earnPointsPerUnit < 0) {
      return new Response(
        JSON.stringify({ error: 'Earn points per unit cannot be negative' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (earnSpendUnit <= 0) {
      return new Response(
        JSON.stringify({ error: 'Spend unit must be greater than 0' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (pointRedeemValue <= 0) {
      return new Response(
        JSON.stringify({ error: 'Point redemption value must be greater than 0' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (minBillForRedeem < 0) {
      return new Response(
        JSON.stringify({ error: 'Minimum bill for redemption cannot be negative' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (maxRedeemPercent < 0 || maxRedeemPercent > 100) {
      return new Response(
        JSON.stringify({ error: 'Max redeem percentage must be between 0 and 100' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (staffMaxBonusPoints < 0) {
      return new Response(
        JSON.stringify({ error: 'Staff max bonus points cannot be negative' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await env.DB.prepare(
      `UPDATE cafe_settings
       SET cafe_name = ?,
           earn_points_per_unit = ?,
           earn_spend_unit = ?,
           point_redeem_value = ?,
           min_bill_for_redeem = ?,
           max_redeem_percent = ?,
           staff_max_bonus_points = ?,
           sms_enabled = ?,
           sms_api_key = ?,
           sms_sender_id = ?,
           sms_template = ?,
           gst_enabled = ?,
           gst_rate = ?,
           gstin = ?,
           packaging_charge = ?
       WHERE id = 1`
    ).bind(
      cafeName,
      earnPointsPerUnit,
      earnSpendUnit,
      pointRedeemValue,
      minBillForRedeem,
      maxRedeemPercent,
      staffMaxBonusPoints,
      smsEnabled,
      smsApiKey,
      smsSenderId,
      smsTemplate,
      gstEnabled,
      gstRate,
      gstin,
      packagingCharge
    ).run();

    const updated = await env.DB.prepare('SELECT * FROM cafe_settings WHERE id = 1').first<CafeSettingsRow>();

    return new Response(
      JSON.stringify({ success: true, settings: updated }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to update settings' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
