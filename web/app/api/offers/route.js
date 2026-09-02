import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get('source') || null;
  const q = searchParams.get('q') || null;
  const destination = searchParams.get('destination') || null;
  const country = searchParams.get('country') || null;
  const meal_plan = searchParams.get('meal_plan') || null;
  const departure_city = searchParams.get('departure_city') || null;
  const min_stars = searchParams.get('min_stars') || null;
  const nights_min = searchParams.get('nights_min') || null;
  const nights_max = searchParams.get('nights_max') || null;
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
    if (country) query = query.eq('country', country);
    if (meal_plan) query = query.ilike('meal_plan', `%${meal_plan}%`);
    if (departure_city) query = query.eq('departure_city', departure_city);
    if (min_stars) query = query.gte('stars', parseInt(min_stars, 10));
    if (nights_min) query = query.gte('nights', parseInt(nights_min, 10));
    if (nights_max) query = query.lte('nights', parseInt(nights_max, 10));
    if (max_price) query = query.lte('price_per_person', parseInt(max_price, 10));
    if (min_rating) query = query.gte('rating', parseFloat(min_rating));

    let orderCol = 'price_per_person';
    let ascending = order === 'asc';
    if (sort === 'rating') orderCol = 'rating';
    else if (sort === 'newest') orderCol = 'last_seen_at';
    query = query.order(orderCol, { ascending }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json(
      { offers: data || [], total: count || 0 },
      { headers: { 'Cache-Control': 'no-store' } }
    );
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