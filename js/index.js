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
    const sortedEvents = sortPerformances(groupEvents);
    const firstEvent = sortedEvents[0];
    const lastEvent = sortedEvents[sortedEvents.length - 1];

    return {
      event_group_id: eventGroupId,
      title: firstEvent.title,
      first_date: firstEvent.event_date,
      last_date: lastEvent.event_date,
      events: sortedEvents
    };
  });
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

function getLatestEventGroup(events) {
  const groups = groupEventsByGroupId(events);

  groups.sort((a, b) => {
    return new Date(b.last_date) - new Date(a.last_date);
  });

  return groups[0];
}

function buildTabLabel(event, allEvents) {
  const venues = new Set(allEvents.map((item) => item.venue).filter(Boolean));
  const hasMultipleVenues = venues.size > 1;

  const dayLabel = event.day_label || `DAY${event.day_no ?? ""}`;

  if (hasMultipleVenues) {
    const place = event.city || event.prefecture || event.venue || "";
    return `${place}_${dayLabel}`;
  }

  return dayLabel;
}

function formatEventSummary(events) {
  const first = events[0];
  const last = events[events.length - 1];

  const firstDate = first.event_date;
  const lastDate = last.event_date;

  const venues = [...new Set(events.map((event) => event.venue).filter(Boolean))];

  const dateText =
    firstDate === lastDate ? firstDate : `${firstDate} ～ ${lastDate}`;

  const venueText =
    venues.length === 1 ? venues[0] : `${venues[0]} ほか`;

  return `${dateText} / ${venueText}`;
}

function renderSetlistTable(event) {
  return `
    <article class="event-detail latest-event">
      <header class="event-detail__header">
        <h3>${escapeHtml(event.title)}</h3>
        <p class="event-meta">
          ${escapeHtml(event.day_label ?? "")}
          ${escapeHtml(event.event_date ?? "")}
          / ${escapeHtml(event.venue ?? "")}
        </p>
      </header>

      <div class="setlist-table-wrap">
        <table class="setlist-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>ブロック</th>
              <th>楽曲名</th>
              <th>歌唱キャラクター</th>
            </tr>
          </thead>
          <tbody>
            ${(event.setlist ?? [])
              .map((item) => {
                const performers = Array.isArray(item.performers)
                  ? item.performers.map((name) => escapeHtml(name)).join(" / ")
                  : "";

                return `
                  <tr>
                    <td>${escapeHtml(item.order_no)}</td>
                    <td>${escapeHtml(item.block_name ?? "")}</td>
                    <td>${escapeHtml(item.song_name)}</td>
                    <td>${performers}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>

      <p class="detail-link">
        <a href="./event.html?event_group_id=${encodeURIComponent(event.event_group_id || event.event_id)}">
          このイベントの詳細を見る
        </a>
      </p>
    </article>
  `;
}

async function loadLatestEventGroup() {
  const tabsContainer = document.getElementById("latest-event-tabs");
  const contentContainer = document.getElementById("latest-event-content");

  if (!tabsContainer || !contentContainer) {
    return;
  }

  try {
    const response = await fetch("./data/events.json");

    if (!response.ok) {
      throw new Error("events.json を読み込めませんでした");
    }

    const events = await response.json();

    if (!Array.isArray(events) || events.length === 0) {
      contentContainer.innerHTML = `
        <p class="error-message">表示できるイベントがありません。</p>
      `;
      return;
    }

    const latestGroup = getLatestEventGroup(events);

    if (!latestGroup) {
      contentContainer.innerHTML = `
        <p class="error-message">最新イベントが見つかりませんでした。</p>
      `;
      return;
    }

    const latestEvents = latestGroup.events;

    function activateTab(index) {
      const selectedEvent = latestEvents[index];

      tabsContainer.querySelectorAll(".tab-button").forEach((button, buttonIndex) => {
        button.classList.toggle("is-active", buttonIndex === index);
      });

      contentContainer.innerHTML = renderSetlistTable(selectedEvent);
    }

    const sectionHeading = document.querySelector(".section-heading h2");

    if (sectionHeading) {
      sectionHeading.textContent = "披露済みの最新イベント";
    }

    const summaryElement = document.createElement("p");
    summaryElement.className = "latest-event-summary";
    summaryElement.textContent = `${latestGroup.title} / ${formatEventSummary(latestEvents)}`;

    const oldSummary = document.querySelector(".latest-event-summary");
    if (oldSummary) {
      oldSummary.remove();
    }

    tabsContainer.before(summaryElement);

    tabsContainer.innerHTML = latestEvents
      .map((event, index) => {
        return `
          <button
            type="button"
            class="tab-button ${index === 0 ? "is-active" : ""}"
            data-index="${index}"
          >
            ${escapeHtml(buildTabLabel(event, latestEvents))}
          </button>
        `;
      })
      .join("");

    tabsContainer.querySelectorAll(".tab-button").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.index);
        activateTab(index);
      });
    });

    activateTab(0);
  } catch (error) {
    console.error(error);

    contentContainer.innerHTML = `
      <p class="error-message">
        最新イベントの読み込みに失敗しました。
      </p>
    `;
  }
}

loadLatestEventGroup();