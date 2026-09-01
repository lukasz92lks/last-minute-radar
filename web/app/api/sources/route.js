import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SOURCES = ['tui', 'itaka', 'rainbow', 'wakacje'];

export async function GET() {
  try {
    const client = supabase();
    const sources = [];
    for (const s of SOURCES) {
      const { count: prices, error: pErr } = await client
        .from('offers')
        .select('price_per_person', { count: 'exact', head: true })
        .eq('source', s)
        .not('price_per_person', 'is', null);
      if (pErr) throw pErr;

      const { data: priceRows, error: rErr } = await client
        .from('offers')
        .select('price_per_person')
        .eq('source', s)
        .not('price_per_person', 'is', null);
      if (rErr) throw rErr;

      const vals = (priceRows || []).map((r) => r.price_per_person).filter((n) => n != null);
      const { data: lastRow } = await client
        .from('offers')
        .select('last_seen_at')
        .eq('source', s)
        .order('last_seen_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      sources.push({
        source: s,
        offers: prices || 0,
        min_price: vals.length ? Math.min(...vals) : null,
        max_price: vals.length ? Math.max(...vals) : null,
        last_seen: lastRow ? lastRow.last_seen_at : null,
      });
    }
    return NextResponse.json({ sources }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}