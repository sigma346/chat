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

const badgeSymbols = {
    badge_ace: "♠",
    badge_penguin: "🐧",
    badge_dice: "⚄",
    badge_crown: "♛",
    badge_admin_shield: "✒️"
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

function formatNumber(value) {
    return new Intl.NumberFormat("en-AU").format(
        Number(value ?? 0)
    );
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
                ? "Owned"
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
            await loadCosmetics();
        }
    } catch (error) {
        console.error(error);
        setMessage(
            error.message || "The player profile could not be loaded.",
            "error"
        );
        profileBio.textContent = "Profile unavailable.";
    }
}

initialiseProfile();
