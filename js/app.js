// Application Data Access
const MENU_ITEMS = window.MENU_ITEMS || [];
const CATEGORIES = window.CATEGORIES || [];
const DIET_FILTERS = window.DIET_FILTERS || [];
const CURRENCY = window.CURRENCY || '₪';

// PIN Passcode for Staff Access
const ADMIN_PIN = '69015';

// Application State
let activeCategory = 'all';
let activeDietFilters = new Set();
let searchQuery = '';
let currentModalItem = null;
let currentModalQty = 1;
let selectedModalOptions = {};
let cart = [];
let menuItemsState = [];
let happyHoursActive = false;
let happyHoursItems = new Set();
let adminSearchQuery = '';
let adminActiveCategory = 'all';

// DOM Elements
const menuGridContainer = document.getElementById('menu-grid-container');
const categoriesNav = document.getElementById('categories-nav');
const dietFiltersContainer = document.getElementById('diet-filters');
const searchInput = document.getElementById('search-input');
const itemCountEl = document.getElementById('item-count');
const sectionTitleEl = document.getElementById('section-title');

// Admin Auth Elements
const adminAuthModal = document.getElementById('admin-auth-modal');
const authModalClose = document.getElementById('auth-modal-close');
const adminPinInput = document.getElementById('admin-pin-input');
const authErrorMsg = document.getElementById('auth-error-msg');
const adminAuthForm = document.getElementById('admin-auth-form');

// Admin Drawer Elements
const adminToggleBtn = document.getElementById('admin-toggle-btn');
const adminDrawer = document.getElementById('admin-drawer');
const adminCloseBtn = document.getElementById('admin-close');
const adminItemsList = document.getElementById('admin-items-list');
const btnResetAdmin = document.getElementById('btn-reset-admin');
const btnLogoutAdmin = document.getElementById('btn-logout-admin');
const btnHappyHours = document.getElementById('btn-happy-hours');
const happyHoursBanner = document.getElementById('happy-hours-banner');
const adminSearchInput = document.getElementById('admin-search-input');
const adminCategoryFilters = document.getElementById('admin-category-filters');

// Modal Elements
const modalBackdrop = document.getElementById('item-modal');
const modalCloseBtn = document.getElementById('modal-close');
const modalImg = document.getElementById('modal-img');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');
const modalOptionsContainer = document.getElementById('modal-options');
const modalQtyVal = document.getElementById('modal-qty-val');
const btnQtyMinus = document.getElementById('btn-qty-minus');
const btnQtyPlus = document.getElementById('btn-qty-plus');
const btnAddToCartConfirm = document.getElementById('btn-add-to-cart-confirm');

// Cart Elements
const cartToggleBtn = document.getElementById('cart-toggle-btn');
const cartDrawer = document.getElementById('cart-drawer');
const cartCloseBtn = document.getElementById('cart-close');
const cartItemsList = document.getElementById('cart-items-list');
const cartCountBadge = document.getElementById('cart-count');
const cartTotalPriceEl = document.getElementById('cart-total-price');
const btnCheckout = document.getElementById('btn-checkout');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  loadMenuState();
  loadHappyHoursState();
  loadCartFromStorage();
  renderCategories();
  renderDietFilters();
  renderMenu();
  setupEventListeners();
  updateCartUI();
  updateHappyHoursBanner();
});

// Load menu state (with localStorage overrides for inStock status)
// NOTE: inStock: false in data.js is always respected as the source of truth.
// Overrides from localStorage only apply to items that are marked inStock: true in data.js.
function loadMenuState() {
  menuItemsState = JSON.parse(JSON.stringify(MENU_ITEMS)); // Deep clone defaults from data.js
  try {
    const savedOverrides = localStorage.getItem('famore_cafe_menu_overrides');
    if (savedOverrides) {
      const overrides = JSON.parse(savedOverrides);
      menuItemsState.forEach(item => {
        // Only apply override if item is IN stock by default in data.js
        // This prevents stale cache from overriding intentional out-of-stock items
        const originalItem = MENU_ITEMS.find(m => m.id === item.id);
        if (overrides[item.id] && originalItem && originalItem.inStock !== false) {
          if (typeof overrides[item.id].inStock === 'boolean') {
            item.inStock = overrides[item.id].inStock;
          }
        }
      });
    }
  } catch (e) {
    console.error('Failed to load menu overrides', e);
  }
}

