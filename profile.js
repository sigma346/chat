const profileHero = document.querySelector("#profile-hero");
const profileAvatarFrame = document.querySelector(
    "#profile-avatar-frame"
);
const profileAvatar = document.querySelector("#profile-avatar");
const profileBadge = document.querySelector("#profile-badge");
const profileUsername = document.querySelector("#profile-username");
const profileLevel = document.querySelector("#profile-level");
const profileAdminStatus = document.querySelector(
    "#profile-admin-status"
);
const profileTitle = document.querySelector("#profile-title");
const profileBio = document.querySelector("#profile-bio");
const profileChips = document.querySelector("#profile-chips");
const profileXp = document.querySelector("#profile-xp");
const profileFriendCount = document.querySelector(
    "#profile-friend-count"
);
const profileFriendActions = document.querySelector(
    "#profile-friend-actions"
);
const profileFriendSummary = document.querySelector(
    "#profile-friend-summary"
);
const profileFriendPrimaryButton = document.querySelector(
    "#profile-friend-primary-button"
);
const profileFriendSecondaryButton = document.querySelector(
    "#profile-friend-secondary-button"
);
const profileAudioCallButton = document.querySelector(
    "#profile-audio-call-button"
);
const profileVideoCallButton = document.querySelector(
    "#profile-video-call-button"
);
const profileFriendsLink = document.querySelector(
    "#profile-friends-link"
);
const profileMessage = document.querySelector("#profile-message");
const profileOwnerPanel = document.querySelector(
    "#profile-owner-panel"
);
const profileBioForm = document.querySelector("#profile-bio-form");
const profileBioInput = document.querySelector("#profile-bio-input");
const bioCharacterCount = document.querySelector(
    "#bio-character-count"
);
const saveProfileButton = document.querySelector(
    "#save-profile-button"
);
const shopWalletChips = document.querySelector("#shop-wallet-chips");
const cosmeticGrid = document.querySelector("#cosmetic-grid");
const profileOverallStatistics = document.querySelector(
    "#profile-overall-statistics"
);
const profileGameStatistics = document.querySelector(
    "#profile-game-statistics"
);
const statisticsFavouriteGame = document.querySelector(
    "#statistics-favourite-game"
);
const profileAchievementGroups = document.querySelector(
    "#profile-achievement-groups"
);
const achievementCount = document.querySelector(
    "#achievement-count"
);

const badgeSymbols = {
    badge_ace: "♠",
    badge_penguin: "🐧",
    badge_dice: "⚄",
    badge_crown: "♛",
    badge_admin_shield: "✒️",
    badge_first_steps: "★",
    badge_level_10: "✦",
    badge_level_50: "◆",
    badge_chip_vault: "◈",
    badge_hot_streak: "🔥",
    badge_poker_veteran: "♠",
    badge_big_pot: "●",
    badge_draw_veteran: "🂠",
    badge_twenty_one: "21",
    badge_blackjack_veteran: "♣",
    badge_hearts_winner: "♥",
    badge_klondike: "K",
    badge_spider: "🕷",
    badge_plinko_profit: "•",
    badge_ice_crossing: "❄",
    badge_horse_winner: "♞",
    badge_green_zero: "0",
    badge_daily_challenger: "✓",
    badge_easy_going: "★",
    badge_busy_day: "⚡",
    badge_handshake: "🤝",
    badge_club_founder: "⚑",
    badge_slot_spinner: "🎰",
    badge_rr_survivor: "☠",
    badge_first_trade: "↗",
    badge_bull_market: "▲"
};

const categoryNames = {
    theme: "Theme",
    frame: "Frame",
    title: "Title",
    badge: "Badge"
};

let currentUser = null;
let loadedProfile = null;
let cosmetics = [];
let selectedCategory = "theme";
let shopBusy = false;
let friendRelationship = null;
let friendActionBusy = false;
let friendshipProfileChannel = null;

