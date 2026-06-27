function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sortPerformances(events) {
  return [...events].sort((a, b) => {
    return (
      Number(a.event_no ?? 0) - Number(b.event_no ?? 0) ||
      Number(a.day_no ?? 0) - Number(b.day_no ?? 0) ||
      new Date(a.event_date) - new Date(b.event_date)
    );
  });
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
    const sortedEvents = sortPerformances(groupEvents);
    const firstEvent = sortedEvents[0];
    const lastEvent = sortedEvents[sortedEvents.length - 1];

    return {
      event_group_id: eventGroupId,
      title: firstEvent.title,
      event_count: sortedEvents.length,
      first_date: firstEvent.event_date,
      last_date: lastEvent.event_date,
      venue: buildVenueSummary(sortedEvents),
      is_numbered: sortedEvents.some((event) => event.is_numbered === true),
      events: sortedEvents
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

function getYearFromDate(dateText) {
  if (!dateText) return "開催年不明";
  return `${new Date(dateText).getFullYear()}年`;
}

function groupByYear(eventGroups) {
  const yearMap = new Map();

  for (const group of eventGroups) {
    const year = getYearFromDate(group.last_date || group.first_date);

    if (!yearMap.has(year)) {
      yearMap.set(year, []);
    }

    yearMap.get(year).push(group);
  }

  return Array.from(yearMap.entries()).map(([year, groups]) => {
    return {
      year,
      groups
    };
  });
}

function renderEventCard(group) {
  const eventGroupId = encodeURIComponent(group.event_group_id);
  const dateText = formatDateRange(group.first_date, group.last_date);
  const countLabel = group.event_count > 1 ? `${group.event_count}公演` : "1公演";
  const typeLabel = group.is_numbered ? "ナンバリング" : "その他";

  return `
    <article class="event-card">
      <a class="event-card__link" href="./event.html?event_group_id=${eventGroupId}">
        <div class="event-card__badges">
          <span class="event-badge">${escapeHtml(typeLabel)}</span>
          <span class="event-badge event-badge--sub">${escapeHtml(countLabel)}</span>
        </div>

        <h3>${escapeHtml(group.title)}</h3>
        <p>${escapeHtml(dateText)} / ${escapeHtml(group.venue)}</p>
        <p class="event-card__action">セットリストを見る</p>
      </a>
    </article>
  `;
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

    const yearGroups = groupByYear(eventGroups);

    container.innerHTML = yearGroups
      .map((yearGroup) => {
        return `
          <section class="archive-year-section">
            <h3 class="archive-year-heading">${escapeHtml(yearGroup.year)}</h3>

            <div class="event-grid">
              ${yearGroup.groups.map((group) => renderEventCard(group)).join("")}
            </div>
          </section>
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