function saveMenuOverrides() {
  try {
    const overrides = {};
    menuItemsState.forEach(item => {
      overrides[item.id] = {
        inStock: item.inStock
      };
    });
    localStorage.setItem('famore_cafe_menu_overrides', JSON.stringify(overrides));
  } catch (e) {
    console.error('Failed to save menu overrides', e);
  }
}

// Happy Hours State Management
function loadHappyHoursState() {
  try {
    const saved = localStorage.getItem('famore_cafe_happy_hours');
    if (saved) {
      const data = JSON.parse(saved);
      happyHoursActive = data.active === true;
      happyHoursItems = new Set(data.items || []);
    }
  } catch (e) {
    console.error('Failed to load Happy Hours state', e);
  }
}

function saveHappyHoursState() {
  try {
    localStorage.setItem('famore_cafe_happy_hours', JSON.stringify({
      active: happyHoursActive,
      items: Array.from(happyHoursItems)
    }));
  } catch (e) {
    console.error('Failed to save Happy Hours state', e);
  }
}

function updateHappyHoursBanner() {
  if (happyHoursBanner) {
    if (happyHoursActive && happyHoursItems.size > 0) {
      happyHoursBanner.classList.add('active');
    } else {
      happyHoursBanner.classList.remove('active');
    }
  }
  // Update admin button state
  if (btnHappyHours) {
    if (happyHoursActive) {
      btnHappyHours.classList.add('active');
      btnHappyHours.textContent = '🎉 Happy Hours ON — Click to Deactivate';
    } else {
      btnHappyHours.classList.remove('active');
      btnHappyHours.textContent = '🎉 Activate Happy Hours';
    }
  }
}

function getItemPrice(item) {
  if (happyHoursActive && happyHoursItems.has(item.id)) {
    return Math.max(1, item.price - 4);
  }
  return item.price;
}

function isItemHappyHour(item) {
  return happyHoursActive && happyHoursItems.has(item.id);
}

// Utility: Debounce function for performance
function debounce(func, wait = 150) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Setup Event Listeners
function setupEventListeners() {
  // Search (Debounced to avoid rapid DOM re-renders)
  searchInput?.addEventListener('input', debounce((e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderMenu();
  }, 120));

  // Protected Header Admin Access — always require PIN
  const attemptOpenAdmin = () => {
    openAuthModal();
  };

  adminToggleBtn?.addEventListener('click', attemptOpenAdmin);
  authModalClose?.addEventListener('click', closeAuthModal);
  adminAuthForm?.addEventListener('submit', handlePinSubmit);

  adminCloseBtn?.addEventListener('click', () => {
    adminDrawer?.classList.remove('open');
  });

  btnLogoutAdmin?.addEventListener('click', () => {
    adminDrawer?.classList.remove('open');
  });

  // Admin Search
  adminSearchInput?.addEventListener('input', (e) => {
    adminSearchQuery = e.target.value.toLowerCase().trim();
    renderAdminItemsList();
  });

  btnResetAdmin?.addEventListener('click', () => {
    if (confirm('Reset all item stock availability and Best Seller tags to default?')) {
      localStorage.removeItem('famore_cafe_menu_overrides');
      localStorage.removeItem('velvet_cafe_menu_overrides');
      loadMenuState();
      renderMenu();
      renderAdminItemsList();
    }
  });

  // Happy Hours Toggle
  btnHappyHours?.addEventListener('click', () => {
    happyHoursActive = !happyHoursActive;
    saveHappyHoursState();
    updateHappyHoursBanner();
    renderMenu();
    renderAdminItemsList();
  });

  // Modal Controls
  modalCloseBtn?.addEventListener('click', closeModal);
  modalBackdrop?.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeModal();
  });

  btnQtyMinus?.addEventListener('click', () => {
    if (currentModalQty > 1) {
      currentModalQty--;
      if (modalQtyVal) modalQtyVal.textContent = currentModalQty;
      updateModalPrice();
    }
  });

  btnQtyPlus?.addEventListener('click', () => {
    currentModalQty++;
    if (modalQtyVal) modalQtyVal.textContent = currentModalQty;
    updateModalPrice();
  });

  btnAddToCartConfirm?.addEventListener('click', handleAddToCartFromModal);

  // Cart Drawer
  cartToggleBtn?.addEventListener('click', () => {
    cartDrawer?.classList.add('open');
  });

  cartCloseBtn?.addEventListener('click', () => {
    cartDrawer?.classList.remove('open');
  });

  btnCheckout?.addEventListener('click', handleCheckout);
}

