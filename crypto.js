const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
    wallet: $("#crypto-wallet"),
    invested: $("#crypto-invested"),
    wealth: $("#crypto-total-wealth"),
    index: $("#crypto-index-value"),
    indexChange: $("#crypto-index-change"),
    marketStatus: $("#crypto-market-status"),
    countdown: $("#crypto-countdown"),
    lastTick: $("#crypto-last-tick"),
    feedNote: $("#crypto-feed-note"),
    message: $("#crypto-message"),
    search: $("#crypto-search"),
    category: $("#crypto-category-filter"),
    sort: $("#crypto-sort"),
    grid: $("#crypto-grid"),
    marketView: $("#crypto-market-view"),
    portfolioView: $("#crypto-portfolio-view"),
    communityView: $("#crypto-community-view"),
    portfolioValue: $("#crypto-portfolio-value"),
    portfolioUnrealised: $("#crypto-portfolio-unrealised"),
    portfolioRealised: $("#crypto-portfolio-realised"),
    portfolioTotal: $("#crypto-portfolio-total"),
    portfolioChart: $("#crypto-portfolio-chart"),
    portfolioTooltip: $("#crypto-portfolio-tooltip"),
    holdings: $("#crypto-holdings-list"),
    trades: $("#crypto-trade-list"),
    community: $("#crypto-community-holdings"),
    dialog: $("#crypto-dialog"),
    closeDialog: $("#crypto-dialog-close"),
    detailCategory: $("#crypto-detail-category"),
    detailName: $("#crypto-detail-name"),
    detailSymbol: $("#crypto-detail-symbol"),
    detailDescription: $("#crypto-detail-description"),
    detailPrice: $("#crypto-detail-price"),
    detailOwned: $("#crypto-detail-owned"),
    detailAverage: $("#crypto-detail-average"),
    detailRange: $("#crypto-detail-range"),
    detailChart: $("#crypto-detail-chart"),
    detailTooltip: $("#crypto-detail-tooltip"),
    amountLabel: $("#crypto-amount-label"),
    amount: $("#crypto-trade-amount"),
    quickAmounts: $("#crypto-quick-amounts"),
    estimate: $("#crypto-trade-estimate"),
    fee: $("#crypto-fee-note"),
    submit: $("#crypto-trade-submit"),
    tradeMessage: $("#crypto-trade-message"),
    max: $("#crypto-trade-max")
};

const categoryNames = {
    store_of_value: "Store of value",
    smart_contracts: "Smart contracts",
    payments: "Payments",
    meme: "Meme",
    infrastructure: "Infrastructure"
};

let overview = null;
let selectedSymbol = null;
let detailDuration = "1h";
let tradeSide = "buy";
let nextRefreshAt = 0;
let loadingOverview = false;
let tradeBusy = false;
let detailData = null;
let communityData = null;
let portfolioData = null;
let portfolioDuration =
    localStorage.getItem("crypto-portfolio-duration") || "30d";
let detailChartType =
    localStorage.getItem("crypto-detail-chart-type") === "candlestick"
        ? "candlestick"
        : "line";

function formatInteger(value) {
    return Math.round(Number(value) || 0).toLocaleString();
}

function formatPrice(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return "0.00";
    }

    const maximumFractionDigits = number >= 1000
        ? 2
        : number >= 1
            ? 4
            : number >= 0.01
                ? 6
                : 8;

    return number.toLocaleString(undefined, {
        minimumFractionDigits: number >= 1 ? 2 : 4,
        maximumFractionDigits
    });
}

function formatUnits(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return "0";
    }

    return number.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 8
    });
}

function formatPercent(value) {
    const number = Number(value) || 0;
    return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function dateTime(value) {
    if (!value) {
        return "Waiting for first update";
    }

    return new Date(value).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short"
    });
}

function axisDate(value, duration) {
    const date = new Date(value);
    if (["1h", "6h", "24h"].includes(duration)) {
        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    return date.toLocaleDateString([], {
        month: "short",
        day: "numeric"
    });
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function setMessage(text = "", type = "") {
    elements.message.textContent = text;
    elements.message.className = `form-message ${type}`.trim();
}

function setTradeMessage(text = "", type = "") {
    elements.tradeMessage.textContent = text;
    elements.tradeMessage.className = `form-message ${type}`.trim();
}

function profitClass(value) {
    const number = Number(value) || 0;
    return number > 0 ? "positive" : number < 0 ? "negative" : "neutral";
}

function assetBySymbol(symbol) {
    return overview?.assets?.find((asset) => asset.symbol === symbol) ?? null;
}

function svgElement(tag, attributes = {}) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [name, value] of Object.entries(attributes)) {
        node.setAttribute(name, value);
    }
    return node;
}

