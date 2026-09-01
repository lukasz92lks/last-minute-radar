import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(_req, { params }) {
  try {
    const { id } = params;
    const { data, error } = await supabase().from('offers').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Nie znaleziono oferty' }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}