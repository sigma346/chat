
const clubsMessage = document.querySelector("#clubs-message");
const clubDetailPanel = document.querySelector("#club-detail-panel");
const clubCreatePanel = document.querySelector("#club-create-panel");

const clubDetailTag = document.querySelector("#club-detail-tag");
const clubDetailName = document.querySelector("#club-detail-name");
const clubDetailDescription = document.querySelector(
    "#club-detail-description"
);
const clubDetailLevel = document.querySelector("#club-detail-level");
const clubDetailPoints = document.querySelector("#club-detail-points");
const clubDetailXp = document.querySelector("#club-detail-xp");
const clubDetailMembers = document.querySelector("#club-detail-members");
const clubLevelProgressValue = document.querySelector(
    "#club-level-progress-value"
);
const clubXpFill = document.querySelector("#club-xp-fill");

const clubJoinButton = document.querySelector("#club-join-button");
const clubCancelRequestButton = document.querySelector(
    "#club-cancel-request-button"
);
const clubLeaveButton = document.querySelector("#club-leave-button");

const clubMemberList = document.querySelector("#club-member-list");
const clubActivityList = document.querySelector("#club-activity-list");
const clubRequestList = document.querySelector("#club-request-list");
const clubRequestsSection = document.querySelector(
    "#club-requests-section"
);
const clubSettingsSection = document.querySelector(
    "#club-settings-section"
);

const clubCreateForm = document.querySelector("#club-create-form");
const clubCreateName = document.querySelector("#club-create-name");
const clubCreateTag = document.querySelector("#club-create-tag");
const clubCreateDescription = document.querySelector(
    "#club-create-description"
);
const clubCreatePolicy = document.querySelector(
    "#club-create-policy"
);

const clubSettingsForm = document.querySelector("#club-settings-form");
const clubSettingsName = document.querySelector("#club-settings-name");
const clubSettingsTag = document.querySelector("#club-settings-tag");
const clubSettingsDescription = document.querySelector(
    "#club-settings-description"
);
const clubSettingsPolicy = document.querySelector(
    "#club-settings-policy"
);
const clubDisbandButton = document.querySelector("#club-disband-button");

const clubSearchForm = document.querySelector("#club-search-form");
const clubSearchInput = document.querySelector("#club-search-input");
const clubDirectoryList = document.querySelector(
    "#club-directory-list"
);
const clubLeaderboardBody = document.querySelector(
    "#club-leaderboard-body"
);
const clubRefreshButton = document.querySelector(
    "#club-refresh-button"
);

let currentUser = null;
let ownClubId = null;
let viewedClubId = null;
let currentClubState = null;
let realtimeChannel = null;
let refreshTimer = null;

function formatNumber(value) {
    return new Intl.NumberFormat("en-AU").format(
        Number(value ?? 0)
    );
}

function formatDate(value) {
    return new Intl.DateTimeFormat("en-AU", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date(value));
}

