// Magic Numbers - Disney Resort Total Cost Calculator
// Injects estimated total price next to per-night rates on the Disney resorts page.

const TAX_MULTIPLIER = 1.1275;
const INJECTED_ATTR = "data-mn-injected";
const TICKET_KEY = "mn-ticket-cost";

// ─── Ticket panel ─────────────────────────────────────────────────────────────

function getTicketCost() {
  return parseFloat(localStorage.getItem(TICKET_KEY)) || 0;
}

function makeDraggable(el) {
  const header = el.querySelector(".mn-panel-header");
  header.style.cursor = "grab";
  let startX, startY, startLeft, startTop;

  header.addEventListener("mousedown", (e) => {
    if (e.target.closest(".mn-panel-close")) return;
    const rect = el.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    el.style.right = "auto";
    el.style.left = `${startLeft}px`;
    el.style.top = `${startTop}px`;
    header.style.cursor = "grabbing";

    const onMove = (e) => {
      el.style.left = `${startLeft + e.clientX - startX}px`;
      el.style.top = `${startTop + e.clientY - startY}px`;
    };
    const onUp = () => {
      header.style.cursor = "grab";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

function createTicketPanel() {
  if (document.getElementById("mn-ticket-panel")) return;

  const panel = document.createElement("div");
  panel.id = "mn-ticket-panel";

  const saved = localStorage.getItem(TICKET_KEY) || "";
  panel.innerHTML = `
    <div class="mn-panel-header">
      <div class="mn-drag-handle"><span></span><span></span><span></span></div>
      <span class="mn-panel-title">Ticket Cost</span>
      <span class="mn-info-icon" aria-label="About this panel">&#x24D8;<span class="mn-info-tooltip"><strong>Why am I seeing this?</strong><br>You installed Magic Numbers, a Chrome extension that calculates estimated Disney resort trip totals.</span></span>
      <button class="mn-panel-close" aria-label="Close">&#x2715;</button>
    </div>
    <label class="mn-panel-label">Total ticket cost for your party <span class="mn-help-icon" aria-label="Help">?<span class="mn-tooltip">Click on &ldquo;Rate Details&rdquo; to see the ticket type priced into your package</span></span></label>
    <div class="mn-panel-input-row">
      <span class="mn-panel-symbol">$</span>
      <input class="mn-panel-input" id="mn-ticket-input" type="number" min="0" step="1" placeholder="0" value="${saved}">
    </div>
  `;
  document.body.appendChild(panel);
  makeDraggable(panel);

  const toggle = document.createElement("button");
  toggle.id = "mn-toggle";
  toggle.textContent = "🎟$";
  toggle.title = "Show ticket cost";
  document.body.appendChild(toggle);

  panel.querySelector(".mn-panel-close").addEventListener("click", () => {
    panel.style.display = "none";
    toggle.style.display = "flex";
  });

  toggle.addEventListener("click", () => {
    panel.style.display = "";
    toggle.style.display = "none";
  });

  let ticketDebounce = null;
  panel.querySelector("#mn-ticket-input").addEventListener("input", (e) => {
    clearTimeout(ticketDebounce);
    ticketDebounce = setTimeout(() => {
      const val = parseFloat(e.target.value) || 0;
      val > 0
        ? localStorage.setItem(TICKET_KEY, val)
        : localStorage.removeItem(TICKET_KEY);
      refreshBoxes();
    }, 500);
  });
}

// ─── Date extraction ──────────────────────────────────────────────────────────

function extractDates() {
  // Resort list page: wdpr-datepicker components
  const pickers = document.querySelectorAll("wdpr-datepicker");
  if (pickers.length >= 2) {
    const checkin = new Date(pickers[0].value);
    const checkout = new Date(pickers[1].value);
    const nights = Math.round((checkout - checkin) / 86400000);
    if (nights > 0) {
      console.log(
        `[CC] ${pickers[0].value} → ${pickers[1].value} (${nights} nights)`,
      );
      return nights;
    }
  }

  // Room detail page: "09/27/2026 - 10/02/2026" text
  const dateEl = document.querySelector(".quick-quote-info-text");
  if (dateEl) {
    const match = dateEl.textContent.match(
      /(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/,
    );
    if (match) {
      const checkin = new Date(match[1]);
      const checkout = new Date(match[2]);
      const nights = Math.round((checkout - checkin) / 86400000);
      if (nights > 0) {
        console.log(`[CC] ${match[1]} → ${match[2]} (${nights} nights)`);
        return nights;
      }
    }
  }

  return null;
}

// ─── Price extraction ─────────────────────────────────────────────────────────

function extractPrice(card) {
  // Each price block has .int-price and .decimal spans.
  // Collect all prices and return the lowest (promotions show a cheaper second price).
  const prices = [];
  for (const intEl of card.querySelectorAll(".int-price")) {
    const intPart = intEl.textContent.replace(/[,\s]/g, "");
    const decEl = intEl.closest(".price")?.querySelector(".decimal");
    const decPart = decEl ? decEl.textContent.replace(/[.\s]/g, "") : "00";
    const value = parseFloat(`${intPart}.${decPart}`);
    if (!isNaN(value)) prices.push(value);
  }
  // Package cards show a single total; room cards use the lowest (best promo) price
  const isPackage = card.textContent.includes("Package Total");
  return prices.length
    ? isPackage
      ? Math.max(...prices)
      : Math.min(...prices)
    : null;
}

// ─── Injection ────────────────────────────────────────────────────────────────

function injectTotalBox(card, hotelTotal, price, nights, ticketCost) {
  const grandTotal = hotelTotal + ticketCost;
  const fmt = (n) => Math.round(n).toLocaleString("en-US");

  const box = document.createElement("div");
  box.className = "mn-total-box";

  const ticketLine =
    ticketCost > 0
      ? `<p class="font12 mn-calc">+ $${fmt(ticketCost)} tickets</p>`
      : "";

  box.innerHTML = `
    <h4 class="font12 special-offer-label mn-heading">Est. Trip Total</h4>
    <div class="price mn-price">
      <span class="symbol">$</span><span class="int-price">${fmt(grandTotal)}</span>
    </div>
    <p class="label package-label hyperion-roman font12 mn-sub">Incl. Tax &middot; ${nights} nights</p>
    <p class="font12 mn-calc">$${fmt(price)}/night<br>&times; ${nights} nights<br>&times; 1.1275 tax</p>
    ${ticketLine}
  `;

  insertBox(card, box);
}

// ─── Daily rate box (package pages) ───────────────────────────────────────────

function injectDailyRateBox(card, packageTotal, nights, ticketCost) {
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const box = document.createElement("div");
  box.className = "mn-total-box";

  if (ticketCost <= 0) {
    box.innerHTML = `
      <h4 class="font12 special-offer-label mn-heading">Est. Daily Rate</h4>
      <p class="font12 mn-calc mn-needs-tickets">Enter ticket cost<br>to calculate daily rate</p>
    `;
  } else {
    const roomTotal = packageTotal - ticketCost;
    const dailyRate = roomTotal / nights / TAX_MULTIPLIER;
    box.innerHTML = `
      <h4 class="font12 special-offer-label mn-heading">Est. Daily Rate</h4>
      <div class="price mn-price">
        <span class="symbol">$</span><span class="int-price">${fmt(dailyRate)}</span>
      </div>
      <p class="label package-label hyperion-roman font12 mn-sub">Excl. Tax &middot; ${nights} nights</p>
      <p class="font12 mn-calc">($${fmt(packageTotal)} &minus; $${fmt(ticketCost)} tickets)<br>&divide; ${nights} nights<br>&divide; 1.1275 tax</p>
    `;
  }

  insertBox(card, box);
}

// ─── Main processing ──────────────────────────────────────────────────────────

function isRoomPage() {
  return window.location.pathname.includes("/rates-rooms/");
}

function getCards() {
  if (isRoomPage()) {
    return Array.from(document.querySelectorAll(".room-details-card"));
  }
  const found = Array.from(document.querySelectorAll('[class*="resort-card"]'));
  return found.filter(
    (card) => !found.some((other) => other !== card && card.contains(other)),
  );
}

function insertBox(card, box) {
  if (isRoomPage()) {
    const priceRow = card.querySelector("app-price-display .room-price-group");
    if (priceRow) {
      priceRow.appendChild(box);
    } else {
      (card.querySelector(".room-price") || card).appendChild(box);
    }
  } else {
    const target =
      card.querySelector(".room-price-group .arrow-display") ||
      card.querySelector(".room-price-group") ||
      card;
    const arrow = target.querySelector(".desktop-arrow");
    arrow ? target.insertBefore(box, arrow) : target.appendChild(box);
  }
}

function processCards(nights) {
  if (!nights || !document.body) return;

  const cards = getCards();
  if (cards.length === 0) return;

  const ticketCost = getTicketCost();
  let injected = 0;

  for (const card of cards) {
    if (card.hasAttribute(INJECTED_ATTR)) continue;

    if (card.textContent.includes("Package Total")) {
      const packageTotal = extractPrice(card);
      if (!packageTotal) continue;
      injectDailyRateBox(card, packageTotal, nights, ticketCost);
    } else if (card.textContent.includes("Avg/Night Excl Tax")) {
      const price = extractPrice(card);
      if (!price) continue;
      injectTotalBox(
        card,
        price * nights * TAX_MULTIPLIER,
        price,
        nights,
        ticketCost,
      );
    } else {
      continue;
    }

    card.setAttribute(INJECTED_ATTR, "true");
    injected++;
  }

  if (injected > 0) console.log(`[CC] Injected ${injected} total box(es).`);
}

function refreshBoxes() {
  document.querySelectorAll(".mn-total-box").forEach((el) => el.remove());
  document
    .querySelectorAll(`[${INJECTED_ATTR}]`)
    .forEach((el) => el.removeAttribute(INJECTED_ATTR));
  processCards(extractDates());
}

// ─── Entry point ──────────────────────────────────────────────────────────────

let debounceTimer = null;
let lastNights = null;
let lastPath = null;
let lastMode = null;

function run() {
  if (!document.body) return;
  createTicketPanel();

  const nights = extractDates();
  const path = window.location.pathname;
  const cards = getCards();
  const mode = cards.some((c) => c.textContent.includes("Package Total"))
    ? "package"
    : cards.some((c) => c.textContent.includes("Avg/Night Excl Tax"))
      ? "room"
      : null;

  const panel = document.getElementById("mn-ticket-panel");
  if (panel) panel.classList.toggle("mn-package-mode", mode === "package");

  if (path !== lastPath) {
    lastPath = path;
    document.querySelectorAll(".mn-total-box").forEach((box) => {
      box.innerHTML = '<p class="font12 mn-calc mn-loading">…</p>';
    });
    return; // wait for Angular to finish re-rendering before injecting
  }

  if (mode === null) return; // page still transitioning — wait for next mutation

  if (nights !== lastNights || mode !== lastMode) {
    lastNights = nights;
    lastMode = mode;
    refreshBoxes();
  } else {
    processCards(nights);
  }
}

function init() {
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(run, 300);
  });
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
  });
  run();
  [1000, 2500, 5000].forEach((ms) => setTimeout(run, ms));
}

if (document.body) {
  init();
} else {
  document.addEventListener("DOMContentLoaded", init);
}
