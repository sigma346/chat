const predictionWallet = document.querySelector("#prediction-wallet");
const predictionMessage = document.querySelector("#prediction-message");
const predictionGrid = document.querySelector("#prediction-market-grid");
const predictionLastUpdated = document.querySelector("#prediction-last-updated");
const predictionListTitle = document.querySelector("#prediction-list-title");
const predictionRefreshButton = document.querySelector("#prediction-refresh-button");
const predictionCreateToggle = document.querySelector("#prediction-create-toggle");
const predictionCreatePanel = document.querySelector("#prediction-create-panel");
const predictionCreateClose = document.querySelector("#prediction-create-close");
const predictionCreateForm = document.querySelector("#prediction-create-form");
const predictionCreateSubmit = document.querySelector("#prediction-create-submit");
const predictionAdminBanner = document.querySelector("#prediction-admin-banner");
const predictionReviewCount = document.querySelector("#prediction-review-count");
const predictionReviewButton = document.querySelector("#prediction-review-button");
const predictionDialog = document.querySelector("#prediction-detail-dialog");
const predictionDialogContent = document.querySelector("#prediction-dialog-content");
const predictionDialogClose = document.querySelector("#prediction-dialog-close");

let predictionUser = null;
let predictionState = null;
let predictionFilter = "all";
let selectedMarketId = null;
let predictionBusy = false;
let predictionRefreshTimer = null;

const filterTitles = {
    all: "All prediction markets",
    open: "Open for betting",
    awaiting_review: "Awaiting admin review",
    settled: "Settled markets",
    mine: "Markets you created or joined"
};

const statusLabels = {
    open: "Open",
    awaiting_review: "Review",
    resolved: "Resolved",
    refunded: "Refunded"
};

function makeElement(tag, className = "", text = "") {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== "") element.textContent = text;
    return element;
}

function formatChips(value) {
    return new Intl.NumberFormat("en-AU").format(Number(value ?? 0));
}

