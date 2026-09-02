import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const client = supabase();
    const [countries, meals, sources, cities] = await Promise.all([
      client.from('offers').select('country').not('country', 'is', null),
      client.from('offers').select('meal_plan').not('meal_plan', 'is', null),
      client.from('offers').select('source'),
      client.from('offers').select('departure_city').not('departure_city', 'is', null),
    ]);

    const countUnique = (rows, key) => {
      const set = new Set();
      for (const r of rows || []) if (r[key]) set.add(r[key]);
      return [...set].sort((a, b) => a.localeCompare(b, 'pl'));
    };

    return NextResponse.json(
      {
        countries: countUnique(countries.data, 'country'),
        meal_plans: countUnique(meals.data, 'meal_plan'),
        sources: countUnique(sources.data, 'source'),
        departure_cities: countUnique(cities.data, 'departure_city'),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}