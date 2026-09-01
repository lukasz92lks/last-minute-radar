import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const client = supabase();

    const { count: total, error: cErr } = await client
      .from('offers')
      .select('id', { count: 'exact', head: true })
      .not('price_per_person', 'is', null);
    if (cErr) throw cErr;

    const { data: prices, error: pErr } = await client
      .from('offers')
      .select('price_per_person')
      .not('price_per_person', 'is', null);
    if (pErr) throw pErr;

    const vals = (prices || []).map((r) => r.price_per_person).filter((n) => n != null);
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    const min = vals.length ? Math.min(...vals) : null;

    const { data: updatedRow } = await client
      .from('offers')
      .select('last_seen_at')
      .order('last_seen_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json(
      {
        total: total || 0,
        avg_price: avg,
        min_price: min,
        updated_at: updatedRow ? updatedRow.last_seen_at : null,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}