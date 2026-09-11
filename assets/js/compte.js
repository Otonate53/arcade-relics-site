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
const driveImageObjectUrls = [];

function parseBackupArray(value) {

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
        } catch {
            return [];
        }
    }

    return [];
}


async function getZipImageUrl(
    zip,
    imageRef
) {

    if (
        !imageRef ||
        typeof imageRef !== "string"
    ) {
        return "";
    }


    if (
        imageRef.startsWith("https://") ||
        imageRef.startsWith("http://")
    ) {
        return imageRef;
    }

    const path =
        imageRef
            .replace(/^\/+/, "");

    const file =
        zip.file(path);

    if (!file) {
        return "";
    }

    const blob =
        await file.async("blob");

    const objectUrl =
        URL.createObjectURL(blob);

    driveImageObjectUrls.push(
        objectUrl
    );

    return objectUrl;
}
async function loadGoogleDriveImages() {

    const accessToken =
        sessionStorage.getItem(
            "arcade_relics_drive_token"
        );

    if (!accessToken) {

        console.warn(
            "Aucun accès Google Drive disponible."
        );

        return;
    }


    /*
     * Recherche du backup Arcade Relics.
     */
    const searchUrl =
        new URL(
            "https://www.googleapis.com/drive/v3/files"
        );

    searchUrl.searchParams.set(
        "spaces",
        "appDataFolder"
    );

    searchUrl.searchParams.set(
        "q",
        "name='arcade_relics_backup.zip' and trashed=false"
    );

    searchUrl.searchParams.set(
        "orderBy",
        "modifiedTime desc"
    );

    searchUrl.searchParams.set(
        "pageSize",
        "1"
    );

    searchUrl.searchParams.set(
        "fields",
        "files(id,name,modifiedTime)"
    );


    const searchResponse =
        await fetch(
            searchUrl.toString(),
            {
                headers: {
                    Authorization:
                        `Bearer ${accessToken}`
                }
            }
        );


    if (!searchResponse.ok) {

        throw new Error(
            "Impossible d'accéder à Google Drive."
        );
    }


    const searchData =
        await searchResponse.json();

    const backupFile =
        searchData.files?.[0];


    if (!backupFile) {

        console.warn(
            "Aucun backup Arcade Relics trouvé."
        );

        return;
    }


    console.log(
        "Backup Drive trouvé :",
        backupFile.modifiedTime
    );


    /*
     * Récupération du ZIP en mémoire.
     */
    const downloadResponse =
        await fetch(
            `https://www.googleapis.com/drive/v3/files/${backupFile.id}?alt=media`,
            {
                headers: {
                    Authorization:
                        `Bearer ${accessToken}`
                }
            }
        );


    if (!downloadResponse.ok) {

        throw new Error(
            "Impossible de lire le backup."
        );
    }


    const zipBuffer =
        await downloadResponse.arrayBuffer();

    const zip =
        await JSZip.loadAsync(
            zipBuffer
        );


    /*
     * Nettoyage des anciennes URL temporaires.
     */
    driveImageObjectUrls.forEach(
        url => URL.revokeObjectURL(url)
    );

    driveImageObjectUrls.length = 0;


    const gameImages =
        new Map();

    const wishlistImages =
        new Map();

    const consoleImages =
        new Map();


    /*
     * Parcours directement TOUS les fichiers
     * présents dans le ZIP.
     */
    for (
        const [
            path,
            file
        ] of Object.entries(zip.files)
    ) {

        if (file.dir) {
            continue;
        }


        /*
         * Jeux possédés
         *
         * images/games/ID_cover.webp
         */
        let match =
            path.match(
                /^images\/games\/(.+)_cover\.(webp|png|jpe?g|gif)$/i
            );

        if (match) {

            const id =
                String(match[1]);

            const blob =
                await file.async("blob");

            const url =
                URL.createObjectURL(blob);

            driveImageObjectUrls.push(url);

            gameImages.set(
                id,
                url
            );

            continue;
        }


        /*
         * Wishlist
         *
         * images/wishlist/ID_cover.webp
         */
        match =
            path.match(
                /^images\/wishlist\/(.+)_cover\.(webp|png|jpe?g|gif)$/i
            );

        if (match) {

            const id =
                String(match[1]);

            const blob =
                await file.async("blob");

            const url =
                URL.createObjectURL(blob);

            driveImageObjectUrls.push(url);

            wishlistImages.set(
                id,
                url
            );

            continue;
        }


        /*
         * Consoles
         *
         * images/consoles/ID_cover.webp
         */
        match =
            path.match(
                /^images\/consoles\/(.+)_cover\.(webp|png|jpe?g|gif)$/i
            );

        if (match) {

            const id =
                String(match[1]);

            const blob =
                await file.async("blob");

            const url =
                URL.createObjectURL(blob);

            driveImageObjectUrls.push(url);

            consoleImages.set(
                id,
                url
            );
        }
    }


    console.log(
        "Photos trouvées dans le ZIP :",
        {
            jeux: gameImages.size,
            wishlist: wishlistImages.size,
            consoles: consoleImages.size
        }
    );


    /*
     * Association avec les jeux Firestore.
     */
    parsedData.ownedGames =
        parsedData.ownedGames.map(
            game => ({
                ...game,

                driveImage:
                    gameImages.get(
                        String(game.id)
                    ) ||

                    wishlistImages.get(
                        String(game.id)
                    ) ||

                    ""
            })
        );


    /*
     * Association avec la wishlist.
     */
    parsedData.wishlistGames =
        parsedData.wishlistGames.map(
            game => ({
                ...game,

                driveImage:
                    wishlistImages.get(
                        String(game.id)
                    ) ||

                    gameImages.get(
                        String(game.id)
                    ) ||

                    ""
            })
        );


    /*
     * Association avec les consoles.
     */
    parsedData.consoles =
        parsedData.consoles.map(
            consoleItem => ({
                ...consoleItem,

                driveImage:
                    consoleImages.get(
                        String(consoleItem.id)
                    ) ||

                    ""
            })
        );


    console.log(
        "Images Google Drive associées :",
        {
            jeux:
                parsedData.ownedGames.filter(
                    game => game.driveImage
                ).length,

            wishlist:
                parsedData.wishlistGames.filter(
                    game => game.driveImage
                ).length,

            consoles:
                parsedData.consoles.filter(
                    item => item.driveImage
                ).length
        }
    );
}

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
        const data =
            await loadCloudSnapshot(
                user.uid
            );

        processCollectionData(data);

        try {

            await loadGoogleDriveImages();

        } catch (driveError) {

            console.warn(
                "Photos Google Drive :",
                driveError
            );
        }

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