function formatNumber(value) {
    return new Intl.NumberFormat("en-AU").format(
        Number(value ?? 0)
    );
}

function formatSignedChips(value) {
    const amount = Number(value ?? 0);
    const absolute = formatNumber(Math.abs(amount));

    if (amount > 0) {
        return `+${absolute} chips`;
    }

    if (amount < 0) {
        return `−${absolute} chips`;
    }

    return "0 chips";
}

function formatPercent(value) {
    return `${Number(value ?? 0).toFixed(1)}%`;
}

const gameLabels = {
    poker: "Texas Hold'em",
    five_card_draw: "Five-Card Draw",
    blackjack: "Blackjack",
    hearts: "Hearts",
    solitaire_klondike: "Klondike",
    solitaire_spider: "Spider",
    plinko: "Plinko",
    penguin_cross: "Penguin Cross",
    horse_racing: "Horse Racing",
    roulette: "Community Roulette"
};

function gameLabel(gameKey) {
    return gameLabels[gameKey] ?? "No completed games";
}

function initialsFromUsername(username) {
    const parts = String(username ?? "?")
        .replaceAll("_", " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!parts.length) {
        return "?";
    }

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return (
        parts[0][0]
        + parts[parts.length - 1][0]
    ).toUpperCase();
}

function setMessage(message = "", type = "") {
    profileMessage.textContent = message;
    profileMessage.className =
        `form-message profile-message ${type}`.trim();
}

function setBioCharacterCount() {
    bioCharacterCount.textContent =
        `${profileBioInput.value.length} / 160`;
}

function badgeSymbol(badgeId) {
    return badgeSymbols[badgeId] ?? "";
}

function renderPublicProfile(profile) {
    loadedProfile = profile;

    document.title = `${profile.username} · Player Profile`;

    profileHero.dataset.theme =
        profile.theme?.id ?? "theme_midnight";

    profileAvatarFrame.dataset.frame =
        profile.frame?.id ?? "frame_standard";

    profileAvatar.textContent =
        initialsFromUsername(profile.username);

    profileUsername.textContent = profile.username;
    profileLevel.textContent = `Lv. ${Number(profile.level ?? 1)}`;

    const isAdmin = profile.is_admin === true;
    profileHero.classList.toggle("admin-profile", isAdmin);
    profileAdminStatus.classList.toggle("hidden", !isAdmin);
    profileAdminStatus.textContent = isAdmin
        ? "Administrator"
        : "";

    profileChips.textContent = formatNumber(profile.chips);
    profileXp.textContent = formatNumber(profile.xp);

    const titleName = profile.title?.name ?? "";
    profileTitle.textContent = titleName;
    profileTitle.classList.toggle("hidden", !titleName);

    const badgeId = profile.badge?.id ?? "badge_none";
    const symbol = badgeSymbol(badgeId);

    profileBadge.textContent = symbol;
    profileBadge.title = profile.badge?.name ?? "";
    profileBadge.classList.toggle("hidden", !symbol);

    const bio = String(profile.bio ?? "").trim();
    profileBio.textContent = bio || "This player has not written a bio yet.";
    profileBio.classList.toggle("empty", !bio);

    profileOwnerPanel.classList.toggle(
        "hidden",
        !profile.is_self
    );

    if (profile.is_self) {
        profileBioInput.value = bio;
        shopWalletChips.textContent = formatNumber(profile.chips);
        setBioCharacterCount();
    }
}

function profileRequestParameters() {
    const parameters = new URLSearchParams(window.location.search);
    const requestedId = parameters.get("id");
    const requestedUsername = parameters.get("username");

    return {
        p_user_id: requestedId || null,
        p_username: requestedId
            ? null
            : requestedUsername || null
    };
}

async function loadPublicProfile() {
    const {
        data,
        error
    } = await window.supabaseClient.rpc(
        "get_public_player_profile",
        profileRequestParameters()
    );

    if (error) {
        throw error;
    }

    renderPublicProfile(data);
}