function initials(username) {
    return String(username ?? "?")
        .split(/[\s_-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("")
        || "?";
}

function levelStartXp(level) {
    const adjusted = Math.max(Number(level) - 1, 0);
    return 500 * adjusted * adjusted;
}

function setMessage(message = "", type = "error") {
    clubsMessage.textContent = message;
    clubsMessage.className =
        `form-message ${message ? type : ""}`.trim();
}

async function rpc(functionName, parameters = {}) {
    const result = await window.supabaseClient.rpc(
        functionName,
        parameters
    );

    if (result.error) {
        throw result.error;
    }

    return result.data;
}

function setButtonBusy(button, busy) {
    button.disabled = busy;
}

function profileLink(userId, username) {
    const link = document.createElement("a");
    link.className = "club-member-name";
    link.href = `profile.html?id=${encodeURIComponent(userId)}`;
    link.textContent = username;
    return link;
}

function sourceLabel(sourceType) {
    const labels = {
        poker_hand: "Texas Hold’em",
        five_card_draw_hand: "Five-Card Draw",
        blackjack_round: "Blackjack",
        hearts_game: "Hearts",
        solitaire_klondike: "Klondike",
        solitaire_spider: "Spider",
        plinko_drop: "Plinko",
        penguin_cross: "Penguin Cross",
        horse_race: "Horse Racing",
        community_roulette: "Community Roulette"
    };

    return labels[sourceType] ?? sourceType;
}

function renderMembers(members, viewer) {
    clubMemberList.replaceChildren();

    if (!members.length) {
        clubMemberList.innerHTML =
            '<p class="club-empty">No members.</p>';
        return;
    }

    for (const member of members) {
        const card = document.createElement("article");
        card.className = "club-member";

        const main = document.createElement("div");
        main.className = "club-member-main";

        const avatar = document.createElement("span");
        avatar.className = "club-member-avatar";
        avatar.textContent = initials(member.username);

        const copy = document.createElement("div");
        copy.className = "club-member-copy";

        const nameRow = document.createElement("div");
        nameRow.className = "club-member-main";

        const link = profileLink(
            member.user_id,
            member.username
        );

        const role = document.createElement("span");
        role.className = "club-role";
        role.textContent = member.is_admin
            ? `${member.role} · admin`
            : member.role;

        nameRow.append(link, role);

        const meta = document.createElement("div");
        meta.className = "club-member-meta";
        meta.innerHTML = `
            <span>Lv. ${formatNumber(member.level)}</span>
            <span>${formatNumber(member.contributed_points)} points</span>
            <span>${formatNumber(member.contributed_xp)} XP</span>
        `;

        copy.append(nameRow, meta);
        main.append(avatar, copy);

        const actions = document.createElement("div");
        actions.className = "club-member-actions";

        const isSelf = member.user_id === currentUser.id;

        if (
            viewer.is_owner
            && !isSelf
            && member.role !== "owner"
        ) {
            const roleButton = document.createElement("button");
            roleButton.type = "button";
            roleButton.className = "secondary-button";
            roleButton.textContent = member.role === "officer"
                ? "Demote"
                : "Promote";
            roleButton.dataset.action = "role";
            roleButton.dataset.userId = member.user_id;
            roleButton.dataset.role = member.role === "officer"
                ? "member"
                : "officer";
            actions.append(roleButton);

            const transferButton = document.createElement("button");
            transferButton.type = "button";
            transferButton.className = "secondary-button";
            transferButton.textContent = "Make owner";
            transferButton.dataset.action = "transfer";
            transferButton.dataset.userId = member.user_id;
            actions.append(transferButton);
        }

        const viewerCanRemove =
            !isSelf
            && member.role !== "owner"
            && (
                viewer.is_owner
                || (
                    viewer.is_manager
                    && member.role === "member"
                )
            );

        if (viewerCanRemove) {
            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.className = "danger-button";
            removeButton.textContent = "Remove";
            removeButton.dataset.action = "remove";
            removeButton.dataset.userId = member.user_id;
            actions.append(removeButton);
        }

        card.append(main, actions);
        clubMemberList.append(card);
    }
}

function renderActivity(items) {
    clubActivityList.replaceChildren();

    if (!items.length) {
        clubActivityList.innerHTML = `
            <p class="club-empty">
                No club contributions yet. Someone must first achieve the
                apparently radical act of making a profit.
            </p>
        `;
        return;
    }

    for (const item of items) {
        const card = document.createElement("article");
        card.className = "club-activity";

        const copy = document.createElement("div");
        const link = profileLink(item.user_id, item.username);
        const meta = document.createElement("div");
        meta.className = "club-activity-meta";
        meta.innerHTML = `
            <span>${sourceLabel(item.source_type)}</span>
            <span>+${formatNumber(item.net_profit)} profit</span>
            <span>${formatDate(item.created_at)}</span>
        `;
        copy.append(link, meta);

        const reward = document.createElement("div");
        reward.className = "club-activity-reward";
        reward.innerHTML = `
            +${formatNumber(item.points_awarded)} points<br>
            +${formatNumber(item.xp_awarded)} XP
        `;

        card.append(copy, reward);
        clubActivityList.append(card);
    }
}

function renderRequests(requests) {
    clubRequestList.replaceChildren();

    if (!requests.length) {
        clubRequestList.innerHTML =
            '<p class="club-empty">No pending requests.</p>';
        return;
    }

    for (const request of requests) {
        const row = document.createElement("article");
        row.className = "club-request";

        const copy = document.createElement("div");
        copy.append(
            profileLink(request.user_id, request.username)
        );

        const meta = document.createElement("div");
        meta.className = "club-request-meta";
        meta.innerHTML = `
            <span>Lv. ${formatNumber(request.level)}</span>
            <span>${formatDate(request.created_at)}</span>
        `;
        copy.append(meta);

        const actions = document.createElement("div");
        actions.className = "club-request-actions";

        for (const [label, accept] of [
            ["Accept", true],
            ["Decline", false]
        ]) {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = label;
            button.className = accept
                ? ""
                : "secondary-button";
            button.dataset.action = "request";
            button.dataset.userId = request.user_id;
            button.dataset.accept = String(accept);
            actions.append(button);
        }

        row.append(copy, actions);
        clubRequestList.append(row);
    }
}

function renderClubState(state) {
    currentClubState = state;

    if (!state?.club) {
        clubDetailPanel.classList.add("hidden");
        return;
    }

    const { club, viewer } = state;
    viewedClubId = club.id;

    clubDetailPanel.classList.remove("hidden");
    clubDetailTag.textContent = club.tag;
    clubDetailName.textContent = club.name;
    clubDetailDescription.textContent =
        club.description || "No club description.";
    clubDetailLevel.textContent = formatNumber(club.level);
    clubDetailPoints.textContent = formatNumber(club.points);
    clubDetailXp.textContent = formatNumber(club.xp);
    clubDetailMembers.textContent =
        `${formatNumber(club.member_count)} / ${formatNumber(club.member_limit)}`;

    const currentStart = levelStartXp(club.level);
    const nextStart = levelStartXp(club.level + 1);
    const gained = Math.max(Number(club.xp) - currentStart, 0);
    const needed = Math.max(nextStart - currentStart, 1);
    const percentage = Math.min(
        Math.max((gained / needed) * 100, 0),
        100
    );

    clubLevelProgressValue.textContent =
        `${formatNumber(gained)} / ${formatNumber(needed)} XP`;
    clubXpFill.style.width = `${percentage}%`;

    clubJoinButton.classList.toggle(
        "hidden",
        viewer.is_member || viewer.request_pending
    );
    clubCancelRequestButton.classList.toggle(
        "hidden",
        !viewer.request_pending
    );
    clubLeaveButton.classList.toggle(
        "hidden",
        !viewer.is_member
    );

    clubJoinButton.textContent = club.join_policy === "open"
        ? "Join club"
        : "Request to join";

    clubCreatePanel.classList.toggle(
        "hidden",
        Boolean(ownClubId)
    );

    clubRequestsSection.classList.toggle(
        "hidden",
        !viewer.is_manager
    );
    clubSettingsSection.classList.toggle(
        "hidden",
        !viewer.is_manager
    );
    clubDisbandButton.classList.toggle(
        "hidden",
        !viewer.is_owner
    );

    clubSettingsName.value = club.name;
    clubSettingsTag.value = club.tag;
    clubSettingsDescription.value = club.description ?? "";
    clubSettingsPolicy.value = club.join_policy;

    renderMembers(state.members ?? [], viewer);
    renderActivity(state.recent_progress ?? []);
    renderRequests(state.requests ?? []);
}

async function loadClubState(clubId = null) {
    const state = await rpc("get_club_state", {
        p_club_id: clubId
    });

    renderClubState(state);
}

function directoryButton(row) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.clubId = row.club_id;

    if (row.viewer_is_member) {
        button.textContent = "Open";
        button.dataset.action = "open";
        return button;
    }

    if (ownClubId) {
        button.textContent = "View";
        button.dataset.action = "open";
        button.className = "secondary-button";
        return button;
    }

    if (row.request_pending) {
        button.textContent = "Requested";
        button.dataset.action = "open";
        button.className = "secondary-button";
        return button;
    }

    button.textContent = row.join_policy === "open"
        ? "Join"
        : "Request";
    button.dataset.action = "join";
    return button;
}

function renderDirectory(rows) {
    clubDirectoryList.replaceChildren();

    if (!rows.length) {
        clubDirectoryList.innerHTML =
            '<p class="club-empty">No clubs matched that search.</p>';
        return;
    }

    for (const row of rows) {
        const card = document.createElement("article");
        card.className = "club-directory-card";

        const copy = document.createElement("div");

        const heading = document.createElement("div");
        heading.className = "club-directory-heading";

        const tag = document.createElement("span");
        tag.className = "club-tag";
        tag.textContent = row.club_tag;

        const link = document.createElement("a");
        link.className = "club-directory-name";
        link.href = `clubs.html?id=${encodeURIComponent(row.club_id)}`;
        link.textContent = row.club_name;

        heading.append(tag, link);

        const description = document.createElement("p");
        description.className = "club-directory-description";
        description.textContent =
            row.description || "No club description.";

        const meta = document.createElement("div");
        meta.className = "club-directory-meta";
        meta.innerHTML = `
            <span>Lv. ${formatNumber(row.level)}</span>
            <span>${formatNumber(row.member_count)} / ${formatNumber(row.member_limit)} members</span>
            <span>${formatNumber(row.points)} points</span>
            <span>${row.join_policy === "open" ? "Open" : "Approval"}</span>
        `;

        copy.append(heading, description, meta);
        card.append(copy, directoryButton(row));
        clubDirectoryList.append(card);
    }
}

async function loadDirectory() {
    const rows = await rpc("get_club_directory", {
        p_search: clubSearchInput.value.trim() || null,
        p_limit: 50
    });

    renderDirectory(rows ?? []);
}

function renderLeaderboard(rows) {
    clubLeaderboardBody.replaceChildren();

    if (!rows.length) {
        const row = document.createElement("tr");
        row.innerHTML =
            '<td colspan="5">No clubs have been created yet.</td>';
        clubLeaderboardBody.append(row);
        return;
    }

    for (const club of rows) {
        const row = document.createElement("tr");

        const clubCell = document.createElement("td");
        const link = document.createElement("a");
        link.className = "club-directory-name";
        link.href = `clubs.html?id=${encodeURIComponent(club.club_id)}`;
        link.textContent = `[${club.club_tag}] ${club.club_name}`;
        clubCell.append(link);

        row.innerHTML = `
            <td>${formatNumber(club.rank)}</td>
        `;
        row.append(clubCell);

        for (const value of [
            club.level,
            club.member_count,
            formatNumber(club.points)
        ]) {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.append(cell);
        }

        clubLeaderboardBody.append(row);
    }
}

async function loadLeaderboard() {
    const rows = await rpc("get_club_leaderboard", {
        p_limit: 50
    });

    renderLeaderboard(rows ?? []);
}

async function refreshPage() {
    try {
        setMessage();

        ownClubId = await rpc("get_my_club_id");

        const queryClubId = new URLSearchParams(
            window.location.search
        ).get("id");

        const targetClubId = queryClubId || ownClubId;

        clubCreatePanel.classList.toggle(
            "hidden",
            Boolean(ownClubId)
        );

        if (targetClubId) {
            await loadClubState(targetClubId);
        } else {
            clubDetailPanel.classList.add("hidden");
        }

        await Promise.all([
            loadDirectory(),
            loadLeaderboard()
        ]);
    } catch (error) {
        console.error(error);
        setMessage(
            error.message || "The clubs page could not be loaded."
        );
    }
}

clubCreateTag.addEventListener("input", () => {
    clubCreateTag.value = clubCreateTag.value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 5);
});

