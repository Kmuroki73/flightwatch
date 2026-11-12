// Public browser configuration for static deployments. Only Supabase URL and anon/publishable key belong here.
// Never add service-role, AeroAPI, OpenAI, WhatsApp or PayPal secrets to this file.
window.SONGA_CONFIG = window.SONGA_CONFIG || {
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_ANON_KEY: "",
  VITE_FLIGHT_SEARCH_FUNCTION_URL: "",
  VITE_WHATSAPP_LINK_FUNCTION_URL: ""
};
