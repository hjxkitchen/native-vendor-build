// scripts/deploy-apk.js
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// ENV vars from GitHub Actions
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

(async () => {
  try {
    const apkDir = path.resolve(__dirname, "../apks/universal.apk");
    if (!fs.existsSync(apkDir)) {
      throw new Error("universal.apk not found in apks folder");
    }

    const apkBuffer = fs.readFileSync(apkDir);
    const fileName = `app-latest.apk`;
    const filePath = `apk/${fileName}`; // in 'apk' bucket

    // Upload to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from("apk")
      .upload(filePath, apkBuffer, {
        upsert: true,
        contentType: "application/vnd.android.package-archive",
      });

    if (uploadErr) throw uploadErr;

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${filePath}`;

    // Optional: Update version in DB
    const { error: dbErr } = await supabase
      .from("app_versions")
      .upsert([{ platform: "android", latest_url: publicUrl }], {
        onConflict: ["platform"],
      });

    if (dbErr) throw dbErr;

    console.log("✅ APK uploaded and DB updated:", publicUrl);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();