clubSettingsTag.addEventListener("input", () => {
    clubSettingsTag.value = clubSettingsTag.value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 5);
});

clubCreateForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = clubCreateForm.querySelector(
        'button[type="submit"]'
    );
    setButtonBusy(submitButton, true);

    try {
        const clubId = await rpc("create_club", {
            p_name: clubCreateName.value.trim(),
            p_tag: clubCreateTag.value.trim(),
            p_description: clubCreateDescription.value.trim(),
            p_join_policy: clubCreatePolicy.value
        });

        window.location.href =
            `clubs.html?id=${encodeURIComponent(clubId)}`;
    } catch (error) {
        setMessage(error.message);
    } finally {
        setButtonBusy(submitButton, false);
    }
});

clubSettingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = clubSettingsForm.querySelector(
        'button[type="submit"]'
    );
    setButtonBusy(submitButton, true);

    try {
        await rpc("update_club", {
            p_club_id: viewedClubId,
            p_name: clubSettingsName.value.trim(),
            p_tag: clubSettingsTag.value.trim(),
            p_description:
                clubSettingsDescription.value.trim(),
            p_join_policy: clubSettingsPolicy.value
        });

        setMessage("Club settings saved.", "success");
        await refreshPage();
    } catch (error) {
        setMessage(error.message);
    } finally {
        setButtonBusy(submitButton, false);
    }
});

clubSearchForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
        await loadDirectory();
    } catch (error) {
        setMessage(error.message);
    }
});

clubJoinButton.addEventListener("click", async () => {
    setButtonBusy(clubJoinButton, true);

    try {
        const result = await rpc("join_club", {
            p_club_id: viewedClubId
        });

        setMessage(
            result?.state === "joined"
                ? "You joined the club."
                : "Join request sent.",
            "success"
        );

        await refreshPage();
    } catch (error) {
        setMessage(error.message);
    } finally {
        setButtonBusy(clubJoinButton, false);
    }
});

clubCancelRequestButton.addEventListener("click", async () => {
    setButtonBusy(clubCancelRequestButton, true);

    try {
        await rpc("cancel_club_join_request", {
            p_club_id: viewedClubId
        });
        setMessage("Join request cancelled.", "success");
        await refreshPage();
    } catch (error) {
        setMessage(error.message);
    } finally {
        setButtonBusy(clubCancelRequestButton, false);
    }
});

clubLeaveButton.addEventListener("click", async () => {
    const owner = currentClubState?.viewer?.is_owner;
    const message = owner
        ? "Leave and delete this one-member club?"
        : "Leave this club?";

    if (!window.confirm(message)) {
        return;
    }

    setButtonBusy(clubLeaveButton, true);

    try {
        await rpc("leave_club");
        window.location.href = "clubs.html";
    } catch (error) {
        setMessage(error.message);
    } finally {
        setButtonBusy(clubLeaveButton, false);
    }
});

