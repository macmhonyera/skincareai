const AUTH_TOKEN_KEY = 'skincare_auth_token';
let googleClientId = window.SKINCARE_GOOGLE_CLIENT_ID || '';

const form = document.getElementById('recommendation-form');
const statusEl = document.getElementById('status');
const submitBtn = document.getElementById('submit-btn');
const resultsSection = document.getElementById('results');
const ingredientListEl = document.getElementById('ingredient-list');
const insightsListEl = document.getElementById('insights-list');
const productsListEl = document.getElementById('products-list');
const routineBlockEl = document.getElementById('routine-block');
const marketplaceCardEl = document.getElementById('marketplace-card');
const marketplaceListEl = document.getElementById('marketplace-list');
const imageAnalysisBlockEl = document.getElementById('image-analysis-block');
const proInsightsBlockEl = document.getElementById('pro-insights-block');
const historyListEl = document.getElementById('history-list');

const registerForm = document.getElementById('register-form');
const loginForm = document.getElementById('login-form');
const authStatusEl = document.getElementById('auth-status');
const authToggleBtn = document.getElementById('auth-toggle-btn');
const authModalEl = document.getElementById('auth-modal');
const authModalCloseEl = document.getElementById('auth-modal-close');
const authTitleEl = document.getElementById('auth-title');
const authSubtitleEl = document.getElementById('auth-subtitle');
const showLoginBtn = document.getElementById('show-login-btn');
const showRegisterBtn = document.getElementById('show-register-btn');
const toLoginBtn = document.getElementById('to-login-btn');
const toRegisterBtn = document.getElementById('to-register-btn');
const googleCustomBtn = document.getElementById('google-custom-btn');
const googleStatusEl = document.getElementById('google-status');
const logoutBtn = document.getElementById('logout-btn');
const upgradeProBtn = document.getElementById('upgrade-pro-btn');
const loadHistoryBtn = document.getElementById('load-history-btn');
const loadProgressBtn = document.getElementById('load-progress-btn');
const proFeaturesListEl = document.getElementById('pro-features-list');
const progressChartEl = document.getElementById('progress-chart');
const progressSummaryEl = document.getElementById('progress-summary');
const progressComparisonEl = document.getElementById('progress-comparison');

const authState = {
  token: localStorage.getItem(AUTH_TOKEN_KEY) || null,
  user: null,
};

let googleTokenClient = null;
let authMode = 'login';

function titleCase(value) {
  return String(value || '')
    .split(' ')
    .filter(Boolean)
    .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1))
    .join(' ');
}

function getSelectedConcerns() {
  return Array.from(
    document.querySelectorAll('.chips input[type="checkbox"]:checked'),
  ).map((checkbox) => checkbox.value);
}

