const DEFAULT_CRYPTOS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
const MAX_TOTAL_CRYPTOS = 6;
const AUTO_REFRESH_INTERVAL = 30000;

const COIN_NAMES = {
  'BTCUSDT': 'Bitcoin',
  'ETHUSDT': 'Ethereum',
  'SOLUSDT': 'Solana'
};

let activeCryptos = [...DEFAULT_CRYPTOS];
let debounceTimer;
let autoRefreshTimer;

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  initDonateModal();

  document.getElementById('refresh-btn').addEventListener('click', () => {
    fetchPrices(activeCryptos);
    restartAutoRefresh();
  });

  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const query = e.target.value.trim().toUpperCase();

    if (query.length < 2) {
      document.getElementById('search-results').innerHTML = '';
      return;
    }

    debounceTimer = setTimeout(() => {
      searchCryptos(query);
    }, 350);
  });
});

function initDonateModal() {
  const donateBtn = document.getElementById('donate-btn');
  const closeModalBtn = document.getElementById('close-modal');
  const modal = document.getElementById('donate-modal');
  const copyBtn = document.getElementById('copy-btn');
  const addressText = document.getElementById('wallet-address').innerText;

  donateBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
  });

  closeModalBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(addressText).then(() => {
      copyBtn.innerText = '¡Copiado con éxito! ✓';
      copyBtn.classList.add('copied');

      setTimeout(() => {
        copyBtn.innerText = 'Copiar Dirección';
        copyBtn.classList.remove('copied');
      }, 2000);
    });
  });
}

function initApp() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['selectedCryptos'], (result) => {
      if (result && Array.isArray(result.selectedCryptos) && result.selectedCryptos.length > 0) {
        activeCryptos = result.selectedCryptos.slice(0, MAX_TOTAL_CRYPTOS);
      } else {
        activeCryptos = [...DEFAULT_CRYPTOS];
        saveCryptos();
      }
      updateCounter();
      fetchPrices(activeCryptos);
      startAutoRefresh();
    });
  } else {
    updateCounter();
    fetchPrices(activeCryptos);
    startAutoRefresh();
  }
}

function startAutoRefresh() {
  clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(() => {
    fetchPrices(activeCryptos);
  }, AUTO_REFRESH_INTERVAL);
}

function restartAutoRefresh() {
  startAutoRefresh();
}

function saveCryptos() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.set({ selectedCryptos: activeCryptos }, () => {
      updateCounter();
    });
  } else {
    updateCounter();
  }
}

function updateCounter() {
  const counterEl = document.getElementById('counter');
  if (counterEl) {
    counterEl.textContent = `${activeCryptos.length}/${MAX_TOTAL_CRYPTOS}`;
  }
}

function formatPrice(val) {
  if (val >= 1) {
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else if (val >= 0.001) {
    return val.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  } else {
    return val.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 8 });
  }
}

