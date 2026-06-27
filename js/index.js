function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatEventLabel(event, index) {
  const title = event.title ?? "";

  if (title.toUpperCase().includes("DAY1")) return "DAY1";
  if (title.toUpperCase().includes("DAY2")) return "DAY2";

  if (event.event_id?.toLowerCase().includes("day1")) return "DAY1";
  if (event.event_id?.toLowerCase().includes("day2")) return "DAY2";

  if (event.event_id?.endsWith("_1")) return "DAY1";
  if (event.event_id?.endsWith("_2")) return "DAY2";

  return `EVENT ${index + 1}`;
}

function renderSetlistTable(event) {
  return `
    <article class="event-detail latest-event">
      <header class="event-detail__header">
        <h3>${escapeHtml(event.title)}</h3>
        <p class="event-meta">
          ${escapeHtml(event.event_date)} / ${escapeHtml(event.venue)}
        </p>
      </header>

      <div class="setlist-table-wrap">
        <table class="setlist-table">
          <thead>
            <tr>
              <th>No.</th>
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
        <a href="./event.html?event_id=${encodeURIComponent(event.event_id)}">
          このイベントの詳細を見る
        </a>
      </p>
    </article>
  `;
}

async function loadLatestEvents() {
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

    const sortedEvents = [...events].sort((a, b) => {
      return new Date(b.event_date) - new Date(a.event_date);
    });

    // まずは最新2件をタブ表示対象にする
    // DAY1/DAY2がある場合を想定して、古い順に並べ直す
    const latestEvents = sortedEvents.slice(0, 2).reverse();

    function activateTab(index) {
      const selectedEvent = latestEvents[index];

      tabsContainer.querySelectorAll(".tab-button").forEach((button, buttonIndex) => {
        button.classList.toggle("is-active", buttonIndex === index);
      });

      contentContainer.innerHTML = renderSetlistTable(selectedEvent);
    }

    tabsContainer.innerHTML = latestEvents
      .map((event, index) => {
        const label = formatEventLabel(event, index);

        return `
          <button
            type="button"
            class="tab-button ${index === 0 ? "is-active" : ""}"
            data-index="${index}"
          >
            ${escapeHtml(label)}
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

loadLatestEvents();