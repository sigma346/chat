const userState = {
    users: [],
    loading: false,
    selectedIds: new Set()
};

const usersTable = document.querySelector("#users-table");
const usersTableBody = document.querySelector("#users-table-body");
const usersLoading = document.querySelector("#users-loading");
const usersEmpty = document.querySelector("#users-empty");
const userSearchInput = document.querySelector("#user-search-input");
const statusFilter = document.querySelector("#status-filter");
const refreshUsersButton = document.querySelector("#refresh-users-button");
const adminMessage = document.querySelector("#admin-message");
const banDialog = document.querySelector("#ban-dialog");
const banForm = document.querySelector("#ban-form");
const deleteDialog = document.querySelector("#delete-dialog");
const deleteForm = document.querySelector("#delete-form");
const bulkActions = document.querySelector("#bulk-actions");
const selectVisibleUsers = document.querySelector("#select-visible-users");
const bulkDeleteDialog = document.querySelector("#bulk-delete-dialog");
const bulkDeleteForm = document.querySelector("#bulk-delete-form");

function showAdminMessage(message, tone = "success") {
    adminMessage.textContent = message;
    adminMessage.dataset.tone = tone;
    adminMessage.hidden = !message;
}

function formatDate(value, fallback = "Never") {
    if (!value) {
        return fallback;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return fallback;
    }

    return date.toLocaleString();
}

function formatChips(value) {
    try {
        return `${new Intl.NumberFormat().format(BigInt(value ?? 0))} chips`;
    } catch {
        return `${value ?? 0} chips`;
    }
}

function accountStatus(user) {
    if (user.account_deleted) {
        return { key: "deleted", label: "Deleted" };
    }
    if (user.is_admin) {
        return { key: "admin", label: user.is_you ? "Admin · You" : "Admin" };
    }
    if (user.is_banned) {
        return { key: "banned", label: "Banned" };
    }
    return { key: "active", label: "Active" };
}

function canBulkDelete(user) {
    return !user.is_admin
        && !user.is_you
        && (!user.account_deleted || user.auth_user_exists);
}

function selectedUsers() {
    return userState.users.filter((user) =>
        userState.selectedIds.has(user.id)
        && canBulkDelete(user)
    );
}

function updateSelectionInterface() {
    const selected = selectedUsers();
    const visibleEligible = filteredUsers().filter(canBulkDelete);
    const selectedVisibleCount = visibleEligible.filter((user) =>
        userState.selectedIds.has(user.id)
    ).length;

    bulkActions.hidden = selected.length === 0;
    document.querySelector("#selected-user-count").textContent =
        `${selected.length} ${selected.length === 1 ? "user" : "users"} selected`;

    selectVisibleUsers.disabled = visibleEligible.length === 0;
    selectVisibleUsers.checked = visibleEligible.length > 0
        && selectedVisibleCount === visibleEligible.length;
    selectVisibleUsers.indeterminate = selectedVisibleCount > 0
        && selectedVisibleCount < visibleEligible.length;

    document.querySelectorAll(".user-select-checkbox").forEach((checkbox) => {
        checkbox.checked = userState.selectedIds.has(checkbox.value);
    });
}

async function parseFunctionError(error) {
    try {
        if (error?.context instanceof Response) {
            const payload = await error.context.clone().json();
            return payload?.error || payload?.detail || error.message;
        }
    } catch {
        // Fall back to the Functions client error below.
    }

    return error?.message || "The moderation request failed.";
}

async function invokeAdmin(body) {
    const { data, error } = await window.supabaseClient.functions.invoke(
        "admin-manage-users",
        { body }
    );

    if (error) {
        throw new Error(await parseFunctionError(error));
    }

    if (data?.error) {
        throw new Error(data.error);
    }

    return data;
}

function makeCell() {
    return document.createElement("td");
}

function makeButton(label, className, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    if (className) {
        button.className = className;
    }
    button.addEventListener("click", onClick);
    return button;
}

