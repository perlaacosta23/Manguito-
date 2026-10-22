const STORAGE_KEY = "manguito-app";
const ACCOUNTS_KEY = "manguito-accounts";

const categories = [
  { id: "alquiler", name: "Vivienda", color: "#FFFAB3", icon: "categoriahogar.svg", children: ["Alquiler", "Expensas", "Impuestos", "Mantenimiento"] },
  { id: "comidas", name: "Comidas", color: "#FFF2DD", icon: "categoriacomidas.svg", children: ["Juntadas", "Delivery", "Restaurantes", "Suplementos"] },
  { id: "transporte", name: "Transporte", color: "#d9f5c9", icon: "categoriatransporte.svg", children: ["Combustible/estacionamiento", "Seguro", "Apps y taxis", "Colectivo/tren/subte"] },
  { id: "ocio", name: "Ocio", color: "#EBD3FF", icon: "categoriaocio.svg", children: ["Paseos", "Deportes", "Viajes", "Recitales"] },
  { id: "servicios", name: "Servicios", color: "#fff3a8", icon: "categoriaservicios.svg", children: ["Luz / Gas / Agua", "Internet", "Celular", "Suscripciones"] },
  { id: "salud", name: "Salud", color: "#D8FFBA", icon: "categoriasalud.svg", children: ["Medicamentos", "Consultas", "Estudios", "Obra social"] },
  { id: "mercado", name: "Mercado", color: "#F8DBAE", icon: "categoriasupermercado.svg", children: ["Carnicería", "Verdulería", "Almacén", "Limpieza"] },
  { id: "mascotas", name: "Mascotas", color: "#eadcf4", icon: "categoriamascotas.svg", children: ["Alimento", "Veterinario", "Medicamentos", "Peluquería y juguetes"] },
];

const incomeCategories = [
  { id: "sueldo", name: "Sueldo" },
  { id: "freelance", name: "Trabajo independiente" },
  { id: "ventas", name: "Ventas" },
  { id: "otros-ingresos", name: "Otros ingresos" },
];

const defaultData = {
  user: null,
  monthlyIncome: 0,
  selectedCategories: categories.map(({ id }) => id),
  subcategoryOverrides: {},
  customCategories: [],
  alertReminders: { enabled: true, daysBefore: 1, emailEnabled: false },
  transactions: [],
  alerts: [],
  promotions: [],
  exchangeRates: {},
  theme: "light",
};

function dateAfterDays(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function legacyAlertDate(alert) {
  const days = Number(String(alert.dueLabel || "").match(/(\d+)\s*d[ií]as?/i)?.[1]);
  return dateAfterDays(Number.isFinite(days) && days > 0 ? days : 0);
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(defaultData);
    const parsed = JSON.parse(saved);
    const alerts = Array.isArray(parsed.alerts) ? parsed.alerts : structuredClone(defaultData.alerts);
    const oldSeedDays = { internet: 3, luz: 5, spotify: 10 };
    const migratedAlerts = alerts.map((alert, index) => {
      const id = String(alert.id || `legacy-alert-${index + 1}`);
      const seed = defaultData.alerts.find((item) => item.id === id);
      const oldDate = oldSeedDays[id] !== undefined ? dateAfterDays(oldSeedDays[id]) : "";
      return {
        ...alert,
        id,
        date: seed && alert.title === seed.title && Number(alert.amount) === seed.amount
          ? seed.date
          : (alert.date === oldDate ? seed?.date : (/^\d{4}-\d{2}-\d{2}$/.test(alert.date || "") ? alert.date : legacyAlertDate(alert))),
        history: alert.history || seed?.history || [],
      };
    });
    return {
      ...structuredClone(defaultData),
      ...parsed,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      alerts: migratedAlerts,
      promotions: Array.isArray(parsed.promotions) ? parsed.promotions : [],
      customCategories: Array.isArray(parsed.customCategories) ? parsed.customCategories.filter((category) => category && category.id && category.name).map((category) => ({ ...category, children: Array.isArray(category.children) ? category.children : [] })) : [],
      subcategoryOverrides: parsed.subcategoryOverrides && typeof parsed.subcategoryOverrides === "object" ? parsed.subcategoryOverrides : {},
      alertReminders: {
        enabled: parsed.alertReminders?.enabled !== false,
        daysBefore: [0, 1, 2, 3, 7].includes(Number(parsed.alertReminders?.daysBefore)) ? Number(parsed.alertReminders.daysBefore) : 1,
        emailEnabled: parsed.alertReminders?.emailEnabled === true,
      },
      exchangeRates: parsed.exchangeRates && typeof parsed.exchangeRates === "object" ? parsed.exchangeRates : {},
      theme: parsed.theme === "dark" ? "dark" : "light",
    };
  } catch (error) {
    console.error("No se pudieron cargar los datos de Manguito.", error);
    return structuredClone(defaultData);
  }
}

const data = loadData();
const content = document.querySelector("#app-content");
const topBar = document.querySelector("#top-bar");
const bottomNav = document.querySelector("#bottom-nav");
const toast = document.querySelector("#toast");
const backButton = document.querySelector("#back-button");

let screenHistory = [];
let currentScreen = data.user ? "home" : "welcome";
let currentTab = "home";
let selectedSetupCategories = new Set(data.selectedCategories);
let draft = null;
let editingCategories = false;
let transactionFilter = "Todas";
let currentMonth = new Date();
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedAlertDate = dateAfterDays(0);
let selectedAlertId = "";
let editingAlertId = "";
let glossaryQuery = "";
let glossaryIndex = 0;
let calculatorMode = "installments";
let calculatorSavingsMonths = 3;
let textSize = localStorage.getItem("manguito-text-size") === "large" ? "large" : "standard";
let alertPreferences = { due: true, movements: false, summary: false };
let currencyCurrency = "USD";
let currencyDirection = "to-foreign";
let currencyResult = null;
let selectedCategoryId = "";
let toastTimer;

const money = (value) => `$${Math.round(Number(value) || 0).toLocaleString("es-AR")}`;
function expenseCategories() {
  return [...categories, ...(data.customCategories || [])].map((category) => ({
    ...category,
    children: Array.isArray(data.subcategoryOverrides?.[category.id])
      ? data.subcategoryOverrides[category.id]
      : category.children,
  }));
}
const todayISO = () => {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};
const escapeHTML = (value) =>
  String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);

const categoryIconPaths = {
  alquiler: '<path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-6v-6h-4v6H4a1 1 0 0 1-1-1z"/><path d="M8 9h.01M16 9h.01"/>',
  comidas: '<circle cx="12" cy="12" r="8"/><path d="M8 4v5M6 4v4m4-4v4M8 9v11m8-16v16m0-16c2 2 2 5 0 7"/>',
  transporte: '<path d="M5 17h14l1-3V7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v7zM4 14h16M7 17v3m10-3v3"/><circle cx="8" cy="11" r="1"/><circle cx="16" cy="11" r="1"/>',
  ocio: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h.01M16 8h.01M8 16h.01M16 16h.01M12 10v4m-2-2h4"/>',
  servicios: '<path d="M9 18h6m-5 3h4m-5-6a7 7 0 1 1 6 0c-.8.5-1 1.1-1 2h-4c0-.9-.2-1.5-1-2z"/>',
  salud: '<path d="M12 21s-8-4.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.5-8 11-8 11z"/><path d="M9 12h6m-3-3v6"/>',
  mercado: '<path d="M4 9h16l-1.5 11h-13zM3 9l2-5h14l2 5M8 9v11m8-11v11M9 4l1 5m5-5-1 5"/>',
  mascotas: '<path d="M8 12c-2 0-4 2-4 4s2 3 4 2l2-1h4l2 1c2 1 4 0 4-2s-2-4-4-4c-1 0-2 .5-4 .5S9 12 8 12z"/><ellipse cx="5.5" cy="8" rx="1.5" ry="2"/><ellipse cx="9" cy="5.5" rx="1.5" ry="2"/><ellipse cx="15" cy="5.5" rx="1.5" ry="2"/><ellipse cx="18.5" cy="8" rx="1.5" ry="2"/>',
  sueldo: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-13 5h18m-11 0v2h4v-2"/>',
  freelance: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4m-5-12h10m-10 4h6"/>',
  ventas: '<path d="M4 8h16l-1 12H5zM3 8l2-4h14l2 4M9 8a3 3 0 0 0 6 0"/>',
  "otros-ingresos": '<path d="m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z"/>',
};

function categoryIconMarkup(id) {
  return `<svg class="category-vector" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${categoryIconPaths[id] || categoryIconPaths["otros-ingresos"]}</svg>`;
}

const customCategoryIconPaths = {
  study: '<path d="M3 9 12 4l9 5-9 5-9-5Z"/><path d="M6 11v5c3 2 9 2 12 0v-5M21 10v6"/>',
  work: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-13 5h18m-9 0v2"/>',
  savings: '<path d="M5 10c0-3 3-5 7-5s7 2 7 5v7c0 2-3 3-7 3s-7-1-7-3v-7Z"/><path d="M5 11H3a2 2 0 0 0 0 4h2m14-5h1a2 2 0 0 1 0 4h-1M9 4l1-2m5 2-1-2M12 9v6m-2-3h4"/>',
  alerts: '<path d="M4 17h16l-2-3V9a6 6 0 0 0-12 0v5l-2 3Zm6 3h4"/><path d="M19 4v3m-1.5-1.5h3"/>',
};

function customCategoryIconMarkup(id) {
  return `<svg class="category-vector custom-category-vector custom-category-${id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${customCategoryIconPaths[id] || customCategoryIconPaths.work}</svg>`;
}

function categoryAssetMarkup(category) {
  if (category?.customIcon) return customCategoryIconMarkup(category.customIcon);
  // Este es el SVG original de Manguito. El archivo incluye el nombre debajo;
  // CSS recorta únicamente el círculo para mostrarlo como icono de categoría.
  if (category?.id === "servicios") {
    return `<span class="category-asset category-asset-servicios-original" aria-hidden="true"><img src="manguito elementos/categoriaservicios.svg" alt=""></span>`;
  }
  return category?.icon
    ? `<img class="category-asset category-asset-${category.id}" src="manguito elementos/${category.icon}" alt="">`
    : categoryIconMarkup(category?.id || "otros-ingresos");
}

function categoryVisualMarkup(id) {
  const category = expenseCategories().find(({ id: categoryId }) => categoryId === id);
  return categoryAssetMarkup(category || { id });
}

function promotionIconMarkup() {
  return '<img class="promotion-icon" src="manguito elementos/promo-megaphone.svg" alt="">';
}

function localDateFromISO(value) {
  return new Date(`${value}T12:00:00`);
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateDistance(value) {
  const today = localDateFromISO(dateAfterDays(0));
  return Math.round((localDateFromISO(value) - today) / 86400000);
}

function formatDate(value, options = { day: "numeric", month: "long", year: "numeric" }) {
  return localDateFromISO(value).toLocaleDateString("es-AR", options);
}

function calendarTitle(date) {
  const month = date.toLocaleDateString("es-AR", { month: "long" });
  return `${month.charAt(0).toLocaleUpperCase("es-AR")}${month.slice(1)} ${date.getFullYear()}`;
}

function moveCalendarMonth(offset) {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + offset, 1);
  selectedAlertDate = calendarMonth.getFullYear() === new Date().getFullYear() && calendarMonth.getMonth() === new Date().getMonth()
    ? todayISO()
    : dateKey(calendarMonth);
}

function alertDueLabel(alert) {
  const days = dateDistance(alert.date);
  if (days < 0) return days === -1 ? "Venció ayer" : `Venció hace ${Math.abs(days)} días`;
  if (days === 0) return "Vence hoy";
  if (days === 1) return "Vence mañana";
  return `Vence en ${days} días`;
}

function alertCardMarkup(alert) {
  return `
    <button class="due-row alert-row" type="button" data-alert-id="${escapeHTML(alert.id)}" aria-label="Ver ${escapeHTML(alert.title)}, ${alertDueLabel(alert)}">
      <span class="due-row-main"><strong>${escapeHTML(alert.title)}</strong><small>${alertDueLabel(alert)}</small></span>
      <strong>${money(alert.amount)}</strong>
    </button>
  `;
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (data.user?.email) {
      const accounts = readAccounts();
      accounts[String(data.user.email).trim().toLowerCase()] = structuredClone(data);
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    }
    return true;
  } catch (error) {
    console.error("No se pudieron guardar los datos de Manguito.", error);
    showToast("No se pudieron guardar los cambios en este dispositivo.");
    return false;
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2600);
}

function goTo(screen, options = {}) {
  if (!options.replace && currentScreen !== screen) screenHistory.push(currentScreen);
  currentScreen = screen;
  if (options.tab) currentTab = options.tab;
  render();
  content.scrollTop = 0;
}