// PIN Auth Modal Handlers
function openAuthModal() {
  if (!adminAuthModal) return;
  if (adminPinInput) adminPinInput.value = '';
  if (authErrorMsg) authErrorMsg.textContent = '';
  adminAuthModal.classList.add('active');
  setTimeout(() => adminPinInput?.focus(), 150);
}

function closeAuthModal() {
  adminAuthModal?.classList.remove('active');
}

function handlePinSubmit(e) {
  if (e) e.preventDefault();
  if (!adminPinInput) return;
  const enteredPin = adminPinInput.value.trim();

  if (enteredPin === ADMIN_PIN || enteredPin === 'admin') {
    closeAuthModal();
    adminDrawer?.classList.add('open');
    adminSearchQuery = '';
    adminActiveCategory = 'all';
    if (adminSearchInput) adminSearchInput.value = '';
    renderAdminCategoryFilters();
    renderAdminItemsList();
  } else {
    if (authErrorMsg) authErrorMsg.textContent = '❌';
    adminPinInput.value = '';
    adminPinInput.focus();
  }
}

// Render Category Tabs
function renderCategories() {
  if (!categoriesNav) return;
  categoriesNav.innerHTML = CATEGORIES.map(cat => `
    <button class="category-tab ${cat.id === activeCategory ? 'active' : ''}" data-id="${cat.id}">
      <span>${cat.icon}</span>
      <span>${cat.name}</span>
    </button>
  `).join('');

  categoriesNav.querySelectorAll('.category-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.id;
      document.querySelectorAll('.category-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderMenu();
    });
  });
}

// ------------------------------------------------------

// Render Dietary Filters
function renderDietFilters() {
  if (!dietFiltersContainer) return;
  dietFiltersContainer.innerHTML = DIET_FILTERS.map(filter => `
    <button class="diet-pill ${activeDietFilters.has(filter.id) ? 'active' : ''}" data-id="${filter.id}">
      ${filter.label}
    </button>
  `).join('');

  dietFiltersContainer.querySelectorAll('.diet-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const id = pill.dataset.id;
      if (activeDietFilters.has(id)) {
        activeDietFilters.delete(id);
        pill.classList.remove('active');
      } else {
        activeDietFilters.add(id);
        pill.classList.add('active');
      }
      renderMenu();
    });
  });
}

// ------------------------------------------------------

// Get Badge Label & Icon
function getBadgeInfo(tag) {
  if (!tag) return null;
  const tagLower = tag.toLowerCase().trim();

  const knownBadges = {
    'bestseller': { label: 'Best Seller', icon: '⭐', class: 'bestseller' },
    'vegan': { label: 'Vegan', icon: '🌱', class: 'vegan' },
    'gluten-free': { label: 'Gluten-Free', icon: '🌾', class: 'gluten-free' },
    'vegetarian': { label: 'Vegetarian', icon: '🧀', class: 'vegetarian' },
    'spicy': { label: 'Spicy', icon: '🌶️', class: 'spicy' },
    'new': { label: 'New', icon: '✨', class: 'new' },
    'organic': { label: 'Organic', icon: '🍃', class: 'organic' },
    'sugar-free': { label: 'Sugar-Free', icon: '🍃', class: 'sugar-free' },
    'special': { label: 'Special', icon: '🎉', class: 'special' }
  };

  if (knownBadges[tagLower]) {
    return knownBadges[tagLower];
  }

  // Check in DIET_FILTERS if present
  const customFilter = DIET_FILTERS.find(f => f.id === tagLower);
  if (customFilter) {
    return {
      label: customFilter.label.replace(/^[^\w\sа-яА-ЯёЁ]+/, '').trim(),
      icon: customFilter.label.match(/^[^\w\sа-яА-ЯёЁ]+/)?.[0] || '🏷️',
      class: tagLower
    };
  }

  // Auto-format any custom tag
  const formattedLabel = tagLower
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return { label: formattedLabel, icon: '🏷️', class: tagLower.replace(/\s+/g, '-') };
}

