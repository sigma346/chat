const profileDonationsSummary =
    document.querySelector(
        "#profile-donations-summary"
    );

const profileDonationsList =
    document.querySelector(
        "#profile-donations-list"
    );


function publicDonationProfileParameters() {
    const parameters =
        new URLSearchParams(
            window.location.search
        );

    const requestedId =
        parameters.get("id");

    const requestedUsername =
        parameters.get("username");

    return {
        p_user_id:
            requestedId || null,

        p_username:
            requestedId
                ? null
                : requestedUsername || null,

        p_limit: 25
    };
}


function publicDonationInteger(value) {
    const textValue =
        String(value ?? 0);

    if (!/^-?\d+$/.test(textValue)) {
        return 0n;
    }

    try {
        return BigInt(textValue);
    } catch (error) {
        return 0n;
    }
}


function formatPublicDonationNumber(value) {
    return new Intl.NumberFormat(
        "en-AU"
    ).format(
        publicDonationInteger(value)
    );
}


function formatPublicDonationDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Unknown date";
    }

    return new Intl.DateTimeFormat(
        "en-AU",
        {
            dateStyle: "medium",
            timeStyle: "short"
        }
    ).format(date);
}


function publicDonationInitials(username) {
    const words = String(username || "?")
        .trim()
        .split(/[\s_-]+/)
        .filter(Boolean);

    if (words.length === 0) {
        return "?";
    }

    return words
        .slice(0, 2)
        .map((word) => word.charAt(0))
        .join("")
        .toUpperCase();
}


function publicDonationPlural(
    value,
    singular,
    plural
) {
    return publicDonationInteger(value) === 1n
        ? singular
        : plural;
}


function setPublicDonationState(
    message,
    state = "empty"
) {
    profileDonationsList.replaceChildren();

    const stateMessage =
        document.createElement("p");

    stateMessage.className =
        `profile-donations-state ${state}`;

    stateMessage.textContent = message;
    profileDonationsList.append(stateMessage);
}


function publicDonationProfileUrl(donorId) {
    const url = new URL(
        "profile.html",
        window.location.href
    );

    url.searchParams.set(
        "id",
        String(donorId)
    );

    return url.href;
}


function createPublicDonationItem(donation) {
    const item = document.createElement("article");
    item.className = "profile-donation-item";

    const avatar = document.createElement("span");
    avatar.className = "profile-donation-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent =
        publicDonationInitials(
            donation.donor_username
        );

    const details = document.createElement("div");
    details.className = "profile-donation-details";

    const donor = document.createElement("a");
    donor.className = "profile-donation-donor";
    donor.textContent =
        donation.donor_username
        || "Deleted player";

    if (donation.donor_id) {
        donor.href =
            publicDonationProfileUrl(
                donation.donor_id
            );
    } else {
        donor.removeAttribute("href");
    }

    const date = document.createElement("time");
    date.className = "profile-donation-date";
    date.dateTime = String(
        donation.created_at || ""
    );
    date.textContent =
        formatPublicDonationDate(
            donation.created_at
        );

    details.append(donor, date);

    const amount = document.createElement("strong");
    amount.className = "profile-donation-amount";
    amount.textContent =
        `+${formatPublicDonationNumber(
            donation.amount
        )} chips`;

    item.append(avatar, details, amount);
    return item;
}


function renderPublicDonations(payload) {
    const donationCount =
        payload?.total_donations ?? 0;

    const donorCount =
        payload?.unique_donors ?? 0;

    const chipTotal =
        payload?.total_chips_received ?? 0;

    profileDonationsSummary.textContent =
        `${formatPublicDonationNumber(
            chipTotal
        )} chips · ${formatPublicDonationNumber(
            donationCount
        )} ${publicDonationPlural(
            donationCount,
            "donation",
            "donations"
        )} · ${formatPublicDonationNumber(
            donorCount
        )} ${publicDonationPlural(
            donorCount,
            "donor",
            "donors"
        )}`;

    const donations = Array.isArray(
        payload?.donations
    )
        ? payload.donations
        : [];

    if (donations.length === 0) {
        setPublicDonationState(
            "This player has not received any chip donations yet."
        );
        return;
    }

    profileDonationsList.replaceChildren(
        ...donations.map(
            createPublicDonationItem
        )
    );
}


async function loadPublicProfileDonations() {
    if (
        !profileDonationsSummary
        || !profileDonationsList
    ) {
        return;
    }

    try {
        const {
            data,
            error
        } =
            await window.supabaseClient.rpc(
                "get_public_profile_donations",
                publicDonationProfileParameters()
            );

        if (error) {
            throw error;
        }

        renderPublicDonations(data || {});
    } catch (error) {
        console.error(
            "Could not load public donations:",
            error
        );

        profileDonationsSummary.textContent =
            "Unavailable";

        setPublicDonationState(
            "Donations could not be loaded right now.",
            "error"
        );
    }
}


loadPublicProfileDonations();
