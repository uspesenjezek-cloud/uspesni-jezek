import * as Supabase from "@supabase/supabase-js";

// Keep the existing plain-script API while serving the SDK from our own app.
globalThis.supabase = Supabase;
