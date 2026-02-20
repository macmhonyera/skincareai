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

function titleCase(value) {
  return value
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
  return rawValue
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function clearResults() {
  ingredientListEl.innerHTML = '';
  insightsListEl.innerHTML = '';
  productsListEl.innerHTML = '';
  routineBlockEl.innerHTML = '';
  marketplaceListEl.innerHTML = '';
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

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const concerns = getSelectedConcerns();

  if (!concerns.length) {
    statusEl.textContent = 'Select at least one skin concern.';
    return;
  }

  const payload = {
    skinType: String(formData.get('skinType') || '').toLowerCase(),
    skinConcerns: concerns,
    sensitivities: getCommaList(String(formData.get('sensitivities') || '')),
    routineGoal: String(formData.get('routineGoal') || '').trim() || undefined,
    budgetLevel: String(formData.get('budgetLevel') || '').trim() || undefined,
  };

  submitBtn.disabled = true;
  statusEl.textContent = 'Analyzing your skin profile...';
  clearResults();

  try {
    const response = await fetch('/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || 'Failed to fetch recommendations.');
    }

    const result = await response.json();

    renderIngredients(result.recommendedIngredients || []);
    renderInsights(result.ingredientInsights || []);
    renderProducts(result.matchingProducts || []);
    renderRoutine(result.routine);
    renderMarketplaceLinks(result.marketplaceLinks || []);

    resultsSection.classList.remove('hidden');
    statusEl.textContent = 'Recommendations generated successfully.';
  } catch (error) {
    resultsSection.classList.add('hidden');
    statusEl.textContent =
      error instanceof Error
        ? `Unable to generate recommendations: ${error.message}`
        : 'Unable to generate recommendations.';
  } finally {
    submitBtn.disabled = false;
  }
});
