import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get('source') || null;
  const q = searchParams.get('q') || null;
  const destination = searchParams.get('destination') || null;
  const max_price = searchParams.get('max_price') || null;
  const min_rating = searchParams.get('min_rating') || null;
  const sort = searchParams.get('sort') || 'price';
  const order = searchParams.get('order') || 'asc';
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  try {
    let query = supabase().from('offers').select('*', { count: 'exact' });
    query = query.not('price_per_person', 'is', null);

    if (source) query = query.eq('source', source);
    if (q) query = query.ilike('hotel_name', `%${q}%`);
    if (destination) query = query.ilike('destination', `%${destination}%`);
    if (max_price) query = query.lte('price_per_person', parseInt(max_price, 10));
    if (min_rating) query = query.gte('rating', parseFloat(min_rating));

    let orderCol = 'price_per_person';
    let ascending = order === 'asc';
    if (sort === 'rating') orderCol = 'rating';
    else if (sort === 'newest') orderCol = 'last_seen_at';
    query = query.order(orderCol, { ascending }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({ offers: data || [], total: count || 0 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS' },
  });
}