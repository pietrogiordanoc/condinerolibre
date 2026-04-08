window.CONFIG = {
  supabaseUrl: "https://yhgqmbexjscojlrzguvh.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloZ3FtYmV4anNjb2pscnpndXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNzA1NTcsImV4cCI6MjA4Mjc0NjU1N30.uXFLknfgsZ_3yH5t9cW0dfbwN_b3uOi6jcfM06inVu4",
  radarAccessUrl: "https://yhgqmbexjscojlrzguvh.supabase.co/functions/v1/radar-access"
};
window.sp = supabase.createClient(window.CONFIG.supabaseUrl, window.CONFIG.anonKey);