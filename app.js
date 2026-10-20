const STORAGE_KEY = "manguito-app";

const categories = [
  { id: "alquiler", name: "Alquiler", icon: "🏠", color: "#fff1a6", children: ["Alquiler", "Expensas", "Impuestos"] },
  { id: "comidas", name: "Comidas", icon: "🍽️", color: "#ffe3b0", children: ["Supermercado", "Restaurantes", "Delivery"] },
  { id: "transporte", name: "Transporte", icon: "🚌", color: "#d9f5c9", children: ["Colectivo", "Combustible", "Taxi"] },
  { id: "ocio", name: "Ocio", icon: "🎲", color: "#eee0f6", children: ["Entretenimiento", "Cine", "Suscripciones"] },
  { id: "servicios", name: "Servicios", icon: "💡", color: "#fff3a8", children: ["Internet", "Luz", "Agua"] },
  { id: "salud", name: "Salud", icon: "💚", color: "#dff3d6", children: ["Farmacia", "Médico", "Obra social"] },
  { id: "mercado", name: "Mercado", icon: "🛒", color: "#ffe4c4", children: ["Alimentos", "Limpieza", "Higiene"] },
  { id: "mascotas", name: "Mascotas", icon: "🐾", color: "#eadcf4", children: ["Peluquería y juguetes", "Medicamentos", "Veterinaria", "Alimentación"] },
];

const incomeCategories = [
  { id: "sueldo", name: "Sueldo", icon: "💼" },
  { id: "freelance", name: "Trabajo independiente", icon: "💻" },
  { id: "ventas", name: "Ventas", icon: "🛍️" },
  { id: "otros-ingresos", name: "Otros ingresos", icon: "✨" },
];

const defaultData = {
  user: null,
  monthlyIncome: 1000000,
  selectedCategories: categories.map(({ id }) => id),
  transactions: [],
  alerts: [
    { title: "Internet", amount: 60000, dueLabel: "Vence en 3 días" },
    { title: "Luz", amount: 51000, dueLabel: "Vence en 5 días" },
    { title: "Spotify", amount: 6883, dueLabel: "Vence en 10 días" },
  ],
};

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(defaultData);
    const parsed = JSON.parse(saved);
    return {
      ...structuredClone(defaultData),
      ...parsed,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts : structuredClone(defaultData.alerts),
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
let toastTimer;

const money = (value) => `$${Math.round(Number(value) || 0).toLocaleString("es-AR")}`;
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

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
  const items = [
    ["home", "", "Inicio"],
    ["panel", active === "panel" ? "panel-active.svg" : "panel.svg", "Panel"],
    ["add", "records.svg", "Agregar"],
    ["alerts", "alerts.svg", "Alertas"],
    ["profile", "profile.svg", "Perfil"],
  ];
  return items.map(([id, icon, label]) => `
    <button class="nav-item ${id === active ? "active" : ""} ${id === "add" ? "add-nav" : ""}"
      type="button" data-tab="${id}" aria-label="${label}" ${id === active ? 'aria-current="page"' : ""}>
      <span class="nav-icon" aria-hidden="true">${icon ? `<img class="${id === "panel" ? "panel-icon-image" : ""}" src="assets/ui-icons/${icon}" alt="">` : "⌂"}</span>
      <span>${label}</span>
    </button>
  `).join("");
}

function showAppChrome(showNav = true) {
  topBar.hidden = false;
  bottomNav.hidden = !showNav;
  bottomNav.innerHTML = navMarkup(currentTab);
}

function mangoIllustration(asset, small = false, withBackdrop = false) {
  return `<div class="mango-art ${small ? "mango-small" : ""} ${withBackdrop ? "has-backdrop" : ""}" aria-hidden="true">${withBackdrop ? '<img class="mascot-backdrop" src="assets/fondo verde dtras del mango.svg" alt="">' : ""}<img class="mascot-image" src="assets/${asset}" alt=""></div>`;
}

