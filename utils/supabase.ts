import { createClient } from '@supabase/supabase-js';

// Mengambil URL dan Kunci Anonim dari file konfigurasi lingkungan (.env.local)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Membuat koneksi resmi ke database Supabase sekolah kita
export const supabase = createClient(supabaseUrl, supabaseAnonKey);