clubDisbandButton.addEventListener("click", async () => {
    const clubName = currentClubState?.club?.name ?? "this club";

    if (
        !window.confirm(
            `Permanently disband ${clubName}? Club points and history will be deleted.`
        )
    ) {
        return;
    }

    setButtonBusy(clubDisbandButton, true);

    try {
        await rpc("disband_club");
        window.location.href = "clubs.html";
    } catch (error) {
        setMessage(error.message);
    } finally {
        setButtonBusy(clubDisbandButton, false);
    }
});

clubDirectoryList.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-club-id]");

    if (!button) {
        return;
    }

    const clubId = button.dataset.clubId;

    if (button.dataset.action === "open") {
        window.location.href =
            `clubs.html?id=${encodeURIComponent(clubId)}`;
        return;
    }

    setButtonBusy(button, true);

    try {
        await rpc("join_club", {
            p_club_id: clubId
        });
        window.location.href =
            `clubs.html?id=${encodeURIComponent(clubId)}`;
    } catch (error) {
        setMessage(error.message);
        setButtonBusy(button, false);
    }
});

clubRequestList.addEventListener("click", async (event) => {
    const button = event.target.closest(
        'button[data-action="request"]'
    );

    if (!button) {
        return;
    }

    setButtonBusy(button, true);

    try {
        await rpc("respond_to_club_join_request", {
            p_club_id: viewedClubId,
            p_user_id: button.dataset.userId,
            p_accept: button.dataset.accept === "true"
        });
        await refreshPage();
    } catch (error) {
        setMessage(error.message);
    } finally {
        setButtonBusy(button, false);
    }
});

clubMemberList.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");

    if (!button) {
        return;
    }

    const userId = button.dataset.userId;
    const action = button.dataset.action;

    if (
        action === "remove"
        && !window.confirm("Remove this player from the club?")
    ) {
        return;
    }

    if (
        action === "transfer"
        && !window.confirm(
            "Transfer club ownership to this player?"
        )
    ) {
        return;
    }

    setButtonBusy(button, true);

    try {
        if (action === "remove") {
            await rpc("remove_club_member", {
                p_user_id: userId
            });
        } else if (action === "role") {
            await rpc("set_club_member_role", {
                p_user_id: userId,
                p_role: button.dataset.role
            });
        } else if (action === "transfer") {
            await rpc("transfer_club_ownership", {
                p_user_id: userId
            });
        }

        await refreshPage();
    } catch (error) {
        setMessage(error.message);
    } finally {
        setButtonBusy(button, false);
    }
});

clubRefreshButton.addEventListener("click", refreshPage);

function subscribeToClubChanges() {
    realtimeChannel = window.supabaseClient
        .channel(`clubs-page-${currentUser.id}`)
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "clubs"
            },
            scheduleRefresh
        )
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "club_members"
            },
            scheduleRefresh
        )
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "club_join_requests"
            },
            scheduleRefresh
        )
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "club_progress_events"
            },
            scheduleRefresh
        )
        .subscribe();
}

function scheduleRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refreshPage, 350);
}

window.addEventListener("beforeunload", () => {
    window.clearTimeout(refreshTimer);

    if (realtimeChannel) {
        window.supabaseClient.removeChannel(realtimeChannel);
    }
});

async function initialiseClubs() {
    try {
        const {
            data: { user },
            error
        } = await window.supabaseClient.auth.getUser();

        if (error || !user) {
            window.location.href = "login.html";
            return;
        }

        currentUser = user;
        await refreshPage();
        subscribeToClubChanges();
    } catch (error) {
        console.error(error);
        setMessage(
            error.message || "The clubs page could not be loaded."
        );
    }
}

initialiseClubs();