function renderFriendRelationship(data) {
    friendRelationship = data ?? {
        state: loadedProfile?.is_self ? "self" : "none",
        friend_count: 0,
        mutual_count: 0
    };

    profileFriendCount.textContent =
        formatNumber(friendRelationship.friend_count);

    profileFriendActions.classList.remove("hidden");
    profileFriendPrimaryButton.classList.add("hidden");
    profileFriendSecondaryButton.classList.add("hidden");
    profileAudioCallButton.classList.add("hidden");
    profileVideoCallButton.classList.add("hidden");
    profileFriendPrimaryButton.disabled = false;
    profileFriendSecondaryButton.disabled = false;
    profileFriendsLink.textContent = loadedProfile?.is_self
        ? "Manage friends"
        : "View friends";

    const mutualCount =
        Number(friendRelationship.mutual_count ?? 0);

    if (friendRelationship.state === "self") {
        profileFriendSummary.textContent =
            `${formatNumber(friendRelationship.friend_count)} friends`;
        return;
    }

    if (friendRelationship.state === "friends") {
        profileFriendSummary.textContent = mutualCount > 0
            ? `Friends · ${formatNumber(mutualCount)} mutual`
            : "Friends";

        profileFriendPrimaryButton.textContent = "Friends";
        profileFriendPrimaryButton.dataset.action = "none";
        profileFriendPrimaryButton.disabled = true;
        profileFriendPrimaryButton.classList.remove("hidden");

        profileFriendSecondaryButton.textContent = "Remove";
        profileFriendSecondaryButton.dataset.action = "remove";
        profileFriendSecondaryButton.classList.remove("hidden");

        for (const callButton of [
            profileAudioCallButton,
            profileVideoCallButton
        ]) {
            callButton.dataset.playerCallUser = loadedProfile.id;
            callButton.dataset.playerCallName = loadedProfile.username;
            callButton.classList.remove("hidden");
        }
        return;
    }

    if (friendRelationship.state === "incoming_pending") {
        profileFriendSummary.textContent = mutualCount > 0
            ? `Sent you a request · ${formatNumber(mutualCount)} mutual`
            : "Sent you a friend request";

        profileFriendPrimaryButton.textContent = "Accept";
        profileFriendPrimaryButton.dataset.action = "accept";
        profileFriendPrimaryButton.classList.remove("hidden");

        profileFriendSecondaryButton.textContent = "Decline";
        profileFriendSecondaryButton.dataset.action = "decline";
        profileFriendSecondaryButton.classList.remove("hidden");
        return;
    }

    if (friendRelationship.state === "outgoing_pending") {
        profileFriendSummary.textContent = mutualCount > 0
            ? `Request sent · ${formatNumber(mutualCount)} mutual`
            : "Friend request sent";

        profileFriendPrimaryButton.textContent = "Request sent";
        profileFriendPrimaryButton.dataset.action = "none";
        profileFriendPrimaryButton.disabled = true;
        profileFriendPrimaryButton.classList.remove("hidden");

        profileFriendSecondaryButton.textContent = "Cancel";
        profileFriendSecondaryButton.dataset.action = "cancel";
        profileFriendSecondaryButton.classList.remove("hidden");
        return;
    }

    profileFriendSummary.textContent = mutualCount > 0
        ? `${formatNumber(mutualCount)} mutual friends`
        : "Not friends yet";

    profileFriendPrimaryButton.textContent = "Add friend";
    profileFriendPrimaryButton.dataset.action = "send";
    profileFriendPrimaryButton.classList.remove("hidden");
}

async function loadFriendRelationship() {
    if (!loadedProfile?.id) {
        return;
    }

    const {
        data,
        error
    } = await window.supabaseClient.rpc(
        "get_friend_relationship",
        {
            p_user_id: loadedProfile.id
        }
    );

    if (error) {
        throw error;
    }

    renderFriendRelationship(data);
}