function formatDate(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat("en-AU", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(new Date(value));
}

function setMessage(message = "", type = "") {
    predictionMessage.textContent = message;
    predictionMessage.className = `prediction-message ${type}`.trim();
}

function errorText(error) {
    return error?.message || "Something went wrong. Please try again.";
}

function poolPercent(amount, total) {
    const pool = Number(total ?? 0);
    if (pool <= 0) return 50;
    return Math.round((Number(amount ?? 0) / pool) * 100);
}

function closingText(market) {
    if (market.status === "open") return `Closes ${formatDate(market.closes_at)}`;
    if (market.status === "awaiting_review") return "Betting closed";
    return market.resolved_at ? `Settled ${formatDate(market.resolved_at)}` : "Settled";
}

function renderPoolBar(market) {
    const group = makeElement("div", "pool-group");
    const yesPercent = poolPercent(market.total_yes, market.total_pool);
    const noPercent = 100 - yesPercent;
    const bar = makeElement("div", "pool-bar");
    const yes = makeElement("span", "pool-bar-yes");
    const no = makeElement("span", "pool-bar-no");
    yes.style.width = `${market.total_pool > 0 ? yesPercent : 50}%`;
    no.style.width = `${market.total_pool > 0 ? noPercent : 50}%`;
    bar.append(yes, no);

    const labels = makeElement("div", "pool-labels");
    labels.append(
        makeElement("span", "yes-label", `YES ${yesPercent}% · ${formatChips(market.total_yes)}`),
        makeElement("span", "no-label", `NO ${noPercent}% · ${formatChips(market.total_no)}`)
    );
    group.append(bar, labels);
    return group;
}

function createMarketCard(market) {
    const card = makeElement("article", "panel prediction-market-card");
    const header = makeElement("div", "market-card-header");
    const title = makeElement("h3", "", market.title);
    const status = makeElement("span", `market-status ${market.status}`, statusLabels[market.status] || market.status);
    header.append(title, status);

    const description = makeElement("p", "market-card-description", market.description);
    const meta = makeElement("div", "market-meta-row");
    meta.append(
        makeElement("span", "", `${formatChips(market.total_pool)} chips`),
        makeElement("span", "", `${market.participant_count} player${market.participant_count === 1 ? "" : "s"}`),
        makeElement("span", "", closingText(market)),
        makeElement("span", "", `by ${market.creator_username}`)
    );

    const footer = makeElement("div", "market-card-footer");
    const position = makeElement("span", "my-position-chip");
    if (market.my_amount) {
        position.append("Your stake: ");
        const side = makeElement("strong", market.my_outcome, market.my_outcome.toUpperCase());
        position.append(side, ` · ${formatChips(market.my_amount)} chips`);
    } else {
        position.textContent = market.status === "open" ? "You have not joined yet" : "No stake placed";
    }

    const view = makeElement("button", "secondary-button", market.status === "open" ? "View & bet" : "View details");
    view.type = "button";
    view.addEventListener("click", () => openMarket(market.id));
    footer.append(position, view);

    card.append(header, description, renderPoolBar(market), meta, footer);
    return card;
}

function renderMarkets() {
    predictionGrid.replaceChildren();
    const markets = predictionState?.markets ?? [];

    if (!markets.length) {
        predictionGrid.append(makeElement("article", "panel prediction-empty", "No prediction markets match this filter."));
        return;
    }

    for (const market of markets) predictionGrid.append(createMarketCard(market));
}

function updateAdminBanner() {
    const waiting = (predictionState?.markets ?? []).filter(
        (market) => market.status === "awaiting_review"
    ).length;

    predictionAdminBanner.classList.toggle("hidden", !predictionState?.is_admin);
    predictionReviewCount.textContent = waiting
        ? `${waiting} market${waiting === 1 ? "" : "s"} waiting in this view`
        : "Open the admin review queue";
}

async function loadMarkets({ quiet = false } = {}) {
    if (predictionBusy) return;
    predictionBusy = true;
    predictionRefreshButton.disabled = true;
    if (!quiet) setMessage("Loading prediction markets…");

    try {
        const { data, error } = await window.supabaseClient.rpc(
            "get_prediction_markets",
            { p_filter: predictionFilter }
        );
        if (error) throw error;

        predictionState = data;
        predictionWallet.textContent = formatChips(data.wallet_chips);
        predictionListTitle.textContent = filterTitles[predictionFilter];
        predictionLastUpdated.textContent = `Updated ${new Intl.DateTimeFormat("en-AU", { timeStyle: "short" }).format(new Date())}`;
        renderMarkets();
        updateAdminBanner();
        if (!quiet) setMessage("");
    } catch (error) {
        setMessage(errorText(error), "error");
        predictionGrid.replaceChildren(makeElement("article", "panel prediction-empty", "Prediction markets could not be loaded."));
    } finally {
        predictionBusy = false;
        predictionRefreshButton.disabled = false;
    }
}

function setFilter(filter) {
    predictionFilter = filter;
    document.querySelectorAll(".filter-button").forEach((button) => {
        button.classList.toggle("active", button.dataset.filter === filter);
    });
    loadMarkets();
}

function createDetailHeader(market) {
    const header = makeElement("header", "detail-header");
    const status = makeElement("span", `market-status ${market.status}`, statusLabels[market.status] || market.status);
    const title = makeElement("h2", "", market.title);
    const description = makeElement("p", "detail-description", market.description);
    const meta = makeElement("div", "market-meta-row");
    meta.append(
        makeElement("span", "", `Created by ${market.creator_username}`),
        makeElement("span", "", closingText(market)),
        makeElement("span", "", `${formatChips(market.total_pool)} chips in pool`)
    );
    header.append(status, title, description, meta);
    return header;
}

function createDetailPools(market) {
    const group = makeElement("div", "detail-pools");
    for (const side of ["yes", "no"]) {
        const card = makeElement("article", `detail-pool-card ${side}`);
        const amount = market[`total_${side}`];
        card.append(
            makeElement("span", "", side.toUpperCase()),
            makeElement("strong", "", `${poolPercent(amount, market.total_pool)}%`),
            makeElement("small", "", `${formatChips(amount)} chips backed`)
        );
        group.append(card);
    }
    return group;
}

function createPositionSection(positions) {
    const section = makeElement("section", "detail-section");
    section.append(makeElement("h3", "", `Positions (${positions.length})`));
    const list = makeElement("div", "position-list");

    if (!positions.length) {
        list.append(makeElement("p", "", "Nobody has placed a bet yet."));
    }

    for (const position of positions) {
        const row = makeElement("div", "position-row");
        row.append(
            makeElement("strong", "", position.username),
            makeElement("span", `side-label ${position.outcome}`, position.outcome.toUpperCase()),
            makeElement("span", "position-payout", position.payout > 0
                ? `${formatChips(position.amount)} → ${formatChips(position.payout)}`
                : `${formatChips(position.amount)} chips`)
        );
        list.append(row);
    }
    section.append(list);
    return section;
}

function createVoteSection(votes) {
    const section = makeElement("section", "detail-section");
    section.append(makeElement("h3", "", `Participant verification (${votes.length})`));
    const list = makeElement("div", "verification-list");

    if (!votes.length) list.append(makeElement("p", "", "No participants have submitted a result yet."));

    for (const vote of votes) {
        const row = makeElement("div", "verification-row");
        const copy = makeElement("div", "verification-copy");
        copy.append(makeElement("strong", "", vote.username));
        if (vote.comment) copy.append(makeElement("span", "", vote.comment));
        if (vote.evidence_url) {
            const link = makeElement("a", "", "Open evidence source");
            link.href = vote.evidence_url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            copy.append(link);
        }
        copy.append(makeElement("small", "", formatDate(vote.updated_at)));
        row.append(copy, makeElement("span", `side-label ${vote.outcome}`, vote.outcome.toUpperCase()));
        list.append(row);
    }
    section.append(list);
    return section;
}

function currentSummary() {
    return (predictionState?.markets ?? []).find((market) => market.id === selectedMarketId) ?? null;
}

function createBetForm(market) {
    const summary = currentSummary();
    const form = makeElement("form", "detail-form");
    const heading = makeElement("h3", "", summary?.my_amount ? "Add to your position" : "Place a bet");
    const grid = makeElement("div", "detail-form-grid");

    const sideLabel = makeElement("label", "", "Outcome");
    const side = document.createElement("select");
    side.name = "outcome";
    for (const value of ["yes", "no"]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value.toUpperCase();
        side.append(option);
    }
    if (summary?.my_outcome) {
        side.value = summary.my_outcome;
        side.disabled = true;
    }
    sideLabel.append(side);

    const amountLabel = makeElement("label", "", "Stake (chips)");
    const amount = document.createElement("input");
    amount.name = "amount";
    amount.type = "number";
    amount.min = "1";
    amount.step = "1";
    amount.max = String(predictionState.wallet_chips ?? 0);
    amount.required = true;
    amount.placeholder = "100";
    amountLabel.append(amount);
    grid.append(sideLabel, amountLabel);

    const button = makeElement("button", "", summary?.my_amount ? "Add stake" : "Back this outcome");
    button.type = "submit";
    form.append(heading, grid, button);
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        button.disabled = true;
        try {
            const { error } = await window.supabaseClient.rpc("place_prediction_market_bet", {
                p_market_id: market.id,
                p_outcome: side.value,
                p_amount: Number(amount.value)
            });
            if (error) throw error;
            setMessage("Your prediction market stake was placed.", "success");
            await reloadSelectedMarket();
        } catch (error) {
            setMessage(errorText(error), "error");
            button.disabled = false;
        }
    });
    return form;
}