async function loadCloudSnapshot(uid) {

    const collectionReference =
        doc(
            db,
            "publicCollections",
            uid
        );

    const collectionSnapshot =
        await getDoc(
            collectionReference
        );

    if (!collectionSnapshot.exists()) {

        throw new Error(
            "Aucune collection synchronisée trouvée."
        );
    }

    const data =
        collectionSnapshot.data();

    console.log(
        "Collection Firestore actuelle :",
        data
    );

    return data;
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

    const items =
        Array.isArray(data.items)
            ? data.items
            : [];

    const owned =
        Array.isArray(data.owned)
            ? data.owned
            : [];

    const wishlist =
        Array.isArray(data.wishlist)
            ? data.wishlist
            : [];

    const consoles =
        Array.isArray(data.consoles)
            ? data.consoles
            : [];

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

function getGameCoverUrl(game) {

    if (!game) {
        return "";
    }

    return (
        game.driveImage ||
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

            const consoleImage =
                consoleItem.driveImage ||
                consoleItem.image ||
                consoleItem.cover ||
                "";

            card.innerHTML = `
              <div class="console-icon-wrap">

    ${consoleImage
                    ? `
                <img
                    src="${escapeHtml(consoleImage)}"
                    alt="${escapeHtml(name)}"
                    style="
                        width:100%;
                        height:100%;
                        object-fit:cover;
                        border-radius:inherit;
                    "
                >
              `
                    : "🕹️"
                }

</div>
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