async function runProfileFriendAction(action) {
    if (
        friendActionBusy
        || !loadedProfile?.id
        || action === "none"
    ) {
        return;
    }

    friendActionBusy = true;
    profileFriendPrimaryButton.disabled = true;
    profileFriendSecondaryButton.disabled = true;
    setMessage();

    try {
        let result;

        if (action === "send") {
            result = await window.supabaseClient.rpc(
                "send_friend_request",
                {
                    p_target_user_id: loadedProfile.id
                }
            );
        } else if (
            action === "accept"
            || action === "decline"
        ) {
            result = await window.supabaseClient.rpc(
                "respond_to_friend_request",
                {
                    p_friendship_id:
                        friendRelationship.friendship_id,
                    p_accept: action === "accept"
                }
            );
        } else if (action === "cancel") {
            result = await window.supabaseClient.rpc(
                "cancel_friend_request",
                {
                    p_friendship_id:
                        friendRelationship.friendship_id
                }
            );
        } else if (action === "remove") {
            const confirmed = window.confirm(
                `Remove ${loadedProfile.username} from your friends?`
            );

            if (!confirmed) {
                return;
            }

            result = await window.supabaseClient.rpc(
                "remove_friend",
                {
                    p_friend_user_id: loadedProfile.id
                }
            );
        }

        if (result?.error) {
            throw result.error;
        }

        const messages = {
            send: "Friend request sent.",
            accept: "Friend request accepted.",
            decline: "Friend request declined.",
            cancel: "Friend request cancelled.",
            remove: "Friend removed."
        };

        setMessage(messages[action], "success");
        await loadFriendRelationship();
    } catch (error) {
        console.error(error);
        setMessage(
            error.message || "The friend action failed.",
            "error"
        );
    } finally {
        friendActionBusy = false;

        if (friendRelationship) {
            renderFriendRelationship(friendRelationship);
        }
    }
}

function subscribeToProfileFriendships() {
    if (
        !currentUser
        || friendshipProfileChannel
    ) {
        return;
    }

    friendshipProfileChannel =
        window.supabaseClient
            .channel(
                `profile-friendships-${currentUser.id}`
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "player_friendships"
                },
                () => {
                    loadFriendRelationship().catch(
                        (error) => {
                            console.warn(
                                "Friend relationship could not be refreshed:",
                                error
                            );
                        }
                    );
                }
            )
            .subscribe();
}

profileFriendPrimaryButton.addEventListener(
    "click",
    () => {
        runProfileFriendAction(
            profileFriendPrimaryButton.dataset.action
        );
    }
);

profileFriendSecondaryButton.addEventListener(
    "click",
    () => {
        runProfileFriendAction(
            profileFriendSecondaryButton.dataset.action
        );
    }
);

function statisticCard(label, value, detail = "") {
    const card = document.createElement("article");
    card.className = "profile-statistic-card";

    const labelElement = document.createElement("span");
    labelElement.textContent = label;

    const valueElement = document.createElement("strong");
    valueElement.textContent = value;

    card.append(labelElement, valueElement);

    if (detail) {
        const detailElement = document.createElement("small");
        detailElement.textContent = detail;
        card.append(detailElement);
    }

    return card;
}