function createVoteForm(market, votes) {
    const summary = currentSummary();
    const form = makeElement("form", "detail-form");
    form.append(makeElement("h3", "", summary?.my_vote ? "Update your verification" : "Verify the outcome"));

    const tally = makeElement("div", "vote-tally");
    for (const outcome of ["yes", "no", "unclear"]) {
        const count = votes.filter((vote) => vote.outcome === outcome).length;
        tally.append(makeElement("span", `side-label ${outcome}`, `${outcome.toUpperCase()} ${count}`));
    }

    const grid = makeElement("div", "detail-form-grid");
    const outcomeLabel = makeElement("label", "", "Your result");
    const outcome = document.createElement("select");
    for (const value of ["yes", "no", "unclear"]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value.toUpperCase();
        outcome.append(option);
    }
    outcome.value = summary?.my_vote || "yes";
    outcomeLabel.append(outcome);

    const linkLabel = makeElement("label", "", "Evidence link (optional)");
    const link = document.createElement("input");
    link.type = "url";
    link.maxLength = 1000;
    link.placeholder = "https://…";
    link.value = summary?.my_evidence_url || "";
    linkLabel.append(link);
    grid.append(outcomeLabel, linkLabel);

    const commentLabel = makeElement("label", "", "Comment (optional)");
    const comment = document.createElement("textarea");
    comment.rows = 3;
    comment.maxLength = 1000;
    comment.placeholder = "Explain how the result meets the market rules.";
    comment.value = summary?.my_vote_comment || "";
    commentLabel.append(comment);

    const button = makeElement("button", "", "Submit verification");
    button.type = "submit";
    form.append(tally, grid, commentLabel, button);
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        button.disabled = true;
        try {
            const { error } = await window.supabaseClient.rpc("vote_prediction_market_outcome", {
                p_market_id: market.id,
                p_outcome: outcome.value,
                p_evidence_url: link.value.trim() || null,
                p_comment: comment.value.trim() || null
            });
            if (error) throw error;
            setMessage("Your outcome verification was saved.", "success");
            await reloadSelectedMarket();
        } catch (error) {
            setMessage(errorText(error), "error");
            button.disabled = false;
        }
    });
    return form;
}

