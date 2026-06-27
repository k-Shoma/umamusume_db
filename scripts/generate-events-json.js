import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const exportViewName = process.env.SUPABASE_EXPORT_VIEW || "v_setlist_export";

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
  console.log(`参照ビュー: ${exportViewName}`);

  const { data, error } = await supabase
    // テスト用のビューから取得。本番時は v_setlist_export に変更する
    .from(exportViewName)
    .select("*")
    .order("event_date", { ascending: false })
    .order("event_db_id", { ascending: true })
    .order("order_no", { ascending: true });

  if (error) {
    throw error;
  }

  const eventMap = new Map();

  for (const row of data) {
    const eventId = row.event_id;

    if (!eventMap.has(eventId)) {
      eventMap.set(eventId, {
        event_id: row.event_id,
        event_group_id: row.event_group_id,
        event_no: row.event_no,
        title: row.event_title,
        day_label: row.day_label,
        day_no: row.day_no,
        event_date: row.event_date,
        venue: row.venue,
        city: row.city,
        prefecture: row.prefecture,
        is_numbered: row.is_numbered,
        setlist: []
      });
    }

    const event = eventMap.get(eventId);

    event.setlist.push({
      order_no: row.order_no,
      block_name: row.block_name,
      song_id: row.song_id,
      is_numbered_live_candidate: row.is_numbered_live_candidate,
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