function renderPlayerStatistics(data) {
    const overall = data?.overall ?? {};
    const games = Array.isArray(data?.games)
        ? data.games
        : [];

    statisticsFavouriteGame.textContent =
        `Favourite: ${gameLabel(overall.favourite_game)}`;

    profileOverallStatistics.replaceChildren(
        statisticCard(
            "Games completed",
            formatNumber(overall.games_completed)
        ),
        statisticCard(
            "Wins",
            formatNumber(overall.wins),
            `${formatPercent(overall.win_rate)} win rate`
        ),
        statisticCard(
            "Best win streak",
            formatNumber(overall.best_win_streak)
        ),
        statisticCard(
            "Lifetime profit",
            formatSignedChips(overall.lifetime_profit)
        ),
        statisticCard(
            "Biggest single win",
            formatSignedChips(overall.biggest_win)
        ),
        statisticCard(
            "Achievements",
            formatNumber(overall.achievements_unlocked),
            `${formatNumber(overall.cosmetics_owned)} cosmetics owned`
        ),
        statisticCard(
            "Chips donated",
            `${formatNumber(overall.donated_chips)} chips`
        ),
        statisticCard(
            "Chips received",
            `${formatNumber(overall.received_chips)} chips`
        ),
        statisticCard(
            "Chips gained",
            `${formatNumber(overall.chips_gained)} chips`,
            "All recorded wallet income"
        ),
        statisticCard(
            "Chips lost",
            `${formatNumber(overall.chips_lost)} chips`,
            "All recorded wallet spending"
        ),
        statisticCard(
            "Gained today",
            `${formatNumber(overall.chips_gained_today)} chips`,
            "Since midnight Brisbane time"
        ),
        statisticCard(
            "Lost today",
            `${formatNumber(overall.chips_lost_today)} chips`,
            "Since midnight Brisbane time"
        )
    );

    profileGameStatistics.replaceChildren();

    if (!games.length) {
        const empty = document.createElement("p");
        empty.className = "profile-data-loading";
        empty.textContent =
            "No completed competitive games have been recorded yet.";
        profileGameStatistics.append(empty);
        return;
    }

    for (const game of games) {
        const card = document.createElement("article");
        card.className = "profile-game-stat-card";

        const header = document.createElement("div");
        header.className = "profile-game-stat-header";

        const name = document.createElement("h4");
        name.textContent = game.label ?? gameLabel(game.key);

        const played = document.createElement("span");
        played.textContent = `${formatNumber(game.played)} played`;

        header.append(name, played);

        const metrics = document.createElement("div");
        metrics.className = "profile-game-stat-metrics";

        const winMetric = document.createElement("span");
        winMetric.innerHTML =
            `<strong>${formatNumber(game.wins)}</strong> wins`;

        const rateMetric = document.createElement("span");
        rateMetric.innerHTML =
            `<strong>${formatPercent(game.win_rate)}</strong> win rate`;

        const profitMetric = document.createElement("span");
        profitMetric.className =
            Number(game.profit ?? 0) > 0
                ? "positive"
                : Number(game.profit ?? 0) < 0
                    ? "negative"
                    : "neutral";
        profitMetric.innerHTML =
            `<strong>${formatSignedChips(game.profit)}</strong> profit`;

        metrics.append(winMetric, rateMetric, profitMetric);
        card.append(header, metrics);
        profileGameStatistics.append(card);
    }
}

function achievementRewardPreview(achievement) {
    const reward = achievement.reward ?? {};
    const category = reward.category ?? "title";
    const preview = document.createElement("span");

    preview.className =
        `achievement-reward-preview reward-${category}`;

    if (reward.id) {
        preview.dataset.cosmetic = reward.id;
    }

    if (category === "badge") {
        preview.textContent =
            badgeSymbol(reward.id) || "◆";
    } else if (category === "frame") {
        preview.textContent = "P";
        preview.dataset.frame = reward.id ?? "frame_standard";
    } else if (category === "theme") {
        preview.setAttribute(
            "aria-label",
            reward.name ?? "Profile theme"
        );
    } else {
        preview.textContent = "Aa";
    }

    preview.title = reward.name ?? "Cosmetic reward";
    return preview;
}

