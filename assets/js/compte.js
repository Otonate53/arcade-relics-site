import {
    app,
    auth
} from "./firebase-auth.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    getFirestore,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const db = getFirestore(app);

// DOM Elements
const loading = document.getElementById("loading");
const errorMessage = document.getElementById("errorMessage");
const errorDetail = document.getElementById("errorDetail");
const accountContent = document.getElementById("accountContent");
const userEmail = document.getElementById("userEmail");
const gamesCount = document.getElementById("gamesCount");
const consolesCount = document.getElementById("consolesCount");
const wishlistCount = document.getElementById("wishlistCount");
const collectionList = document.getElementById("collectionList");
const emptyTabState = document.getElementById("emptyTabState");
const logoutBtn = document.getElementById("logoutBtn");

const tabGames = document.getElementById("tabGames");
const tabConsoles = document.getElementById("tabConsoles");
const tabWishlist = document.getElementById("tabWishlist");
const badgeGames = document.getElementById("badgeGames");
const badgeConsoles = document.getElementById("badgeConsoles");
const badgeWishlist = document.getElementById("badgeWishlist");
const collectionSearch = document.getElementById("collectionSearch");

// State storage
let parsedData = {
    ownedGames: [],
    consoles: [],
    wishlistGames: []
};
let currentTab = "games"; // "games" | "consoles" | "wishlist"

// 1. Listen for Authentication
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html?login=true";
        return;
    }

    if (userEmail) {
        userEmail.textContent = user.email || "Compte Google";
    }

    try {
        const data = await loadCloudSnapshot(user.uid);
        processCollectionData(data);
        renderCurrentView();

        if (loading) loading.style.display = "none";
        if (errorMessage) errorMessage.style.display = "none";
        if (accountContent) accountContent.style.display = "block";
    } catch (error) {
        console.error("Erreur chargement collection :", error);
        if (loading) loading.style.display = "none";
        if (errorMessage) {
            errorMessage.style.display = "flex";
            if (errorDetail) {
                errorDetail.textContent = error.message || "Impossible de charger votre collection.";
            }
        }
    }
});

// 2. Load and Decompress Cloud Snapshot from Firestore
async function loadCloudSnapshot(uid) {
    const rootReference = doc(db, "privateSync", uid);
    const rootSnapshot = await getDoc(rootReference);

    if (!rootSnapshot.exists()) {
        throw new Error("Aucune sauvegarde cloud trouvée. Assurez-vous d'avoir activé la sauvegarde dans l'application mobile Arcade Relics.");
    }

    const chunkCount = rootSnapshot.data().chunkCount || 0;
    if (chunkCount <= 0) {
        throw new Error("La sauvegarde cloud est vide.");
    }

    let compressedBase64 = "";
    for (let index = 0; index < chunkCount; index++) {
        const chunkId = String(index).padStart(4, "0");
        const chunkReference = doc(db, "privateSync", uid, "chunks", chunkId);
        const chunkSnapshot = await getDoc(chunkReference);

        if (!chunkSnapshot.exists()) {
            throw new Error(`Morceau de sauvegarde absent (${chunkId}).`);
        }

        compressedBase64 += chunkSnapshot.data().data || "";
    }

    const json = await gunzipBase64(compressedBase64);
    return JSON.parse(json);
}

// 3. Gunzip Base64 Helper
async function gunzipBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    const stream = new Blob([bytes])
        .stream()
        .pipeThrough(new DecompressionStream("gzip"));

    return await new Response(stream).text();
}

function parseStoredArray(value) {

    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value === "string") {

        try {

            const parsed =
                JSON.parse(value);

            return Array.isArray(parsed)
                ? parsed
                : [];

        } catch (error) {

            console.error(
                "Impossible de lire une donnée Arcade Relics :",
                value,
                error
            );

            return [];
        }
    }

    return [];
}

function processCollectionData(data) {

    console.log(
        "Données Arcade Relics reçues :",
        data
    );

    /*
     * Le snapshot Android stocke les données
     * dans l'objet "values".
     */
    const values =
        data &&
        data.values &&
        typeof data.values === "object"
            ? data.values
            : data;

    console.log(
        "Valeurs Arcade Relics :",
        values
    );

    const items =
        parseStoredArray(
            values.otr_items
        );

    const owned =
        parseStoredArray(
            values.otr_owned
        );

    const wishlist =
        parseStoredArray(
            values.otr_wishlist
        );

    const consoles =
        parseStoredArray(
            values.otr_user_consoles
        );

    console.log(
        "Items :",
        items
    );

    console.log(
        "Jeux possédés IDs :",
        owned
    );

    console.log(
        "Wishlist IDs :",
        wishlist
    );

    console.log(
        "Consoles :",
        consoles
    );

    const ownedIds =
        new Set(
            owned.map(
                id => String(id)
            )
        );

    const wishlistIds =
        new Set(
            wishlist.map(
                id => String(id)
            )
        );

    parsedData.ownedGames =
        items.filter(
            item =>
                ownedIds.has(
                    String(item.id)
                )
        );

    parsedData.wishlistGames =
        items.filter(
            item =>
                wishlistIds.has(
                    String(item.id)
                )
        );

    parsedData.consoles =
        consoles;

    // Compteurs
    if (gamesCount) {
        gamesCount.textContent =
            parsedData.ownedGames.length;
    }

    if (consolesCount) {
        consolesCount.textContent =
            parsedData.consoles.length;
    }

    if (wishlistCount) {
        wishlistCount.textContent =
            parsedData.wishlistGames.length;
    }

    // Badges des onglets
    if (badgeGames) {
        badgeGames.textContent =
            parsedData.ownedGames.length;
    }

    if (badgeConsoles) {
        badgeConsoles.textContent =
            parsedData.consoles.length;
    }

    if (badgeWishlist) {
        badgeWishlist.textContent =
            parsedData.wishlistGames.length;
    }
}