function createSparkline(points, negative) {
    const svg = svgElement("svg", {
        viewBox: "0 0 220 72",
        class: `spark ${negative ? "negative" : ""}`,
        "aria-hidden": "true"
    });
    const values = (points || [])
        .map((point) => Number(point.price))
        .filter(Number.isFinite);

    if (values.length < 2) {
        return svg;
    }

    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const span = maximum - minimum || 1;
    const path = values.map((value, index) => {
        const x = index / (values.length - 1) * 220;
        const y = 66 - (value - minimum) / span * 58;
        return `${index ? "L" : "M"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(" ");

    svg.append(
        svgElement("path", {
            d: `${path} L 220 72 L 0 72 Z`,
            class: "area"
        }),
        svgElement("path", { d: path, class: "line" })
    );
    return svg;
}

function filteredAssets() {
    const query = elements.search.value.trim().toLowerCase();
    const category = elements.category.value;
    const sort = elements.sort.value;
    const assets = [...(overview?.assets || [])].filter((asset) => {
        const matchesSearch = !query
            || asset.name.toLowerCase().includes(query)
            || asset.symbol.toLowerCase().includes(query);
        const matchesCategory = category === "all" || asset.category === category;
        return matchesSearch && matchesCategory;
    });

    assets.sort((left, right) => {
        if (sort === "watch") {
            return Number(right.watchlisted) - Number(left.watchlisted)
                || Number(right.change_24h) - Number(left.change_24h);
        }
        if (sort === "gain") {
            return Number(right.change_24h) - Number(left.change_24h);
        }
        if (sort === "loss") {
            return Number(left.change_24h) - Number(right.change_24h);
        }
        if (sort === "high") {
            return Number(right.price) - Number(left.price);
        }
        if (sort === "low") {
            return Number(left.price) - Number(right.price);
        }
        return left.name.localeCompare(right.name);
    });

    return assets;
}

function createAssetCard(asset) {
    const card = document.createElement("article");
    card.className = "company-card crypto-card";
    card.dataset.sector = asset.category;
    card.tabIndex = 0;

    const change = Number(asset.change_24h) || 0;
    card.innerHTML = `
        <div class="card-head">
            <div>
                <span class="ticker">${escapeHtml(asset.symbol)}</span>
                <h2>${escapeHtml(asset.name)}</h2>
                <span class="volatility-badge">${escapeHtml(categoryNames[asset.category] || asset.category)}</span>
            </div>
            <button class="watch ${asset.watchlisted ? "active" : ""}" type="button" aria-label="Toggle watchlist">★</button>
        </div>
        <div class="card-price">
            <div class="price-block">
                <strong>${Number(asset.price) > 0 ? formatPrice(asset.price) : "Waiting"}</strong>
                <span>chips per ${escapeHtml(asset.symbol)}</span>
            </div>
            <span class="change ${profitClass(change)}">${formatPercent(change)}</span>
        </div>
        <div class="spark-slot"></div>
        <div class="card-foot">
            <span>${formatUnits(asset.owned_units)} owned</span>
            <span>${formatInteger(asset.position_value)} chips</span>
        </div>
    `;

    card.querySelector(".spark-slot").append(
        createSparkline(asset.sparkline, change < 0)
    );

    const watchButton = card.querySelector(".watch");
    watchButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        try {
            const { error } = await supabaseClient.rpc(
                "toggle_crypto_watchlist",
                { p_symbol: asset.symbol }
            );
            if (error) {
                throw error;
            }
            await loadOverview(true);
        } catch (error) {
            setMessage(error.message || "Watchlist update failed.", "error");
        }
    });

    const open = () => openDetail(asset.symbol);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            open();
        }
    });
    return card;
}

function renderGrid() {
    const assets = filteredAssets();
    elements.grid.replaceChildren();

    if (!assets.length) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "No cryptocurrencies match those filters.";
        elements.grid.append(empty);
        return;
    }

    elements.grid.append(...assets.map(createAssetCard));
}

function renderHoldings() {
    const holdings = overview?.holdings || [];
    elements.holdings.replaceChildren();

    if (!holdings.length) {
        elements.holdings.innerHTML = '<p class="empty">You do not own any cryptocurrency yet.</p>';
        return;
    }

    for (const holding of holdings) {
        const row = document.createElement("article");
        row.className = "holding-row";
        row.tabIndex = 0;
        row.innerHTML = `
            <div><strong>${escapeHtml(holding.name)} · ${escapeHtml(holding.symbol)}</strong><span>${formatUnits(holding.units)} units</span></div>
            <div><strong>${formatInteger(holding.position_value)}</strong><span>Current value</span></div>
            <div><strong>${formatPrice(holding.average_cost)}</strong><span>Average cost</span></div>
            <div><strong class="${profitClass(holding.unrealised_profit)}">${formatInteger(holding.unrealised_profit)}</strong><span>Unrealised</span></div>
            <div><strong>${dateTime(holding.held_since)}</strong><span>Held since</span></div>
        `;
        row.addEventListener("click", () => openDetail(holding.symbol));
        row.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                openDetail(holding.symbol);
            }
        });
        elements.holdings.append(row);
    }
}

function renderTrades() {
    const trades = overview?.recent_trades || [];
    elements.trades.replaceChildren();

    if (!trades.length) {
        elements.trades.innerHTML = '<p class="empty">No crypto trades yet.</p>';
        return;
    }

    for (const trade of trades) {
        const row = document.createElement("article");
        row.className = "trade-row";
        row.innerHTML = `
            <div><strong>${trade.side === "buy" ? "Bought" : "Sold"} ${escapeHtml(trade.symbol)}</strong><span>${dateTime(trade.created_at)}</span></div>
            <div><strong>${formatUnits(trade.units)}</strong><span>Quantity</span></div>
            <div><strong>${formatInteger(Math.abs(trade.wallet_change))}</strong><span>${trade.side === "buy" ? "Spent" : "Received"}</span></div>
            <div><strong class="${profitClass(trade.realised_profit)}">${formatInteger(trade.realised_profit)}</strong><span>Realised profit</span></div>
        `;
        elements.trades.append(row);
    }
}

function renderCommunity() {
    const players = communityData?.players || [];
    elements.community.replaceChildren();

    if (!players.length) {
        elements.community.innerHTML = '<p class="empty">Nobody owns cryptocurrency yet.</p>';
        return;
    }

    for (const player of players) {
        const card = document.createElement("article");
        card.className = `community-player ${player.is_you ? "you" : ""}`;

        const positions = (player.positions || []).map((position) => `
            <button type="button" class="community-position" data-symbol="${escapeHtml(position.symbol)}">
                <div><strong>${escapeHtml(position.name)} · ${escapeHtml(position.symbol)}</strong><span>${formatUnits(position.units)} units</span></div>
                <strong>${formatInteger(position.position_value)}</strong>
                <strong class="position-profit ${profitClass(position.unrealised_profit)}">${formatInteger(position.unrealised_profit)}</strong>
            </button>
        `).join("");

        card.innerHTML = `
            <div class="community-player-head">
                <div class="community-player-name">
                    <a class="player-profile-link" href="profile.html?id=${encodeURIComponent(player.user_id)}" data-profile-user-id="${escapeHtml(player.user_id)}" data-profile-username="${escapeHtml(player.username)}">${escapeHtml(player.username)}</a>
                    ${player.is_you ? '<span class="you-chip">YOU</span>' : ""}
                </div>
                <div class="community-total">
                    <strong>${formatInteger(player.total_value)} chips</strong>
                    <span class="${profitClass(player.total_profit)}">${formatInteger(player.total_profit)} profit</span>
                </div>
            </div>
            <div class="community-positions">${positions}</div>
        `;

        card.querySelectorAll(".community-position").forEach((button) => {
            button.addEventListener("click", () => openDetail(button.dataset.symbol));
        });
        elements.community.append(card);
    }
}

function renderOverview() {
    if (!overview) {
        return;
    }

    const portfolio = overview.portfolio;
    const market = overview.market;
    elements.wallet.textContent = formatInteger(portfolio.wallet_chips);
    elements.invested.textContent = formatInteger(portfolio.holdings_value);
    elements.wealth.textContent = formatInteger(portfolio.total_wealth);
    elements.portfolioValue.textContent = formatInteger(portfolio.holdings_value);
    elements.portfolioUnrealised.textContent = formatInteger(portfolio.unrealised_profit);
    elements.portfolioUnrealised.className = profitClass(portfolio.unrealised_profit);
    elements.portfolioRealised.textContent = formatInteger(portfolio.realised_profit);
    elements.portfolioRealised.className = profitClass(portfolio.realised_profit);
    elements.portfolioTotal.textContent = formatInteger(portfolio.total_wealth);
    elements.index.textContent = Number(market.index_value || 1000).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    elements.indexChange.textContent = formatPercent(market.change_24h);
    elements.indexChange.className = profitClass(market.change_24h);
    elements.marketStatus.textContent = "Open 24/7";
    elements.lastTick.textContent = dateTime(overview.last_refresh_at);
    nextRefreshAt = Number(new Date(overview.next_refresh_at));

    const age = overview.last_refresh_at
        ? Date.now() - Number(new Date(overview.last_refresh_at))
        : Infinity;
    const stale = age > 10 * 60 * 1000;
    elements.feedNote.classList.toggle("warning", stale || Boolean(market.last_error));
    elements.feedNote.textContent = stale
        ? "Kraken prices are currently stale. Trading automatically locks after 15 minutes without a valid update."
        : market.last_error
            ? `Some Kraken prices failed to update: ${market.last_error}`
            : "Prices are supplied by Kraken and mapped directly to play-chip values. This is simulated trading, not real investing.";

    renderGrid();
    renderHoldings();
    renderTrades();
}

async function loadOverview(silent = false) {
    if (loadingOverview) {
        return;
    }

    loadingOverview = true;
    try {
        const { data, error } = await supabaseClient.rpc(
            "get_crypto_market_overview"
        );
        if (error) {
            throw error;
        }

        overview = data;
        communityData = null;
        renderOverview();

        if (selectedSymbol && elements.dialog.open) {
            updateDetail(assetBySymbol(selectedSymbol));
        }
    } catch (error) {
        console.error(error);
        if (!silent) {
            setMessage(error.message || "The crypto market could not be loaded.", "error");
        }
    } finally {
        loadingOverview = false;
    }
}

async function loadCommunity() {
    if (communityData) {
        renderCommunity();
        return;
    }

    try {
        const { data, error } = await supabaseClient.rpc(
            "get_public_crypto_holdings"
        );
        if (error) {
            throw error;
        }
        communityData = data;
        renderCommunity();
    } catch (error) {
        elements.community.innerHTML = `<p class="empty">${escapeHtml(error.message || "Community holdings could not be loaded.")}</p>`;
    }
}

function setView(view) {
    elements.marketView.classList.toggle("hidden", view !== "market");
    elements.portfolioView.classList.toggle("hidden", view !== "portfolio");
    elements.communityView.classList.toggle("hidden", view !== "community");

    $$(".view-tab").forEach((button) => {
        const active = button.dataset.view === view;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });

    if (view === "portfolio") {
        loadPortfolio(portfolioDuration);
    } else if (view === "community") {
        loadCommunity();
    }
}

function lineChart(node, tooltip, points, key, duration, formatter, label) {
    node.replaceChildren();
    tooltip.classList.add("hidden");
    const values = (points || [])
        .map((point) => ({ at: +new Date(point.at), value: +point[key] }))
        .filter((point) => Number.isFinite(point.at) && Number.isFinite(point.value))
        .sort((left, right) => left.at - right.at);
    const shell = node.parentElement;
    const width = Math.max(shell.clientWidth, 320);
    const height = width < 560 ? 270 : 320;
    const padding = { top: 18, right: 16, bottom: 42, left: width < 560 ? 58 : 72 };
    node.setAttribute("viewBox", `0 0 ${width} ${height}`);

    if (!values.length) {
        const text = svgElement("text", {
            x: width / 2,
            y: height / 2,
            "text-anchor": "middle",
            class: "axis-label"
        });
        text.textContent = "No history recorded yet.";
        node.append(text);
        return;
    }

    let minimumTime = values[0].at;
    let maximumTime = values.at(-1).at;
    if (maximumTime <= minimumTime) {
        minimumTime -= 60000;
        maximumTime += 60000;
    }

    let minimum = Math.min(...values.map((point) => point.value));
    let maximum = Math.max(...values.map((point) => point.value));
    const span = maximum - minimum;
    const verticalPadding = span
        ? Math.max(span * 0.1, 0.00000001)
        : Math.max(Math.abs(maximum) * 0.08, 1);
    minimum = Math.max(0, minimum - verticalPadding);
    maximum += verticalPadding;
    if (maximum <= minimum) {
        maximum = minimum + 1;
    }

    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const x = (time) => padding.left
        + (time - minimumTime) / (maximumTime - minimumTime) * plotWidth;
    const y = (value) => padding.top
        + (1 - (value - minimum) / (maximum - minimum)) * plotHeight;

    for (let index = 0; index < 5; index += 1) {
        const lineY = padding.top + index / 4 * plotHeight;
        node.append(svgElement("line", {
            x1: padding.left,
            y1: lineY,
            x2: width - padding.right,
            y2: lineY,
            class: "grid-line"
        }));
        const text = svgElement("text", {
            x: padding.left - 8,
            y: lineY + 4,
            "text-anchor": "end",
            class: "axis-label"
        });
        text.textContent = formatter(maximum - index / 4 * (maximum - minimum));
        node.append(text);
    }

    const labelCount = width < 560 ? 4 : 6;
    for (let index = 0; index < labelCount; index += 1) {
        const labelX = padding.left + index / (labelCount - 1) * plotWidth;
        const time = minimumTime + index / (labelCount - 1) * (maximumTime - minimumTime);
        const text = svgElement("text", {
            x: labelX,
            y: height - 14,
            "text-anchor": index === 0 ? "start" : index === labelCount - 1 ? "end" : "middle",
            class: "axis-label"
        });
        text.textContent = axisDate(time, duration);
        node.append(text);
    }

    const plotted = values.map((point) => ({
        ...point,
        x: x(point.at),
        y: y(point.value)
    }));
    const path = plotted.map((point, index) =>
        `${index ? "L" : "M"} ${point.x} ${point.y}`
    ).join(" ");
    const area = `M ${plotted[0].x} ${padding.top + plotHeight} ${path.replace(/^M/, "L")} L ${plotted.at(-1).x} ${padding.top + plotHeight} Z`;

    node.append(
        svgElement("path", { d: area, class: "chart-area" }),
        svgElement("path", {
            d: path,
            class: `chart-line ${plotted.at(-1).value < plotted[0].value ? "negative" : ""}`
        })
    );

    const hoverLine = svgElement("line", {
        class: "hover-line hidden",
        y1: padding.top,
        y2: padding.top + plotHeight
    });
    const hoverPoint = svgElement("circle", {
        class: "hover-point hidden",
        r: 5
    });
    const interaction = svgElement("rect", {
        class: "interaction",
        x: padding.left,
        y: padding.top,
        width: plotWidth,
        height: plotHeight
    });

    const hide = () => {
        hoverLine.classList.add("hidden");
        hoverPoint.classList.add("hidden");
        tooltip.classList.add("hidden");
    };
    const show = (event) => {
        const bounds = node.getBoundingClientRect();
        const scaledX = (event.clientX - bounds.left) * width / bounds.width;
        const nearest = plotted.reduce((best, current) =>
            Math.abs(current.x - scaledX) < Math.abs(best.x - scaledX)
                ? current
                : best
        , plotted[0]);
        hoverLine.setAttribute("x1", nearest.x);
        hoverLine.setAttribute("x2", nearest.x);
        hoverPoint.setAttribute("cx", nearest.x);
        hoverPoint.setAttribute("cy", nearest.y);
        hoverLine.classList.remove("hidden");
        hoverPoint.classList.remove("hidden");
        tooltip.innerHTML = `<strong>${escapeHtml(formatter(nearest.value))} ${escapeHtml(label)}</strong><span>${escapeHtml(dateTime(nearest.at))}</span>`;
        tooltip.classList.remove("hidden");
        const shellBounds = shell.getBoundingClientRect();
        const left = Math.min(
            Math.max(bounds.left + nearest.x * bounds.width / width - shellBounds.left - tooltip.offsetWidth / 2, 8),
            shellBounds.width - tooltip.offsetWidth - 8
        );
        const top = Math.max(
            bounds.top + nearest.y * bounds.height / height - shellBounds.top - tooltip.offsetHeight - 12,
            8
        );
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    };
    interaction.onpointermove = show;
    interaction.onpointerdown = show;
    interaction.onpointerleave = hide;
    node.append(hoverLine, hoverPoint, interaction);
}

function candlestickChart(node, tooltip, points, duration) {
    node.replaceChildren();
    tooltip.classList.add("hidden");
    const raw = (points || []).map((point) => ({
        at: +new Date(point.at),
        open: +(point.open ?? point.price),
        high: +(point.high ?? point.price),
        low: +(point.low ?? point.price),
        close: +(point.close ?? point.price)
    })).filter((point) =>
        [point.at, point.open, point.high, point.low, point.close].every(Number.isFinite)
    ).sort((left, right) => left.at - right.at);

    const candles = [];
    for (let index = 0; index < raw.length; index += 3) {
        const group = raw.slice(index, index + 3);
        if (!group.length) {
            continue;
        }
        candles.push({
            at: group[0].at,
            open: group[0].open,
            high: Math.max(...group.map((point) => point.high)),
            low: Math.min(...group.map((point) => point.low)),
            close: group.at(-1).close
        });
    }

    const shell = node.parentElement;
    const width = Math.max(shell.clientWidth, 320);
    const height = width < 560 ? 270 : 320;
    const padding = { top: 18, right: 16, bottom: 42, left: width < 560 ? 58 : 72 };
    node.setAttribute("viewBox", `0 0 ${width} ${height}`);

    if (!candles.length) {
        const text = svgElement("text", {
            x: width / 2,
            y: height / 2,
            "text-anchor": "middle",
            class: "axis-label"
        });
        text.textContent = "No candle history recorded yet.";
        node.append(text);
        return;
    }

    let minimum = Math.min(...candles.map((candle) => candle.low));
    let maximum = Math.max(...candles.map((candle) => candle.high));
    const span = maximum - minimum;
    const verticalPadding = span
        ? Math.max(span * 0.1, 0.00000001)
        : Math.max(Math.abs(maximum) * 0.08, 1);
    minimum = Math.max(0, minimum - verticalPadding);
    maximum += verticalPadding;
    if (maximum <= minimum) {
        maximum = minimum + 1;
    }

    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const y = (value) => padding.top
        + (1 - (value - minimum) / (maximum - minimum)) * plotHeight;
    const candleWidth = Math.max(
        2,
        Math.min(14, plotWidth / Math.max(candles.length, 1) * 0.62)
    );

    for (let index = 0; index < 5; index += 1) {
        const lineY = padding.top + index / 4 * plotHeight;
        node.append(svgElement("line", {
            x1: padding.left,
            y1: lineY,
            x2: width - padding.right,
            y2: lineY,
            class: "grid-line"
        }));
        const text = svgElement("text", {
            x: padding.left - 8,
            y: lineY + 4,
            "text-anchor": "end",
            class: "axis-label"
        });
        text.textContent = formatPrice(maximum - index / 4 * (maximum - minimum));
        node.append(text);
    }

    const plotted = candles.map((candle, index) => ({
        ...candle,
        x: candles.length === 1
            ? padding.left + plotWidth / 2
            : padding.left + index / (candles.length - 1) * plotWidth
    }));

    plotted.forEach((candle) => {
        const direction = candle.close >= candle.open ? "up" : "down";
        const openY = y(candle.open);
        const closeY = y(candle.close);
        node.append(
            svgElement("line", {
                x1: candle.x,
                y1: y(candle.high),
                x2: candle.x,
                y2: y(candle.low),
                class: `candle-wick ${direction}`
            }),
            svgElement("rect", {
                x: candle.x - candleWidth / 2,
                y: Math.min(openY, closeY),
                width: candleWidth,
                height: Math.max(Math.abs(closeY - openY), 1.5),
                rx: 1,
                class: `candle-body ${direction}`
            })
        );
    });

    const hoverLine = svgElement("line", {
        class: "hover-line hidden",
        y1: padding.top,
        y2: padding.top + plotHeight
    });
    const interaction = svgElement("rect", {
        class: "interaction",
        x: padding.left,
        y: padding.top,
        width: plotWidth,
        height: plotHeight
    });
    const hide = () => {
        hoverLine.classList.add("hidden");
        tooltip.classList.add("hidden");
    };
    const show = (event) => {
        const bounds = node.getBoundingClientRect();
        const scaledX = (event.clientX - bounds.left) * width / bounds.width;
        const nearest = plotted.reduce((best, current) =>
            Math.abs(current.x - scaledX) < Math.abs(best.x - scaledX)
                ? current
                : best
        , plotted[0]);
        hoverLine.setAttribute("x1", nearest.x);
        hoverLine.setAttribute("x2", nearest.x);
        hoverLine.classList.remove("hidden");
        tooltip.innerHTML = `
            <strong>${escapeHtml(dateTime(nearest.at))}</strong>
            <span>Open ${formatPrice(nearest.open)} · High ${formatPrice(nearest.high)}</span>
            <span>Low ${formatPrice(nearest.low)} · Close ${formatPrice(nearest.close)}</span>
            <small>Built from cached Kraken samples</small>
        `;
        tooltip.classList.remove("hidden");
        const shellBounds = shell.getBoundingClientRect();
        const left = Math.min(
            Math.max(bounds.left + nearest.x * bounds.width / width - shellBounds.left - tooltip.offsetWidth / 2, 8),
            shellBounds.width - tooltip.offsetWidth - 8
        );
        const top = Math.max(
            bounds.top + y(nearest.high) * bounds.height / height - shellBounds.top - tooltip.offsetHeight - 12,
            8
        );
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    };
    interaction.onpointermove = show;
    interaction.onpointerdown = show;
    interaction.onpointerleave = hide;
    node.append(hoverLine, interaction);
}

function drawDetailChart() {
    if (!detailData) {
        return;
    }

    if (detailChartType === "candlestick") {
        candlestickChart(
            elements.detailChart,
            elements.detailTooltip,
            detailData.points,
            detailDuration
        );
    } else {
        lineChart(
            elements.detailChart,
            elements.detailTooltip,
            detailData.points,
            "price",
            detailDuration,
            formatPrice,
            "chips"
        );
    }
}

async function loadPortfolio(duration) {
    portfolioDuration = duration;
    localStorage.setItem("crypto-portfolio-duration", duration);
    $$("#crypto-portfolio-ranges button").forEach((button) => {
        button.classList.toggle("active", button.dataset.duration === duration);
    });

    try {
        const { data, error } = await supabaseClient.rpc(
            "get_my_crypto_portfolio_history",
            { p_duration: duration }
        );
        if (error) {
            throw error;
        }
        portfolioData = data;
        lineChart(
            elements.portfolioChart,
            elements.portfolioTooltip,
            data.points,
            "total",
            duration,
            formatInteger,
            "chips"
        );
    } catch (error) {
        console.warn(error);
    }
}

function updateDetail(asset) {
    if (!asset) {
        return;
    }

    elements.detailCategory.textContent =
        (categoryNames[asset.category] || asset.category).toUpperCase();
    elements.detailName.textContent = asset.name;
    elements.detailSymbol.textContent = asset.symbol;
    elements.detailDescription.textContent = asset.description;
    elements.detailPrice.textContent = Number(asset.price) > 0
        ? `${formatPrice(asset.price)} chips`
        : "Waiting for quote";
    elements.detailOwned.textContent = `${formatUnits(asset.owned_units)} ${asset.symbol}`;
    elements.detailAverage.textContent = `${formatPrice(asset.average_cost)} chips`;
    elements.detailRange.textContent =
        Number(asset.low_24h) > 0 && Number(asset.high_24h) > 0
            ? `${formatPrice(asset.low_24h)} – ${formatPrice(asset.high_24h)}`
            : "—";
    updateEstimate();
}

async function loadDetail() {
    const { data, error } = await supabaseClient.rpc(
        "get_crypto_asset_history",
        {
            p_symbol: selectedSymbol,
            p_duration: detailDuration
        }
    );
    if (error) {
        throw error;
    }
    detailData = data;
    drawDetailChart();
}

async function openDetail(symbol) {
    selectedSymbol = symbol;
    updateDetail(assetBySymbol(symbol));
    updateTradeSide();
    setTradeMessage();
    if (!elements.dialog.open) {
        elements.dialog.showModal();
    }

    try {
        await loadDetail();
    } catch (error) {
        setTradeMessage(error.message || "Price history could not be loaded.", "error");
    }
}

function closeDetail() {
    selectedSymbol = null;
    detailData = null;
    elements.dialog.close();
}

function numericAmount() {
    const value = Number(elements.amount.value);
    return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

function updateTradeSide() {
    $$("#crypto-side-buttons button").forEach((button) => {
        button.classList.toggle("active", button.dataset.side === tradeSide);
    });

    const quickButtons = [...elements.quickAmounts.querySelectorAll("button:not(#crypto-trade-max)")];
    if (tradeSide === "buy") {
        elements.amountLabel.textContent = "Chips to invest";
        elements.amount.min = "10";
        elements.amount.step = "1";
        elements.amount.value = Math.max(Math.round(numericAmount()), 100);
        const values = [100, 1000, 5000];
        quickButtons.forEach((button, index) => {
            button.textContent = values[index] >= 1000
                ? `${values[index] / 1000}K`
                : String(values[index]);
            button.dataset.buyChips = values[index];
            delete button.dataset.sellPercent;
        });
        elements.submit.textContent = "Buy crypto";
        elements.submit.classList.remove("sell");
    } else {
        elements.amountLabel.textContent = `${selectedSymbol || "Crypto"} quantity to sell`;
        elements.amount.min = "0.00000001";
        elements.amount.step = "any";
        elements.amount.value = "0";
        const values = [25, 50, 75];
        quickButtons.forEach((button, index) => {
            button.textContent = `${values[index]}%`;
            button.dataset.sellPercent = values[index];
            delete button.dataset.buyChips;
        });
        elements.submit.textContent = "Sell crypto";
        elements.submit.classList.add("sell");
    }
    updateEstimate();
}

function updateEstimate() {
    const asset = assetBySymbol(selectedSymbol);
    if (!asset || !(Number(asset.price) > 0)) {
        elements.estimate.textContent = "Waiting for quote";
        elements.fee.textContent = "Trading unlocks after the first Kraken refresh";
        return;
    }

    const amount = numericAmount();
    if (tradeSide === "buy") {
        const budget = Math.floor(amount);
        const fee = Math.max(0, Math.round(budget * 0.0015));
        const assetChips = Math.max(budget - fee, 0);
        const quantity = assetChips / Number(asset.price);
        elements.estimate.textContent = `${formatUnits(quantity)} ${asset.symbol} received`;
        elements.fee.textContent = `${formatInteger(budget)} chips spent · ${formatInteger(fee)} fee (0.15%)`;
    } else {
        const gross = Math.floor(amount * Number(asset.price));
        const fee = Math.max(0, Math.round(gross * 0.0015));
        elements.estimate.textContent = `${formatInteger(Math.max(gross - fee, 0))} chips received`;
        elements.fee.textContent = `${formatInteger(gross)} gross · ${formatInteger(fee)} fee (0.15%)`;
    }
}

function maxAmount() {
    const asset = assetBySymbol(selectedSymbol);
    if (!asset) {
        return;
    }

    elements.amount.value = tradeSide === "buy"
        ? Math.floor(Number(overview.portfolio.wallet_chips) || 0)
        : Number(asset.owned_units || 0).toFixed(12).replace(/0+$/, "").replace(/\.$/, "");
    updateEstimate();
}

function useQuickAmount(button) {
    const asset = assetBySymbol(selectedSymbol);
    if (!asset) {
        return;
    }

    if (tradeSide === "buy") {
        elements.amount.value = button.dataset.buyChips;
    } else {
        const percentage = Number(button.dataset.sellPercent) / 100;
        elements.amount.value = (Number(asset.owned_units) * percentage)
            .toFixed(12)
            .replace(/0+$/, "")
            .replace(/\.$/, "");
    }
    updateEstimate();
}

async function submitTrade() {
    if (tradeBusy || !selectedSymbol) {
        return;
    }

    const amount = numericAmount();
    if (tradeSide === "buy" && amount < 10) {
        setTradeMessage("Enter at least 10 chips.", "error");
        return;
    }
    if (tradeSide === "sell" && amount <= 0) {
        setTradeMessage("Enter a quantity to sell.", "error");
        return;
    }

    tradeBusy = true;
    elements.submit.disabled = true;
    try {
        const rpcName = tradeSide === "buy" ? "buy_crypto" : "sell_crypto";
        const parameters = tradeSide === "buy"
            ? { p_symbol: selectedSymbol, p_chip_amount: Math.floor(amount) }
            : { p_symbol: selectedSymbol, p_units: amount };
        const { data, error } = await supabaseClient.rpc(rpcName, parameters);
        if (error) {
            throw error;
        }

        setTradeMessage(
            tradeSide === "buy"
                ? `Bought ${formatUnits(data.units)} ${data.symbol} for ${formatInteger(Math.abs(data.wallet_change))} chips.`
                : `Sold ${formatUnits(data.units)} ${data.symbol} for ${formatInteger(data.wallet_change)} chips.`,
            "success"
        );
        communityData = null;
        await loadOverview(true);
        await loadDetail();
        updateDetail(assetBySymbol(selectedSymbol));
    } catch (error) {
        setTradeMessage(error.message || "The trade could not be completed.", "error");
    } finally {
        tradeBusy = false;
        elements.submit.disabled = false;
    }
}

function updateCountdown() {
    if (!nextRefreshAt) {
        elements.countdown.textContent = "--:--";
        return;
    }

    const seconds = Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000));
    elements.countdown.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    if (seconds === 0) {
        loadOverview(true);
    }
}

$$(".view-tab").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
});

[elements.search, elements.category, elements.sort].forEach((input) => {
    input.addEventListener(input === elements.search ? "input" : "change", renderGrid);
});

$$("#crypto-portfolio-ranges button").forEach((button) => {
    button.addEventListener("click", () => loadPortfolio(button.dataset.duration));
});

$$("#crypto-detail-ranges button").forEach((button) => {
    button.addEventListener("click", async () => {
        detailDuration = button.dataset.duration;
        $$("#crypto-detail-ranges button").forEach((rangeButton) => {
            rangeButton.classList.toggle("active", rangeButton === button);
        });
        if (selectedSymbol) {
            try {
                await loadDetail();
            } catch (error) {
                setTradeMessage(error.message, "error");
            }
        }
    });
});

$$("#crypto-chart-types button").forEach((button) => {
    button.classList.toggle("active", button.dataset.chartType === detailChartType);
    button.addEventListener("click", () => {
        detailChartType = button.dataset.chartType;
        localStorage.setItem("crypto-detail-chart-type", detailChartType);
        $$("#crypto-chart-types button").forEach((typeButton) => {
            typeButton.classList.toggle("active", typeButton === button);
        });
        drawDetailChart();
    });
});

$$("#crypto-side-buttons button").forEach((button) => {
    button.addEventListener("click", () => {
        tradeSide = button.dataset.side;
        updateTradeSide();
    });
});

elements.quickAmounts.querySelectorAll("button:not(#crypto-trade-max)").forEach((button) => {
    button.addEventListener("click", () => useQuickAmount(button));
});

elements.amount.addEventListener("input", updateEstimate);
elements.max.addEventListener("click", maxAmount);
elements.submit.addEventListener("click", submitTrade);
elements.closeDialog.addEventListener("click", closeDetail);
elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) {
        closeDetail();
    }
});

window.addEventListener("resize", () => {
    if (elements.dialog.open && detailData) {
        drawDetailChart();
    }
    if (portfolioData && !elements.portfolioView.classList.contains("hidden")) {
        lineChart(
            elements.portfolioChart,
            elements.portfolioTooltip,
            portfolioData.points,
            "total",
            portfolioDuration,
            formatInteger,
            "chips"
        );
    }
});

(async function initialiseCryptoMarket() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error || !user) {
        window.location.href = "login.html";
        return;
    }

    await loadOverview();
    updateTradeSide();
    updateCountdown();
    setInterval(updateCountdown, 1000);
    setInterval(() => loadOverview(true), 30000);
})().catch((error) => {
    console.error(error);
    setMessage(error.message || "The crypto market could not be loaded.", "error");
});
