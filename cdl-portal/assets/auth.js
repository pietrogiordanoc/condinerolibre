import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://yhgqmbexjscojlrzguvh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloZ3FtYmV4anNjb2pscnpndXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNzA1NTcsImV4cCI6MjA4Mjc0NjU1N30.uXFLknfgsZ_3yH5t9cW0dfbwN_b3uOi6jcfM06inVu4";

const LOGIN_URL = "/cdl-portal/login/";
const CURRENT_URL = window.location.pathname + window.location.search;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  const next = encodeURIComponent(CURRENT_URL);
  window.location.replace(`${LOGIN_URL}?next=${next}`);
}