function getCommaList(rawValue) {
  return String(rawValue || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function setStatus(message) {
  statusEl.textContent = message;
}

function getAuthHeaders(defaultHeaders = {}) {
  const headers = { ...defaultHeaders };
  if (authState.token) {
    headers.Authorization = `Bearer ${authState.token}`;
  }
  return headers;
}

function setSession(token, user) {
  authState.token = token;
  authState.user = user;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  updateAuthUi();
}

function clearSession() {
  authState.token = null;
  authState.user = null;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  updateAuthUi();
}

function updateAuthUi() {
  if (!authState.user) {
    authStatusEl.textContent = 'Guest mode. Recommendation is open.';
    authToggleBtn.textContent = 'Sign In';
    logoutBtn.classList.add('hidden');
    upgradeProBtn.classList.add('hidden');
    return;
  }

  authStatusEl.textContent = `${authState.user.email} · ${titleCase(authState.user.planTier)} plan`;
  authToggleBtn.textContent = 'Account';
  logoutBtn.classList.remove('hidden');

  if (authState.user.planTier === 'pro') {
    upgradeProBtn.classList.add('hidden');
  } else {
    upgradeProBtn.classList.remove('hidden');
  }
}

function setAuthMode(mode) {
  authMode = mode === 'register' ? 'register' : 'login';

  const isLogin = authMode === 'login';
  loginForm.classList.toggle('hidden', !isLogin);
  registerForm.classList.toggle('hidden', isLogin);

  showLoginBtn.classList.toggle('active', isLogin);
  showRegisterBtn.classList.toggle('active', !isLogin);

  authTitleEl.textContent = isLogin ? 'Welcome back' : 'Create your account';
  authSubtitleEl.textContent = isLogin
    ? 'Sign in to unlock history and progress tracking.'
    : 'Register once to keep your recommendation timeline.';
}

function openAuthModal(mode = 'login') {
  setAuthMode(mode);
  authModalEl.classList.remove('hidden');
}

function closeAuthModal() {
  authModalEl.classList.add('hidden');
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === 'string'
        ? payload
        : payload?.message || payload?.error || 'Request failed.';
    throw new Error(message);
  }

  return payload;
}

function clearResults() {
  ingredientListEl.innerHTML = '';
  insightsListEl.innerHTML = '';
  productsListEl.innerHTML = '';
  routineBlockEl.innerHTML = '';
  marketplaceListEl.innerHTML = '';
  imageAnalysisBlockEl.innerHTML = '';
  proInsightsBlockEl.innerHTML = '';
  marketplaceCardEl.classList.add('hidden');
}

function renderIngredients(ingredients) {
  ingredientListEl.innerHTML = '';

  if (!ingredients.length) {
    ingredientListEl.innerHTML = '<li>No ingredients returned.</li>';
    return;
  }

  ingredients.forEach((ingredient) => {
    const li = document.createElement('li');
    li.textContent = titleCase(ingredient);
    ingredientListEl.appendChild(li);
  });
}

function renderInsights(insights) {
  insightsListEl.innerHTML = '';

  if (!insights.length) {
    insightsListEl.innerHTML =
      '<div class="insight-item">No ingredient insights available.</div>';
    return;
  }

  insights.forEach((insight) => {
    const div = document.createElement('div');
    div.className = 'insight-item';
    div.innerHTML = `
      <div class="item-title">${titleCase(insight.name)}</div>
      <div class="item-sub">${insight.description}</div>
    `;
    insightsListEl.appendChild(div);
  });
}

function renderProducts(products) {
  productsListEl.innerHTML = '';

  if (!products.length) {
    productsListEl.innerHTML =
      '<div class="product-item">No strong product matches in database yet.</div>';
    return;
  }

  products.forEach((product) => {
    const div = document.createElement('div');
    div.className = 'product-item';

    const matched = (product.matchedIngredients || [])
      .map((item) => titleCase(item))
      .join(', ');

    div.innerHTML = `
      <div class="item-title">${product.name}</div>
      <div class="item-sub">${product.brand} · Match score: ${product.matchScore}%</div>
      <div class="item-sub">${matched ? `Matched: ${matched}` : 'No direct matches tagged.'}</div>
      ${
        product.purchaseUrl
          ? `<a class="item-link" href="${product.purchaseUrl}" target="_blank" rel="noreferrer">View Product</a>`
          : ''
      }
    `;
    productsListEl.appendChild(div);
  });
}

function renderRoutine(routine) {
  routineBlockEl.innerHTML = '';
  if (!routine) {
    routineBlockEl.innerHTML =
      '<div class="routine-item"><div class="item-sub">No routine returned.</div></div>';
    return;
  }

  const groups = [
    { title: 'Morning', items: routine.morning || [] },
    { title: 'Evening', items: routine.evening || [] },
    { title: 'Cautions', items: routine.cautions || [] },
  ];

  groups.forEach((group) => {
    const div = document.createElement('div');
    div.className = 'routine-item';
    div.innerHTML = `
      <div class="item-title">${group.title}</div>
      <div class="item-sub">${group.items.length ? group.items.join(' ') : 'None.'}</div>
    `;
    routineBlockEl.appendChild(div);
  });
}

function renderMarketplaceLinks(links) {
  marketplaceListEl.innerHTML = '';

  if (!links.length) {
    marketplaceCardEl.classList.add('hidden');
    return;
  }

  links.forEach((link) => {
    const div = document.createElement('div');
    div.className = 'product-item';
    div.innerHTML = `
      <div class="item-title">${link.title}</div>
      <a class="item-link" href="${link.link}" target="_blank" rel="noreferrer">Open Link</a>
    `;
    marketplaceListEl.appendChild(div);
  });

  marketplaceCardEl.classList.remove('hidden');
}

function renderImageAnalysis(imageAnalysis) {
  imageAnalysisBlockEl.innerHTML = '';

  if (!imageAnalysis) {
    imageAnalysisBlockEl.innerHTML =
      '<div class="routine-item"><div class="item-sub">No image analysis used for this result.</div></div>';
    return;
  }

  const concerns = (imageAnalysis.detectedConcerns || []).join(', ') || 'None';
  const observations = (imageAnalysis.observations || []).join(' ') || 'None';
  const confidence =
    typeof imageAnalysis.confidence === 'number'
      ? `${Math.round(imageAnalysis.confidence * 100)}%`
      : 'N/A';

  imageAnalysisBlockEl.innerHTML = `
    <div class="routine-item">
      <div class="item-title">Detected Skin Type</div>
      <div class="item-sub">${titleCase(imageAnalysis.suggestedSkinType || 'not detected')}</div>
    </div>
    <div class="routine-item">
      <div class="item-title">Detected Concerns</div>
      <div class="item-sub">${titleCase(concerns)}</div>
    </div>
    <div class="routine-item">
      <div class="item-title">Observations</div>
      <div class="item-sub">${observations}</div>
    </div>
    <div class="routine-item">
      <div class="item-title">Confidence</div>
      <div class="item-sub">${confidence}</div>
    </div>
  `;
}

function renderProInsights(proInsights) {
  proInsightsBlockEl.innerHTML = '';

  if (!proInsights) {
    proInsightsBlockEl.innerHTML =
      '<div class="routine-item"><div class="item-sub">Upgrade to Pro to unlock deeper weekly and layering insights.</div></div>';
    return;
  }

  const focus = (proInsights.weeklyFocus || [])
    .map((entry) => titleCase(entry))
    .join(', ');
  const warnings = (proInsights.layeringWarnings || []).join(' ') || 'None';
  const observations = (proInsights.observationSummary || []).join(' ') || 'None';

  proInsightsBlockEl.innerHTML = `
    <div class="routine-item">
      <div class="item-title">Weekly Focus</div>
      <div class="item-sub">${focus || 'General maintenance'}</div>
    </div>
    <div class="routine-item">
      <div class="item-title">Layering Warnings</div>
      <div class="item-sub">${warnings}</div>
    </div>
    <div class="routine-item">
      <div class="item-title">Consistency Window</div>
      <div class="item-sub">${proInsights.estimatedConsistencyWindow || 'N/A'}</div>
    </div>
    <div class="routine-item">
      <div class="item-title">Image Observation Summary</div>
      <div class="item-sub">${observations}</div>
    </div>
  `;
}

function renderHistory(items) {
  historyListEl.innerHTML = '';

  if (!items.length) {
    historyListEl.innerHTML =
      '<div class="product-item">No saved recommendations yet.</div>';
    return;
  }

  items.forEach((item) => {
    const profile = item.profileSnapshot || {};
    const rec = item.recommendationSnapshot || {};
    const ingredients = (rec.recommendedIngredients || [])
      .map((entry) => titleCase(entry))
      .join(', ');

    const div = document.createElement('div');
    div.className = 'product-item';
    div.innerHTML = `
      <div class="item-title">${new Date(item.createdAt).toLocaleString()}</div>
      <div class="item-sub">Source: ${item.source} · Skin type: ${profile.skinType || 'n/a'}</div>
      <div class="item-sub">Concerns: ${titleCase((profile.concerns || []).join(', ') || 'n/a')}</div>
      <div class="item-sub">Ingredients: ${ingredients || 'n/a'}</div>
    `;
    historyListEl.appendChild(div);
  });
}

function renderLockedMessage(message) {
  return `
    <div class="product-item">
      <div class="item-sub">${message}</div>
      <button type="button" class="secondary open-auth-btn">Sign in to unlock</button>
    </div>
  `;
}

function drawProgressChart(progress) {
  const canvas = progressChartEl;
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  const labels = progress?.chart?.labels || [];
  const overall = progress?.chart?.overallSkinScore || [];
  const severity = progress?.chart?.averageConcernSeverity || [];

  context.clearRect(0, 0, canvas.width, canvas.height);

  if (!labels.length || !overall.length) {
    context.fillStyle = '#3c6657';
    context.font = '16px Manrope, sans-serif';
    context.fillText(
      'Upload at least two skin photos to visualize progress.',
      24,
      40,
    );
    return;
  }

  const padding = { top: 30, right: 20, bottom: 45, left: 52 };
  const chartWidth = canvas.width - padding.left - padding.right;
  const chartHeight = canvas.height - padding.top - padding.bottom;

  const xForIndex = (index) =>
    padding.left +
    (labels.length === 1 ? chartWidth / 2 : (index / (labels.length - 1)) * chartWidth);
  const yForScore = (score) =>
    padding.top + chartHeight - (Math.max(0, Math.min(100, score)) / 100) * chartHeight;

  context.strokeStyle = '#b8d8ca';
  context.lineWidth = 1;
  for (let i = 0; i <= 5; i += 1) {
    const score = i * 20;
    const y = yForScore(score);
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(canvas.width - padding.right, y);
    context.stroke();
    context.fillStyle = '#6a8b7c';
    context.font = '12px Manrope, sans-serif';
    context.fillText(String(score), 16, y + 4);
  }

  const drawLine = (values, color) => {
    context.strokeStyle = color;
    context.lineWidth = 3;
    context.beginPath();
    values.forEach((value, index) => {
      const x = xForIndex(index);
      const y = yForScore(value);
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });
    context.stroke();

    values.forEach((value, index) => {
      const x = xForIndex(index);
      const y = yForScore(value);
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(x, y, 4, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.stroke();
    });
  };

  drawLine(overall, '#2f8f6f');
  drawLine(severity.map((value) => 100 - value), '#d47842');

  labels.forEach((label, index) => {
    const x = xForIndex(index);
    context.fillStyle = '#2d5648';
    context.font = '11px Manrope, sans-serif';
    context.fillText(label, x - 16, canvas.height - 15);
  });

  context.fillStyle = '#2f8f6f';
  context.fillRect(canvas.width - 300, 12, 10, 10);
  context.fillStyle = '#244f42';
  context.font = '12px Manrope, sans-serif';
  context.fillText('Overall Skin Score', canvas.width - 284, 22);

  context.fillStyle = '#d47842';
  context.fillRect(canvas.width - 155, 12, 10, 10);
  context.fillStyle = '#244f42';
  context.fillText('Lower Concern Severity', canvas.width - 139, 22);
}

function scoreDeltaLabel(value) {
  if (typeof value !== 'number') {
    return 'N/A';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}`;
}

function renderProgress(progress) {
  progressSummaryEl.innerHTML = '';
  progressComparisonEl.innerHTML = '';

  drawProgressChart(progress);

  const comparison = progress?.comparison;
  if (!comparison) {
    progressSummaryEl.innerHTML =
      '<div class="product-item">No progress data available yet.</div>';
    return;
  }

  progressSummaryEl.innerHTML = `
    <div class="product-item">
      <div class="item-title">Progress Summary</div>
      <div class="item-sub">${comparison.summary || 'No summary available yet.'}</div>
    </div>
  `;

  const latest = comparison.latest;
  const previous = comparison.previous;
  const deltas = comparison.deltas;

  if (!latest) {
    return;
  }

  const buildComparisonCard = (title, point) => {
    if (!point) {
      return `
        <article class="comparison-card">
          <div class="item-title">${title}</div>
          <div class="item-sub">Not available yet.</div>
        </article>
      `;
    }

    return `
      <article class="comparison-card">
        <div class="item-title">${title}</div>
        <div class="item-sub">${new Date(point.createdAt).toLocaleString()}</div>
        <div class="item-sub">Overall score: ${point.overallSkinScore}</div>
        <div class="item-sub">Avg concern severity: ${point.averageConcernSeverity}</div>
        ${
          point.imageUrl
            ? `<img src="${point.imageUrl}" alt="${title} skin check photo" loading="lazy" />`
            : '<div class="item-sub">No photo saved for this check-in.</div>'
        }
      </article>
    `;
  };

  progressComparisonEl.innerHTML = `
    ${buildComparisonCard('Previous Photo', previous)}
    ${buildComparisonCard('Latest Photo', latest)}
    ${
      deltas
        ? `<article class="comparison-card">
            <div class="item-title">Delta</div>
            <div class="item-sub">Overall skin score: ${scoreDeltaLabel(deltas.overallSkinScore)}</div>
            <div class="item-sub">Avg concern severity improvement: ${scoreDeltaLabel(
              deltas.averageConcernSeverity,
            )}</div>
            <div class="item-sub">Acne improvement: ${scoreDeltaLabel(
              deltas.concernDeltas?.acne,
            )}</div>
            <div class="item-sub">Pigmentation improvement: ${scoreDeltaLabel(
              deltas.concernDeltas?.pigmentation,
            )}</div>
            <div class="item-sub">Redness improvement: ${scoreDeltaLabel(
              deltas.concernDeltas?.redness,
            )}</div>
          </article>`
        : ''
    }
  `;
}

async function loadProgress() {
  if (!authState.token) {
    progressSummaryEl.innerHTML = renderLockedMessage(
      'Photo progress is available after sign in.',
    );
    drawProgressChart(null);
    progressComparisonEl.innerHTML = '';
    return;
  }

  try {
    const progress = await requestJson('/recommend/progress?limit=12', {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    renderProgress(progress);
  } catch (error) {
    progressSummaryEl.innerHTML = `<div class="product-item">Progress unavailable: ${
      error instanceof Error ? error.message : 'Unknown error'
    }</div>`;
    drawProgressChart(null);
    progressComparisonEl.innerHTML = '';
  }
}

async function handleAuthSuccess(result) {
  if (!result?.token || !result?.user) {
    throw new Error('Invalid auth response.');
  }
  setSession(result.token, result.user);
  closeAuthModal();
  await loadHistory();
  await loadProgress();
}

async function loadProFeatures() {
  try {
    const result = await requestJson('/auth/pro-features');
    proFeaturesListEl.innerHTML = '';
    (result.features || []).forEach((feature) => {
      const li = document.createElement('li');
      li.textContent = feature;
      proFeaturesListEl.appendChild(li);
    });
  } catch {
    proFeaturesListEl.innerHTML =
      '<li>Could not load pro features at the moment.</li>';
  }
}

async function loadCurrentUser() {
  if (!authState.token) {
    updateAuthUi();
    return;
  }

  try {
    const user = await requestJson('/auth/me', {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    authState.user = user;
    updateAuthUi();
  } catch {
    clearSession();
  }
}

async function loadHistory() {
  if (!authState.token) {
    historyListEl.innerHTML = renderLockedMessage(
      'History is available after sign in.',
    );
    return;
  }

  try {
    const result = await requestJson('/recommend/history?limit=15', {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    renderHistory(result.items || []);
  } catch (error) {
    historyListEl.innerHTML = `<div class="product-item">History unavailable: ${
      error instanceof Error ? error.message : 'Unknown error'
    }</div>`;
  }
}

async function initGoogleSignIn() {
  if (!googleClientId) {
    googleStatusEl.textContent =
      'Google client id not configured. Set GOOGLE_CLIENT_ID in backend env.';
    return;
  }

  let retries = 0;
  const maxRetries = 12;
  const check = () => {
    if (window.google?.accounts?.oauth2) {
      googleTokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: 'openid email profile',
        callback: async (tokenResponse) => {
          if (!tokenResponse?.access_token) {
            googleStatusEl.textContent = 'Google login failed.';
            return;
          }

          try {
            const result = await requestJson('/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                accessToken: tokenResponse.access_token,
              }),
            });
            await handleAuthSuccess(result);
            googleStatusEl.textContent = 'Google login successful.';
          } catch (error) {
            googleStatusEl.textContent =
              error instanceof Error ? error.message : 'Google login failed.';
          }
        },
      });

      googleStatusEl.textContent = '';
      return;
    }

    retries += 1;
    if (retries <= maxRetries) {
      setTimeout(check, 400);
    } else {
      googleStatusEl.textContent =
        'Could not load Google script. Refresh to retry.';
    }
  };

  check();
}

async function loadGoogleClientId() {
  if (googleClientId) {
    return;
  }

  try {
    const config = await requestJson('/auth/client-config');
    googleClientId = String(config.googleClientId || '').trim();
  } catch {
    googleClientId = '';
  }
}

authToggleBtn.addEventListener('click', () => {
  openAuthModal('login');
});

showLoginBtn.addEventListener('click', () => {
  setAuthMode('login');
});

showRegisterBtn.addEventListener('click', () => {
  setAuthMode('register');
});

toRegisterBtn.addEventListener('click', () => {
  setAuthMode('register');
});

toLoginBtn.addEventListener('click', () => {
  setAuthMode('login');
});

authModalCloseEl.addEventListener('click', () => {
  closeAuthModal();
});

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.dataset.authClose === 'true') {
    closeAuthModal();
  }

  if (target.classList.contains('open-auth-btn')) {
    openAuthModal('login');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeAuthModal();
  }
});

googleCustomBtn.addEventListener('click', () => {
  if (!googleTokenClient) {
    googleStatusEl.textContent =
      'Google sign-in is not ready yet. Please retry in a moment.';
    return;
  }

  googleTokenClient.requestAccessToken({ prompt: 'consent' });
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(registerForm);

  try {
    const result = await requestJson('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: String(data.get('name') || '').trim() || undefined,
        email: String(data.get('email') || '').trim(),
        password: String(data.get('password') || ''),
      }),
    });
    await handleAuthSuccess(result);
    setStatus('Account created and logged in.');
    registerForm.reset();
  } catch (error) {
    setStatus(
      error instanceof Error ? `Register failed: ${error.message}` : 'Register failed.',
    );
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(loginForm);

  try {
    const result = await requestJson('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: String(data.get('email') || '').trim(),
        password: String(data.get('password') || ''),
      }),
    });
    await handleAuthSuccess(result);
    setStatus('Login successful.');
    loginForm.reset();
  } catch (error) {
    setStatus(
      error instanceof Error ? `Login failed: ${error.message}` : 'Login failed.',
    );
  }
});

logoutBtn.addEventListener('click', () => {
  clearSession();
  setStatus('Logged out.');
  loadHistory();
  loadProgress();
});

upgradeProBtn.addEventListener('click', async () => {
  if (!authState.token) {
    setStatus('Login first before upgrading.');
    return;
  }

  try {
    const result = await requestJson('/auth/plan', {
      method: 'PATCH',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ planTier: 'pro' }),
    });
    await handleAuthSuccess(result);
    setStatus('Pro plan activated.');
  } catch (error) {
    setStatus(
      error instanceof Error
        ? `Could not upgrade: ${error.message}`
        : 'Could not upgrade.',
    );
  }
});

loadHistoryBtn.addEventListener('click', async () => {
  await loadHistory();
});

loadProgressBtn.addEventListener('click', async () => {
  await loadProgress();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const concerns = getSelectedConcerns();
  if (!concerns.length) {
    setStatus('Select at least one skin concern.');
    return;
  }

  const formData = new FormData(form);
  const imageFile = formData.get('skinImage');
  const hasImage = imageFile instanceof File && imageFile.size > 0;

  const payload = {
    skinType: String(formData.get('skinType') || '').toLowerCase(),
    skinConcerns: concerns,
    sensitivities: getCommaList(String(formData.get('sensitivities') || '')),
    routineGoal: String(formData.get('routineGoal') || '').trim() || undefined,
    budgetLevel: String(formData.get('budgetLevel') || '').trim() || undefined,
    photoNotes: String(formData.get('photoNotes') || '').trim() || undefined,
  };

  submitBtn.disabled = true;
  setStatus(
    hasImage
      ? 'Analyzing your skin image and profile...'
      : 'Analyzing your skin profile...',
  );
  clearResults();

  try {
    let result;

    if (hasImage) {
      const uploadPayload = new FormData();
      uploadPayload.append('image', imageFile);
      uploadPayload.append('skinType', payload.skinType);
      uploadPayload.append('skinConcerns', JSON.stringify(payload.skinConcerns));
      uploadPayload.append(
        'sensitivities',
        JSON.stringify(payload.sensitivities || []),
      );
      if (payload.routineGoal) {
        uploadPayload.append('routineGoal', payload.routineGoal);
      }
      if (payload.budgetLevel) {
        uploadPayload.append('budgetLevel', payload.budgetLevel);
      }
      if (payload.photoNotes) {
        uploadPayload.append('photoNotes', payload.photoNotes);
      }

      result = await requestJson('/recommend/with-image', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: uploadPayload,
      });
    } else {
      result = await requestJson('/recommend', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
    }

    renderIngredients(result.recommendedIngredients || []);
    renderInsights(result.ingredientInsights || []);
    renderProducts(result.matchingProducts || []);
    renderRoutine(result.routine);
    renderMarketplaceLinks(result.marketplaceLinks || []);
    renderImageAnalysis(result.imageAnalysis);
    renderProInsights(result.proInsights);

    resultsSection.classList.remove('hidden');
    setStatus('Recommendations generated successfully.');

    if (authState.token) {
      await loadHistory();
      await loadProgress();
    }
  } catch (error) {
    resultsSection.classList.add('hidden');
    setStatus(
      error instanceof Error
        ? `Unable to generate recommendations: ${error.message}`
        : 'Unable to generate recommendations.',
    );
  } finally {
    submitBtn.disabled = false;
  }
});

async function init() {
  await loadGoogleClientId();
  await loadCurrentUser();
  await loadProFeatures();
  await loadHistory();
  await loadProgress();
  await initGoogleSignIn();
}

init();