function createAdminPanel(market) {
    const panel = makeElement("section", "admin-resolution-panel");
    panel.append(makeElement("h3", "", "Administrator settlement"));
    panel.append(makeElement("p", "", market.status === "open"
        ? "You may refund this market early if its rules are invalid. Final outcomes cannot be chosen until betting closes."
        : "Review the rules, participant votes and evidence before settling."));

    const noteLabel = makeElement("label", "", "Decision note");
    const note = document.createElement("textarea");
    note.rows = 3;
    note.maxLength = 2000;
    note.placeholder = "Explain the source or reason for the decision.";
    noteLabel.append(note);

    const actions = makeElement("div", "detail-actions");
    if (market.status === "awaiting_review") {
        for (const outcome of ["yes", "no"]) {
            const button = makeElement("button", `${outcome}-action`, `Resolve ${outcome.toUpperCase()}`);
            button.type = "button";
            button.addEventListener("click", () => settleMarket("resolve", outcome, note.value, button));
            actions.append(button);
        }
    }
    const refund = makeElement("button", "refund-action", "Refund all bets");
    refund.type = "button";
    refund.addEventListener("click", () => settleMarket("refund", null, note.value, refund));
    actions.append(refund);

    panel.append(noteLabel, actions);
    return panel;
}

async function settleMarket(action, outcome, note, button) {
    const normalizedNote = note.trim();
    if (action === "refund" && normalizedNote.length < 5) {
        setMessage("Add a short reason before refunding the market.", "error");
        return;
    }
    const wording = action === "refund"
        ? "refund every stake"
        : `resolve this market as ${outcome.toUpperCase()}`;
    if (!window.confirm(`Are you sure you want to ${wording}? This cannot be undone.`)) return;

    button.disabled = true;
    try {
        const rpc = action === "refund"
            ? window.supabaseClient.rpc("admin_refund_prediction_market", {
                p_market_id: selectedMarketId,
                p_note: normalizedNote
            })
            : window.supabaseClient.rpc("admin_resolve_prediction_market", {
                p_market_id: selectedMarketId,
                p_outcome: outcome,
                p_note: normalizedNote || null
            });
        const { error } = await rpc;
        if (error) throw error;
        setMessage(action === "refund" ? "Every stake was refunded." : `Market resolved as ${outcome.toUpperCase()}.`, "success");
        await reloadSelectedMarket();
    } catch (error) {
        setMessage(errorText(error), "error");
        button.disabled = false;
    }
}

function renderMarketDetail(detail) {
    const market = detail.market;
    const fragment = document.createDocumentFragment();
    fragment.append(createDetailHeader(market), createDetailPools(market));

    const columns = makeElement("div", "detail-columns");
    columns.append(createPositionSection(detail.positions), createVoteSection(detail.votes));
    fragment.append(columns);

    const summary = currentSummary();
    if (market.status === "open") fragment.append(createBetForm(market));
    if (market.status === "awaiting_review" && summary?.my_amount) {
        fragment.append(createVoteForm(market, detail.votes));
    }
    if (detail.is_admin && ["open", "awaiting_review"].includes(market.status)) {
        fragment.append(createAdminPanel(market));
    }
    if (["resolved", "refunded"].includes(market.status)) {
        const result = market.status === "refunded"
            ? `All ${formatChips(market.total_pool)} chips were returned. ${market.admin_note || "The outcome was not clear enough to settle."}`
            : `Final outcome: ${market.final_outcome.toUpperCase()}. ${formatChips(market.total_pool)} chips were distributed proportionally to the winners.${market.admin_note ? ` ${market.admin_note}` : ""}`;
        fragment.append(makeElement("div", "settlement-result", result));
    }

    predictionDialogContent.replaceChildren(fragment);
}

