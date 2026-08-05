const homeUsername =
    document.querySelector("#home-username");

const homeChipBalance =
    document.querySelector("#home-chip-balance");

const homeLevel =
    document.querySelector("#home-level");

const homeLevelProgress =
    document.querySelector("#home-level-progress");

const homeJokeCategory =
    document.querySelector("#home-joke-category");

const homeJokeSetup =
    document.querySelector("#home-joke-setup");

const homeJokeDelivery =
    document.querySelector("#home-joke-delivery");

const homeJokeFlags =
    document.querySelector("#home-joke-flags");

const homeJokeRevealButton =
    document.querySelector("#home-joke-reveal");

const homeJokeNewButton =
    document.querySelector("#home-joke-new");

const homeJokeStatus =
    document.querySelector("#home-joke-status");


const HOME_JOKE_API_URL =
    "https://v2.jokeapi.dev/joke/Any";

const HOME_JOKE_CACHE_KEY =
    "casino-home-joke-v1";

const HOME_JOKE_CACHE_DURATION =
    10 * 60 * 1000;

const HOME_JOKE_FLAG_LABELS = {
    nsfw: "NSFW",
    religious: "Religious",
    political: "Political",
    racist: "Racist",
    sexist: "Sexist",
    explicit: "Explicit"
};


let homeJokeLoaded = false;


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


function normaliseHomeJoke(payload) {
    if (
        !payload
        || payload.error === true
    ) {
        throw new Error(
            payload?.message
            || "JokeAPI did not return a joke."
        );
    }

    const category =
        String(payload.category || "Unknown")
            .trim()
            .slice(0, 40);

    if (payload.type === "single") {
        const joke =
            String(payload.joke || "").trim();

        if (!joke) {
            throw new Error(
                "JokeAPI returned an empty joke."
            );
        }

        return {
            category,
            type: "single",
            setup: joke,
            delivery: "",
            flags:
                payload.flags
                && typeof payload.flags === "object"
                    ? payload.flags
                    : {}
        };
    }

    if (payload.type === "twopart") {
        const setup =
            String(payload.setup || "").trim();

        const delivery =
            String(payload.delivery || "").trim();

        if (!setup || !delivery) {
            throw new Error(
                "JokeAPI returned an incomplete two-part joke."
            );
        }

        return {
            category,
            type: "twopart",
            setup,
            delivery,
            flags:
                payload.flags
                && typeof payload.flags === "object"
                    ? payload.flags
                    : {}
        };
    }

    throw new Error(
        "JokeAPI returned an unsupported joke format."
    );
}


function activeHomeJokeFlags(flags) {
    return Object.entries(
        HOME_JOKE_FLAG_LABELS
    )
        .filter(([flag]) => flags?.[flag] === true)
        .map(([, label]) => label);
}


function renderHomeJoke(payload, cached = false) {
    const joke = normaliseHomeJoke(payload);
    const activeFlags =
        activeHomeJokeFlags(joke.flags);

    homeJokeSetup.textContent = joke.setup;
    homeJokeCategory.textContent =
        `${joke.category} · ${
            joke.type === "single"
                ? "Single"
                : "Two-part"
        }`;

    homeJokeFlags.textContent =
        activeFlags.length > 0
            ? `Content flags: ${activeFlags.join(", ")}`
            : "This joke has no content flags.";

    if (joke.type === "twopart") {
        homeJokeDelivery.textContent =
            joke.delivery;

        homeJokeDelivery.hidden = true;
        homeJokeRevealButton.hidden = false;
    } else {
        homeJokeDelivery.textContent = "";
        homeJokeDelivery.hidden = true;
        homeJokeRevealButton.hidden = true;
    }

    homeJokeStatus.textContent = cached
        ? "Showing the most recently loaded joke."
        : "New joke loaded.";

    homeJokeStatus.classList.remove("error");
    homeJokeLoaded = true;
}


function readCachedHomeJoke() {
    try {
        const cached = JSON.parse(
            window.sessionStorage.getItem(
                HOME_JOKE_CACHE_KEY
            )
        );

        if (
            !cached
            || !Number.isFinite(cached.savedAt)
            || Date.now() - cached.savedAt
                > HOME_JOKE_CACHE_DURATION
        ) {
            return null;
        }

        normaliseHomeJoke(cached.payload);
        return cached.payload;
    } catch (error) {
        return null;
    }
}


function cacheHomeJoke(payload) {
    try {
        window.sessionStorage.setItem(
            HOME_JOKE_CACHE_KEY,
            JSON.stringify({
                savedAt: Date.now(),
                payload
            })
        );
    } catch (error) {
        // The generator still works when browser storage is unavailable.
    }
}


async function fetchHomeJoke({ force = false } = {}) {
    if (!force) {
        const cached = readCachedHomeJoke();

        if (cached) {
            renderHomeJoke(cached, true);
            return;
        }
    }

    homeJokeNewButton.disabled = true;
    homeJokeRevealButton.disabled = true;
    homeJokeStatus.textContent = "Loading a joke...";
    homeJokeStatus.classList.remove("error");

    if (!homeJokeLoaded) {
        homeJokeSetup.textContent =
            "The comedian is finding material...";
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(
        () => controller.abort(),
        8000
    );

    try {
        const response = await fetch(
            HOME_JOKE_API_URL,
            {
                method: "GET",
                headers: {
                    Accept: "application/json"
                },
                cache: "no-store",
                signal: controller.signal
            }
        );

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error(
                    "Too many jokes were requested. Wait a moment and try again."
                );
            }

            throw new Error(
                `JokeAPI returned HTTP ${response.status}.`
            );
        }

        const payload = await response.json();
        normaliseHomeJoke(payload);
        cacheHomeJoke(payload);
        renderHomeJoke(payload);
    } catch (error) {
        console.error(
            "Could not load a JokeAPI joke:",
            error
        );

        if (!homeJokeLoaded) {
            homeJokeSetup.textContent =
                "The comedian is unavailable right now.";
        }

        homeJokeStatus.textContent =
            error?.name === "AbortError"
                ? "JokeAPI took too long to respond. Try again."
                : error?.message
                    || "A joke could not be loaded.";

        homeJokeStatus.classList.add("error");
    } finally {
        window.clearTimeout(timeout);
        homeJokeNewButton.disabled = false;
        homeJokeRevealButton.disabled = false;
    }
}


homeJokeRevealButton.addEventListener(
    "click",
    () => {
        homeJokeDelivery.hidden = false;
        homeJokeRevealButton.hidden = true;
        homeJokeStatus.textContent =
            "Punchline revealed.";
    }
);


homeJokeNewButton.addEventListener(
    "click",
    () => fetchHomeJoke({ force: true })
);


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


fetchHomeJoke();