async function fetchPrices(cryptoList) {
  const container = document.getElementById('main-cryptos');
  if (!cryptoList || cryptoList.length === 0) {
    container.innerHTML = '<div class="empty">No hay monedas agregadas.</div>';
    return;
  }

  try {
    const symbolsParam = JSON.stringify(cryptoList);
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${symbolsParam}`);
    
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);

    const data = await res.json();
    container.innerHTML = '';

    data.forEach(coinData => {
      const symbol = coinData.symbol;
      const price = parseFloat(coinData.lastPrice);
      const change = parseFloat(coinData.priceChangePercent);
      const isPos = change >= 0;
      
      const displaySymbol = symbol.replace('USDT', '');
      const displayName = COIN_NAMES[symbol] || displaySymbol;

      const card = document.createElement('div');
      card.className = 'card';
      if (symbol === 'BTCUSDT') card.setAttribute('data-id', 'bitcoin');
      if (symbol === 'ETHUSDT') card.setAttribute('data-id', 'ethereum');
      if (symbol === 'SOLUSDT') card.setAttribute('data-id', 'solana');

      card.innerHTML = `
        <div class="coin-info">
          <span class="symbol">${displaySymbol}</span>
          <span class="name">${displayName}</span>
        </div>
        <div class="right-side">
          <div class="price-info">
            <div class="price">$${formatPrice(price)}</div>
            <div class="change ${isPos ? 'positive' : 'negative'}">
              ${isPos ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%
            </div>
          </div>
          <button class="remove-btn" title="Eliminar" data-symbol="${symbol}">✕</button>
        </div>
      `;
      container.appendChild(card);
    });

    document.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const symbolToRemove = e.target.getAttribute('data-symbol');
        removeCrypto(symbolToRemove);
      });
    });

  } catch (err) {
    console.error("Error al obtener precios:", err);
    container.innerHTML = '<div class="empty" style="color:#f87171;">Error de conexión con el mercado</div>';
  }
}

function removeCrypto(symbol) {
  activeCryptos = activeCryptos.filter(item => item !== symbol);
  saveCryptos();
  fetchPrices(activeCryptos);

  const query = document.getElementById('search-input').value.trim();
  if (query.length >= 2) {
    searchCryptos(query);
  }
}

function addCrypto(symbol, name) {
  if (activeCryptos.length >= MAX_TOTAL_CRYPTOS) {
    showSearchStatus(`Límite alcanzado (${MAX_TOTAL_CRYPTOS} max)`, true);
    return;
  }

  if (!activeCryptos.includes(symbol)) {
    if (name) COIN_NAMES[symbol] = name;
    activeCryptos.push(symbol);
    saveCryptos();
    fetchPrices(activeCryptos);

    const query = document.getElementById('search-input').value.trim();
    if (query.length >= 2) {
      searchCryptos(query);
    }
  }
}

function showSearchStatus(message, isError = false) {
  const resultsContainer = document.getElementById('search-results');
  const color = isError ? '#f87171' : '#64748b';
  resultsContainer.innerHTML = `<div class="empty" style="color: ${color};">${message}</div>`;
}

async function searchCryptos(query) {
  const resultsContainer = document.getElementById('search-results');
  resultsContainer.innerHTML = '<div class="loading">Buscando mercado...</div>';

  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/price');
    const allPrices = await res.json();
    
    const filteredCoins = allPrices.filter(c => 
      c.symbol.endsWith('USDT') && 
      c.symbol.replace('USDT', '').includes(query.toUpperCase())
    ).slice(0, 4);

    if (filteredCoins.length === 0) {
      showSearchStatus('Sin coincidencias en USDT');
      return;
    }

    resultsContainer.innerHTML = '';

    filteredCoins.forEach(coin => {
      const symbol = coin.symbol;
      const displaySymbol = symbol.replace('USDT', '');
      const price = parseFloat(coin.price);
      
      const isAlreadyAdded = activeCryptos.includes(symbol);
      const isLimitReached = activeCryptos.length >= MAX_TOTAL_CRYPTOS;

      const item = document.createElement('div');
      item.className = 'result-item';

      let actionHTML = '';
      if (isAlreadyAdded) {
        actionHTML = '<span class="added-label">✓ Guardada</span>';
      } else if (isLimitReached) {
        actionHTML = '<span class="added-label" style="color:#64748b;">Límite 6/6</span>';
      } else {
        actionHTML = `<button class="add-btn" data-symbol="${symbol}" data-name="${displaySymbol}">+ Añadir</button>`;
      }

      item.innerHTML = `
        <div class="coin-info">
          <span class="symbol">${displaySymbol}</span>
        </div>
        <div class="right-side">
          <div class="price" style="margin-right: 8px;">
             $${formatPrice(price)}
          </div>
          ${actionHTML}
        </div>
      `;

      resultsContainer.appendChild(item);
    });

    document.querySelectorAll('.add-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const symbol = e.target.getAttribute('data-symbol');
        const name = e.target.getAttribute('data-name');
        addCrypto(symbol, name);
      });
    });

  } catch (err) {
    console.error("Error en la búsqueda:", err);
    showSearchStatus('Error al buscar en el mercado', true);
  }
}