function welcomeScreen() {
  return `
    <section class="screen welcome-screen">
      <div class="welcome-logo">
        <img src="assets/logomanguitoaprendeacuidarlo.svg" alt="Manguito, aprendé a cuidarlo">
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
    <section class="screen onboarding-screen">
      <div class="onboarding-logo"><span class="isotipo-window" aria-hidden="true"><img src="assets/ISOTIPO.svg" alt=""></span></div>
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
    <section class="screen onboarding-screen">
      <div class="onboarding-logo"><span class="isotipo-window" aria-hidden="true"><img src="assets/ISOTIPO.svg" alt=""></span></div>
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
      <div class="onboarding-logo"><span class="isotipo-window" aria-hidden="true"><img src="assets/ISOTIPO.svg" alt=""></span></div>
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
    <section class="screen onboarding-screen">
      <div class="onboarding-logo"><span class="isotipo-window" aria-hidden="true"><img src="assets/ISOTIPO.svg" alt=""></span></div>
      <header class="screen-header"><h1>Ahora registrá<br>tus gastos</h1></header>
      <div class="category-grid">
        ${categories.map((category) => `
          <button class="category-option ${selectedSetupCategories.has(category.id) ? "selected" : ""}" type="button" data-setup-category="${category.id}" aria-pressed="${selectedSetupCategories.has(category.id)}">
            <span class="category-emoji" style="background:${category.color}">${category.icon}</span><span class="category-name">${category.name}</span><span aria-hidden="true">›</span>
          </button>
        `).join("")}
      </div>
      <div class="form-actions"><button class="primary-button" type="button" data-action="setup-categories-continue">Continuar</button></div>
    </section>
  `;
}

function readyScreen() {
  return `
    <section class="screen disclosure-screen">
      <h1>¡Listo!</h1>
      <p>Cuantos más gastos e ingresos anotes, más claro vas a ver tu panorama.</p>
      ${mangoIllustration("MANGUITOSONRIENDO.svg")}
      <button class="primary-button" type="button" data-action="finish-setup">Continuar</button>
    </section>
  `;
}

function dueMarkup(alert) {
  return `<div class="due-row"><div><strong>${escapeHTML(alert.title)}</strong><small>${escapeHTML(alert.dueLabel || "Próximo vencimiento")}</small></div><strong>${money(alert.amount)}</strong></div>`;
}

function dashboardScreen() {
  const name = escapeHTML(data.user?.name?.split(/\s+/)[0] || "Juana");
  const expenseByCategory = new Map([
    ["Alquiler", { amount: 454350, icon: "🏠" }],
    ["Salud", { amount: 378625, icon: "💚" }],
    ["Supermercado", { amount: 302900, icon: "🛒" }],
    ["Entretenimiento", { amount: 227175, icon: "🎲" }],
    ["Comida", { amount: 151450, icon: "🍽️" }],
  ]);
  for (const item of data.transactions.filter(({ type }) => type === "expense")) {
    const category = categories.find(({ id }) => id === item.category);
    const label = category?.name || "Otros";
    const summary = expenseByCategory.get(label) || { amount: 0, icon: category?.icon || "💸" };
    summary.amount += item.amount;
    expenseByCategory.set(label, summary);
  }
  const spent = [...expenseByCategory.values()].reduce((total, { amount }) => total + amount, 0);
  const transactionBalance = data.transactions.reduce(
    (total, item) => total + (item.type === "income" ? item.amount : -item.amount),
    0,
  );
  const available = Math.max((Number(data.monthlyIncome) || 0) - 459400 + transactionBalance, 0);
  const rows = [...expenseByCategory].map(([label, summary]) =>
    `<div class="summary-row"><span>${summary.icon} ${escapeHTML(label)}</span><strong>${money(summary.amount)}</strong></div>`).join("");

  return `
    <section class="screen dashboard-screen">
      <h1 class="greeting">Hola, ${name}! 👋</h1>
      <p class="greeting-subtitle">Este es tu resumen</p>
      <article class="balance-card">
        <p class="balance-label">Dinero disponible</p>
        <p class="balance-amount">${money(available)}</p>
        <p class="balance-until">Hasta el 30/09</p>
        <div class="balance-track"><span></span></div>
        <p class="balance-days">18 días restantes</p>
      </article>
      <article class="summary-card">
        <h2>Gastos del mes</h2>
        <div class="summary-grid">
          <div class="donut-chart" aria-label="Distribución de gastos"><span>${money(spent)}</span></div>
          <div class="summary-list">${rows}</div>
        </div>
      </article>
      <div class="section-title-row"><h2>Próximos vencimientos</h2></div>
      <article class="list-card">
        ${data.alerts.slice(0, 3).map(dueMarkup).join("")}
        <button class="text-link" type="button" data-tab="alerts" style="display:block;margin:7px 0 0 auto">Ver más &gt;</button>
      </article>
      <div class="section-title-row"><h2>Últimos movimientos</h2><button class="text-link" type="button" data-tab="panel">Ver todos</button></div>
      <article class="list-card">${transactionRows(data.transactions.slice(0, 3), true)}</article>
    </section>
  `;
}