function renderPlayerAchievements(data) {
    const achievements = Array.isArray(data?.achievements)
        ? data.achievements
        : [];

    achievementCount.textContent =
        `${formatNumber(data?.unlocked_count)} / `
        + `${formatNumber(data?.total_count)} unlocked`;

    profileAchievementGroups.replaceChildren();

    if (!achievements.length) {
        const empty = document.createElement("p");
        empty.className = "profile-data-loading";
        empty.textContent = "No achievements are available.";
        profileAchievementGroups.append(empty);
        return;
    }

    const grouped = new Map();

    for (const achievement of achievements) {
        const category = achievement.category ?? "Other";

        if (!grouped.has(category)) {
            grouped.set(category, []);
        }

        grouped.get(category).push(achievement);
    }

    for (const [category, categoryAchievements] of grouped) {
        const section = document.createElement("section");
        section.className = "achievement-category";

        const heading = document.createElement("h3");
        heading.textContent = category;

        const grid = document.createElement("div");
        grid.className = "achievement-grid";

        for (const achievement of categoryAchievements) {
            const unlocked = achievement.unlocked === true;
            const progress = Number(achievement.progress ?? 0);
            const target = Math.max(
                Number(achievement.target ?? 1),
                1
            );
            const percentage = unlocked
                ? 100
                : Math.min(progress / target * 100, 100);

            const card = document.createElement("article");
            card.className = "achievement-card";
            card.classList.toggle("unlocked", unlocked);
            card.classList.toggle("locked", !unlocked);

            const icon = document.createElement("div");
            icon.className = "achievement-reward-icon";
            icon.append(achievementRewardPreview(achievement));

            const content = document.createElement("div");
            content.className = "achievement-card-content";

            const topRow = document.createElement("div");
            topRow.className = "achievement-card-heading";

            const name = document.createElement("h4");
            name.textContent = achievement.name;

            const status = document.createElement("span");
            status.className = "achievement-status";
            status.textContent = unlocked ? "Unlocked" : "Locked";

            topRow.append(name, status);

            const description = document.createElement("p");
            description.textContent = achievement.description;

            const reward = document.createElement("p");
            reward.className = "achievement-reward-name";
            reward.textContent =
                `Reward: ${achievement.reward?.name ?? "Cosmetic"}`;

            const progressRow = document.createElement("div");
            progressRow.className = "achievement-progress-row";

            const progressText = document.createElement("span");
            progressText.textContent = unlocked
                ? "Complete"
                : `${formatNumber(progress)} / ${formatNumber(target)}`;

            const track = document.createElement("span");
            track.className = "achievement-progress-track";

            const fill = document.createElement("span");
            fill.className = "achievement-progress-fill";
            fill.style.width = `${percentage}%`;

            track.append(fill);
            progressRow.append(progressText, track);

            content.append(
                topRow,
                description,
                reward,
                progressRow
            );

            card.append(icon, content);
            grid.append(card);
        }

        section.append(heading, grid);
        profileAchievementGroups.append(section);
    }
}

async function refreshAchievements() {
    const {
        error
    } = await window.supabaseClient.rpc(
        "refresh_my_achievements"
    );

    if (error) {
        throw error;
    }
}

async function loadPlayerStatistics() {
    const parameters = profileRequestParameters();
    const [statisticsResult, chipFlowResult] = await Promise.all([
        window.supabaseClient.rpc(
            "get_player_statistics",
            parameters
        ),
        window.supabaseClient.rpc(
            "get_player_chip_flow_statistics",
            parameters
        )
    ]);

    if (statisticsResult.error) {
        throw statisticsResult.error;
    }

    if (chipFlowResult.error) {
        throw chipFlowResult.error;
    }

    renderPlayerStatistics({
        ...statisticsResult.data,
        overall: {
            ...(statisticsResult.data?.overall ?? {}),
            ...(chipFlowResult.data ?? {})
        }
    });
}

async function loadPlayerAchievements() {
    const {
        data,
        error
    } = await window.supabaseClient.rpc(
        "get_player_achievements",
        profileRequestParameters()
    );

    if (error) {
        throw error;
    }

    renderPlayerAchievements(data);
}