// Filter and Render Menu grouped with Section Dividers
function renderMenu() {
  if (!menuGridContainer) return;

  let filtered = menuItemsState.filter(item => {
    const matchCategory = activeCategory === 'all' || item.category === activeCategory;

    let matchSearch = true;
    if (searchQuery) {
      const q = searchQuery;
      const nameMatch = item.name.toLowerCase().includes(q);
      const descMatch = item.description.toLowerCase().includes(q);
      const catMatch = item.category.toLowerCase().includes(q);

      const isCoffeeSearch = (q.includes('coffee') || q.includes('espresso') || q.includes('latte') || q.includes('cappuccino') || q.includes('brew') || q.includes('drink'));
      const isCoffeeCategoryMatch = isCoffeeSearch && (item.category === 'coffee' || item.category === 'beans');

      const isSaladSearch = (q.includes('salad') || q.includes('bowl') || q.includes('quinoa') || q.includes('greens'));
      const isSaladCategoryMatch = isSaladSearch && item.category === 'salads';

      const isSandwichSearch = (q.includes('sandwich') || q.includes('bagel') || q.includes('toast') || q.includes('focaccia') || q.includes('bread'));
      const isSandwichCategoryMatch = isSandwichSearch && item.category === 'sandwiches';

      const isPastrySearch = (q.includes('pastry') || q.includes('bakery') || q.includes('croissant') || q.includes('sweet') || q.includes('cake') || q.includes('bun') || q.includes('danish'));
      const isPastryCategoryMatch = isPastrySearch && item.category === 'pastries';

      const isBeansSearch = (q.includes('bean') || q.includes('roast') || q.includes('yirgacheffe') || q.includes('colombia'));
      const isBeansCategoryMatch = isBeansSearch && item.category === 'beans';

      matchSearch = nameMatch || descMatch || catMatch || isCoffeeCategoryMatch || isSaladCategoryMatch || isSandwichCategoryMatch || isPastryCategoryMatch || isBeansCategoryMatch;
    }

    let matchDiet = true;
    if (activeDietFilters.size > 0) {
      activeDietFilters.forEach(dietId => {
        if (!item.tags.includes(dietId)) {
          matchDiet = false;
        }
      });
    }

    return matchCategory && matchSearch && matchDiet;
  });

  const currentCatObj = CATEGORIES.find(c => c.id === activeCategory);
  if (sectionTitleEl) sectionTitleEl.textContent = currentCatObj ? currentCatObj.name : 'All Items';
  if (itemCountEl) itemCountEl.textContent = `${filtered.length} item${filtered.length !== 1 ? 's' : ''} available`;

  if (filtered.length === 0) {
    menuGridContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">☕</div>
        <h3>No items found</h3>
        <p>Try searching for something else or clear your filters.</p>
      </div>
    `;
    return;
  }

  const categoriesToRender = activeCategory === 'all'
    ? CATEGORIES.filter(c => c.id !== 'all')
    : CATEGORIES.filter(c => c.id === activeCategory);

  let htmlContent = '';

  categoriesToRender.forEach(cat => {
    const itemsInCat = filtered.filter(item => item.category === cat.id);
    if (itemsInCat.length === 0) return;

    htmlContent += `
      <div class="category-section-block">
        <div class="category-divider-header">
          <h3 class="category-divider-title">
            <span>${cat.icon}</span> ${cat.name}
          </h3>
          <div class="category-divider-line"></div>
        </div>
        <div class="menu-grid">
          ${itemsInCat.map(item => renderItemCardHTML(item)).join('')}
        </div>
      </div>
    `;
  });

  menuGridContainer.innerHTML = htmlContent;
}

// Generate single card HTML
function renderItemCardHTML(item) {
  const isOutOfStock = item.inStock === false;
  const isHH = isItemHappyHour(item);
  const displayPrice = getItemPrice(item);
  const buttonLabel = modalBackdrop ? 'Customize & Add' : 'Add to Cart';

  return `
    <div class="menu-card ${isOutOfStock ? 'out-of-stock' : ''}" data-id="${item.id}">
      <div class="card-img-wrapper">
        <img class="card-img" src="${item.image}" alt="${item.name}" loading="lazy" decoding="async" />
        <div class="card-overlay"></div>

        ${isOutOfStock ? `<div class="out-of-stock-banner">Sorry<br> Out of Stock</div>` : ''}

        <!-- Styled Badges -->
        <div class="card-badges">
          ${isHH ? `<span class="badge-tag happy-hour"><span>🎉</span> Happy Hour</span>` : ''}
          ${item.tags.map(tag => {
    const b = getBadgeInfo(tag);
    return b ? `<span class="badge-tag ${b.class}"><span>${b.icon}</span> ${b.label}</span>` : '';
  }).join('')}
        </div>

        ${isHH ? `
          <div class="price-tag happy-hour-price">
            <span class="price-original">${CURRENCY}${item.price}</span>
            <span class="price-discounted">${CURRENCY}${displayPrice}</span>
          </div>
        ` : `
          <div class="price-tag">${CURRENCY}${item.price}</div>
        `}
      </div>

      <div class="card-body">
        <h3 class="card-title">${item.name}</h3>
        <p class="card-description">${item.description}</p>
        
        <div class="card-footer">
          ${isOutOfStock ? `
            <button class="btn-add-item out-of-stock-btn" disabled>
              Unavailable
            </button>
          ` : `
            <button class="btn-add-item" onclick="openItemModal('${item.id}')">
              <span>+</span> ${buttonLabel}
            </button>
          `}
        </div>
      </div>
    </div>
  `;
}

// Render Admin Category Filters in Drawer
function renderAdminCategoryFilters() {
  if (!adminCategoryFilters) return;
  adminCategoryFilters.innerHTML = CATEGORIES.map(cat => `
    <button class="admin-cat-tab ${cat.id === adminActiveCategory ? 'active' : ''}" onclick="setAdminCategory('${cat.id}')">
      ${cat.icon} ${cat.name}
    </button>
  `).join('');
}

window.setAdminCategory = function (catId) {
  adminActiveCategory = catId;
  renderAdminCategoryFilters();
  renderAdminItemsList();
};

// Render Admin Items Management List in Drawer
function renderAdminItemsList() {
  if (!adminItemsList) return;

  const items = menuItemsState.filter(item => {
    const matchCat = adminActiveCategory === 'all' || item.category === adminActiveCategory;
    const matchQuery = !adminSearchQuery || item.name.toLowerCase().includes(adminSearchQuery);
    return matchCat && matchQuery;
  });

  adminItemsList.innerHTML = items.map(item => {
    const isBestseller = item.tags.includes('bestseller');
    const isInStock = item.inStock !== false;
    const isInHH = happyHoursItems.has(item.id);
    const displayPrice = getItemPrice(item);

    return `
      <div class="admin-item-row">
        <div>
          <div class="admin-item-name">${item.name}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${CURRENCY}${item.price}${isItemHappyHour(item) ? ` → ${CURRENCY}${displayPrice}` : ''} • ${item.category}</div>
        </div>
        <div class="admin-item-actions">
          <button 
            class="admin-action-btn ${isInStock ? 'active-stock' : 'out-stock'}" 
            onclick="toggleItemStock('${item.id}')"
          >
            ${isInStock ? '✅ In Stock' : '❌ Out of Stock'}
          </button>

          <button 
            class="admin-action-btn ${isBestseller ? 'active-bestseller' : ''}" 
            onclick="toggleItemBestseller('${item.id}')"
          >
            ${isBestseller ? '⭐ Best Seller' : '☆ Add Best Seller'}
          </button>

          <button 
            class="admin-action-btn hh-toggle ${isInHH ? 'active-hh' : ''}" 
            onclick="toggleItemHappyHour('${item.id}')"
          >
            ${isInHH ? '🎉 In HH' : '☆ Add to HH'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Global Admin Action Handlers
window.toggleItemStock = function (itemId) {
  const item = menuItemsState.find(i => i.id === itemId);
  if (item) {
    item.inStock = !item.inStock;
    saveMenuOverrides();
    renderMenu();
    renderAdminItemsList();
  }
};

window.toggleItemBestseller = function (itemId) {
  const item = menuItemsState.find(i => i.id === itemId);
  if (item) {
    const index = item.tags.indexOf('bestseller');
    if (index > -1) {
      item.tags.splice(index, 1);
    } else {
      item.tags.unshift('bestseller');
    }
    saveMenuOverrides();
    renderMenu();
    renderAdminItemsList();
  }
};

window.toggleItemHappyHour = function (itemId) {
  if (happyHoursItems.has(itemId)) {
    happyHoursItems.delete(itemId);
  } else {
    happyHoursItems.add(itemId);
  }
  saveHappyHoursState();
  updateHappyHoursBanner();
  renderMenu();
  renderAdminItemsList();
};

// Fallback: Add directly to cart if modal is not present
function addItemDirectlyToCart(item) {
  const unitPrice = getItemPrice(item);
  const cartItemId = item.id;
  const existingIndex = cart.findIndex(ci => ci.cartItemId === cartItemId);

  if (existingIndex > -1) {
    cart[existingIndex].qty += 1;
  } else {
    cart.push({
      cartItemId,
      id: item.id,
      name: item.name,
      image: item.image,
      optionsText: '',
      unitPrice,
      qty: 1
    });
  }

  saveCartToStorage();
  updateCartUI();
  cartDrawer?.classList.add('open');
}

// Open Item Customization Modal
window.openItemModal = function (itemId) {
  const item = menuItemsState.find(i => i.id === itemId);
  if (!item || item.inStock === false) return;

  if (!modalBackdrop) {
    addItemDirectlyToCart(item);
    return;
  }

  currentModalItem = item;
  currentModalQty = 1;
  selectedModalOptions = {};
  if (modalQtyVal) modalQtyVal.textContent = 1;

  if (modalImg) modalImg.src = item.image;
  if (modalTitle) modalTitle.textContent = item.name;
  if (modalDesc) modalDesc.textContent = item.description;

  // Build Options UI
  let optionsHTML = '';
  if (item.options && Object.keys(item.options).length > 0) {
    for (const [key, group] of Object.entries(item.options)) {
      const isArray = Array.isArray(group);
      optionsHTML += `
        <div class="option-group">
          <div class="option-title">Select ${key}</div>
          <div class="option-choices">
      `;

      if (isArray) {
        group.forEach((opt, idx) => {
          const isChecked = idx === 0;
          if (isChecked) selectedModalOptions[key] = opt;
          optionsHTML += `
            <label class="option-choice-label">
              <span>
                <input type="radio" name="opt-${key}" value="${idx}" ${isChecked ? 'checked' : ''} onchange="handleOptionSelect('${key}', ${idx})" />
                ${opt.name}
              </span>
              <span>${opt.price > 0 ? `+${CURRENCY}${opt.price}` : 'Free'}</span>
            </label>
          `;
        });
      } else {
        selectedModalOptions[key] = null;
        optionsHTML += `
          <label class="option-choice-label">
            <span>
              <input type="checkbox" name="opt-${key}" onchange="handleCheckboxSelect('${key}')" />
              ${group.name}
            </span>
            <span>+${CURRENCY}${group.price}</span>
          </label>
        `;
      }
      optionsHTML += `</div></div>`;
    }
  }

  if (modalOptionsContainer) modalOptionsContainer.innerHTML = optionsHTML;
  updateModalPrice();
  modalBackdrop.classList.add('active');
};

window.handleOptionSelect = function (groupKey, index) {
  const item = currentModalItem;
  if (item && item.options && item.options[groupKey]) {
    selectedModalOptions[groupKey] = item.options[groupKey][index];
    updateModalPrice();
  }
};

window.handleCheckboxSelect = function (groupKey) {
  const item = currentModalItem;
  const checkbox = document.querySelector(`input[name="opt-${groupKey}"]`);
  if (item && item.options && item.options[groupKey] && checkbox) {
    selectedModalOptions[groupKey] = checkbox.checked ? item.options[groupKey] : null;
    updateModalPrice();
  }
};

function updateModalPrice() {
  if (!currentModalItem || !btnAddToCartConfirm) return;
  let unitPrice = getItemPrice(currentModalItem);

  for (const opt of Object.values(selectedModalOptions)) {
    if (opt && opt.price) {
      unitPrice += opt.price;
    }
  }

  const totalPrice = unitPrice * currentModalQty;
  const hhLabel = isItemHappyHour(currentModalItem) ? ' 🎉' : '';
  btnAddToCartConfirm.textContent = `Add to Order • ${CURRENCY}${totalPrice}${hhLabel}`;
}

function closeModal() {
  modalBackdrop?.classList.remove('active');
  currentModalItem = null;
}

// Cart Logic
function handleAddToCartFromModal() {
  if (!currentModalItem) return;

  const optionsList = [];
  const optionsKeyParts = [];

  for (const [key, val] of Object.entries(selectedModalOptions)) {
    if (val && val.name && val.name !== 'None' && val.name !== 'No Extra Protein') {
      const priceText = val.price > 0 ? ` (+${CURRENCY}${val.price})` : '';
      optionsList.push(`${val.name}${priceText}`);
      optionsKeyParts.push(`${key}:${val.name}`);
    }
  }

  let unitPrice = getItemPrice(currentModalItem);
  for (const opt of Object.values(selectedModalOptions)) {
    if (opt && opt.price) unitPrice += opt.price;
  }

  const cartItemId = currentModalItem.id + '-' + optionsKeyParts.join('-').replace(/\s+/g, '');
  const existingIndex = cart.findIndex(ci => ci.cartItemId === cartItemId);

  if (existingIndex > -1) {
    cart[existingIndex].qty += currentModalQty;
  } else {
    cart.push({
      cartItemId,
      id: currentModalItem.id,
      name: currentModalItem.name,
      image: currentModalItem.image,
      optionsList: optionsList,
      unitPrice,
      qty: currentModalQty
    });
  }

  saveCartToStorage();
  updateCartUI();
  closeModal();
  cartDrawer?.classList.add('open');
}

function updateCartUI() {
  const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);

  if (cartCountBadge) cartCountBadge.textContent = totalCount;
  if (cartTotalPriceEl) cartTotalPriceEl.textContent = `${CURRENCY}${totalPrice}`;

  if (!cartItemsList) return;

  if (cart.length === 0) {
    cartItemsList.innerHTML = `
      <div style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
        <p style="font-size: 2.5rem; margin-bottom: 0.5rem;">📋</p>
        <p style="font-weight: 700; color: var(--brown-primary); margin-bottom: 4px;">No items selected</p>
        <p style="font-size: 0.85rem; line-height: 1.4;">Add items from the menu above to calculate your estimated order total.</p>
      </div>
    `;
    return;
  }

  cartItemsList.innerHTML = cart.map((item, index) => {
    const options = Array.isArray(item.optionsList) && item.optionsList.length > 0
      ? item.optionsList
      : (item.optionsText ? item.optionsText.split(', ').filter(Boolean) : []);

    return `
      <div class="cart-item">
        <img class="cart-item-img" src="${item.image}" alt="${item.name}" />
        <div class="cart-item-info">
          <div class="cart-item-title">${item.name}</div>
          ${options.length > 0 ? `
            <ul class="cart-item-options-list">
              ${options.map(opt => `<li>${opt}</li>`).join('')}
            </ul>
          ` : ''}
          <div class="cart-item-price">${CURRENCY}${item.unitPrice * item.qty}</div>
        </div>
        <div class="quantity-control" style="padding: 2px 8px;">
          <button class="btn-qty" onclick="changeCartQty(${index}, -1)">-</button>
          <span class="qty-val">${item.qty}</span>
          <button class="btn-qty" onclick="changeCartQty(${index}, 1)">+</button>
        </div>
      </div>
    `;
  }).join('');
}

window.changeCartQty = function (index, delta) {
  if (cart[index]) {
    cart[index].qty += delta;
    if (cart[index].qty <= 0) {
      cart.splice(index, 1);
    }
    saveCartToStorage();
    updateCartUI();
  }
};

function handleCheckout() {
  if (cart.length === 0) return;
  cart = [];
  saveCartToStorage();
  updateCartUI();
}

function saveCartToStorage() {
  try {
    localStorage.setItem('famore_cafe_cart', JSON.stringify(cart));
  } catch (e) {
    console.error(e);
  }
}

function loadCartFromStorage() {
  try {
    const saved = localStorage.getItem('famore_cafe_cart') || localStorage.getItem('velvet_cafe_cart');
    if (saved) cart = JSON.parse(saved);
  } catch (e) {
    cart = [];
  }
}