function transactionRows(transactions, emptyMessage = false) {
  if (!transactions.length) return `<div class="empty-state">${emptyMessage ? "Todavía no hay movimientos. Tocá + para registrar el primero." : "No hay movimientos para mostrar."}</div>`;
  return `<div class="transaction-list">${transactions.map((item) => {
    const category = [...categories, ...incomeCategories].find(({ id }) => id === item.category);
    const icon = category?.icon || "💸";
    const date = item.date ? new Date(`${item.date}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" }) : "Hoy";
    return `
      <div class="transaction-row">
        <span class="row-emoji">${icon}</span>
        <div class="row-info"><div><strong>${escapeHTML(item.note || item.subcategory || category?.name || "Movimiento")}</strong><small>${escapeHTML(category?.name || "Otro")} · ${date}</small></div></div>
        <strong class="${item.type === "income" ? "income" : "expense"}">${item.type === "income" ? "+" : "−"}${money(item.amount)}</strong>
      </div>
    `;
  }).join("")}</div>`;
}

function panelScreen() {
  const monthName = currentMonth.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  const currentTransactions = data.transactions.filter((item) => {
    if (!item.date) return true;
    const date = new Date(`${item.date}T12:00:00`);
    return date.getMonth() === currentMonth.getMonth() && date.getFullYear() === currentMonth.getFullYear();
  });
  const income = currentTransactions.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expenses = currentTransactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const bars = [
    ["Alquiler", 75], ["Salud", 61], ["Supermercado", 48], ["Entretenimiento", 36], ["Comidas", 24],
  ];
  return `
    <section class="screen">
      <header class="screen-header left"><h1>Tu panel</h1><p>Revisá cómo se mueve tu plata.</p></header>
      <div class="month-switcher">
        <button type="button" data-action="month-prev" aria-label="Mes anterior">‹</button>
        <span>${escapeHTML(monthName)}</span>
        <button type="button" data-action="month-next" aria-label="Mes siguiente">›</button>
      </div>
      <div class="metric-grid">
        <div class="metric-card"><span>Ingresos registrados</span><strong>${money(income || data.monthlyIncome)}</strong></div>
        <div class="metric-card"><span>Gastos registrados</span><strong>${money(expenses)}</strong></div>
      </div>
      <article class="panel-card">
        <h2>Gastos por categoría</h2>
        <div class="bar-list">${bars.map(([label, percent]) => `
          <div class="bar-item"><span>${label}</span><div class="bar-track"><span style="width:${percent}%"></span></div><strong>${percent}%</strong></div>
        `).join("")}</div>
      </article>
      <div class="section-title-row"><h2>Movimientos recientes</h2><button class="text-link" type="button" data-action="view-transactions">Ver todos</button></div>
      <article class="list-card">${transactionRows(currentTransactions, true)}</article>
      <button class="primary-button wide-button" type="button" data-action="new-transaction">Registrar movimiento</button>
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
  return `
    <section class="screen">
      <header class="screen-header left"><h1>Alertas</h1><p>Tené presentes tus próximos vencimientos.</p></header>
      <div class="section-title-row"><h2>Próximos vencimientos</h2><span>${data.alerts.length} avisos</span></div>
      <article class="list-card">${data.alerts.map(dueMarkup).join("") || '<div class="empty-state">Todavía no agregaste vencimientos.</div>'}</article>
      <button class="primary-button wide-button" type="button" data-action="new-alert">＋ Nueva alerta</button>
    </section>
  `;
}

