function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getParamsFromUrl() {
  const params = new URLSearchParams(window.location.search);

  return {
    eventGroupId: params.get("event_group_id"),
    eventId: params.get("event_id")
  };
}

function normalizeValue(value) {
  if (value === null || value === undefined) return "";

  const text = String(value).trim();

  if (text === "" || text.toUpperCase() === "NULL") {
    return "";
  }

  return text;
}

function getAreaLabel(event) {
  return normalizeValue(event.area_label);
}

function getGeoAreaLabel(event) {
  return (
    normalizeValue(event.city) ||
    normalizeValue(event.prefecture) ||
    normalizeValue(event.venue)
  );
}

function getTabGroupLabel(event) {
  return getAreaLabel(event) || getGeoAreaLabel(event);
}

function toSafeNumber(value, fallback = 9999) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toSafeTime(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 8640000000000000;
}

function sortPerformances(events) {
  const groupOrderMap = new Map();

  const baseSortedEvents = [...events].sort((a, b) => {
    return (
      toSafeNumber(a.event_no) - toSafeNumber(b.event_no) ||
      toSafeTime(a.event_date) - toSafeTime(b.event_date) ||
      toSafeNumber(a.day_no) - toSafeNumber(b.day_no)
    );
  });

  for (const event of baseSortedEvents) {
    const groupLabel = getTabGroupLabel(event) || event.event_id || "";

    if (!groupOrderMap.has(groupLabel)) {
      groupOrderMap.set(groupLabel, groupOrderMap.size);
    }
  }

  return [...events].sort((a, b) => {
    const groupA = getTabGroupLabel(a) || a.event_id || "";
    const groupB = getTabGroupLabel(b) || b.event_id || "";

    return (
      toSafeNumber(groupOrderMap.get(groupA)) -
        toSafeNumber(groupOrderMap.get(groupB)) ||
      toSafeNumber(a.day_no) - toSafeNumber(b.day_no) ||
      toSafeNumber(a.event_no) - toSafeNumber(b.event_no) ||
      toSafeTime(a.event_date) - toSafeTime(b.event_date)
    );
  });
}

function buildTabLabel(event, allEvents) {
  const areaLabels = new Set(
    allEvents
      .map((item) => getAreaLabel(item))
      .filter(Boolean)
  );

  const geoLabels = new Set(
    allEvents
      .map((item) => getGeoAreaLabel(item))
      .filter(Boolean)
  );

  const shouldShowGroupLabel =
    areaLabels.size > 1 || geoLabels.size > 1;

  const dayLabel =
    normalizeValue(event.day_label) ||
    (event.day_no ? `DAY${event.day_no}` : "公演");

  if (shouldShowGroupLabel) {
    const groupLabel = getTabGroupLabel(event);
    return `${groupLabel}_${dayLabel}`;
  }

  return dayLabel;
}

function formatAreaDetail(event) {
  const areaLabel = getAreaLabel(event);
  const geoLabel = [event.prefecture, event.city]
    .map((value) => normalizeValue(value))
    .filter(Boolean)
    .join(" ");

  if (areaLabel && geoLabel) {
    return `${areaLabel}（${geoLabel}）`;
  }

  return areaLabel || geoLabel || "";
}

function renderSetlistTable(event) {
  return `
    <article class="event-detail">
      <header class="event-detail__header">
        <div class="event-detail__labels">
          ${event.day_label ? `<span class="event-badge">${escapeHtml(event.day_label)}</span>` : ""}
          ${event.is_numbered ? `<span class="event-badge event-badge--sub">ナンバリング</span>` : ""}
        </div>

        <h2>${escapeHtml(event.title)}</h2>

        <dl class="event-info">
          <div>
            <dt>開催日</dt>
            <dd>${escapeHtml(event.event_date ?? "")}</dd>
          </div>
          <div>
            <dt>会場</dt>
            <dd>${escapeHtml(event.venue ?? "")}</dd>
          </div>
          <div>
            <dt>開催地</dt>
            <dd>
              ${escapeHtml(formatAreaDetail(event))}
            </dd>
          </div>
        </dl>
      </header>

      <section class="section">
        <h3>セットリスト</h3>

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
                      <td class="setlist-table__order">${escapeHtml(item.order_no)}</td>
                      <td class="setlist-table__block">${escapeHtml(item.block_name || "-")}</td>
                      <td class="setlist-table__song">
                        ${escapeHtml(item.song_name || "-")}
                      </td>
                      <td class="setlist-table__performers">
                        ${performers || "-"}
                      </td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </section>
    </article>
  `;
}

async function loadEventDetail() {
  const container = document.getElementById("event-detail");

  if (!container) return;

  const { eventGroupId, eventId } = getParamsFromUrl();

  if (!eventGroupId && !eventId) {
    container.innerHTML = `
      <p class="error-message">イベントが指定されていません。</p>
      <p><a href="./archive.html">イベント一覧へ戻る</a></p>
    `;
    return;
  }

  try {
    const response = await fetch("./data/events.json");

    if (!response.ok) {
      throw new Error("events.json を読み込めませんでした");
    }

    const events = await response.json();

    let targetEvents = [];

    if (eventGroupId) {
      targetEvents = events.filter((event) => {
        return String(event.event_group_id || event.event_id) === String(eventGroupId);
      });
    } else if (eventId) {
      targetEvents = events.filter((event) => {
        return String(event.event_id) === String(eventId);
      });
    }

    targetEvents = sortPerformances(targetEvents);

    if (targetEvents.length === 0) {
      container.innerHTML = `
        <p class="error-message">指定されたイベントが見つかりませんでした。</p>
        <p><a href="./archive.html">イベント一覧へ戻る</a></p>
      `;
      return;
    }

    const title = targetEvents[0].title;

    container.innerHTML = `
      <section class="page-header">
        <h2>${escapeHtml(title)}</h2>
        <p>
          ${escapeHtml(formatEventSummary(targetEvents))}
        </p>
      </section>

      ${
        targetEvents.length > 1
          ? `
            <div class="tab-buttons" id="event-day-tabs">
              ${targetEvents
                .map((event, index) => {
                  return `
                    <button
                      type="button"
                      class="tab-button ${index === 0 ? "is-active" : ""}"
                      data-index="${index}"
                    >
                      ${escapeHtml(buildTabLabel(event, targetEvents))}
                    </button>
                  `;
                })
                .join("")}
            </div>
          `
          : ""
      }

      <div id="event-day-content">
        ${renderSetlistTable(targetEvents[0])}
      </div>

      <p class="back-link">
        <a href="./archive.html">イベント一覧へ戻る</a>
      </p>
    `;

    const contentContainer = document.getElementById("event-day-content");

    document.querySelectorAll("#event-day-tabs .tab-button").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.index);
        const selectedEvent = targetEvents[index];

        document
          .querySelectorAll("#event-day-tabs .tab-button")
          .forEach((tab) => tab.classList.remove("is-active"));

        button.classList.add("is-active");
        contentContainer.innerHTML = renderSetlistTable(selectedEvent);
      });
    });

    document.title = `${title} | ウマ娘リアルイベント セットリストDB`;
  } catch (error) {
    console.error(error);

    container.innerHTML = `
      <p class="error-message">イベント詳細の読み込みに失敗しました。</p>
      <p><a href="./archive.html">イベント一覧へ戻る</a></p>
    `;
  }
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

loadEventDetail();