function cosmeticPreview(cosmetic) {
    const preview = document.createElement("div");
    preview.className = "cosmetic-preview";
    preview.dataset.cosmetic = cosmetic.id;
    preview.dataset.category = cosmetic.category;

    if (cosmetic.category === "theme") {
        preview.classList.add("cosmetic-theme-preview");
        preview.textContent = "Aa";
    } else if (cosmetic.category === "frame") {
        const avatar = document.createElement("span");
        avatar.className = "cosmetic-mini-avatar";
        avatar.dataset.frame = cosmetic.id;
        avatar.textContent = initialsFromUsername(
            loadedProfile?.username ?? "Player"
        );
        preview.append(avatar);
    } else if (cosmetic.category === "title") {
        preview.classList.add("cosmetic-title-preview");
        preview.textContent = cosmetic.id === "title_none"
            ? "No title"
            : cosmetic.name;
    } else {
        preview.classList.add("cosmetic-badge-preview");
        preview.textContent = badgeSymbol(cosmetic.id) || "—";
    }

    return preview;
}

function cosmeticActionButton(cosmetic) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cosmetic-action-button";
    button.dataset.cosmeticId = cosmetic.id;

    if (cosmetic.equipped) {
        button.textContent = "Equipped";
        button.disabled = true;
        button.classList.add("equipped");
        return button;
    }

    if (
        cosmetic.unlock_source === "achievement"
        && !cosmetic.owned
    ) {
        button.textContent = "Locked";
        button.disabled = true;
        button.classList.add("achievement-locked");
        return button;
    }

    if (cosmetic.owned) {
        button.textContent = "Equip";
        button.dataset.action = "equip";
        return button;
    }

    button.textContent = `Buy · ${formatNumber(cosmetic.price)}`;
    button.dataset.action = "buy";
    button.classList.add("purchase");
    return button;
}

function renderCosmetics() {
    cosmeticGrid.replaceChildren();

    const visibleCosmetics = cosmetics.filter(
        (cosmetic) => cosmetic.category === selectedCategory
    );

    if (!visibleCosmetics.length) {
        const empty = document.createElement("p");
        empty.className = "cosmetic-loading";
        empty.textContent = "No cosmetics are available in this category.";
        cosmeticGrid.append(empty);
        return;
    }

    for (const cosmetic of visibleCosmetics) {
        const card = document.createElement("article");
        card.className = "cosmetic-card";
        card.classList.toggle("owned", cosmetic.owned);
        card.classList.toggle("equipped", cosmetic.equipped);

        const preview = cosmeticPreview(cosmetic);

        const content = document.createElement("div");
        content.className = "cosmetic-card-content";

        const category = document.createElement("span");
        category.className = "cosmetic-category-label";
        category.textContent = categoryNames[cosmetic.category];

        const name = document.createElement("h3");
        name.textContent = cosmetic.name;

        const description = document.createElement("p");
        description.textContent = cosmetic.description;

        const footer = document.createElement("div");
        footer.className = "cosmetic-card-footer";

        const ownership = document.createElement("span");
        ownership.className = "cosmetic-ownership";
        ownership.textContent = cosmetic.equipped
            ? "Currently equipped"
            : cosmetic.owned
                ? cosmetic.unlock_source === "achievement"
                    ? "Achievement unlocked"
                    : "Owned"
                : cosmetic.unlock_source === "achievement"
                    ? "Achievement reward"
                    : `${formatNumber(cosmetic.price)} chips`;

        const button = cosmeticActionButton(cosmetic);

        footer.append(ownership, button);
        content.append(category, name, description, footer);
        card.append(preview, content);
        cosmeticGrid.append(card);
    }
}

async function loadCosmetics() {
    const {
        data,
        error
    } = await window.supabaseClient.rpc(
        "get_my_profile_cosmetics"
    );

    if (error) {
        throw error;
    }

    cosmetics = data ?? [];
    renderCosmetics();
}

async function refreshOwnerProfile() {
    await Promise.all([
        loadPublicProfile(),
        loadCosmetics()
    ]);
}

