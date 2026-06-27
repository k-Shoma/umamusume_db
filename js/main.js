async function loadEvents() {
  const response = await fetch("./data/events.json");
  const events = await response.json();

  const container = document.getElementById("event-list");

  container.innerHTML = events
    .map((event) => {
      return `
        <article>
          <h2>${event.title}</h2>
          <p>${event.event_date} / ${event.venue}</p>
          <ol>
            ${event.setlist
              .map((item) => {
                return `
                  <li>
                    <strong>${item.song_name}</strong><br>
                    <span>${item.performers.join(" / ")}</span>
                  </li>
                `;
              })
              .join("")}
          </ol>
        </article>
      `;
    })
    .join("");
}

loadEvents();