function openBanDialog(user) {
    document.querySelector("#ban-target-id").value = user.id;
    document.querySelector("#ban-dialog-username").textContent = user.username;
    document.querySelector("#ban-reason").value = "";
    document.querySelector("#ban-duration").value = "24h";
    banDialog.showModal();
    document.querySelector("#ban-reason").focus();
}

function openDeleteDialog(user) {
    document.querySelector("#delete-target-id").value = user.id;
    document.querySelector("#delete-target-username").value = user.username;
    document.querySelector("#delete-dialog-username").textContent = user.username;
    document.querySelector("#delete-confirmation-name").textContent = user.username;
    document.querySelector("#delete-reason").value = "";
    document.querySelector("#delete-confirmation").value = "";
    document.querySelector("#confirm-delete-button").disabled = true;
    deleteDialog.showModal();
    document.querySelector("#delete-reason").focus();
}

function openBulkDeleteDialog() {
    const users = selectedUsers();
    if (users.length === 0) {
        return;
    }

    const confirmationPhrase = `DELETE ${users.length} USERS`;
    document.querySelector("#bulk-delete-count").textContent = users.length;
    document.querySelector("#bulk-delete-confirmation-phrase").textContent =
        confirmationPhrase;
    document.querySelector("#bulk-delete-reason").value = "";
    document.querySelector("#bulk-delete-confirmation").value = "";
    document.querySelector("#confirm-bulk-delete-button").disabled = true;
    bulkDeleteDialog.showModal();
    document.querySelector("#bulk-delete-reason").focus();
}

async function unbanUser(user) {
    if (!window.confirm(`Restore website access for ${user.username}?`)) {
        return;
    }

    showAdminMessage(`Unbanning ${user.username}…`);

    try {
        await invokeAdmin({
            action: "unban",
            target_user_id: user.id
        });
        showAdminMessage(`${user.username} can access the website again.`);
        await loadUsers({ keepMessage: true });
    } catch (error) {
        showAdminMessage(error.message, "error");
    }
}

function buildUserRow(user) {
    const row = document.createElement("tr");
    const status = accountStatus(user);

    const selectionCell = makeCell();
    selectionCell.className = "select-user-column";
    if (canBulkDelete(user)) {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "user-select-checkbox";
        checkbox.value = user.id;
        checkbox.checked = userState.selectedIds.has(user.id);
        checkbox.setAttribute("aria-label", `Select ${user.username}`);
        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                userState.selectedIds.add(user.id);
            } else {
                userState.selectedIds.delete(user.id);
            }
            updateSelectionInterface();
        });
        selectionCell.append(checkbox);
    }

    const identityCell = makeCell();
    const identity = document.createElement("div");
    identity.className = "user-identity";
    const username = document.createElement("strong");
    username.textContent = user.username;
    const email = document.createElement("small");
    email.textContent = user.email || (user.auth_user_exists ? "Email unavailable" : "Auth login removed");
    identity.append(username, email);
    identityCell.append(identity);

    const balanceCell = makeCell();
    balanceCell.textContent = `${formatChips(user.chips)} · Level ${user.level}`;

    const statusCell = makeCell();
    const pill = document.createElement("span");
    pill.className = `status-pill status-pill-${status.key}`;
    pill.textContent = status.label;
    statusCell.append(pill);

    if (user.is_banned && !user.account_deleted) {
        const detail = document.createElement("span");
        detail.className = "user-ban-reason";
        const expiry = user.banned_until
            ? `Until ${formatDate(user.banned_until)}`
            : "No expiry";
        detail.textContent = `${expiry}${user.ban_reason ? ` · ${user.ban_reason}` : ""}`;
        statusCell.append(detail);
    }

    const signInCell = makeCell();
    signInCell.className = "user-date";
    signInCell.textContent = formatDate(user.last_sign_in_at);

    const actionsCell = makeCell();
    const actions = document.createElement("div");
    actions.className = "user-actions";

    if (user.is_admin || user.is_you) {
        const protectedLabel = document.createElement("span");
        protectedLabel.className = "protected-label";
        protectedLabel.textContent = "Protected account";
        actions.append(protectedLabel);
    } else if (user.account_deleted) {
        const deletedLabel = document.createElement("span");
        deletedLabel.className = "protected-label";
        deletedLabel.textContent = user.auth_user_exists
            ? "Deletion needs retry"
            : "Login removed";
        actions.append(deletedLabel);
        if (user.auth_user_exists) {
            actions.append(makeButton(
                "Retry delete",
                "danger-button",
                () => openDeleteDialog(user)
            ));
        }
    } else {
        if (user.is_banned) {
            actions.append(makeButton(
                "Unban",
                "",
                () => unbanUser(user)
            ));
        } else {
            actions.append(makeButton(
                "Ban",
                "",
                () => openBanDialog(user)
            ));
        }

        actions.append(makeButton(
            "Delete",
            "danger-button",
            () => openDeleteDialog(user)
        ));
    }

    actionsCell.append(actions);
    row.append(
        selectionCell,
        identityCell,
        balanceCell,
        statusCell,
        signInCell,
        actionsCell
    );
    return row;
}