async function purchaseCosmetic(cosmeticId) {
    const cosmetic = cosmetics.find(
        (item) => item.id === cosmeticId
    );

    if (!cosmetic || shopBusy) {
        return;
    }

    const confirmed = window.confirm(
        `Buy ${cosmetic.name} for ${formatNumber(cosmetic.price)} chips?`
    );

    if (!confirmed) {
        return;
    }

    shopBusy = true;
    setMessage("");

    try {
        const {
            data,
            error
        } = await window.supabaseClient.rpc(
            "purchase_profile_cosmetic",
            {
                p_cosmetic_id: cosmeticId
            }
        );

        if (error) {
            throw error;
        }

        await refreshOwnerProfile();

        setMessage(
            data?.status === "already_owned"
                ? "You already own that cosmetic."
                : `${cosmetic.name} purchased.`,
            "success"
        );
    } catch (error) {
        setMessage(
            error.message || "The cosmetic could not be purchased.",
            "error"
        );
    } finally {
        shopBusy = false;
    }
}

async function equipCosmetic(cosmeticId) {
    const cosmetic = cosmetics.find(
        (item) => item.id === cosmeticId
    );

    if (!cosmetic || shopBusy) {
        return;
    }

    shopBusy = true;
    setMessage("");

    try {
        const {
            error
        } = await window.supabaseClient.rpc(
            "equip_profile_cosmetic",
            {
                p_cosmetic_id: cosmeticId
            }
        );

        if (error) {
            throw error;
        }

        await refreshOwnerProfile();
        setMessage(`${cosmetic.name} equipped.`, "success");
    } catch (error) {
        setMessage(
            error.message || "The cosmetic could not be equipped.",
            "error"
        );
    } finally {
        shopBusy = false;
    }
}

profileBioInput.addEventListener("input", setBioCharacterCount);

profileBioForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!loadedProfile?.is_self) {
        return;
    }

    saveProfileButton.disabled = true;
    setMessage("");

    try {
        const {
            error
        } = await window.supabaseClient.rpc(
            "update_my_profile_bio",
            {
                p_bio: profileBioInput.value
            }
        );

        if (error) {
            throw error;
        }

        await loadPublicProfile();
        setMessage("Profile bio saved.", "success");
    } catch (error) {
        setMessage(
            error.message || "The profile bio could not be saved.",
            "error"
        );
    } finally {
        saveProfileButton.disabled = false;
    }
});

document
    .querySelectorAll(".cosmetic-tab")
    .forEach((button) => {
        button.addEventListener("click", () => {
            selectedCategory = button.dataset.category;

            document
                .querySelectorAll(".cosmetic-tab")
                .forEach((candidate) => {
                    const active = candidate === button;
                    candidate.classList.toggle("active", active);
                    candidate.setAttribute(
                        "aria-selected",
                        String(active)
                    );
                });

            renderCosmetics();
        });
    });

cosmeticGrid.addEventListener("click", (event) => {
    const button = event.target.closest(
        ".cosmetic-action-button"
    );

    if (!button || button.disabled) {
        return;
    }

    const cosmeticId = button.dataset.cosmeticId;

    if (button.dataset.action === "buy") {
        purchaseCosmetic(cosmeticId);
    } else if (button.dataset.action === "equip") {
        equipCosmetic(cosmeticId);
    }
});

async function initialiseProfile() {
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
        await loadPublicProfile();

        if (loadedProfile?.is_self) {
            await refreshAchievements();
        }

        await Promise.all([
            loadPlayerStatistics(),
            loadPlayerAchievements(),
            loadFriendRelationship().catch((error) => {
                console.warn(
                    "Friend relationship could not be loaded:",
                    error
                );
            }),
            loadedProfile?.is_self
                ? loadCosmetics()
                : Promise.resolve()
        ]);

        subscribeToProfileFriendships();
    } catch (error) {
        console.error(error);
        setMessage(
            error.message || "The player profile could not be loaded.",
            "error"
        );
        profileBio.textContent = "Profile unavailable.";
    }
}

window.addEventListener("beforeunload", () => {
    if (friendshipProfileChannel) {
        window.supabaseClient.removeChannel(
            friendshipProfileChannel
        );
    }
});

initialiseProfile();