function goBack() {
  const previous = screenHistory.pop();
  if (previous) {
    currentScreen = previous;
    render();
  } else {
    goTo(data.user ? "home" : "welcome", { replace: true });
  }
}

function navMarkup(active) {
  const navIcons = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/>',
    panel: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h8"/><circle cx="10" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="11" cy="16" r="1.5" fill="currentColor" stroke="none"/>',
    alerts: '<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    profile: '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 21c.5-4.1 3.1-6.5 7.5-6.5s7 2.4 7.5 6.5"/>',
  };
  const items = [
    ["home", "Inicio"],
    ["panel", "Panel"],
    ["add", "Agregar"],
    ["alerts", "Alertas"],
    ["profile", "Perfil"],
  ];
  return items.map(([id, label]) => `
    <button class="nav-item ${id === active ? "active" : ""} ${id === "add" ? "add-nav" : ""}"
      type="button" data-tab="${id}" aria-label="${label}" ${id === active ? 'aria-current="page"' : ""}>
      <span class="nav-icon" aria-hidden="true">${id === "add" ? "<span>+</span>" : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${navIcons[id]}</svg>`}</span>
      <span>${label}</span>
    </button>
  `).join("");
}

function readAccounts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// Migrate the existing single-account storage into the account collection so
// future accounts remain isolated on the same browser.
if (data.user?.email) {
  const accounts = readAccounts();
  const emailKey = String(data.user.email).trim().toLowerCase();
  if (!accounts[emailKey]) {
    accounts[emailKey] = structuredClone(data);
    try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts)); } catch { /* handled by saveData */ }
  }
}

function showAppChrome(showNav = true) {
  topBar.hidden = false;
  bottomNav.hidden = !showNav;
  bottomNav.innerHTML = navMarkup(currentTab);
}

function mangoIllustration(asset, small = false, withBackdrop = false) {
  return `<div class="mango-art ${small ? "mango-small" : ""} ${withBackdrop ? "has-backdrop" : ""}" aria-hidden="true">${withBackdrop ? '<img class="mascot-backdrop" src="manguito elementos/fondo verde dtras del mango.svg" alt="">' : ""}<img class="mascot-image" src="manguito elementos/${asset}" alt=""></div>`;
}

function welcomeScreen() {
  return `
    <section class="screen welcome-screen">
      <div class="welcome-logo">
        <img src="manguito elementos/logomanguitoaprendeacuidarlo.svg" alt="Manguito, aprendé a cuidarlo">
      </div>
      ${mangoIllustration("mangoconcelular.svg", false, true)}
      <div class="welcome-copy">
        <h1><span>¡Hola!</span> Soy Mangui.</h1>
        <p>Te ayudo a registrar y visualizar<br>tu economía cotidiana, de<br>forma rápida y sencilla.</p>
      </div>
      <button class="primary-button" type="button" data-action="start">Comenzar</button>
      <p class="login-prompt">¿Ya tenés una cuenta?<br><button type="button" data-action="login">Ingresá desde acá.</button></p>
    </section>
  `;
}

function signupScreen() {
  return `
    <section class="screen onboarding-screen pattern-screen">
      <div class="onboarding-logo"><span class="isotipo-window" aria-hidden="true"><img src="manguito elementos/isotipo-mark.svg" alt=""></span></div>
      <header class="screen-header">
        <h1>¡Empecemos!</h1>
        <p>Creá una cuenta y comenzá a organizar la plata a tu manera.</p>
      </header>
      <form class="form-stack" data-form="signup" novalidate>
        <div class="form-field"><label for="signup-name">Nombre</label><input id="signup-name" name="name" placeholder="¿Cómo te llamás?" autocomplete="name" required></div>
        <div class="form-field"><label for="signup-email">Correo electrónico</label><input id="signup-email" name="email" type="email" placeholder="tuemail@ejemplo.com" autocomplete="email" required></div>
        <div class="form-field"><label for="signup-password">Contraseña</label><input id="signup-password" name="password" type="password" placeholder="••••••••" autocomplete="new-password" minlength="8" required><p class="helper-text">Usá al menos 8 caracteres.</p></div>
        <div class="form-field"><label for="signup-confirm">Repetir contraseña</label><input id="signup-confirm" name="confirm" type="password" placeholder="Volvé a ingresar tu contraseña." autocomplete="new-password" required></div>
        <p class="form-error" data-error></p>
        <div class="form-actions">
          <button class="primary-button" type="submit">Siguiente</button>
          <p class="legal-copy">Al continuar, aceptás nuestros términos, condiciones y política de privacidad.</p>
        </div>
      </form>
    </section>
  `;
}

function loginScreen() {
  return `
    <section class="screen onboarding-screen pattern-screen">
      <div class="onboarding-logo"><span class="isotipo-window" aria-hidden="true"><img src="manguito elementos/isotipo-mark.svg" alt=""></span></div>
      <header class="screen-header left"><h1>¡Qué bueno verte!</h1><p>Ingresá a tu cuenta para continuar.</p></header>
      <form class="form-stack" data-form="login">
        <div class="form-field"><label for="login-email">Correo electrónico</label><input id="login-email" name="email" type="email" placeholder="tuemail@ejemplo.com" required></div>
        <div class="form-field"><label for="login-password">Contraseña</label><input id="login-password" name="password" type="password" placeholder="Tu contraseña" required></div>
        <p class="form-error" data-error></p>
        <div class="form-actions"><button class="primary-button" type="submit">Ingresar</button><button class="text-button" type="button" data-action="forgot-password">Olvidé mi contraseña</button></div>
      </form>
    </section>
  `;
}

function disclosureScreen() {
  return `
    <section class="screen disclosure-screen">
      <div class="onboarding-logo"><span class="isotipo-window" aria-hidden="true"><img src="manguito elementos/isotipo-mark.svg" alt=""></span></div>
      <h1>Manguito no solicita datos bancarios ni maneja dinero real.</h1>
      <p>Es una herramienta para organizar tus gastos, simular presupuestos y aprender a planificar tu economía personal.</p>
      <button class="primary-button" type="button" data-action="disclosure-continue">Entendido</button>
      ${mangoIllustration("mangocon LA tablet EN LA MANO.svg", true)}
    </section>
  `;
}

function incomeSetupScreen() {
  return `
    <section class="screen onboarding-screen income-setup-screen">
      <div class="onboarding-logo"><span class="isotipo-window" aria-hidden="true"><img src="manguito elementos/isotipo-mark.svg" alt=""></span></div>
      <header class="screen-header">
        <h1>¿Cuál es tu<br>ingreso mensual?</h1>
        <p>Si no querés ingresar el monto real podés poner uno estimado.</p>
      </header>
      <form class="income-setup-form" data-form="income-setup">
        <input class="currency-entry" name="income" aria-label="Ingreso mensual" inputmode="numeric" value="${money(data.monthlyIncome)}">
        <div class="form-actions"><button class="primary-button" type="submit">Siguiente</button></div>
      </form>
    </section>
  `;
}

function setupCategoriesScreen() {
  return `
    <section class="screen onboarding-screen setup-categories-screen">
      <div class="onboarding-logo"><span class="isotipo-window" aria-hidden="true"><img src="manguito elementos/isotipo-mark.svg" alt=""></span></div>
      <header class="screen-header"><h1>${editingCategories ? "Mis categorías" : "Ahora registrá<br>tus gastos"}</h1>${editingCategories ? "<p>Elegí qué categorías querés tener disponibles al cargar gastos.</p>" : ""}</header>
      <div class="category-grid setup-category-grid">
        ${categories.map((category) => `
          <button class="category-option ${selectedSetupCategories.has(category.id) ? "selected" : ""}" type="button" data-setup-category="${category.id}" aria-pressed="${selectedSetupCategories.has(category.id)}">
            <span class="category-emoji">${categoryAssetMarkup(category)}</span>
            <span class="category-label"><span class="category-name">${category.name}</span><span class="category-chevron" aria-hidden="true">›</span></span>
          </button>
        `).join("")}
      </div>
      <div class="form-actions"><button class="primary-button" type="button" data-action="setup-categories-continue">${editingCategories ? "Guardar categorías" : "Continuar"}</button></div>
    </section>
  `;
}

function readyScreen() {
  return `
    <section class="screen disclosure-screen ready-screen">
      <div class="onboarding-logo"><span class="isotipo-window" aria-hidden="true"><img src="manguito elementos/isotipo-mark.svg" alt=""></span></div>
      <h1>¡Listo!</h1>
      <p>Cuantos más gastos e ingresos anotes, más claro vas a ver tu panorama.</p>
      ${mangoIllustration("Mango con billetera y monedas transparente.svg")}
      <button class="primary-button" type="button" data-action="finish-setup">Continuar</button>
    </section>
  `;
}

function dashboardScreen() {
  const name = escapeHTML(data.user?.name?.split(/\s+/)[0] || "Juana");
  const today = new Date();
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 12);
  const daysRemaining = dateDistance(dateKey(monthEnd));
  const monthProgress = Math.round(today.getDate() / monthEnd.getDate() * 100);
  const expenseTransactions = data.transactions.filter(({ type }) => type === "expense");
  const expenseByCategory = new Map();
  for (const item of expenseTransactions) {
    const category = expenseCategories().find(({ id }) => id === item.category);
    const label = category?.name || "Otros";
    const summary = expenseByCategory.get(label) || { amount: 0, id: category?.id || "otros-ingresos" };
    summary.amount += item.amount;
    expenseByCategory.set(label, summary);
  }
  const spent = [...expenseByCategory.values()].reduce((total, { amount }) => total + amount, 0);
  let donutOffset = 0;
  const donutSlices = [...expenseByCategory.values()].map(({ amount, id }) => {
    const percent = spent ? amount / spent * 100 : 20;
    const slice = `${categoryChartColors[id] || "#eadcf4"} ${donutOffset}% ${donutOffset + percent}%`;
    donutOffset += percent;
    return { slice, percent, id };
  });
  const donutGradient = donutSlices.map(({ slice }) => slice).join(", ");
  const emptyDonutGradient = "#eeeaf0 0% 100%";
  let donutAngle = 315;
  const donutLabelAngles = expenseTransactions.length ? donutSlices.map(({ percent }) => {
    const angle = donutAngle + percent * 1.8;
    donutAngle += percent * 3.6;
    return angle;
  }) : [];
  const transactionBalance = data.transactions.reduce(
    (total, item) => total + (item.type === "income" ? item.amount : -item.amount),
    0,
  );
  // El saldo inicial no tiene gastos precargados ni una resta fija. Parte del
  // ingreso informado y se actualiza únicamente con movimientos reales.
  const available = Math.max((Number(data.monthlyIncome) || 0) + transactionBalance, 0);
  const rows = [...expenseByCategory].map(([label, summary]) =>
    `<div class="summary-row"><span class="summary-label"><span class="summary-dot" style="background:${categoryChartColors[summary.id] || "#eadcf4"}"></span>${escapeHTML(label)}</span><strong>${money(summary.amount)}</strong></div>`).join("");

  return `
    <section class="screen dashboard-screen">
      <h1 class="greeting">Hola, ${name}! <img class="greeting-wave" src="manguito elementos/MANO DE BIENVENIDA.png" alt=""></h1>
      <p class="greeting-subtitle">Este es tu resumen</p>
      <article class="balance-card">
        <p class="balance-label">Dinero disponible</p>
        <p class="balance-amount">${money(available)}</p>
        <p class="balance-until">Hasta el ${String(monthEnd.getDate()).padStart(2, "0")}/${String(monthEnd.getMonth() + 1).padStart(2, "0")}</p>
        <div class="balance-track"><span style="width:${monthProgress}%"></span></div>
        <p class="balance-days">${daysRemaining} días restantes</p>
      </article>
      <article class="summary-card">
        <h2>Gastos del mes</h2>
        <div class="summary-grid">
          <div class="donut-chart" style="background:conic-gradient(from 315deg, ${expenseTransactions.length ? donutGradient : emptyDonutGradient})" aria-label="Distribuci\u00f3n de gastos por categor\u00eda"><span>${money(spent)}</span>${donutSlices.map(({ percent }, index) => `<small class="donut-percent" style="--percent-angle:${donutLabelAngles[index]}deg">${Math.round(percent)}%</small>`).join("")}</div>
          <div class="summary-list">${rows}</div>
        </div>
      </article>
      <div class="section-title-row"><h2>Próximos vencimientos</h2></div>
      <article class="list-card">
        ${data.alerts.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3).map(alertCardMarkup).join("") || '<div class="empty-state">Todavía no agregaste vencimientos.</div>'}
        <button class="text-link" type="button" data-tab="alerts" style="display:block;margin:7px 0 0 auto">Ver más &gt;</button>
      </article>
      <div class="section-title-row"><h2>Últimos movimientos</h2><button class="text-link" type="button" data-tab="transactions">Ver todos</button></div>
      <article class="list-card">${transactionRows(data.transactions.slice(0, 3), true)}</article>
    </section>
  `;
}