function profileScreen() {
  const name = escapeHTML(data.user?.name || "Juana");
  const email = escapeHTML(data.user?.email || "tuemail@ejemplo.com");
  return `
    <section class="screen">
      <header class="screen-header left"><h1>Perfil</h1><p>Administrá tu cuenta y preferencias.</p></header>
      <article class="panel-card">
        <div class="profile-heading"><span class="profile-avatar">👤</span><div><strong>${name}</strong><small>${email}</small></div></div>
        <div class="setting-row"><button type="button" data-action="edit-profile">Datos personales</button><span>›</span></div>
        <div class="setting-row"><button type="button" data-action="edit-income">Ingreso mensual</button><strong>${money(data.monthlyIncome)}</strong></div>
        <div class="setting-row"><button type="button" data-action="edit-categories">Mis categorías</button><span>›</span></div>
        <div class="setting-row"><button type="button" data-action="about">Acerca de Manguito</button><span>›</span></div>
      </article>
      <button class="text-button" type="button" data-action="logout">Cerrar sesión</button>
    </section>
  `;
}

function transactionChoiceScreen() {
  return `
    <section class="screen choice-screen">
      <div class="choice-art">${mangoIllustration("mangooPENSANDO.svg", true)}</div>
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
  const categoryName = draft?.subcategory || category?.name || "Seleccionar";
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
          <button class="form-row-button" type="button" data-action="pick-category">
            <span class="row-left"><span>${category?.icon || "▤"}</span><span>${escapeHTML(categoryName)}</span></span><span class="chevron-right">›</span>
          </button>
        </div>
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
  const pool = draft?.type === "income"
    ? incomeCategories
    : categories.filter(({ id }) => data.selectedCategories.includes(id));
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
            <span class="category-emoji">${category.icon}</span><span class="category-name">${category.name}</span><span aria-hidden="true">›</span>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function subcategoryPickerScreen() {
  const category = categories.find(({ id }) => id === draft?.category);
  if (!category) return categoryPickerScreen();
  return `
    <section class="screen">
      <header class="screen-header left"><h1>${category.icon} ${escapeHTML(category.name)}</h1><p>Elegí una subcategoría para este gasto.</p></header>
      <article class="panel-card">
        ${category.children.map((child) => `
          <div class="setting-row">
            <button type="button" data-pick-subcategory="${escapeHTML(child)}">${escapeHTML(child)}</button><span>›</span>
          </div>
        `).join("")}
      </article>
      <button class="text-button" type="button" data-action="back-to-categories">Volver a categorías</button>
    </section>
  `;
}

function alertFormScreen() {
  return `
    <section class="screen">
      <header class="screen-header left"><h1>Nueva alerta</h1><p>Agregá un vencimiento para tenerlo presente.</p></header>
      <form class="form-stack" data-form="alert">
        <div class="form-field"><label for="alert-title">Nombre del servicio</label><input id="alert-title" name="title" placeholder="Ej: Internet" required></div>
        <div class="form-field"><label for="alert-amount">Monto</label><input id="alert-amount" name="amount" inputmode="numeric" placeholder="$0" required></div>
        <div class="form-field"><label for="alert-date">Fecha de vencimiento</label><input id="alert-date" name="date" type="date" required></div>
        <p class="form-error" data-error></p>
        <div class="form-actions"><button class="primary-button" type="submit">Guardar alerta</button></div>
      </form>
    </section>
  `;
}

function editProfileScreen() {
  return `
    <section class="screen">
      <header class="screen-header left"><h1>Datos personales</h1><p>Mantené tu perfil actualizado.</p></header>
      <form class="form-stack" data-form="profile">
        <div class="form-field"><label for="profile-name">Nombre</label><input id="profile-name" name="name" value="${escapeHTML(data.user?.name || "")}" required></div>
        <div class="form-field"><label for="profile-email">Correo electrónico</label><input id="profile-email" name="email" type="email" value="${escapeHTML(data.user?.email || "")}" required></div>
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
    transactions: transactionsScreen,
    alerts: alertsScreen,
    profile: profileScreen,
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
  const onboarding = ["welcome", "signup", "login", "disclosure", "income-setup", "setup-categories", "ready"].includes(currentScreen);
  const shouldShowNav = ["home", "panel", "transactions", "alerts", "profile", "transaction-choice", "new-transaction", "category-picker", "subcategory-picker"].includes(currentScreen);
  topBar.hidden = onboarding || currentScreen === "transaction-choice";
  bottomNav.hidden = !shouldShowNav;
  if (shouldShowNav) bottomNav.innerHTML = navMarkup(currentTab);
  document.title = currentScreen === "welcome" ? "Manguito | Tu economía, más clara" : `${screenTitle(currentScreen)} | Manguito`;
}