function filteredUsers() {
    const query = userSearchInput.value.trim().toLowerCase();
    const filter = statusFilter.value;

    return userState.users.filter((user) => {
        const matchesQuery = !query
            || user.username.toLowerCase().includes(query)
            || String(user.email || "").toLowerCase().includes(query);
        const status = accountStatus(user).key;
        return matchesQuery && (filter === "all" || filter === status);
    });
}

function renderUsers() {
    usersTableBody.replaceChildren();

    const users = filteredUsers();
    for (const user of users) {
        usersTableBody.append(buildUserRow(user));
    }

    usersLoading.hidden = true;
    usersTable.hidden = users.length === 0;
    usersEmpty.hidden = users.length !== 0;

    document.querySelector("#player-count").textContent =
        userState.users.filter((user) => !user.is_admin && !user.account_deleted).length;
    document.querySelector("#banned-count").textContent =
        userState.users.filter((user) => user.is_banned && !user.account_deleted).length;
    document.querySelector("#admin-count").textContent =
        userState.users.filter((user) => user.is_admin).length;
    document.querySelector("#deleted-count").textContent =
        userState.users.filter((user) => user.account_deleted).length;

    updateSelectionInterface();
}

async function loadUsers({ keepMessage = false } = {}) {
    if (userState.loading) {
        return;
    }

    userState.loading = true;
    refreshUsersButton.disabled = true;
    usersLoading.hidden = false;
    usersTable.hidden = true;
    usersEmpty.hidden = true;

    if (!keepMessage) {
        showAdminMessage("");
    }

    try {
        const payload = await invokeAdmin({ action: "list" });
        userState.users = Array.isArray(payload?.users) ? payload.users : [];
        const selectableIds = new Set(
            userState.users.filter(canBulkDelete).map((user) => user.id)
        );
        userState.selectedIds.forEach((id) => {
            if (!selectableIds.has(id)) {
                userState.selectedIds.delete(id);
            }
        });
        renderUsers();
    } catch (error) {
        usersLoading.hidden = true;
        showAdminMessage(error.message, "error");

        if (/administrator access|required|invalid or expired/i.test(error.message)) {
            window.setTimeout(() => {
                window.location.replace("index.html");
            }, 1800);
        }
    } finally {
        userState.loading = false;
        refreshUsersButton.disabled = false;
    }
}

banForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const targetId = document.querySelector("#ban-target-id").value;
    const username = document.querySelector("#ban-dialog-username").textContent;
    const duration = document.querySelector("#ban-duration").value;
    const reason = document.querySelector("#ban-reason").value.trim();
    const submitButton = document.querySelector("#confirm-ban-button");

    if (!reason) {
        return;
    }

    submitButton.disabled = true;

    try {
        await invokeAdmin({
            action: "ban",
            target_user_id: targetId,
            duration,
            reason
        });
        banDialog.close();
        showAdminMessage(`${username} has been banned.`);
        await loadUsers({ keepMessage: true });
    } catch (error) {
        showAdminMessage(error.message, "error");
    } finally {
        submitButton.disabled = false;
    }
});

deleteForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const targetId = document.querySelector("#delete-target-id").value;
    const username = document.querySelector("#delete-target-username").value;
    const confirmation = document.querySelector("#delete-confirmation").value;
    const reason = document.querySelector("#delete-reason").value.trim();
    const submitButton = document.querySelector("#confirm-delete-button");

    if (confirmation !== username || !reason) {
        return;
    }

    submitButton.disabled = true;

    try {
        await invokeAdmin({
            action: "delete",
            target_user_id: targetId,
            reason
        });
        deleteDialog.close();
        showAdminMessage(`${username}'s login was deleted and profile was anonymized.`);
        await loadUsers({ keepMessage: true });
    } catch (error) {
        showAdminMessage(error.message, "error");
        await loadUsers({ keepMessage: true });
    } finally {
        submitButton.disabled = false;
    }
});

bulkDeleteForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const users = selectedUsers();
    const reason = document.querySelector("#bulk-delete-reason").value.trim();
    const confirmation = document.querySelector("#bulk-delete-confirmation").value;
    const expected = `DELETE ${users.length} USERS`;
    const submitButton = document.querySelector("#confirm-bulk-delete-button");

    if (users.length === 0 || !reason || confirmation !== expected) {
        return;
    }

    submitButton.disabled = true;
    let deletedCount = 0;
    const failures = [];

    try {
        const ids = users.map((user) => user.id);

        for (let index = 0; index < ids.length; index += 25) {
            const batch = ids.slice(index, index + 25);
            const payload = await invokeAdmin({
                action: "bulk_delete",
                target_user_ids: batch,
                reason
            });

            const deleted = Array.isArray(payload?.deleted)
                ? payload.deleted
                : [];
            const failed = Array.isArray(payload?.failed)
                ? payload.failed
                : [];

            deletedCount += deleted.length;
            deleted.forEach((result) => {
                userState.selectedIds.delete(result.id);
            });
            failures.push(...failed);
        }

        bulkDeleteDialog.close();

        if (failures.length === 0) {
            showAdminMessage(
                `${deletedCount} ${deletedCount === 1 ? "account was" : "accounts were"} deleted and anonymized.`
            );
        } else {
            showAdminMessage(
                `${deletedCount} accounts were deleted. ${failures.length} failed and remain blocked; check Storage ownership and retry them.`,
                "error"
            );
        }

        await loadUsers({ keepMessage: true });
    } catch (error) {
        showAdminMessage(
            `${deletedCount} accounts were deleted before the request stopped. ${error.message}`,
            "error"
        );
        await loadUsers({ keepMessage: true });
    } finally {
        submitButton.disabled = false;
    }
});

document.querySelector("#delete-confirmation").addEventListener("input", (event) => {
    const expected = document.querySelector("#delete-target-username").value;
    document.querySelector("#confirm-delete-button").disabled =
        event.target.value !== expected;
});

document.querySelector("#bulk-delete-confirmation").addEventListener("input", (event) => {
    const selectedCount = selectedUsers().length;
    const expected = `DELETE ${selectedCount} USERS`;
    document.querySelector("#confirm-bulk-delete-button").disabled =
        event.target.value !== expected;
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => {
        document.querySelector(`#${button.dataset.closeDialog}`)?.close();
    });
});

userSearchInput.addEventListener("input", renderUsers);
statusFilter.addEventListener("change", renderUsers);
refreshUsersButton.addEventListener("click", () => loadUsers());
document.querySelector("#bulk-delete-button").addEventListener(
    "click",
    openBulkDeleteDialog
);
document.querySelector("#clear-selection-button").addEventListener("click", () => {
    userState.selectedIds.clear();
    updateSelectionInterface();
});
selectVisibleUsers.addEventListener("change", () => {
    const visibleEligible = filteredUsers().filter(canBulkDelete);

    for (const user of visibleEligible) {
        if (selectVisibleUsers.checked) {
            userState.selectedIds.add(user.id);
        } else {
            userState.selectedIds.delete(user.id);
        }
    }

    updateSelectionInterface();
});

loadUsers();