function transactionRows(transactions, emptyMessage = false) {
  if (!transactions.length) return `<div class="empty-state">${emptyMessage ? "Todavía no hay movimientos. Tocá + para registrar el primero." : "No hay movimientos para mostrar."}</div>`;
  return `<div class="transaction-list">${transactions.map((item) => {
    const category = [...expenseCategories(), ...incomeCategories].find(({ id }) => id === item.category);
    const date = item.date ? new Date(`${item.date}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" }) : "Hoy";
    return `
      <div class="transaction-row">
        <span class="row-emoji">${categoryVisualMarkup(category?.id || "otros-ingresos")}</span>
        <div class="row-info"><div><strong>${escapeHTML(item.note || item.subcategory || category?.name || "Movimiento")}</strong><small>${escapeHTML(category?.name || "Otro")} · ${date}</small></div></div>
        <strong class="${item.type === "income" ? "income" : "expense"}">${item.type === "income" ? "+" : "−"}${money(item.amount)}</strong>
      </div>
    `;
  }).join("")}</div>`;
}

const panelTools = [
  { id: "calculators", title: "Calculadora", description: "Hacé tus cálculos de forma rápida y sencilla.", image: "ICONO CALCULADORA PNG.png" },
  { id: "graphs", title: "Gráficos", description: "Visualizá tus ingresos y gastos de manera cómoda.", image: "iconodegraficos.svg" },
  { id: "currency", title: "Conversor de divisas", description: "Enterate de cuánto vale el dólar en pesos argentinos.", image: "ICONO DE DIVISAS.png" },
  { id: "glossary", title: "Glosario", description: "Entendé fácil los significados de los términos financieros.", image: "ICONO DE GLOSARIO.png" },
  { id: "promotions", title: "Promociones", description: "Enterate de los descuentos activos.", image: "ICONO DE MEGAFONO-transparente.svg" },
];

function panelScreen() {
  return `
    <section class="screen tools-screen">
      <header class="screen-header left"><h1>Herramientas</h1><p>Calculá, analizá y seguí tus finanzas de forma fácil y rápida.</p></header>
      <div class="tool-list">
        ${panelTools.map((tool) => `
          <button class="tool-card" type="button" data-tool="${tool.id}">
            <span class="tool-card-icon">${tool.image ? `<img src="manguito elementos/${tool.image}" alt="" class="tool-card-image tool-${tool.id}-image">` : promotionIconMarkup()}</span>
            <span class="tool-card-copy"><strong>${tool.title}</strong><small>${tool.description}</small></span>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function graphsScreen() {
  const currentTransactions = data.transactions.filter((item) => {
    if (!item.date) return true;
    const date = new Date(`${item.date}T12:00:00`);
    return date.getMonth() === currentMonth.getMonth() && date.getFullYear() === currentMonth.getFullYear();
  });
  const totals = new Map();
  for (const item of currentTransactions.filter(({ type }) => type === "expense")) {
    const category = expenseCategories().find(({ id }) => id === item.category);
    const label = category?.name || "Otros";
    totals.set(label, (totals.get(label) || 0) + item.amount);
  }
  const bars = [...totals].sort((a, b) => b[1] - a[1]).map(([label, amount]) => ({ label, amount, category: expenseCategories().find(({ name }) => name === label) }));
  const chartBars = bars;
  const chartExpenses = chartBars.reduce((sum, item) => sum + item.amount, 0);
  chartBars.forEach((item) => {
    item.percent = chartExpenses ? item.amount / chartExpenses * 100 : 0;
  });
  let offset = 0;
  const gradient = chartBars.map(({ amount, category }) => {
    const start = offset;
    offset += chartExpenses ? amount / chartExpenses * 100 : 0;
    return `${categoryChartColors[category?.id] || "#eadcf4"} ${start}% ${offset}%`;
  }).join(", ");
  let graphAngle = 315;
  const graphLabelAngles = currentTransactions.some(({ type }) => type === "expense") ? chartBars.map(({ percent }) => {
    const angle = graphAngle + percent * 1.8;
    graphAngle += percent * 3.6;
    return angle;
  }) : [270, 0, 90, 144, 216];
  const emptyGraphGradient = "#eeeaf0 0% 100%";
  const iconPaths = {
    alquiler: '<path d="m12 2 10 9h-2v10h-6v-6h-4v6H4V11H2z"/>',
    salud: '<path d="M12 21s-9-5.4-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.6-9 12-9 12z"/>',
    mercado: '<path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8a2 2 0 0 0 1.9-1.4L21 9H7M10 21a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Zm7 0a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Z"/>',
    ocio: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
    comidas: '<path d="M5 8h14l-1 13H6L5 8Zm-1 0 2-5h12l2 5M9 8a3 3 0 0 0 6 0"/>',
  };
  const name = escapeHTML(data.user?.name?.split(/\s+/)[0] || "Juana");
  return `
    <section class="screen graphs-screen">
      <header class="graphs-greeting"><h1>Hola, ${name}! <img class="greeting-wave" src="manguito elementos/MANO DE BIENVENIDA.png" alt=""></h1><p>As\u00ed se ve tu dinero de este mes.</p></header>
      <div class="graphs-donut" style="background:conic-gradient(from 315deg, ${chartBars.length ? gradient : emptyGraphGradient})" role="img" aria-label="Distribuci\u00f3n de gastos por categor\u00eda">
        <span class="graphs-total"><small>Total Gastado</small><strong>${money(chartExpenses)}</strong></span>
        ${chartBars.map(({ percent }, index) => `<small class="graph-percent" style="--percent-angle:${graphLabelAngles[index]}deg">${Math.round(percent)}%</small>`).join("")}
      </div>
      <article class="graphs-breakdown">
        ${chartBars.map(({ label, amount, percent, category }) => `
          <div class="graph-row">
            <span class="graph-category-icon graph-icon-${category?.id || "otros-ingresos"}"><svg viewBox="0 0 24 24" aria-hidden="true">${iconPaths[category?.id] || '<path d="m12 2 2.3 7.1L21 12l-6.7 2.9L12 22l-2.3-7.1L3 12l6.7-2.9z"/>'}</svg></span>
            <span class="graph-category-copy"><strong>${escapeHTML(label)}</strong><small>${money(amount)}</small></span>
            <strong class="graph-category-percent">${Math.round(percent)}%</strong>
          </div>
        `).join("") || '<div class="empty-state">Todav\u00eda no hay gastos para mostrar.</div>'}
      </article>
    </section>
  `;
}

function calculatorScreen() {
  const mode = calculatorMode === "budget" ? "savings" : calculatorMode;
  const modeMarkup = mode === "savings"
    ? `<h2>¿Cuánto querés ahorrar?</h2><div class="calculator-input-card savings-input-card"><div class="form-field"><label for="savings-amount">Monto total</label><input id="savings-amount" name="savings-amount" inputmode="numeric" value="$ 50.000" placeholder="$ 0"></div><strong class="calculator-sub-label">En:</strong><div class="savings-months" role="group" aria-label="Cantidad de meses">${[3, 6, 12].map((months) => `<button type="button" class="savings-month-button ${calculatorSavingsMonths === months ? "active" : ""}" data-savings-months="${months}">${months} meses</button>`).join("")}</div></div><div class="calculator-result-card savings-result-card" id="savings-results"><div>Ahorrar <strong>$50.000 en ${calculatorSavingsMonths} meses</strong><small>significa $${Math.round(50000 / calculatorSavingsMonths).toLocaleString("es-AR")} por mes.</small></div><img src="manguito elementos/mangoconcalculadora.svg" alt=""></div>`
    : mode === "installments"
      ? `<h2>¿Cuánto voy a pagar en cuotas?</h2><div class="calculator-input-card installments-input-card"><div class="form-field"><label for="percentage-base">Monto del producto</label><input id="percentage-base" name="percentage-base" inputmode="numeric" value="$ 100.000" placeholder="$ 0"></div><div class="form-field"><label for="calculator-installments">Cantidad de cuotas</label><input id="calculator-installments" name="installments" type="number" min="1" value="12"></div><div class="form-field"><label for="percentage-value">Tasa de interés</label><input id="percentage-value" name="percentage-value" type="number" min="0" max="100" step="0.1" value="38" placeholder="0%"></div></div><div class="calculator-result-card installment-result-card" id="percentage-results"><div><span>Cuota mensual</span><strong>$12.500</strong><small>Total a pagar: $150.000</small></div><img src="manguito elementos/mangoconcalculadora.svg" alt=""></div>`
      : `<h2>¿Cuánto voy a pagar en cuotas?</h2><div class="calculator-input-card installments-input-card"><div class="form-field"><label for="percentage-base">Monto del producto</label><input id="percentage-base" name="percentage-base" inputmode="numeric" value="$ 100.000" placeholder="$ 0"></div><div class="form-field"><label for="calculator-installments">Cantidad de cuotas</label><input id="calculator-installments" name="installments" type="number" min="1" value="12"></div><div class="form-field"><label for="percentage-value">Tasa de interés</label><input id="percentage-value" name="percentage-value" type="number" min="0" max="100" step="0.1" value="38" placeholder="0%"></div></div><div class="calculator-result-card installment-result-card" id="percentage-results"><div><span>Cuota mensual</span><strong>$12.500</strong><small>Total a pagar: $150.000</small></div><img src="manguito elementos/mangoCON calculadora EN LA MANO.svg" alt=""></div>`;
  return `
    <section class="screen">
      <p class="subscreen-description">Hacé tus cálculos de forma rápida y sencilla.</p>
      <form class="panel-card calculator-card" data-form="calculator">
        <div class="calculator-mode-tabs" role="tablist"><button type="button" class="calculator-mode-button ${mode === "savings" ? "active" : ""}" data-calculator-mode="savings">Ahorro</button><button type="button" class="calculator-mode-button ${mode === "installments" ? "active" : ""}" data-calculator-mode="installments">Cuotas</button></div>
        ${modeMarkup}
        <button class="primary-button calculator-submit" type="submit">Calcular de nuevo</button>
      </form>
    </section>
  `;
}

function currencyScreen() {
  const rate = Number(data.exchangeRates[currencyCurrency]) || "";
  return `
    <section class="screen currency-screen">
      <header class="currency-heading"><h2>¿Qué tipo de cambio necesitás?</h2><p>Elegí la moneda y completá el monto.</p></header>
      <form class="form-stack currency-form" data-form="currency">
        <div class="currency-direction-toggle" role="group" aria-label="Tipo de cambio"><button class="currency-direction-button ${currencyDirection === "to-foreign" ? "active" : ""}" type="button" data-currency-direction="to-foreign">Compra</button><button class="currency-direction-button ${currencyDirection === "to-ars" ? "active" : ""}" type="button" data-currency-direction="to-ars">Venta</button></div>
        <div class="currency-converter-box active"><div class="currency-name"><img class="currency-flag" src="manguito elementos/banderaeeuu.svg" alt="Estados Unidos"><strong>USD</strong><span>⌄</span></div><label for="currency-amount">Monto en dólares</label><input id="currency-amount" name="amount" inputmode="decimal" value="${currencyResult?.input?.toLocaleString("es-AR") || "1.000"}" placeholder="1.000" required></div>
        <button class="currency-swap-button" type="button" aria-label="Relación entre monedas" tabindex="-1">↕</button>
        <div class="currency-converter-box"><div class="currency-name"><img class="currency-flag" src="manguito elementos/banderaarg.svg" alt="Argentina"><strong>ARS</strong><span>⌄</span></div><label for="currency-foreign-amount">Equivale a</label><input id="currency-foreign-amount" name="foreign-amount" inputmode="decimal" value="${currencyResult?.output?.toLocaleString("es-AR") || ""}" placeholder="-"></div>
        <input type="hidden" id="currency-rate" name="rate" inputmode="decimal" value="${rate || 1540}" required>
        <input type="hidden" id="currency-name" name="currency" value="${currencyCurrency}">
        <input type="hidden" id="currency-direction" name="direction" value="${currencyDirection}">
        <p class="form-error" data-error></p>
      </form>
      <article class="daily-rate-card"><img src="manguito elementos/mangoconmonedas.svg" alt=""><div><small>Tipo de cambio del día</small><strong>$1.540</strong><span>Actualizado: 12 sep 2026 - 10:24hs</span></div></article><small class="exchange-source">Fuente: BCRA 🔗</small>
    </section>
  `;
}

const glossaryTerms = [
  ["Ahorro", "Parte de tus ingresos que reservás para objetivos o imprevistos."],
  ["Débito", "Dinero que se descuenta de una cuenta o saldo."],
  ["Deuda", "Monto de dinero que queda pendiente de pago."],
  ["Gasto fijo", "Pago recurrente que suele repetirse con una frecuencia definida."],
  ["Ingreso", "Dinero que recibís, por ejemplo un sueldo, una venta o un reintegro."],
  ["Inflación", "Aumento general de precios que reduce el poder de compra del dinero."],
  ["Interés", "Costo de pedir dinero prestado o rendimiento por dejar dinero invertido."],
  ["Presupuesto", "Plan que compara los ingresos con los gastos de un período."],
  ["Saldo", "Diferencia entre el dinero disponible y los movimientos registrados."],
];

function glossaryListMarkup() {
  const query = glossaryQuery.trim().toLocaleLowerCase("es");
  const results = glossaryTerms.filter(([term, description]) => `${term} ${description}`.toLocaleLowerCase("es").includes(query));
  return results.map(([term, description]) => `<details class="glossary-term"><summary>${term}</summary><p>${description}</p></details>`).join("")
    || '<div class="empty-state">No encontramos ese término. Probá con otra palabra.</div>';
}

function legacyGlossaryScreen() {
  return `
    <section class="screen">
      <div class="tool-screen-mascot"><img src="manguito elementos/mangoLEYENDOGLOSARIO.svg" alt="Manguito leyendo un glosario"></div>
      <p class="subscreen-description">Consultá conceptos de finanzas personales en palabras simples.</p>
      <div class="form-field glossary-search"><label for="glossary-search">Buscar un término</label><input id="glossary-search" type="search" placeholder="Ej: ahorro, presupuesto..." value="${escapeHTML(glossaryQuery)}"></div>
      <div class="glossary-list" id="glossary-list">${glossaryListMarkup()}</div>
    </section>
  `;
}

const glossaryLessons = [
  { term: "\u00bfQu\u00e9 es el IVA?", definition: "El IVA es un impuesto que se aplica al consumo de bienes y servicios.", simple: "Lo pag\u00e1s cuando compr\u00e1s un producto o contrat\u00e1s un servicio." },
  { term: "\u00bfQu\u00e9 es el ahorro?", definition: "El ahorro es la parte de tus ingresos que decid\u00eds guardar para usar m\u00e1s adelante.", simple: "Es separar un poquito de plata hoy para alcanzar una meta o estar preparado para un imprevisto." },
  { term: "\u00bfQu\u00e9 es un presupuesto?", definition: "Un presupuesto es un plan para organizar cu\u00e1nto dinero entra y cu\u00e1nto vas a gastar.", simple: "Te ayuda a decidir de antemano qu\u00e9 pod\u00e9s pagar y cu\u00e1nto quer\u00e9s reservar." },
];

const categoryChartColors = Object.fromEntries(categories.map(({ id, color }) => [id, color]));

function glossaryScreen() {
  const lesson = glossaryLessons[glossaryIndex % glossaryLessons.length];
  return `
    <section class="screen glossary-lesson-screen">
      <div class="glossary-hero">
        <h1>${lesson.term}</h1>
        <p>${lesson.definition}</p>
        <img class="glossary-hero-mascot" src="manguito elementos/mangoLEYENDOGLOSARIO.svg" alt="Manguito leyendo el glosario">
        <svg class="glossary-wave" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0 C70 4 88 29 180 36 C268 43 321 53 400 48 L400 60 L0 60Z" fill="white"/></svg>
      </div>
      <article class="glossary-simple-card">
        <div class="glossary-simple-title"><span class="glossary-bulb" aria-hidden="true">${categoryIconMarkup("servicios")}</span><strong>En simple</strong></div>
        <p>${lesson.simple}</p>
      </article>
      <button class="primary-button glossary-next-button" type="button" data-action="glossary-next">Siguiente</button>
    </section>
  `;
}

function promotionsScreen() {
  const offers = [
    { id: "mercado-pago", brand: "mercado pago", brandClass: "mercado-pago", discount: "20% OFF", qualifier: "en MERCADO PAGO", conditions: "Válido en compras realizadas con Mercado Pago. Consultá los comercios adheridos y topes vigentes." },
    { id: "dia", brand: "Día", brandClass: "dia", discount: "20% OFF", qualifier: "con CLUB DÍA", conditions: "Beneficio para socios de Club Día. Revisá los días de vigencia y el tope de reintegro en la app." },
    { id: "cuenta-dni", brand: "Cuenta DNI", brandClass: "cuenta-dni", discount: "20% REINTEGRO", qualifier: "con CUENTA DNI", conditions: "Promoción para pagos con Cuenta DNI. El reintegro y los topes dependen de las condiciones del banco." },
  ];
  const brandLogos = {
    "mercado-pago": "mercadopago.svg",
    dia: "brand-dia.svg",
    "cuenta-dni": "brand-cuenta-dni.svg",
  };
  return `
    <section class="screen promotions-screen">
      <div class="featured-promotions">
        ${offers.map((offer) => `
          <article class="featured-promotion-card ${offer.brandClass}">
            <div class="featured-promotion-brand"><img src="manguito elementos/${brandLogos[offer.id]}" alt="${escapeHTML(offer.brand)}"></div>
            <div class="featured-promotion-offer"><span><strong>${offer.discount}</strong><small>${offer.qualifier}</small></span><span class="promo-validity">Válido hasta el 30/08</span></div>
            <button class="promo-conditions-button" type="button" data-promo-conditions="${offer.id}" aria-expanded="false">Ver condiciones</button>
            <p class="promo-conditions-copy" hidden>${offer.conditions}</p>
          </article>
        `).join("")}
      </div>
      <aside class="promo-mascot-note"><img src="manguito elementos/mangoPLAYERO-transparent.svg" alt=""><p>Aprovechá las promos y<br>hacé rendir tu plata.</p></aside>
    </section>
  `;
}

function transactionsScreen() {
  const filtered = data.transactions.filter((item) => transactionFilter === "Todas" || item.type === transactionFilter.toLowerCase().replace("ingresos", "income").replace("gastos", "expense"));
  return `
    <section class="screen">
      <header class="screen-header left"><h1>Movimientos</h1><p>Todos tus ingresos y gastos, en un mismo lugar.</p></header>
      <div class="filter-tabs">
        ${["Todas", "Ingresos", "Gastos"].map((label) => `<button class="filter-chip ${transactionFilter === label ? "active" : ""}" type="button" data-filter="${label}">${label}</button>`).join("")}
      </div>
      <article class="list-card">${transactionRows(filtered)}</article>
      <button class="primary-button wide-button" type="button" data-action="new-transaction">Agregar movimiento</button>
    </section>
  `;
}

function alertsScreen() {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const leadingDays = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthAlerts = data.alerts.reduce((map, alert) => {
    map.set(alert.date, (map.get(alert.date) || 0) + 1);
    return map;
  }, new Map());
  const calendarCells = [
    ...Array.from({ length: leadingDays }, () => '<span class="calendar-empty" aria-hidden="true"></span>'),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(year, month, index + 1, 12);
      const key = dateKey(date);
      const count = monthAlerts.get(key) || 0;
      return `<button class="calendar-day ${key === selectedAlertDate ? "selected" : ""} ${key === todayISO() ? "today" : ""} ${count ? "has-alert" : ""}" type="button" data-alert-date="${key}" aria-pressed="${key === selectedAlertDate}" aria-label="${formatDate(key)}${count ? `, ${count} ${count === 1 ? "alerta" : "alertas"}` : ""}">${index + 1}</button>`;
    }),
  ].join("");
  const selectedAlerts = data.alerts.filter(({ date }) => date === selectedAlertDate).sort((a, b) => a.title.localeCompare(b.title));
  const upcoming = data.alerts.filter(({ date }) => date >= todayISO() && date !== selectedAlertDate).sort((a, b) => a.date.localeCompare(b.date));
  return `
    <section class="screen alerts-screen">
      <article class="calendar-card">
        <div class="month-switcher"><strong>${calendarTitle(calendarMonth)}</strong><div class="month-controls"><button type="button" data-action="calendar-prev" aria-label="Mes anterior">‹</button><button type="button" data-action="calendar-next" aria-label="Mes siguiente">›</button></div></div>
        <div class="calendar-grid calendar-weekdays" aria-hidden="true">${["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((day) => `<span>${day}</span>`).join("")}</div>
        <div class="calendar-grid">${calendarCells}</div>
      </article>
      ${selectedAlerts.length ? `<div class="section-title-row"><h2>Vencimientos del ${formatDate(selectedAlertDate, { day: "numeric", month: "long" })}</h2></div><article class="list-card">${selectedAlerts.map(alertCardMarkup).join("")}</article>` : ""}
      <div class="section-title-row"><h2>Próximos vencimientos</h2></div>
      <article class="list-card">${upcoming.slice(0, 3).map(alertCardMarkup).join("") || '<div class="empty-state">No hay vencimientos próximos.</div>'}<button class="text-link alert-more-link" type="button" data-action="view-all-alerts">Ver más &gt;</button></article>
    </section>
  `;
}

function allAlertsScreen() {
  const alerts = data.alerts.slice().sort((a, b) => a.date.localeCompare(b.date));
  return `
    <section class="screen alert-list-screen">
      <article class="list-card alert-list-card">${alerts.map((alert) => `
        <div class="alert-list-row">
          <span class="alert-list-copy"><strong>${escapeHTML(alert.title)}</strong><small>${alertDueLabel(alert)}</small></span>
          <span class="alert-list-value"><strong>${money(alert.amount)}</strong><button type="button" data-alert-id="${escapeHTML(alert.id)}">Ver detalle &gt;&gt;</button></span>
        </div>`).join("") || '<div class="empty-state">Todavía no agregaste vencimientos.</div>'}</article>
      <button class="primary-button alert-register-button" type="button" data-action="new-alert">Registrar nuevo vencimiento</button>
    </section>
  `;
}

function profileScreen() {
  const name = escapeHTML(data.user?.name || "Juana");
  const email = escapeHTML(data.user?.email || "tuemail@ejemplo.com");
  return `
    <section class="screen profile-screen">
      <header class="profile-hero">
        <span class="profile-avatar"><img src="manguito elementos/MANGUITOSONRIENDO.svg" alt=""><span class="profile-avatar-edit" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 8h3l1.5-2h7L17 8h3v10H4z"/><circle cx="12" cy="13" r="3"/></svg></span></span>
        <strong>${name}</strong>
        <small>${email}</small>
        <button class="profile-edit-button" type="button" data-action="edit-profile">Editar perfil</button>
      </header>
      <article class="panel-card profile-group">
        <h2 class="profile-group-title">CUENTA</h2>
        <button class="setting-row setting-button profile-setting" type="button" data-action="edit-profile"><span class="profile-setting-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.5-3.5 2.8-5.5 6.5-5.5s6 2 6.5 5.5"/></svg></span><span>Datos personales</span><span class="setting-value">›</span></button>
      </article>
      <article class="panel-card profile-group">
        <h2 class="profile-group-title">PREFERENCIAS</h2>
        <button class="setting-row setting-button profile-setting" type="button" data-action="alert-reminders"><span class="profile-setting-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg></span><span>Alertas y notificaciones</span><span class="setting-value">›</span></button>
        <button class="setting-row setting-button profile-setting" type="button" data-action="appearance"><span class="profile-setting-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18h1.2a2.3 2.3 0 0 0 1.6-4c-.8-.8-.2-2 1-2H18a3 3 0 0 0 3-3 9 9 0 0 0-9-9Z"/><circle cx="7.5" cy="10" r=".8"/><circle cx="11" cy="6.5" r=".8"/><circle cx="16" cy="8" r=".8"/></svg></span><span>Apariencia</span><span class="setting-value">›</span></button>
        <button class="setting-row setting-button profile-setting" type="button" data-action="edit-categories"><span class="profile-setting-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="16" rx="1.5"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></span><span>Mis categorías</span><span class="setting-value">›</span></button>
      </article>
      <footer class="profile-footer">
        <button class="profile-logout-button" type="button" data-action="logout">Cerrar sesión</button>
        <button class="profile-help-button" type="button" data-action="about">ⓘ　¿Necesitás ayuda?</button>
      </footer>
    </section>
  `;
}

function appearanceScreen() {
  const appearanceSlide = `appearance-slide-${data.theme}-${textSize}`;
  return `
    <section class="screen appearance-settings-screen ${appearanceSlide}" data-appearance-slide="${appearanceSlide}">
      <header class="preference-heading"><h2>¿Cómo querés ver a Mango?</h2><p>Elegí el tema que más te guste para la aplicación.</p></header>
      <article class="panel-card appearance-card">
        <button class="appearance-choice ${data.theme === "light" ? "active" : ""}" type="button" data-theme-choice="light" aria-pressed="${data.theme === "light"}"><span class="appearance-preview light-preview">☼</span><span><strong>Claro</strong><small>Fondo blanco y colores de Mango.</small></span><span class="appearance-radio"></span></button>
        <button class="appearance-choice ${data.theme === "dark" ? "active" : ""}" type="button" data-theme-choice="dark" aria-pressed="${data.theme === "dark"}"><span class="appearance-preview dark-preview">☾</span><span><strong>Oscuro</strong><small>Fondo oscuro y colores adaptados.</small></span><span class="appearance-radio"></span></button>
      </article>
      <h2 class="text-size-title">Tamaño del texto</h2>
      <article class="panel-card text-size-card">
        <button class="text-size-choice ${textSize === "standard" ? "active" : ""}" type="button" data-text-size="standard"><span class="text-size-preview">T</span><span><strong>Texto estándar</strong><small>Tamaño de texto por defecto.</small></span><span class="appearance-radio"></span></button>
        <button class="text-size-choice ${textSize === "large" ? "active" : ""}" type="button" data-text-size="large"><span class="text-size-preview large">T<sup>+</sup></span><span><strong>Texto grande</strong><small>Aumenta el tamaño de los textos.</small></span><span class="appearance-radio"></span></button>
      </article>
    </section>
  `;
}

function categorySettingsScreen() {
  const allCategories = expenseCategories();
  return `
    <section class="screen category-settings-screen">
      <header class="preference-heading category-heading"><h2>Configurá Mango a tu manera</h2><p>Personalizá cómo querés organizar tus movimientos.</p></header>
      <div class="category-grid setup-category-grid">
        ${allCategories.map((category) => `
          <button class="category-option ${data.selectedCategories.includes(category.id) ? "selected" : ""}" type="button" data-category-detail="${escapeHTML(category.id)}" aria-label="Abrir ${escapeHTML(category.name)}">
            <span class="category-emoji" style="background:${category.color || "#eee0f6"}">${categoryAssetMarkup(category)}</span>
            <span class="category-label"><span class="category-name">${escapeHTML(category.name)}</span><span class="category-chevron" aria-hidden="true">›</span></span>
          </button>
        `).join("")}
      </div>
      <div class="form-actions"><button class="primary-button wide-button" type="button" data-action="new-category">Crear nueva categoría</button></div>
    </section>
  `;
}

const subcategoryAssetMap = {
  "Impuestos": "icon-17.svg",
  "Expensas": "icon-26.svg",
  "Mantenimiento": "icon-04.svg",
  "Juntadas": "icon-22.svg",
  "Delivery": "icon-16.svg",
  "Restaurantes": "icon-23.svg",
  "Suplementos": "icon-24.svg",
  "Combustible/estacionamiento": "icon-25.svg",
  "Seguro": "icon-14.svg",
  "Apps y taxis": "icon-05.svg",
  "Colectivo/tren/subte": "icon-06.svg",
  "Luz / Gas / Agua": "icon-02.svg",
  "Internet": "icon-08.svg",
  "Celular": "icon-09.svg",
  "Suscripciones": "icon-10.svg",
  "salud:Medicamentos": "icon-11.svg",
  "mascotas:Medicamentos": "icon-18.svg",
  "Consultas": "icon-12.svg",
  "Estudios": "icon-13.svg",
  "Obra social": "icon-15.svg",
  "Carnicería": "icon-01.svg",
  "Verdulería": "icon-27.svg",
  "Almacén": "icon-26.svg",
  "Limpieza": "icon-03.svg",
  "Alimento": "icon-20.svg",
  "Veterinario": "icon-19.svg",
  "Peluquería y juguetes": "icon-21.svg",
  "Recitales": "icon-07.svg",
};

function subcategoryIconMarkup(label, categoryId) {
  if (categoryId === "alquiler" && label === "Alquiler") {
    return '<img class="subcategory-asset subcategory-category-asset" src="manguito elementos/categoriahogar.svg" alt="">';
  }
  const asset = subcategoryAssetMap[`${categoryId}:${label}`] || subcategoryAssetMap[label];
  if (asset) return `<img class="subcategory-asset" src="manguito elementos/subcategorias/${asset}" alt="">`;
  const normalized = String(label).toLocaleLowerCase("es");
  if (normalized.includes("alquiler") || categoryId === "alquiler") return categoryIconMarkup("alquiler");
  if (normalized.includes("internet")) return '<svg class="subcategory-vector" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="13" rx="2"/><path d="M8 21h8M12 18v3M8 9h.01M12 9h.01M16 9h.01"/></svg>';
  if (normalized === "luz") return '<svg class="subcategory-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-8 12h6l-1 8 8-12h-6z"/></svg>';
  if (normalized === "agua") return '<svg class="subcategory-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3s6 6.3 6 11a6 6 0 0 1-12 0c0-4.7 6-11 6-11z"/><path d="M9 16a3 3 0 0 0 3 2"/></svg>';
  if (normalized === "gas") return '<svg class="subcategory-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21a6 6 0 0 0 5-9c-1.5-2.2-3.4-3.1-3-7-3 1.8-4 4.1-3 6-1.8-.8-3-2.3-3-4.5A7 7 0 0 0 7 21"/><path d="M12 21a3 3 0 0 0 2-5c-.8-1.1-1.2-2-1-3-2 1.1-3 2.7-3 4.2A3.8 3.8 0 0 0 12 21z"/></svg>';
  if (categoryId === "ocio" && normalized === "paseos") return '<svg class="subcategory-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 14h14l-1 5H6zM7 14V9h5l2 5M8 19v2m8-2v2"/></svg>';
  if (categoryId === "ocio" && normalized === "deportes") return '<svg class="subcategory-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4m3-6v8m10-8v8m3-6v4M7 12h10"/></svg>';
  if (categoryId === "ocio" && normalized === "viajes") return '<svg class="subcategory-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 12 18-7-7 18-3-8z"/><path d="m11 15 5-5"/></svg>';
  if (categoryId === "ocio" && normalized === "recitales") return '<svg class="subcategory-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>';
  if (normalized.includes("impuesto")) return '<svg class="subcategory-vector" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M14.5 8.5c-.7-.7-1.4-1-2.5-1-1.5 0-2.5.7-2.5 1.8 0 2.8 5 1.2 5 4.1 0 1.1-1 1.9-2.6 1.9-1.1 0-2-.3-2.8-1"/><path d="M12 6v12"/></svg>';
  if (normalized.includes("mantenimiento")) return '<svg class="subcategory-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6 4 4M13 7l4-4 4 4-4 4M4 20l8-8 3 3-8 8H4z"/></svg>';
  if (normalized.includes("expensa")) return '<svg class="subcategory-vector" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>';
  return categoryIconMarkup(categoryId);
}

function categoryDetailScreen() {
  const category = expenseCategories().find(({ id }) => id === selectedCategoryId);
  if (!category) return `<section class="screen"><header class="screen-header left"><h1>Categoría no encontrada</h1></header></section>`;
  const custom = data.customCategories.some(({ id }) => id === category.id);
  const displayName = category.id === "alquiler" ? "Vivienda" : category.name;
  return `
    <section class="screen category-detail-screen category-detail-${category.id}">
      <div class="category-detail-hero">${categoryAssetMarkup(category)}<h1>${escapeHTML(displayName)}</h1></div>
      <h2 class="subcategory-question">¿En qué gastaste?</h2>
      <article class="category-detail-list">
        ${category.children.map((child) => `<button class="subcategory-row" type="button" data-category-subcategory="${escapeHTML(child)}"><span class="subcategory-icon">${subcategoryIconMarkup(child, category.id)}</span><strong>${escapeHTML(child)}</strong><span class="subcategory-chevron" aria-hidden="true">›</span></button>`).join("") || '<div class="empty-state">Todavía no hay subcategorías.</div>'}
      </article>
      <button class="subcategory-manage-button" type="button" data-action="manage-subcategories">⊕ Crear o eliminar subcategoría</button>
      <button class="primary-button category-detail-save" type="button" data-action="back-to-category-settings">Guardar cambios</button>
      ${custom ? `<button class="text-button danger-button" type="button" data-action="delete-custom-category">Eliminar categoría</button>` : ""}
    </section>
  `;
}

function categoryFormScreen() {
  return `
    <section class="screen category-form-screen">
      <header class="preference-heading"><h2>¿Qué nueva categoría querés agregar?</h2></header>
      <form class="form-stack category-form" data-form="category">
        <div class="form-field"><label for="category-name">Nombre de la categoría</label><input id="category-name" name="name" maxlength="28" placeholder="Ej: Mascotas" required></div>
        <div class="form-field"><label>Elegí un ícono</label><div class="category-icon-picker">
          <button type="button" class="category-icon-choice active custom-category-study" data-category-icon="study" aria-label="Estudios">${customCategoryIconMarkup("study")}</button>
          <button type="button" class="category-icon-choice custom-category-work" data-category-icon="work" aria-label="Trabajo">${customCategoryIconMarkup("work")}</button>
          <button type="button" class="category-icon-choice custom-category-savings" data-category-icon="savings" aria-label="Ahorro">${customCategoryIconMarkup("savings")}</button>
          <button type="button" class="category-icon-choice custom-category-alerts" data-category-icon="alerts" aria-label="Alertas">${customCategoryIconMarkup("alerts")}</button>
        </div></div>
        <input type="hidden" name="icon" value="study">
        <input type="hidden" name="children" value="">
        <p class="form-error" data-error></p>
        <div class="form-actions"><button class="primary-button" type="submit">Guardar cambios</button></div>
      </form>
    </section>
  `;
}

function alertRemindersScreen() {
  const days = Number(data.alertReminders.daysBefore);
  return `
    <section class="screen reminder-settings-screen">
      <header class="preference-heading"><h2>Recordarme...</h2><p>Elegí cuándo querés recibir avisos de tus vencimientos.</p></header>
      <article class="panel-card reminder-settings">
        ${[[1, "1 día antes"], [3, "3 días antes"], [7, "7 días antes"]].map(([value, label]) => `<button type="button" class="reminder-option ${days === value ? "active" : ""}" data-reminder-option="${value}"><span>${label}</span><span class="appearance-radio"></span></button>`).join("")}
        <label class="reminder-email-row"><span>Recibir alarmas por mail</span><input type="checkbox" data-reminder-email ${data.alertReminders.emailEnabled ? "checked" : ""}></label>
      </article>
      <button class="primary-button reminder-save-button" type="button" data-action="save-reminder-settings">Guardar cambios</button>
      <div class="preference-mascot"><img src="manguito elementos/mangooPENSANDO.svg" alt="Manguito pensando"></div>
    </section>
  `;
}

function alertPreferencesIntroScreen() {
  return `
    <section class="screen alert-preferences-intro-screen">
      <div class="alert-intro-mascot"><img src="manguito elementos/mangoCONcelular.svg" alt="Manguito"></div>
      <header class="preference-heading"><h2>¡Que no se te pase nada!</h2><p>Elegí las alertas que querés recibir para organizar tus movimientos y vencimientos.</p></header>
      <article class="panel-card alert-preference-list">
        <button type="button" class="alert-preference-row ${alertPreferences.due ? "active" : ""}" data-alert-preference="due" aria-pressed="${alertPreferences.due}"><span class="alert-preference-icon">◴</span><span><strong>Vencimientos</strong><small>Recordatorios de pagos próximos.</small></span><span class="appearance-radio"></span></button>
        <button type="button" class="alert-preference-row ${alertPreferences.movements ? "active" : ""}" data-alert-preference="movements" aria-pressed="${alertPreferences.movements}"><span class="alert-preference-icon">＄</span><span><strong>Movimientos</strong><small>Recordatorios para registrar datos.</small></span><span class="appearance-radio"></span></button>
        <button type="button" class="alert-preference-row ${alertPreferences.summary ? "active" : ""}" data-alert-preference="summary" aria-pressed="${alertPreferences.summary}"><span class="alert-preference-icon">♧</span><span><strong>Resumen mensual</strong><small>Recordatorio para revisar tus movimientos.</small></span><span class="appearance-radio"></span></button>
      </article>
      <button class="primary-button alert-intro-continue" type="button" data-action="alert-reminders-continue">Continuar</button>
      <p class="alert-intro-note">Podés modificar tus preferencias más adelante.</p>
    </section>
  `;
}

function transactionChoiceScreen() {
  return `
    <section class="screen choice-screen pattern-screen">
      <div class="choice-art">${mangoIllustration("Mango con billetera y monedas transparente.svg", true, true)}</div>
      <header class="screen-header"><h1>¿Qué querés registrar?</h1></header>
      <button class="choice-button income-choice" type="button" data-action="choose-income"><span class="choice-arrow">↑</span><strong>INGRESOS</strong></button>
      <button class="choice-button expense-choice" type="button" data-action="choose-expense"><span class="choice-arrow">↓</span><strong>GASTOS</strong></button>
      <button class="text-button" type="button" data-action="cancel">Cancelar</button>
    </section>
  `;
}

function newTransactionScreen() {
  const isIncome = draft?.type === "income";
  const categoryPool = isIncome ? incomeCategories : categories;
  const category = categoryPool.find(({ id }) => id === draft?.category);
  const categoryName = category?.name || "Seleccionar";
  const subcategoryName = draft?.subcategory || "Seleccionar";
  const selectedCategoryIcon = draft?.subcategory && category
    ? subcategoryIconMarkup(draft.subcategory, category.id)
    : categoryIconMarkup(category?.id || "otros-ingresos");
  const title = isIncome ? "Nuevo ingreso" : "Nuevo gasto";
  const amount = draft?.amount ? money(draft.amount) : "$0,00";

  return `
    <section class="screen">
      <header class="screen-header"><h1>${title}</h1></header>
      <form data-form="transaction">
        <div class="amount-card">
          <label for="transaction-amount">Monto del ${isIncome ? "ingreso" : "egreso"}</label>
          <input id="transaction-amount" name="amount" inputmode="numeric" placeholder="$0,00" value="${draft?.amount ? escapeHTML(String(draft.amount)) : ""}" required>
          <small>ARS · Peso argentino</small>
        </div>
        <div class="form-field">
          <label for="transaction-date">Fecha</label>
          <input id="transaction-date" name="date" type="date" value="${escapeHTML(draft?.date || todayISO())}" required>
        </div>
        <div class="form-field" style="margin-top:12px">
          <span class="field-label">Categoría</span>
          <button class="form-row-button" type="button" data-action="change-category">
            <span class="row-left"><span class="category-form-icon">${categoryIconMarkup(category?.id || "otros-ingresos")}</span><span>${escapeHTML(categoryName)}</span></span><span class="chevron-right">›</span>
          </button>
        </div>
        ${!isIncome && category ? `<div class="form-field subcategory-form-field"><span class="field-label">Subcategoría</span><button class="form-row-button" type="button" data-action="change-subcategory"><span class="row-left"><span class="category-form-icon">${selectedCategoryIcon}</span><span>${escapeHTML(subcategoryName)}</span></span><span class="chevron-right">›</span></button></div>` : ""}
        ${!isIncome ? `
          <div style="margin-top:13px">
            <span class="field-label">¿Es un gasto fijo?</span>
            <label class="fixed-choice"><input type="radio" name="fixed" value="no" ${draft?.fixed === "no" ? "checked" : ""}> No</label>
            <label class="fixed-choice"><input type="radio" name="fixed" value="monthly" ${!draft?.fixed || draft.fixed === "monthly" ? "checked" : ""}> Todos los meses</label>
          </div>
        ` : ""}
        <div class="form-field" style="margin-top:13px">
          <label for="transaction-note">Nota (opcional)</label>
          <input id="transaction-note" name="note" placeholder="Ej: Cobro del mes" value="${escapeHTML(draft?.note || "")}">
        </div>
        <p class="form-error" data-error></p>
        <div class="form-actions"><button class="primary-button" type="submit">Guardar</button></div>
      </form>
    </section>
  `;
}

function categoryPickerScreen() {
  // Todas las categorías base deben estar disponibles al registrar un gasto.
  // La selección de Perfil organiza la pantalla de preferencias, no bloquea
  // categorías del registro.
  const pool = draft?.type === "income" ? incomeCategories : expenseCategories();
  if (!pool.length) {
    return `
      <section class="screen">
        <header class="screen-header left"><h1>Elegí una categoría</h1><p>Primero agregá categorías desde tu perfil.</p></header>
        <button class="text-button" type="button" data-action="cancel">Volver</button>
      </section>
    `;
  }
  return `
    <section class="screen">
      <header class="screen-header left"><h1>Elegí una categoría</h1><p>Seleccioná la que mejor describe este movimiento.</p></header>
      <div class="category-grid">
        ${pool.map((category) => `
          <button class="category-option ${draft?.category === category.id ? "selected" : ""}" type="button" data-pick-category="${category.id}">
            <span class="category-emoji">${categoryVisualMarkup(category.id)}</span><span class="category-name">${category.name}</span><span aria-hidden="true">›</span>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function subcategoryPickerScreen() {
  const category = expenseCategories().find(({ id }) => id === draft?.category);
  if (!category) return categoryPickerScreen();
  return `
    <section class="screen subcategory-picker-screen subcategory-picker-${category.id}">
      <header class="subcategory-picker-heading"><div class="subcategory-picker-icon" style="background:${category.color || "#fff3a8"}">${categoryAssetMarkup(category)}</div><h1>${escapeHTML(category.name)}</h1></header>
      <h2>¿En qué gastaste?</h2>
      <article class="subcategory-picker-list">
        ${category.children.map((child) => `<button class="subcategory-row" type="button" data-pick-subcategory="${escapeHTML(child)}"><span class="subcategory-icon">${subcategoryIconMarkup(child, category.id)}</span><strong>${escapeHTML(child)}</strong><span class="subcategory-chevron" aria-hidden="true">›</span></button>`).join("")}
      </article>
    </section>
  `;
}

function alertFormScreen() {
  const alert = data.alerts.find(({ id }) => id === editingAlertId);
  return `
    <section class="screen">
      <header class="screen-header left"><h1>${alert ? "Editar alerta" : "Nueva alerta"}</h1><p>Agregá un vencimiento para tenerlo presente.</p></header>
      <form class="form-stack" data-form="alert">
        <div class="form-field"><label for="alert-title">Nombre del servicio o vencimiento</label><input id="alert-title" name="title" placeholder="Ej: Internet" value="${escapeHTML(alert?.title || "")}" required></div>
        <div class="form-field"><label for="alert-amount">Monto</label><input id="alert-amount" name="amount" inputmode="numeric" placeholder="$0" value="${alert ? money(alert.amount) : ""}" required></div>
        <div class="form-field"><label for="alert-date">Fecha de vencimiento</label><input id="alert-date" name="date" type="date" value="${escapeHTML(alert?.date || todayISO())}" required></div>
        <p class="form-error" data-error></p>
        <div class="form-actions"><button class="primary-button" type="submit">${alert ? "Guardar cambios" : "Guardar alerta"}</button><button class="text-button" type="button" data-action="cancel-alert">Cancelar</button></div>
      </form>
    </section>
  `;
}

function alertDetailScreen() {
  const alert = data.alerts.find(({ id }) => id === selectedAlertId);
  if (!alert) return `<section class="screen"><header class="screen-header left"><h1>Alerta no encontrada</h1></header><button class="text-button" type="button" data-action="back-to-alerts">Volver a alertas</button></section>`;
  const history = alert.history || [];
  return `
    <section class="screen alert-detail-screen">
      <article class="alert-detail-card">
        <div class="alert-detail-heading"><span><strong>${escapeHTML(alert.title)}</strong><small>${escapeHTML(alert.merchant || (alert.id === "internet" ? "Movistar Hogar" : ""))}</small></span><span class="alert-pending">Pendiente</span></div>
        <strong class="alert-detail-amount">${money(alert.amount)}</strong>
        <div class="alert-detail-footer"><span>${alertDueLabel(alert)}</span><span>Hasta el ${formatDate(alert.date, { day: "2-digit", month: "2-digit" })}</span></div>
      </article>
      <h2 class="alert-history-title">Historial de facturación</h2>
      <article class="list-card alert-history-card">${history.length ? history.map((payment) => `<div class="alert-history-row"><span><strong>${escapeHTML(payment.period)}</strong><small>Pagado el ${escapeHTML(payment.paidDate)}</small></span><strong>${money(payment.amount)}</strong></div>`).join("") : '<div class="empty-state">Todavía no hay pagos anteriores registrados.</div>'}<button class="text-link" type="button" data-action="view-alert-history">Ver más &gt;</button></article>
    </section>
  `;
}

function promotionFormScreen() {
  return `
    <section class="screen">
      <header class="screen-header left"><h1>Guardar promoción</h1><p>Registrá un descuento o beneficio que quieras recordar.</p></header>
      <form class="form-stack" data-form="promotion">
        <div class="form-field"><label for="promotion-title">Beneficio</label><input id="promotion-title" name="title" placeholder="Ej: 20% de descuento" required></div>
        <div class="form-field"><label for="promotion-merchant">Comercio</label><input id="promotion-merchant" name="merchant" placeholder="Nombre del comercio" required></div>
        <div class="form-field"><label for="promotion-code">Código (opcional)</label><input id="promotion-code" name="code" placeholder="Código o referencia"></div>
        <div class="form-field"><label for="promotion-date">Válida hasta (opcional)</label><input id="promotion-date" name="date" type="date"></div>
        <p class="form-error" data-error></p>
        <div class="form-actions"><button class="primary-button" type="submit">Guardar promoción</button></div>
      </form>
    </section>
  `;
}

function editProfileScreen() {
  return `
    <section class="screen pattern-screen">
      <form class="form-stack" data-form="profile">
        <div class="form-field"><label for="profile-name">Nombre</label><input id="profile-name" name="name" value="${escapeHTML(data.user?.name || "")}" required></div>
        <div class="form-field"><label for="profile-email">Correo electrónico</label><input id="profile-email" name="email" type="email" value="${escapeHTML(data.user?.email || "")}" required></div>
        <div class="form-field"><label for="profile-password">Contraseña</label><input id="profile-password" name="password" type="password" placeholder="Ingresá tu contraseña" autocomplete="new-password" required></div>
        <p class="form-error" data-error></p>
        <div class="form-actions"><button class="primary-button" type="submit">Guardar cambios</button></div>
      </form>
    </section>
  `;
}

function editIncomeScreen() {
  return `
    <section class="screen">
      <header class="screen-header left"><h1>Ingreso mensual</h1><p>Podés cambiarlo cuando quieras.</p></header>
      <form data-form="edit-income">
        <div class="form-field"><label for="monthly-income">Monto estimado</label><input id="monthly-income" name="income" inputmode="numeric" value="${money(data.monthlyIncome)}" required></div>
        <p class="form-error" data-error></p>
        <div class="form-actions"><button class="primary-button" type="submit">Guardar cambios</button></div>
      </form>
    </section>
  `;
}

function render() {
  const screens = {
    welcome: welcomeScreen,
    signup: signupScreen,
    login: loginScreen,
    disclosure: disclosureScreen,
    "income-setup": incomeSetupScreen,
    "setup-categories": setupCategoriesScreen,
    ready: readyScreen,
    home: dashboardScreen,
    panel: panelScreen,
    calculators: calculatorScreen,
    graphs: graphsScreen,
    currency: currencyScreen,
    glossary: glossaryScreen,
    promotions: promotionsScreen,
    "promotion-form": promotionFormScreen,
    transactions: transactionsScreen,
    alerts: alertsScreen,
    "alert-list": allAlertsScreen,
    "alert-detail": alertDetailScreen,
    profile: profileScreen,
    appearance: appearanceScreen,
    "category-settings": categorySettingsScreen,
    "category-detail": categoryDetailScreen,
    "category-form": categoryFormScreen,
    "alert-reminders": alertRemindersScreen,
    "alert-preferences-intro": alertPreferencesIntroScreen,
    "transaction-choice": transactionChoiceScreen,
    "new-transaction": newTransactionScreen,
    "category-picker": categoryPickerScreen,
    "subcategory-picker": subcategoryPickerScreen,
    "alert-form": alertFormScreen,
    "edit-profile": editProfileScreen,
    "edit-income": editIncomeScreen,
  };
  const renderScreen = screens[currentScreen] || welcomeScreen;
  content.innerHTML = renderScreen();
  document.documentElement.dataset.theme = data.theme;
  document.documentElement.dataset.textSize = textSize;
  const onboarding = ["welcome", "signup", "login", "disclosure", "income-setup", "setup-categories", "ready"].includes(currentScreen);
  const shouldShowNav = ["home", "panel", "alerts", "profile", "transaction-choice"].includes(currentScreen);
  const rootTabScreens = ["home", "panel", "alerts", "profile"];
  const contextualTitles = { calculators: "Calculadora financiera", graphs: "Gr\u00e1fico", currency: "Conversor", glossary: "Glosario", promotions: "Promociones", appearance: "Apariencia", "category-settings": "Categor\u00edas", "category-form": "Agregar categor\u00eda", "alert-reminders": "Recordatorios", "alert-preferences-intro": "Alertas y notificaciones", "edit-profile": "Datos personales" };
  const contextualTitle = contextualTitles[currentScreen] || "";
  topBar.classList.toggle("root-tab-top-bar", rootTabScreens.includes(currentScreen));
  topBar.classList.toggle("home-top-bar", currentScreen === "home");
  topBar.classList.toggle("title-screen", Boolean(contextualTitle));
  topBar.classList.toggle("transaction-choice-top-bar", currentScreen === "transaction-choice");
  topBar.classList.toggle("glossary-top-bar", currentScreen === "glossary");
  topBar.querySelector("#topbar-title").textContent = contextualTitle;
  topBar.querySelector("#topbar-title").hidden = !contextualTitle;
  topBar.hidden = onboarding || currentScreen === "profile";
  bottomNav.hidden = !shouldShowNav;
  if (shouldShowNav) bottomNav.innerHTML = navMarkup(currentScreen === "transaction-choice" ? "" : currentTab);
  document.title = currentScreen === "welcome" ? "Manguito | Tu economía, más clara" : `${screenTitle(currentScreen)} | Manguito`;
}

function screenTitle(screen) {
  return ({
    home: "Inicio",
    panel: "Panel",
    calculators: "Calculadoras",
    graphs: "Gr\u00e1fico",
    currency: "Conversor de divisas",
    glossary: "Glosario",
    promotions: "Promociones",
    "promotion-form": "Guardar promoción",
    transactions: "Movimientos",
    alerts: "Alertas",
    "alert-list": "Todas tus alertas",
    "alert-detail": "Detalle de alerta",
    profile: "Perfil",
    appearance: "Apariencia",
    "alert-preferences-intro": "Alertas y notificaciones",
    "category-settings": "Mis categorías",
    "category-detail": "Categoría",
    "category-form": "Nueva categoría",
    "alert-reminders": "Alertas y notificaciones",
    "transaction-choice": "Registrar",
    "new-transaction": draft?.type === "income" ? "Nuevo ingreso" : "Nuevo gasto",
    "category-picker": "Categorías",
    "subcategory-picker": "Subcategorías",
    "alert-form": "Nueva alerta",
    "edit-profile": "Datos personales",
    "edit-income": "Ingreso mensual",
  })[screen] || "Manguito";
}

function readAmount(value) {
  const amount = Number(String(value).replace(/\D/g, ""));
  return Number.isSafeInteger(amount) ? amount : 0;
}

function readDecimal(value) {
  const normalized = String(value || "").trim().replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  return Number(normalized);
}

function setFormError(form, text) {
  const target = form.querySelector("[data-error]");
  if (target) target.textContent = text;
}

function startTransaction(type) {
  draft = { type, category: "", subcategory: "", amount: "", date: todayISO(), note: "", fixed: "monthly" };
  goTo("new-transaction");
}

function saveTransaction(form) {
  const formData = new FormData(form);
  const amount = readAmount(formData.get("amount"));
  if (amount <= 0) {
    setFormError(form, "Ingresá un monto válido para continuar.");
    form.querySelector('[name="amount"]').focus();
    return;
  }
  if (!draft?.category) {
    setFormError(form, "Seleccioná una categoría para continuar.");
    return;
  }

  const category = [...expenseCategories(), ...incomeCategories].find(({ id }) => id === draft.category);
  data.transactions.unshift({
    id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : String(Date.now()),
    type: draft.type,
    category: draft.category,
    subcategory: draft.subcategory || category?.name || "",
    amount,
    date: String(formData.get("date") || todayISO()),
    note: String(formData.get("note") || "").trim(),
    fixed: formData.get("fixed") === "monthly",
  });
  if (!saveData()) return;
  draft = null;
  screenHistory = [];
  currentTab = "home";
  goTo("home", { replace: true });
  showToast("Movimiento guardado correctamente.");
}

// Keep the application viewport scrollable when large text makes a screen taller
// than the phone viewport. Some embedded browsers do not forward wheel events to
// a nested flex scroller reliably, so handle the gesture explicitly.
content.addEventListener("wheel", (event) => {
  if (content.scrollHeight <= content.clientHeight) return;
  content.scrollTop += event.deltaY;
  event.preventDefault();
}, { passive: false });

content.addEventListener("submit", (event) => {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();

  if (form.dataset.form === "signup") {
    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const confirm = String(formData.get("confirm") || "");
    if (!name || !email || password.length < 8 || password !== confirm) {
      setFormError(form, password.length < 8 ? "La contraseña debe tener al menos 8 caracteres." : "Revisá tus datos y confirmá que las contraseñas coincidan.");
      return;
    }
    const emailKey = email.toLowerCase();
    if (readAccounts()[emailKey]) {
      setFormError(form, "Ya existe una cuenta con ese correo en este dispositivo.");
      return;
    }
    Object.assign(data, structuredClone(defaultData));
    data.user = { name, email, password };
    saveData();
    goTo("disclosure");
    return;
  }

  if (form.dataset.form === "login") {
    const email = String(new FormData(form).get("email") || "").trim();
    const password = String(new FormData(form).get("password") || "");
    const emailKey = email.toLowerCase();
    const account = readAccounts()[emailKey] || (data.user?.email && String(data.user.email).toLowerCase() === emailKey ? data : null);
    if (!account || password !== String(account.user?.password || "")) {
      setFormError(form, "El correo o la contraseña no coinciden con la cuenta guardada en este dispositivo.");
      return;
    }
    Object.assign(data, structuredClone(defaultData), structuredClone(account));
    saveData();
    screenHistory = [];
    currentTab = "home";
    goTo("home", { replace: true });
    return;
  }

  if (form.dataset.form === "income-setup" || form.dataset.form === "edit-income") {
    const amount = readAmount(new FormData(form).get("income"));
    if (amount < 0) {
      setFormError(form, "Ingresá un monto mensual válido.");
      return;
    }
    data.monthlyIncome = amount;
    saveData();
    goTo(form.dataset.form === "edit-income" ? "profile" : "setup-categories");
    return;
  }

  if (form.dataset.form === "transaction") {
    saveTransaction(form);
    return;
  }

  if (form.dataset.form === "calculator") {
    const formData = new FormData(form);
    if (form.querySelector("#savings-results")) {
      const amount = readAmount(formData.get("savings-amount"));
      const months = calculatorSavingsMonths;
      const result = form.querySelector("#savings-results");
      if (result) result.innerHTML = `<div>Ahorrar <strong>${money(amount)} en ${months} meses</strong><small>significa ${money(amount / months)} por mes.</small></div><img src="manguito elementos/mangoCON calculadora EN LA MANO.svg" alt="">`;
    } else if (form.querySelector("#budget-results")) {
      const income = readAmount(formData.get("budget-income"));
      const fixed = Number(formData.get("fixed-percent")) || 0;
      const saving = Number(formData.get("saving-percent")) || 0;
      const result = form.querySelector("#budget-results");
      if (result) result.innerHTML = `<span>Disponible para otros gastos</span><strong>${money(income * (100 - fixed - saving) / 100)}</strong>`;
    } else {
      const amount = readAmount(formData.get("percentage-base"));
      const rate = Number(formData.get("percentage-value")) || 0;
      const installments = Math.max(1, Number(formData.get("installments")) || 1);
      const total = amount * (1 + rate / 100);
      const result = form.querySelector("#percentage-results");
      if (result) result.innerHTML = form.querySelector('[name="installments"]')
        ? `<div><span>Cuota mensual</span><strong>${money(total / installments)}</strong><small>Total a pagar: ${money(total)}</small></div><img src="manguito elementos/mangoCON calculadora EN LA MANO.svg" alt="">`
        : `<span>Resultado</span><strong>${money(amount * rate / 100)}</strong>`;
    }
    return;
  }

  if (form.dataset.form === "category") {
    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    if (!name) {
      setFormError(form, "Ingresá un nombre para la categoría.");
      return;
    }
    if (expenseCategories().some((category) => category.name.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"))) {
      setFormError(form, "Ya existe una categoría con ese nombre.");
      return;
    }
    const baseId = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `categoria-${Date.now()}`;
    const id = expenseCategories().some((category) => category.id === baseId) ? `${baseId}-${Date.now()}` : baseId;
    const children = String(formData.get("children") || "").split(",").map((child) => child.trim()).filter(Boolean);
    data.customCategories.push({ id, name, color: "#eee0f6", customIcon: String(formData.get("icon") || "study"), children });
    data.selectedCategories.push(id);
    if (!saveData()) return;
    goTo("category-settings", { replace: true });
    showToast("Categoría creada.");
    return;
  }

  if (form.dataset.form === "alert") {
    const formData = new FormData(form);
    const title = String(formData.get("title") || "").trim();
    const amount = readAmount(formData.get("amount"));
    const date = String(formData.get("date") || "");
    if (!title || amount <= 0 || !date) {
      setFormError(form, "Completá el nombre, el monto y la fecha.");
      return;
    }
    const existingAlert = data.alerts.find(({ id }) => id === editingAlertId);
    if (existingAlert) {
      Object.assign(existingAlert, { title, amount, date });
      selectedAlertId = existingAlert.id;
    } else {
      const id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : String(Date.now());
      data.alerts.push({ id, title, amount, date });
      selectedAlertId = id;
    }
    if (!saveData()) return;
    selectedAlertDate = date;
    const selectedDate = localDateFromISO(date);
    calendarMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    editingAlertId = "";
    screenHistory = [];
    currentTab = "alerts";
    goTo("alerts", { replace: true, tab: "alerts" });
    showToast("Alerta guardada.");
    return;
  }

  if (form.dataset.form === "currency") {
    const formData = new FormData(form);
    const direction = String(formData.get("direction") || "to-foreign");
    const amount = readDecimal(direction === "to-foreign" ? formData.get("amount") : formData.get("foreign-amount"));
    const currency = String(formData.get("currency") || "USD");
    const rate = readDecimal(formData.get("rate"));
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(rate) || rate <= 0) {
      setFormError(form, "Ingresá un monto y una cotización mayores que cero.");
      return;
    }
    currencyCurrency = currency;
    currencyDirection = direction;
    currencyResult = {
      input: amount,
      output: amount * rate,
      currency,
      direction,
      rate,
    };
    data.exchangeRates[currency] = rate;
    if (!saveData()) return;
    screenHistory = [];
    currentTab = "panel";
    goTo("currency", { replace: true, tab: "panel" });
    return;
  }

  if (form.dataset.form === "promotion") {
    const formData = new FormData(form);
    const title = String(formData.get("title") || "").trim();
    const merchant = String(formData.get("merchant") || "").trim();
    if (!title || !merchant) {
      setFormError(form, "Completá el beneficio y el comercio.");
      return;
    }
    data.promotions.unshift({
      id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : String(Date.now()),
      title,
      merchant,
      code: String(formData.get("code") || "").trim(),
      date: String(formData.get("date") || ""),
    });
    if (!saveData()) return;
    screenHistory = [];
    currentTab = "panel";
    goTo("promotions", { replace: true, tab: "panel" });
    showToast("Promoción guardada.");
    return;
  }

  if (form.dataset.form === "profile") {
    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    if (!name || !email) {
      setFormError(form, "Completá tu nombre y correo.");
      return;
    }
    data.user = { ...data.user, name, email };
    if (!saveData()) return;
    goTo("profile", { replace: true });
    showToast("Perfil actualizado.");
  }
});

content.addEventListener("input", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  if (input.id === "glossary-search") {
    glossaryQuery = input.value;
    content.querySelector("#glossary-list").innerHTML = glossaryListMarkup();
    return;
  }
  if (["budget-income", "fixed-percent", "saving-percent"].includes(input.name)) {
    const income = readAmount(content.querySelector('[name="budget-income"]')?.value);
    const fixed = Number(content.querySelector('[name="fixed-percent"]')?.value) || 0;
    const saving = Number(content.querySelector('[name="saving-percent"]')?.value) || 0;
    content.querySelector("#budget-results").innerHTML = `
      <div><span>Gastos fijos estimados</span><strong>${money(income * fixed / 100)}</strong></div>
      <div><span>Ahorro estimado</span><strong>${money(income * saving / 100)}</strong></div>
      <div class="calculator-total"><span>Disponible para otros gastos</span><strong>${money(income * (100 - fixed - saving) / 100)}</strong></div>
    `;
    return;
  }
  if (["percentage-base", "percentage-value", "installments"].includes(input.name)) {
    const amount = readAmount(content.querySelector('[name="percentage-base"]')?.value);
    const percent = Number(content.querySelector('[name="percentage-value"]')?.value) || 0;
    const installments = Math.max(1, Number(content.querySelector('[name="installments"]')?.value) || 1);
    const total = amount * (1 + percent / 100);
    const result = content.querySelector("#percentage-results");
    if (result) result.innerHTML = `<div><span>Cuota mensual</span><strong>${money(total / installments)}</strong><small>Total a pagar: ${money(total)}</small></div><img src="manguito elementos/mangoCON calculadora EN LA MANO.svg" alt="">`;
    return;
  }
  if (input.name === "savings-amount") {
    const amount = readAmount(input.value);
    const result = content.querySelector("#savings-results");
    if (result) result.innerHTML = `<div>Ahorrar <strong>${money(amount)} en ${calculatorSavingsMonths} meses</strong><small>significa ${money(amount / calculatorSavingsMonths)} por mes.</small></div><img src="manguito elementos/mangoCON calculadora EN LA MANO.svg" alt="">`;
    return;
  }
  if (input.closest('[data-form="currency"]')) {
    const form = input.closest('[data-form="currency"]');
    const rate = readDecimal(form.querySelector('[name="rate"]')?.value);
    const upper = form.querySelector('[name="amount"]');
    const lower = form.querySelector('[name="foreign-amount"]');
    if (Number.isFinite(rate) && rate > 0) {
      const amount = readDecimal(input === lower ? lower.value : upper.value);
      const target = input === lower ? upper : lower;
      if (Number.isFinite(amount) && amount >= 0) target.value = (input === lower ? amount / rate : amount * rate).toLocaleString("es-AR", { maximumFractionDigits: 2 });
      else target.value = "";
    }
    return;
  }
  if (input.closest('[data-form="currency"]') || !["amount", "income"].includes(input.name)) return;
  const digits = input.value.replace(/\D/g, "");
  const formatted = digits ? Number(digits).toLocaleString("es-AR") : "";
  const atEnd = input.selectionStart === input.value.length;
  input.value = formatted;
  if (atEnd) input.setSelectionRange(formatted.length, formatted.length);
});

content.addEventListener("change", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) return;
  if (input.matches("[data-category-toggle]")) {
    const id = input.dataset.categoryToggle;
    const previous = [...data.selectedCategories];
    data.selectedCategories = input.checked
      ? [...new Set([...data.selectedCategories, id])]
      : data.selectedCategories.filter((categoryId) => categoryId !== id);
    if (!data.selectedCategories.length) {
      data.selectedCategories = previous;
      input.checked = true;
      showToast("Dejá al menos una categoría disponible.");
    } else if (!saveData()) {
      data.selectedCategories = previous;
      input.checked = previous.includes(id);
    }
    return;
  }
  if (input.matches("[data-reminder-toggle]")) {
    data.alertReminders.enabled = input.checked;
    if (!saveData()) return;
    const days = content.querySelector("[data-reminder-days]");
    if (days) days.disabled = !input.checked;
    return;
  }
  if (input.matches("[data-reminder-days]")) {
    data.alertReminders.daysBefore = Number(input.value);
    saveData();
  }
  if (input.matches("[data-reminder-email]")) {
    data.alertReminders.emailEnabled = input.checked;
    saveData();
  }
});

content.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.tab) {
    const tab = button.dataset.tab;
    if (tab === "add") {
      draft = null;
      goTo("transaction-choice");
      return;
    }
    currentTab = tab;
    screenHistory = [];
    goTo(tab, { replace: true, tab });
    return;
  }

  if (button.dataset.filter) {
    transactionFilter = button.dataset.filter;
    render();
    return;
  }

  if (button.dataset.tool) {
    currentTab = "panel";
    goTo(button.dataset.tool);
    return;
  }

  if (button.dataset.categoryDetail) {
    selectedCategoryId = button.dataset.categoryDetail;
    goTo("category-detail");
    return;
  }

  if (button.dataset.categorySubcategory) {
    draft = { type: "expense", category: selectedCategoryId, subcategory: button.dataset.categorySubcategory, date: todayISO(), amount: "", note: "", fixed: "no" };
    goTo("new-transaction");
    return;
  }

  if (button.dataset.categoryIcon) {
    content.querySelectorAll(".category-icon-choice").forEach((choice) => choice.classList.toggle("active", choice === button));
    const selectedIcon = content.querySelector('input[name="icon"]');
    if (selectedIcon) selectedIcon.value = button.dataset.categoryIcon;
    return;
  }

  if (button.dataset.alertPreference) {
    const key = button.dataset.alertPreference;
    alertPreferences[key] = !alertPreferences[key];
    render();
    return;
  }

  if (button.dataset.calculatorMode) {
    calculatorMode = button.dataset.calculatorMode;
    render();
    return;
  }

  if (button.dataset.savingsMonths) {
    calculatorSavingsMonths = Number(button.dataset.savingsMonths) || 3;
    render();
    return;
  }

  if (button.dataset.reminderOption) {
    data.alertReminders.enabled = true;
    data.alertReminders.daysBefore = Number(button.dataset.reminderOption);
    saveData();
    render();
    return;
  }

  if (button.dataset.textSize) {
    textSize = button.dataset.textSize === "large" ? "large" : "standard";
    localStorage.setItem("manguito-text-size", textSize);
    document.documentElement.dataset.textSize = textSize;
    render();
    return;
  }

  if (button.dataset.currencyDirection) {
    currencyDirection = button.dataset.currencyDirection;
    render();
    return;
  }

  if (button.dataset.alertDate) {
    selectedAlertDate = button.dataset.alertDate;
    const selectedDate = localDateFromISO(selectedAlertDate);
    calendarMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    render();
    return;
  }

  if (button.dataset.alertId) {
    selectedAlertId = button.dataset.alertId;
    goTo("alert-detail");
    return;
  }

  if (button.dataset.categoryDetail) {
    selectedCategoryId = button.dataset.categoryDetail;
    goTo("category-detail");
    return;
  }

  if (button.dataset.themeChoice) {
    const previousTheme = data.theme;
    data.theme = button.dataset.themeChoice === "dark" ? "dark" : "light";
    if (!saveData()) {
      data.theme = previousTheme;
      return;
    }
    render();
    return;
  }

  if (button.dataset.promoConditions) {
    const conditions = button.closest(".featured-promotion-card")?.querySelector(".promo-conditions-copy");
    if (conditions) {
      conditions.hidden = !conditions.hidden;
      button.setAttribute("aria-expanded", String(!conditions.hidden));
      button.textContent = conditions.hidden ? "Ver condiciones" : "Ocultar condiciones";
    }
    return;
  }

  if (button.dataset.promotionDelete) {
    data.promotions = data.promotions.filter(({ id }) => id !== button.dataset.promotionDelete);
    if (!saveData()) return;
    render();
    showToast("Promoción eliminada.");
    return;
  }

  if (button.dataset.setupCategory) {
    const id = button.dataset.setupCategory;
    selectedSetupCategories.has(id) ? selectedSetupCategories.delete(id) : selectedSetupCategories.add(id);
    button.classList.toggle("selected", selectedSetupCategories.has(id));
    button.setAttribute("aria-pressed", String(selectedSetupCategories.has(id)));
    return;
  }

  if (button.dataset.pickCategory) {
    draft.category = button.dataset.pickCategory;
    draft.subcategory = "";
    if (draft.type === "expense") {
      goTo("subcategory-picker");
    } else {
      goBack();
    }
    return;
  }

  if (button.dataset.pickSubcategory) {
    draft.subcategory = button.dataset.pickSubcategory;
    // La selección termina directamente en el formulario. Volver dos veces
    // dejaba visible nuevamente el selector anterior como un paso duplicado.
    goTo("new-transaction", { replace: true });
    return;
  }

  const action = button.dataset.action;
  if (!action) return;
  switch (action) {
    case "start":
      goTo("signup");
      break;
    case "login":
      goTo("login");
      break;
    case "forgot-password":
      showToast("Contactá al equipo para recuperar tu cuenta.");
      break;
    case "disclosure-continue":
      goTo("income-setup");
      break;
    case "setup-categories-continue":
      if (!selectedSetupCategories.size) {
        showToast("Elegí al menos una categoría para registrar gastos.");
        break;
      }
      data.selectedCategories = [...selectedSetupCategories];
      if (!saveData()) break;
      if (editingCategories) {
        editingCategories = false;
        goTo("profile", { replace: true });
        break;
      }
      goTo("ready");
      break;
    case "finish-setup":
      screenHistory = [];
      currentTab = "home";
      goTo("home", { replace: true });
      break;
    case "choose-income":
      startTransaction("income");
      break;
    case "choose-expense":
      startTransaction("expense");
      break;
    case "pick-category":
      if (!draft) return;
      draft.amount = content.querySelector('[name="amount"]')?.value || "";
      draft.date = content.querySelector('[name="date"]')?.value || todayISO();
      draft.note = content.querySelector('[name="note"]')?.value || "";
      draft.fixed = content.querySelector('[name="fixed"]:checked')?.value || "monthly";
      goTo(draft.type === "expense" && draft.category ? "subcategory-picker" : "category-picker");
      break;
    case "change-category":
      goTo("category-picker");
      break;
    case "change-subcategory":
      goTo(draft?.category ? "subcategory-picker" : "category-picker");
      break;
    case "back-to-categories":
      goBack();
      break;
    case "back-to-category-settings":
      goTo("category-settings");
      break;
    case "manage-subcategories":
      showToast("Podés elegir una subcategoría para registrar el gasto.");
      break;
    case "cancel":
      draft = null;
      screenHistory = [];
      goTo("home", { replace: true, tab: "home" });
      break;
    case "new-transaction":
      goTo("transaction-choice");
      break;
    case "new-alert":
      editingAlertId = "";
      goTo("alert-form");
      break;
    case "view-all-alerts":
      goTo("alert-list");
      break;
    case "new-promotion":
      goTo("promotion-form");
      break;
    case "view-transactions":
      goTo("transactions");
      break;
    case "month-prev":
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
      render();
      break;
    case "month-next":
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
      render();
      break;
    case "calendar-prev":
      moveCalendarMonth(-1);
      render();
      break;
    case "calendar-next":
      moveCalendarMonth(1);
      render();
      break;
    case "back-to-tools":
      screenHistory = [];
      currentTab = "panel";
      goTo("panel", { replace: true, tab: "panel" });
      break;
    case "glossary-next":
      glossaryIndex = (glossaryIndex + 1) % glossaryLessons.length;
      render();
      break;
    case "back-to-alerts":
      currentTab = "alerts";
      goTo("alerts", { replace: true, tab: "alerts" });
      break;
    case "cancel-alert":
      editingAlertId = "";
      goBack();
      break;
    case "edit-alert":
      editingAlertId = selectedAlertId;
      goTo("alert-form");
      break;
    case "view-alert-history":
      showToast("Estás viendo los pagos registrados.");
      break;
    case "delete-alert":
      if (window.confirm("¿Querés eliminar esta alerta?")) {
        data.alerts = data.alerts.filter(({ id }) => id !== selectedAlertId);
        if (!saveData()) break;
        editingAlertId = "";
        screenHistory = [];
        currentTab = "alerts";
        goTo("alerts", { replace: true, tab: "alerts" });
        showToast("Alerta eliminada.");
      }
      break;
    case "edit-profile":
      goTo("edit-profile");
      break;
    case "edit-income":
      goTo("edit-income");
      break;
    case "edit-categories":
      goTo("category-settings");
      break;
    case "new-category":
      goTo("category-form");
      break;
    case "delete-custom-category":
      if (window.confirm("¿Querés eliminar esta categoría personalizada?")) {
        data.customCategories = data.customCategories.filter(({ id }) => id !== selectedCategoryId);
        data.selectedCategories = data.selectedCategories.filter((id) => id !== selectedCategoryId);
        if (!data.selectedCategories.length) data.selectedCategories = [categories[0].id];
        if (!saveData()) break;
        goTo("category-settings", { replace: true });
      }
      break;
    case "alert-reminders-continue":
      goTo("alert-reminders");
      break;
    case "alert-reminders":
      goTo("alert-preferences-intro");
      break;
    case "save-reminder-settings":
      saveData();
      showToast("Preferencias guardadas.");
      break;
    case "appearance":
      goTo("appearance");
      break;
    case "about":
      showToast("Manguito te ayuda a cuidar tu economía cotidiana.");
      break;
    case "logout":
      if (window.confirm("¿Querés cerrar sesión en este dispositivo?")) {
        data.user = null;
        saveData();
        screenHistory = [];
        goTo("welcome", { replace: true });
      }
      break;
  }
});

bottomNav.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tab]");
  if (!button) return;
  const tab = button.dataset.tab;
  if (tab === "add") {
    draft = null;
    goTo("transaction-choice");
    return;
  }
  currentTab = tab;
  screenHistory = [];
  goTo(tab, { replace: true, tab });
});

backButton.addEventListener("click", goBack);
document.querySelector(".brand").addEventListener("click", (event) => {
  event.preventDefault();
  currentTab = "home";
  screenHistory = [];
  goTo(data.user ? "home" : "welcome", { replace: true, tab: "home" });
});

render();

