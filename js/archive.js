function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function groupEventsByGroupId(events) {
  const groupMap = new Map();

  for (const event of events) {
    const groupId = event.event_group_id || event.event_id;

    if (!groupMap.has(groupId)) {
      groupMap.set(groupId, []);
    }

    groupMap.get(groupId).push(event);
  }

  return Array.from(groupMap.entries()).map(([eventGroupId, groupEvents]) => {
    const sortedGroupEvents = [...groupEvents].sort((a, b) => {
      return (
        Number(a.event_no ?? 0) - Number(b.event_no ?? 0) ||
        Number(a.day_no ?? 0) - Number(b.day_no ?? 0) ||
        new Date(a.event_date) - new Date(b.event_date)
      );
    });

    const firstEvent = sortedGroupEvents[0];
    const lastEvent = sortedGroupEvents[sortedGroupEvents.length - 1];

    return {
      event_group_id: eventGroupId,
      title: firstEvent.title,
      event_count: sortedGroupEvents.length,
      first_date: firstEvent.event_date,
      last_date: lastEvent.event_date,
      venue: buildVenueSummary(sortedGroupEvents),
      events: sortedGroupEvents
    };
  });
}

function buildVenueSummary(events) {
  const venues = [...new Set(events.map((event) => event.venue).filter(Boolean))];

  if (venues.length === 0) return "";
  if (venues.length === 1) return venues[0];

  return `${venues[0]} ほか`;
}

function formatDateRange(firstDate, lastDate) {
  if (!firstDate) return "";

  if (!lastDate || firstDate === lastDate) {
    return firstDate;
  }

  return `${firstDate} ～ ${lastDate}`;
}

async function loadArchiveEvents() {
  const container = document.getElementById("archive-event-list");

  if (!container) return;

  try {
    const response = await fetch("./data/events.json");

    if (!response.ok) {
      throw new Error("events.json を読み込めませんでした");
    }

    const events = await response.json();

    const eventGroups = groupEventsByGroupId(events).sort((a, b) => {
      return new Date(b.last_date) - new Date(a.last_date);
    });

    container.innerHTML = eventGroups
      .map((group) => {
        const eventGroupId = encodeURIComponent(group.event_group_id);
        const dateText = formatDateRange(group.first_date, group.last_date);

        const countLabel =
          group.event_count > 1 ? `${group.event_count}公演` : "1公演";

        return `
          <article class="event-card">
            <a class="event-card__link" href="./event.html?event_group_id=${eventGroupId}">
              <h3>${escapeHtml(group.title)}</h3>
              <p>${escapeHtml(dateText)} / ${escapeHtml(group.venue)}</p>
              <p>${escapeHtml(countLabel)}</p>
              <p>セットリストを見る</p>
            </a>
          </article>
        `;
      })
      .join("");
  } catch (error) {
    console.error(error);

    container.innerHTML = `
      <p class="error-message">
        イベント一覧の読み込みに失敗しました。
      </p>
    `;
  }
}

loadArchiveEvents();