async function fetchMarketDetail(marketId) {
    const { data, error } = await window.supabaseClient.rpc(
        "get_prediction_market_detail",
        { p_market_id: marketId }
    );
    if (error) throw error;
    predictionWallet.textContent = formatChips(data.wallet_chips);
    return data;
}

async function openMarket(marketId) {
    selectedMarketId = marketId;
    predictionDialogContent.replaceChildren(makeElement("p", "prediction-empty", "Loading market details…"));
    if (!predictionDialog.open) predictionDialog.showModal();
    try {
        renderMarketDetail(await fetchMarketDetail(marketId));
    } catch (error) {
        predictionDialogContent.replaceChildren(makeElement("p", "prediction-empty", errorText(error)));
    }
}

async function reloadSelectedMarket() {
    predictionBusy = false;
    await loadMarkets({ quiet: true });
    if (selectedMarketId) await openMarket(selectedMarketId);
}

function setDefaultCloseTime() {
    const input = document.querySelector("#prediction-closes-at");
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const offset = date.getTimezoneOffset() * 60000;
    input.value = new Date(date.getTime() - offset).toISOString().slice(0, 16);
    const minimum = new Date(Date.now() + 10 * 60 * 1000);
    input.min = new Date(minimum.getTime() - minimum.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

async function createMarket(event) {
    event.preventDefault();
    predictionCreateSubmit.disabled = true;
    try {
        const closesAt = new Date(document.querySelector("#prediction-closes-at").value);
        if (Number.isNaN(closesAt.getTime())) throw new Error("Choose a valid closing time.");
        const { data, error } = await window.supabaseClient.rpc("create_prediction_market", {
            p_title: document.querySelector("#prediction-title").value.trim(),
            p_description: document.querySelector("#prediction-description").value.trim(),
            p_closes_at: closesAt.toISOString()
        });
        if (error) throw error;
        predictionCreateForm.reset();
        setDefaultCloseTime();
        predictionCreatePanel.classList.add("hidden");
        setMessage("Prediction market published.", "success");
        predictionFilter = "all";
        await loadMarkets({ quiet: true });
        await openMarket(data);
    } catch (error) {
        setMessage(errorText(error), "error");
    } finally {
        predictionCreateSubmit.disabled = false;
    }
}

async function initializePredictionMarkets() {
    const { data, error } = await window.supabaseClient.auth.getUser();
    if (error || !data.user) {
        window.location.href = "login.html";
        return;
    }
    predictionUser = data.user;
    setDefaultCloseTime();
    await loadMarkets();
    predictionRefreshTimer = window.setInterval(() => loadMarkets({ quiet: true }), 30000);
}

document.querySelectorAll(".filter-button").forEach((button) => {
    button.addEventListener("click", () => setFilter(button.dataset.filter));
});

predictionRefreshButton.addEventListener("click", () => loadMarkets());
predictionReviewButton.addEventListener("click", () => setFilter("awaiting_review"));
predictionCreateToggle.addEventListener("click", () => {
    predictionCreatePanel.classList.toggle("hidden");
    if (!predictionCreatePanel.classList.contains("hidden")) {
        document.querySelector("#prediction-title").focus();
    }
});
predictionCreateClose.addEventListener("click", () => predictionCreatePanel.classList.add("hidden"));
predictionCreateForm.addEventListener("submit", createMarket);
predictionDialogClose.addEventListener("click", () => predictionDialog.close());
predictionDialog.addEventListener("click", (event) => {
    if (event.target === predictionDialog) predictionDialog.close();
});
predictionDialog.addEventListener("close", () => {
    selectedMarketId = null;
    predictionDialogContent.replaceChildren();
});
window.addEventListener("beforeunload", () => window.clearInterval(predictionRefreshTimer));

initializePredictionMarkets().catch((error) => setMessage(errorText(error), "error"));