function screenTitle(screen) {
  return ({
    home: "Inicio",
    panel: "Panel",
    transactions: "Movimientos",
    alerts: "Alertas",
    profile: "Perfil",
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

  const category = [...categories, ...incomeCategories].find(({ id }) => id === draft.category);
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
    data.user = { name, email };
    saveData();
    goTo("disclosure");
    return;
  }

  if (form.dataset.form === "login") {
    const email = String(new FormData(form).get("email") || "").trim();
    if (!data.user || email.toLowerCase() !== String(data.user.email).toLowerCase()) {
      setFormError(form, "No encontramos una cuenta con ese correo en este dispositivo.");
      return;
    }
    screenHistory = [];
    currentTab = "home";
    goTo("home", { replace: true });
    return;
  }

  if (form.dataset.form === "income-setup" || form.dataset.form === "edit-income") {
    const amount = readAmount(new FormData(form).get("income"));
    if (amount <= 0) {
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

  if (form.dataset.form === "alert") {
    const formData = new FormData(form);
    const title = String(formData.get("title") || "").trim();
    const amount = readAmount(formData.get("amount"));
    const date = String(formData.get("date") || "");
    if (!title || amount <= 0 || !date) {
      setFormError(form, "Completá el nombre, el monto y la fecha.");
      return;
    }
    const days = Math.max(0, Math.ceil((new Date(`${date}T12:00:00`) - new Date()) / 86400000));
    data.alerts.push({ title, amount, dueLabel: days === 0 ? "Vence hoy" : `Vence en ${days} días` });
    if (!saveData()) return;
    goTo("alerts", { replace: true });
    showToast("Alerta guardada.");
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
    saveData();
    goTo("profile", { replace: true });
    showToast("Perfil actualizado.");
  }
});

content.addEventListener("input", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !["amount", "income"].includes(input.name)) return;
  const digits = input.value.replace(/\D/g, "");
  const formatted = digits ? Number(digits).toLocaleString("es-AR") : "";
  const atEnd = input.selectionStart === input.value.length;
  input.value = formatted;
  if (atEnd) input.setSelectionRange(formatted.length, formatted.length);
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
    goBack();
    goBack();
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
      data.selectedCategories = [...selectedSetupCategories];
      saveData();
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
      goTo("category-picker");
      break;
    case "back-to-categories":
      goBack();
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
      goTo("alert-form");
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
    case "edit-profile":
      goTo("edit-profile");
      break;
    case "edit-income":
      goTo("edit-income");
      break;
    case "edit-categories":
      editingCategories = true;
      goTo("setup-categories");
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