// Helper to resolve platform name from console ID or object
function getPlatformDisplayName(game) {
    if (!game) return "Jeu";
    const rawConsole = game.console || game.platform || game.system || "";
    if (!rawConsole) return "Jeu";

    if (Array.isArray(parsedData.consoles)) {
        const found = parsedData.consoles.find(c => {
            if (!c) return false;
            if (typeof c === "string") return c === rawConsole;
            return (
                String(c.id) === String(rawConsole) ||
                String(c.consoleId) === String(rawConsole) ||
                String(c.console_id) === String(rawConsole) ||
                String(c.key) === String(rawConsole) ||
                String(c.slug) === String(rawConsole)
            );
        });

        if (found) {
            if (typeof found === "string") return found;
            return found.name || found.title || found.consoleName || found.nom || found.label || rawConsole;
        }
    }

    if (game.consoleName) return game.consoleName;
    if (game.platformName) return game.platformName;
    if (game.systemName) return game.systemName;

    return rawConsole;
}

// Helper to get game cover URL
function getGameCoverUrl(game) {
    if (!game) return "";
    return (
        game.coverUrl ||
        game.cover ||
        game.image ||
        game.imageUrl ||
        game.thumbnail ||
        game.boxArt ||
        game.box_art ||
        game.picture ||
        ""
    );
}

// 5. Render Current View
function renderCurrentView() {
    if (!collectionList) return;
    collectionList.innerHTML = "";

    const query = collectionSearch ? collectionSearch.value.trim().toLowerCase() : "";
    let itemsToRender = [];

    if (currentTab === "games") {
        itemsToRender = parsedData.ownedGames;
    } else if (currentTab === "consoles") {
        itemsToRender = parsedData.consoles;
    } else if (currentTab === "wishlist") {
        itemsToRender = parsedData.wishlistGames;
    }

    // Filter by query
    if (query) {
        itemsToRender = itemsToRender.filter(item => {
            const title = (item.title || item.name || "").toLowerCase();
            const platform = (getPlatformDisplayName(item) || item.brand || "").toLowerCase();
            return title.includes(query) || platform.includes(query);
        });
    }

    if (itemsToRender.length === 0) {
        if (emptyTabState) emptyTabState.style.display = "flex";
        collectionList.style.display = "none";
        return;
    } else {
        if (emptyTabState) emptyTabState.style.display = "none";
        collectionList.style.display = "grid";
    }

    // Render Cards
    if (currentTab === "consoles") {
        itemsToRender.forEach(consoleItem => {
            const card = document.createElement("div");
            card.className = "console-card";

            const name = consoleItem.name || consoleItem.title || consoleItem.consoleName || consoleItem.nom || "Console";
            const brand = consoleItem.brand || consoleItem.manufacturer || consoleItem.company || "Retro / Moderne";

            card.innerHTML = `
                <div class="console-icon-wrap">🕹️</div>
                <div class="console-info">
                    <h3>${escapeHtml(name)}</h3>
                    <span class="console-brand">${escapeHtml(brand)}</span>
                </div>
            `;
            collectionList.appendChild(card);
        });
    } else {
        // Games & Wishlist
        itemsToRender.forEach(game => {
            const card = document.createElement("div");
            card.className = "game-card";

            const title = game.title || game.name || "Jeu sans titre";
            const platform = getPlatformDisplayName(game);
            const coverUrl = getGameCoverUrl(game);

            const coverHtml = coverUrl
                ? `<img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(title)}" class="game-cover-img" loading="lazy">`
                : `<div class="game-cover-fallback"><span>🎮</span><small style="font-size:0.75rem;color:var(--text-dim);">${escapeHtml(platform)}</small></div>`;

            const isWishlist = currentTab === "wishlist";
            const statusLabel = isWishlist ? "⭐ Wishlist" : "✓ Possédé";
            const statusColor = isWishlist ? "var(--yellow)" : "var(--green)";

            card.innerHTML = `
                <div class="game-cover-wrap">
                    ${coverHtml}
                </div>
                <div class="game-card-body">
                    <h3 class="game-title" title="${escapeHtml(title)}">${escapeHtml(title)}</h3>
                    <div class="game-meta-row">
                        <span class="platform-pill" title="${escapeHtml(platform)}">${escapeHtml(platform)}</span>
                        <span class="status-indicator" style="color:${statusColor}">${statusLabel}</span>
                    </div>
                </div>
            `;
            collectionList.appendChild(card);
        });
    }
}

// Escape HTML utility
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Tab Click Handlers
function switchTab(tabName) {
    currentTab = tabName;

    [tabGames, tabConsoles, tabWishlist].forEach(btn => {
        if (btn) btn.classList.remove("active");
    });

    if (tabName === "games" && tabGames) tabGames.classList.add("active");
    if (tabName === "consoles" && tabConsoles) tabConsoles.classList.add("active");
    if (tabName === "wishlist" && tabWishlist) tabWishlist.classList.add("active");

    renderCurrentView();
}

if (tabGames) tabGames.addEventListener("click", () => switchTab("games"));
if (tabConsoles) tabConsoles.addEventListener("click", () => switchTab("consoles"));
if (tabWishlist) tabWishlist.addEventListener("click", () => switchTab("wishlist"));

// Real-time Search Filter
if (collectionSearch) {
    collectionSearch.addEventListener("input", () => {
        renderCurrentView();
    });
}

// Logout Handler
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        try {
            await signOut(auth);
            window.location.href = "index.html";
        } catch (e) {
            console.error("Erreur déconnexion :", e);
            window.location.href = "index.html";
        }
    });
}
