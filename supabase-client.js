const chatConfig = window.CHAT_CONFIG;

if (
    !chatConfig?.supabaseUrl ||
    !chatConfig?.supabaseKey ||
    chatConfig.supabaseUrl.includes("YOUR_SUPABASE") ||
    chatConfig.supabaseKey.includes("YOUR_SUPABASE")
) {
    throw new Error(
        "Your Supabase URL or publishable key is missing from config.js."
    );
}

window.supabaseClient = window.supabase.createClient(
    chatConfig.supabaseUrl,
    chatConfig.supabaseKey
);