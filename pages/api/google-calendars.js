import { google } from "googleapis";
import { createClient } from "../../lib/supabase/server";

export default async function handler(req, res) {
  const supabase = createClient(req, res);

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    try {
      console.log("Fetching Google calendars for user:", user.id);

      // Get Google integration
      const { data: integration, error: integrationError } = await supabase
        .from("user_integrations")
        .select("*")
        .eq("user_id", user.id)
        .eq("provider", "google")
        .single();

      console.log("Google integration query result:", {
        found: !!integration,
        error: integrationError?.message,
        hasAccessToken: !!integration?.access_token
      });

      if (integrationError || !integration) {
        return res.status(404).json({
          error: "Google integration not found",
          details: integrationError?.message
        });
      }

      // Set up OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );

      oauth2Client.setCredentials({
        access_token: integration.access_token,
        refresh_token: integration.refresh_token,
      });

      // Fetch calendar list
      const calendar = google.calendar({ version: "v3", auth: oauth2Client });
      const response = await calendar.calendarList.list();

      console.log(`Found ${response.data.items?.length || 0} calendars`);

      const calendars = (response.data.items || []).map((cal) => ({
        id: cal.id,
        summary: cal.summary,
        primary: cal.primary || false,
        backgroundColor: cal.backgroundColor,
        foregroundColor: cal.foregroundColor,
      }));

      return res.status(200).json(calendars);
    } catch (error) {
      console.error("Error fetching Google calendars:", error);
      return res.status(500).json({
        error: "Failed to fetch calendars",
        details: error.message
      });
    }
  }

  if (req.method === "POST") {
    try {
      const { calendarIds } = req.body;

      if (!Array.isArray(calendarIds)) {
        return res.status(400).json({ error: "calendarIds must be an array" });
      }

      // Get or create user preferences
      const { data: existingPrefs, error: fetchError } = await supabase
        .from("user_preferences")
        .select("preferences")
        .eq("user_id", user.id)
        .single();

      const currentPrefs = existingPrefs?.preferences || {};
      const updatedPrefs = {
        ...currentPrefs,
        google_calendar_ids: calendarIds,
      };

      const { error: updateError } = await supabase
        .from("user_preferences")
        .upsert(
          {
            user_id: user.id,
            preferences: updatedPrefs,
          },
          {
            onConflict: "user_id",
          }
        );

      if (updateError) {
        console.error("Error updating calendar preferences:", updateError);
        return res.status(500).json({ error: "Failed to save calendar selection" });
      }

      return res.status(200).json({ success: true, calendarIds });
    } catch (error) {
      console.error("Error saving calendar preferences:", error);
      return res.status(500).json({ error: "Failed to save calendar selection" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
