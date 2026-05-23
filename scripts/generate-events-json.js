import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL が設定されていません");
}

if (!supabaseKey) {
  throw new Error("SUPABASE_SECRET_KEY が設定されていません");
}

const supabase = createClient(supabaseUrl, supabaseKey);

function normalizePerformers(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((name) => String(name).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
  }

  return [];
}

async function main() {
  const { data, error } = await supabase
    .from("v_setlist_export")
    .select("*")
    .order("event_date", { ascending: false })
    .order("event_db_id", { ascending: true })
    .order("order_no", { ascending: true })
    .order("song_name", { ascending: true });
  if (error) {
    throw error;
  }

  const eventMap = new Map();

  for (const row of data) {
    const eventCode = row.event_code;

    if (!eventMap.has(eventCode)) {
      eventMap.set(eventCode, {
        event_code: row.event_code,
        title: row.event_title,
        event_date: row.event_date,
        venue: row.venue,
        setlist: []
      });
    }

    const event = eventMap.get(eventCode);

    event.setlist.push({
      order_no: row.order_no,
      song_name: row.song_name,
      performers: normalizePerformers(row.performers)
    });
  }

  const events = Array.from(eventMap.values());

  await fs.mkdir("data", { recursive: true });

  await fs.writeFile(
    "data/events.json",
    JSON.stringify(events, null, 2),
    "utf-8"
  );

  console.log(`data/events.json を生成しました。イベント数: ${events.length}`);
}

main().catch((error) => {
  console.error("JSON生成に失敗しました");
  console.error(error);
  process.exit(1);
});