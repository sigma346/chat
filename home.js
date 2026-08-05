const homeUsername =
    document.querySelector("#home-username");

const homeChipBalance =
    document.querySelector("#home-chip-balance");

const homeLevel =
    document.querySelector("#home-level");

const homeLevelProgress =
    document.querySelector("#home-level-progress");


function homeInteger(value) {
    const textValue = String(value ?? 0);

    if (!/^-?\d+$/.test(textValue)) {
        return 0n;
    }

    try {
        return BigInt(textValue);
    } catch (error) {
        return 0n;
    }
}


function formatHomeNumber(value) {
    return new Intl.NumberFormat(
        "en-AU"
    ).format(
        homeInteger(value)
    );
}


function renderHomeProfile(profile) {
    homeUsername.textContent =
        profile?.username || "player";

    homeChipBalance.textContent =
        formatHomeNumber(
            profile?.chips ?? 0
        );
}


function renderHomeLevel(progress) {
    const level = Math.max(
        Number(progress?.level ?? 1),
        1
    );

    const xpIntoLevel = Math.max(
        Number(progress?.xp_into_level ?? 0),
        0
    );

    const xpNeeded = Math.max(
        Number(progress?.xp_needed_for_level ?? 0),
        0
    );

    homeLevel.textContent = String(level);

    homeLevelProgress.textContent = xpNeeded > 0
        ? `${formatHomeNumber(
            xpIntoLevel
        )} / ${formatHomeNumber(
            xpNeeded
        )} XP to next level`
        : `${formatHomeNumber(
            progress?.xp ?? 0
        )} XP total`;
}


async function loadCasinoHome() {
    const {
        data: { user },
        error: userError
    } = await window.supabaseClient.auth.getUser();

    if (userError || !user) {
        window.location.href = "login.html";
        return;
    }

    const [profileResult, levelResult] =
        await Promise.all([
            window.supabaseClient
                .from("profiles")
                .select("id, username, chips")
                .eq("id", user.id)
                .single(),

            window.supabaseClient.rpc(
                "get_my_level_progress"
            )
        ]);

    if (profileResult.error) {
        console.error(
            "Could not load the home profile:",
            profileResult.error
        );

        homeUsername.textContent = "player";
        homeChipBalance.textContent = "Unavailable";
    } else {
        renderHomeProfile(profileResult.data);
    }

    if (levelResult.error || !levelResult.data) {
        console.warn(
            "Could not load level progress:",
            levelResult.error
        );

        homeLevel.textContent = "—";
        homeLevelProgress.textContent =
            "Progress unavailable";
    } else {
        renderHomeLevel(levelResult.data);
    }

    window.supabaseClient
        .channel(`home-profile-${user.id}`)
        .on(
            "postgres_changes",
            {
                event: "UPDATE",
                schema: "public",
                table: "profiles",
                filter: `id=eq.${user.id}`
            },
            (payload) => {
                if (payload.new) {
                    renderHomeProfile(payload.new);
                }
            }
        )
        .subscribe();
}


loadCasinoHome().catch((error) => {
    console.error(
        "The casino home page could not be loaded:",
        error
    );

    homeChipBalance.textContent = "Unavailable";
    homeLevel.textContent = "—";
    homeLevelProgress.textContent =
        "Progress unavailable";
});
