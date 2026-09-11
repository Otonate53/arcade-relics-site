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
        ) ||
        localStorage.getItem(
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
     * Lecture du manifest.json du backup
     * pour récupérer toutes les métadonnées détaillées
     * saisies sur l'application mobile.
     */
    let manifestItemsMap = new Map();
    let manifestConsolesMap = new Map();
    const manifestFile = zip.file("manifest.json") || zip.file("backup.json");
    if (manifestFile) {
        try {
            const manifestText = await manifestFile.async("string");
            const manifestJson = JSON.parse(manifestText);
            const values = manifestJson.values || manifestJson;
            const bItems = parseBackupArray(values.otr_items || values.items);
            const bConsoles = parseBackupArray(values.otr_user_consoles || values.consoles);
            bItems.forEach(it => {
                if (it && it.id != null) manifestItemsMap.set(String(it.id), it);
            });
            bConsoles.forEach(c => {
                if (c && c.id != null) manifestConsolesMap.set(String(c.id), c);
            });
            console.log("Manifest Arcade Relics analysé :", {
                items: manifestItemsMap.size,
                consoles: manifestConsolesMap.size
            });
        } catch (manifestError) {
            console.warn("Erreur analyse manifest :", manifestError);
        }
    }


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
     * Association avec les jeux Firestore et enrichissement via le manifest.
     */
    parsedData.ownedGames =
        parsedData.ownedGames.map(
            game => {
                const id = String(game.id);
                const extra = manifestItemsMap.get(id) || {};
                return {
                    ...extra,
                    ...game,
                    driveImage:
                        gameImages.get(id) ||
                        wishlistImages.get(id) ||
                        extra.image ||
                        ""
                };
            }
        );


    /*
     * Association avec la wishlist.
     */
    parsedData.wishlistGames =
        parsedData.wishlistGames.map(
            game => {
                const id = String(game.id);
                const extra = manifestItemsMap.get(id) || {};
                return {
                    ...extra,
                    ...game,
                    driveImage:
                        wishlistImages.get(id) ||
                        gameImages.get(id) ||
                        extra.image ||
                        ""
                };
            }
        );


    /*
     * Association avec les consoles.
     */
    parsedData.consoles =
        parsedData.consoles.map(
            consoleItem => {
                const id = String(consoleItem.id);
                const extra = manifestConsolesMap.get(id) || {};
                return {
                    ...extra,
                    ...consoleItem,
                    driveImage:
                        consoleImages.get(id) ||
                        extra.image ||
                        ""
                };
            }
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
const tabProfile = document.getElementById("tabProfile");
const badgeGames = document.getElementById("badgeGames");
const badgeConsoles = document.getElementById("badgeConsoles");
const badgeWishlist = document.getElementById("badgeWishlist");
const collectionSearch = document.getElementById("collectionSearch");
const searchBoxWrap = document.getElementById("searchBoxWrap");

// Profile Elements
const profileContent = document.getElementById("profileContent");
const profileEmail = document.getElementById("profileEmail");
const finishedCount = document.getElementById("finishedCount");
const backlogCount = document.getElementById("backlogCount");
const profileLogoutBtn = document.getElementById("profileLogoutBtn");

// Modal Elements
const itemModalOverlay = document.getElementById("itemModalOverlay");
const itemModalCard = document.getElementById("itemModalCard");
const itemModalCloseBtn = document.getElementById("itemModalCloseBtn");
const itemModalContent = document.getElementById("itemModalContent");
const modalAmbientAura = document.getElementById("modalAmbientAura");

let parsedData = {
    ownedGames: [],
    consoles: [],
    wishlistGames: [],
    finishedIds: new Set(),
    backlogIds: new Set()
};
let currentTab = "games"; // "games" | "consoles" | "wishlist" | "profile"

// 1. Listen for Authentication
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        localStorage.removeItem("arcade_relics_logged_in");
        localStorage.removeItem("arcade_relics_user_email");
        localStorage.removeItem("arcade_relics_drive_token");
        sessionStorage.removeItem("arcade_relics_drive_token");
        window.location.href = "index.html?login=true";
        return;
    }

    localStorage.setItem("arcade_relics_logged_in", "true");
    if (user.email) {
        localStorage.setItem("arcade_relics_user_email", user.email);
    }

    if (userEmail) {
        userEmail.textContent = user.email || "Compte Google";
    }
    if (profileEmail) {
        profileEmail.textContent = user.email || "Compte Google";
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

    const finished =
        Array.isArray(data.finished)
            ? data.finished
            : [];

    const backlog =
        Array.isArray(data.backlog)
            ? data.backlog
            : [];

    parsedData.finishedIds =
        new Set(
            finished.map(id => String(id))
        );

    parsedData.backlogIds =
        new Set(
            backlog.map(id => String(id))
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

    if (finishedCount) {
        finishedCount.textContent =
            parsedData.finishedIds.size;
    }

    if (backlogCount) {
        backlogCount.textContent =
            parsedData.backlogIds.size;
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

function openGameDetails(game, isWishlist = false) {

    if (!game) {
        return;
    }

    const existingModal =
        document.getElementById(
            "gameDetailModal"
        );

    if (existingModal) {
        existingModal.remove();
    }


    const title =
        game.title ||
        game.name ||
        "Jeu sans titre";

    const platform =
        getPlatformDisplayName(game);

    const cover =
        getGameCoverUrl(game);

    const meta =
        game.meta || {};


    const conditionLabels = {
        neuf: "Neuf",
        tbe: "Très bon état",
        bon: "Bon état",
        correct: "État correct",
        abime: "Abîmé",
        casse: "Cassé",
        nonfunc: "Non fonctionnel"
    };


    const languageLabels = {
        fr: "Français",
        en: "Anglais",
        jp: "Japonais",
        de: "Allemand",
        es: "Espagnol",
        it: "Italien",
        multi: "Multilingue"
    };


    const priorityLabels = {
        high: "Haute",
        medium: "Moyenne",
        low: "Basse"
    };


    const condition =
        conditionLabels[
        meta.condition
        ] ||
        meta.condition ||
        "Non renseigné";


    const language =
        languageLabels[
        meta.lang
        ] ||
        meta.lang ||
        "Non renseignée";


    const priority =
        priorityLabels[
        meta.priority
        ] ||
        meta.priority ||
        "Moyenne";


    const edition =
        meta.edition ||
        game.edition ||
        "Standard";


    const serial =
        meta.serial ||
        game.serial ||
        "—";


    const notes =
        meta.notes ||
        game.notes ||
        "";


    const complete =
        meta.complete === true ||
        meta.complete === "oui" ||
        meta.complete === "yes";


    const finished =
        parsedData.finishedIds.has(
            String(game.id)
        );


    const backlog =
        parsedData.backlogIds.has(
            String(game.id)
        );


    let status = "À jouer";

    if (isWishlist) {
        status = "Wishlist";
    } else if (finished) {
        status = "Terminé";
    } else if (backlog) {
        status = "Pile à terminer";
    }


    let addedDate = "—";

    if (game.addedAt) {

        try {

            addedDate =
                new Date(
                    game.addedAt
                ).toLocaleDateString(
                    "fr-FR"
                );

        } catch { }
    }


    const modal =
        document.createElement(
            "div"
        );

    modal.id =
        "gameDetailModal";

    modal.className =
        "item-modal-overlay";


    modal.innerHTML = `

        <div class="item-modal-wrapper">

            <div class="modal-ambient-aura ${isWishlist
            ? "aura-yellow"
            : ""
        }"></div>


            <div class="item-modal-card">

                <button
                    type="button"
                    class="item-modal-close-btn"
                    id="closeGameModal"
                    aria-label="Fermer"
                >
                    ×
                </button>


                <div class="modal-hero">

                    <div class="modal-cover-wrap">

                        ${cover
            ? `
                                    <img
                                        src="${escapeHtml(cover)}"
                                        alt="${escapeHtml(title)}"
                                        class="modal-cover-img"
                                    >
                                  `
            : `
                                    <div class="modal-cover-fallback">
                                        🎮
                                    </div>
                                  `
        }

                    </div>


                    <div class="modal-header-info">

                        <h2 class="modal-title">
                            ${escapeHtml(title)}
                        </h2>


                        <div class="modal-badge-row">

                            <span class="modal-badge modal-badge-cyan">
                                ${escapeHtml(platform)}
                            </span>

                            <span class="modal-badge ${isWishlist
            ? "modal-badge-yellow"
            : finished
                ? "modal-badge-green"
                : "modal-badge-purple"
        }">
                                ${escapeHtml(status)}
                            </span>

                            ${game.year
            ? `
                                        <span class="modal-badge modal-badge-neutral">
                                            ${escapeHtml(game.year)}
                                        </span>
                                      `
            : ""
        }

                        </div>

                    </div>

                </div>


                <div class="modal-section-title">
                    Informations
                </div>


                <div class="modal-grid">

                    <div class="modal-stat-box">
                        <span class="modal-stat-label">
                            Console
                        </span>
                        <span class="modal-stat-val">
                            ${escapeHtml(platform)}
                        </span>
                    </div>


                    ${isWishlist
            ? `
                                <div class="modal-stat-box">
                                    <span class="modal-stat-label">
                                        Priorité
                                    </span>
                                    <span class="modal-stat-val">
                                        ${escapeHtml(priority)}
                                    </span>
                                </div>
                              `
            : `
                                <div class="modal-stat-box">
                                    <span class="modal-stat-label">
                                        Langue
                                    </span>
                                    <span class="modal-stat-val">
                                        ${escapeHtml(language)}
                                    </span>
                                </div>
                              `
        }


                    <div class="modal-stat-box">
                        <span class="modal-stat-label">
                            Statut
                        </span>
                        <span class="modal-stat-val">
                            ${escapeHtml(status)}
                        </span>
                    </div>


                    <div class="modal-stat-box">
                        <span class="modal-stat-label">
                            Ajouté le
                        </span>
                        <span class="modal-stat-val">
                            ${escapeHtml(addedDate)}
                        </span>
                    </div>

                </div>


                ${!isWishlist
            ? `

                            <div class="modal-section-title">
                                Détails de l'exemplaire
                            </div>


                            <div class="modal-grid">

                                <div class="modal-stat-box">
                                    <span class="modal-stat-label">
                                        État de la boîte
                                    </span>
                                    <span class="modal-stat-val">
                                        ${escapeHtml(condition)}
                                    </span>
                                </div>


                                <div class="modal-stat-box">
                                    <span class="modal-stat-label">
                                        Contenu
                                    </span>
                                    <span class="modal-stat-val">
                                        ${complete
                ? "Complet"
                : "Non complet"
            }
                                    </span>
                                </div>


                                <div class="modal-stat-box">
                                    <span class="modal-stat-label">
                                        Code produit
                                    </span>
                                    <span class="modal-stat-val">
                                        ${escapeHtml(serial)}
                                    </span>
                                </div>


                                <div class="modal-stat-box">
                                    <span class="modal-stat-label">
                                        Édition
                                    </span>
                                    <span class="modal-stat-val">
                                        ${escapeHtml(edition)}
                                    </span>
                                </div>

                            </div>

                          `
            : `
                            <div class="modal-section-title">
                                Détails de la recherche
                            </div>
                          `
        }


                ${notes
            ? `

                            <div class="modal-section-title">
                                Notes
                            </div>

                            <div class="modal-notes-box">
                                ${escapeHtml(notes)}
                            </div>

                          `
            : ""
        }

            </div>

        </div>
    `;


    document.body.appendChild(
        modal
    );


    requestAnimationFrame(
        () => {
            modal.classList.add(
                "active"
            );
        }
    );


    const closeModal =
        () => {

            modal.classList.remove(
                "active"
            );

            setTimeout(
                () => modal.remove(),
                250
            );
        };


    document
        .getElementById(
            "closeGameModal"
        )
        ?.addEventListener(
            "click",
            closeModal
        );


    modal.addEventListener(
        "click",
        event => {

            if (
                event.target === modal
            ) {
                closeModal();
            }
        }
    );


    document.addEventListener(
        "keydown",
        function escapeHandler(event) {

            if (
                event.key === "Escape"
            ) {

                closeModal();

                document.removeEventListener(
                    "keydown",
                    escapeHandler
                );
            }
        }
    );
}

// 5. Render Current View
function renderCurrentView() {
    if (currentTab === "profile") {
        if (collectionList) collectionList.style.display = "none";
        if (emptyTabState) emptyTabState.style.display = "none";
        if (searchBoxWrap) searchBoxWrap.style.display = "none";
        if (profileContent) profileContent.style.display = "block";
        return;
    }

    if (profileContent) profileContent.style.display = "none";
    if (searchBoxWrap) searchBoxWrap.style.display = "flex";

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
                consoleItem.photo ||
                "";

            const coverHtml = consoleImage
                ? `<img src="${escapeHtml(consoleImage)}" alt="${escapeHtml(name)}" class="game-cover-img" loading="lazy">`
                : `<div class="game-cover-fallback"><span>🕹️</span><small style="font-size:0.75rem;color:var(--text-dim);">${escapeHtml(brand)}</small></div>`;

            card.innerHTML = `
                <div class="game-cover-wrap">
                    ${coverHtml}
                </div>
                <div class="game-card-body">
                    <h3 class="game-title" title="${escapeHtml(name)}">${escapeHtml(name)}</h3>
                    <div class="game-meta-row">
                        <span class="platform-pill" style="color: var(--pink); border-color: rgba(255, 45, 164, 0.3); background: rgba(255, 45, 164, 0.1);" title="${escapeHtml(brand)}">${escapeHtml(brand)}</span>
                        <span class="status-indicator" style="color: var(--pink);">🕹️ Console</span>
                    </div>
                </div>
            `;
            card.setAttribute("role", "button");
            card.setAttribute("tabindex", "0");
            card.setAttribute("aria-label", `Voir les détails de la console ${name}`);
            card.addEventListener("click", () => openDetailModal(consoleItem, "consoles"));
            card.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDetailModal(consoleItem, "consoles");
                }
            });

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

            card.setAttribute("role", "button");
            card.setAttribute("tabindex", "0");
            card.setAttribute("aria-label", `Voir les détails du jeu ${title}`);
            card.addEventListener("click", () => {
                openGameDetails(
                    game,
                    currentTab === "wishlist"
                );
            });
            card.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openGameDetails(
                        game,
                        currentTab === "wishlist"
                    );
                }
            });

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

    [tabGames, tabConsoles, tabWishlist, tabProfile].forEach(btn => {
        if (btn) btn.classList.remove("active");
    });

    if (tabName === "games" && tabGames) tabGames.classList.add("active");
    if (tabName === "consoles" && tabConsoles) tabConsoles.classList.add("active");
    if (tabName === "wishlist" && tabWishlist) tabWishlist.classList.add("active");
    if (tabName === "profile" && tabProfile) tabProfile.classList.add("active");

    renderCurrentView();
}

if (tabGames) tabGames.addEventListener("click", () => switchTab("games"));
if (tabConsoles) tabConsoles.addEventListener("click", () => switchTab("consoles"));
if (tabWishlist) tabWishlist.addEventListener("click", () => switchTab("wishlist"));
if (tabProfile) tabProfile.addEventListener("click", () => switchTab("profile"));

if (profileLogoutBtn) {
    profileLogoutBtn.addEventListener("click", async () => {
        try {
            localStorage.removeItem("arcade_relics_logged_in");
            localStorage.removeItem("arcade_relics_user_email");
            localStorage.removeItem("arcade_relics_drive_token");
            sessionStorage.removeItem("arcade_relics_drive_token");
            await signOut(auth);
            window.location.href = "index.html";
        } catch (e) {
            console.error("Erreur déconnexion :", e);
            window.location.href = "index.html";
        }
    });
}

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
            localStorage.removeItem("arcade_relics_logged_in");
            localStorage.removeItem("arcade_relics_user_email");
            localStorage.removeItem("arcade_relics_drive_token");
            sessionStorage.removeItem("arcade_relics_drive_token");
            await signOut(auth);
            window.location.href = "index.html";
        } catch (e) {
            console.error("Erreur déconnexion :", e);
            window.location.href = "index.html";
        }
    });
}

// 6. Modal Functions (Inspection des détails du jeu ou de la console)
function openDetailModal(item, type) {
    if (!itemModalOverlay || !itemModalContent) return;

    if (modalAmbientAura) {
        modalAmbientAura.className = "modal-ambient-aura";
        if (type === "consoles") modalAmbientAura.classList.add("aura-pink");
        else if (type === "wishlist") modalAmbientAura.classList.add("aura-yellow");
    }

    itemModalContent.innerHTML = generateDetailModalHtml(item, type);
    itemModalOverlay.classList.add("active");
    itemModalOverlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeDetailModal() {
    if (!itemModalOverlay) return;
    itemModalOverlay.classList.remove("active");
    itemModalOverlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

function generateDetailModalHtml(item, type) {
    const isConsole = type === "consoles";
    const isWishlist = type === "wishlist";

    const title = item.title || item.name || item.titre || (isConsole ? "Console" : "Jeu sans titre");
    const platform = isConsole ? (item.brand || "Console") : getPlatformDisplayName(item);
    const coverUrl = isConsole
        ? (item.driveImage || item.image || item.cover || item.photo || "")
        : getGameCoverUrl(item);

    const coverHtml = coverUrl
        ? `<img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(title)}" class="modal-cover-img">`
        : `<div class="modal-cover-fallback"><span>${isConsole ? "🕹️" : "🎮"}</span></div>`;

    // Status Badge
    let statusBadgeHtml = "";
    if (isConsole) {
        statusBadgeHtml = `<span class="modal-badge modal-badge-pink">🕹️ Console</span>`;
    } else if (isWishlist) {
        statusBadgeHtml = `<span class="modal-badge modal-badge-yellow">⭐ En Wishlist</span>`;
    } else {
        statusBadgeHtml = `<span class="modal-badge modal-badge-green">✓ Possédé</span>`;
    }

    // Platform Badge
    const platformBadgeHtml = platform
        ? `<span class="modal-badge ${isConsole ? "modal-badge-pink" : "modal-badge-cyan"}">${escapeHtml(platform)}</span>`
        : "";

    // Condition / État
    const condition = item.condition || item.etat || item.state || "";
    const conditionBadgeHtml = condition
        ? `<span class="modal-badge modal-badge-purple">🏷️ État : ${escapeHtml(condition)}</span>`
        : "";

    // Region
    const region = item.region || item.zone || item.country || "";
    const regionBadgeHtml = region
        ? `<span class="modal-badge modal-badge-neutral">🌍 ${escapeHtml(region)}</span>`
        : "";

    // Checklist (Boîte, Notice, Cale, etc.)
    let checklistHtml = "";
    const hasAnyCheck = [
        "hasBox", "box", "boite",
        "hasManual", "manual", "notice",
        "hasInsert", "insert", "cale",
        "hasCartridge", "cartridge", "cartouche"
    ].some(k => item[k] !== undefined && item[k] !== null && item[k] !== "");

    if (hasAnyCheck && !isConsole) {
        const checkItems = [
            { label: "📦 Boîte", val: item.hasBox ?? item.box ?? item.boite },
            { label: "📖 Notice", val: item.hasManual ?? item.manual ?? item.notice },
            { label: "📑 Cale / Insert", val: item.hasInsert ?? item.insert ?? item.cale },
            { label: "💾 Cartouche / Disque", val: item.hasCartridge ?? item.cartridge ?? item.cartouche ?? item.disc }
        ];

        checklistHtml = `
            <div style="margin-top: 14px;">
                <div class="modal-checklist">
                    ${checkItems.filter(c => c.val !== undefined && c.val !== null && c.val !== "").map(c => {
            const isTrue = c.val === true || c.val === 1 || c.val === "1" || String(c.val).toLowerCase() === "oui" || String(c.val).toLowerCase() === "yes";
            return `<span class="modal-check-item ${isTrue ? "active" : "inactive"}">${c.label} : ${isTrue ? "✓ Oui" : "✗ Non"}</span>`;
        }).join("")}
                </div>
            </div>
        `;
    }

    // Key Stats Grid
    const statBoxes = [];

    // Financials
    const price = item.purchasePrice ?? item.buyPrice ?? item.price ?? item.prix ?? item.prixAchat ?? item.prix_achat;
    if (price !== undefined && price !== null && price !== "") {
        const numPrice = typeof price === "number" ? price.toFixed(2) : price;
        statBoxes.push({ label: "Prix d'achat", val: `${escapeHtml(numPrice)} €`, icon: "💰" });
    }

    const value = item.estimatedValue ?? item.currentValue ?? item.value ?? item.valeur ?? item.cote;
    if (value !== undefined && value !== null && value !== "") {
        const numVal = typeof value === "number" ? value.toFixed(2) : value;
        statBoxes.push({ label: "Cote / Valeur", val: `${escapeHtml(numVal)} €`, icon: "📈" });
    }

    const purchaseDate = item.purchaseDate ?? item.buyDate ?? item.dateAchat ?? item.date_achat ?? item.date;
    if (purchaseDate) {
        statBoxes.push({ label: "Date d'acquisition", val: escapeHtml(String(purchaseDate)), icon: "📅" });
    }

    const location = item.purchaseLocation ?? item.location ?? item.lieu ?? item.lieuAchat ?? item.magasin ?? item.store;
    if (location) {
        statBoxes.push({ label: "Lieu d'achat", val: escapeHtml(String(location)), icon: "📍" });
    }

    // Game / Console Metadata
    const releaseYear = item.releaseYear || item.releaseDate || item.year || item.annee;
    if (releaseYear) {
        statBoxes.push({ label: "Année de sortie", val: escapeHtml(String(releaseYear)), icon: "🗓️" });
    }

    const publisher = item.publisher || item.editor || item.editeur;
    if (publisher) {
        statBoxes.push({ label: "Éditeur", val: escapeHtml(String(publisher)), icon: "🏢" });
    }

    const developer = item.developer || item.developpeur;
    if (developer) {
        statBoxes.push({ label: "Développeur", val: escapeHtml(String(developer)), icon: "💻" });
    }

    const genre = Array.isArray(item.genres) ? item.genres.join(", ") : (item.genre || item.genres);
    if (genre) {
        statBoxes.push({ label: "Genre", val: escapeHtml(String(genre)), icon: "🎯" });
    }

    const edition = item.edition || item.version;
    if (edition) {
        statBoxes.push({ label: "Édition / Version", val: escapeHtml(String(edition)), icon: "✨" });
    }

    const rating = item.rating ?? item.note ?? item.score;
    if (rating !== undefined && rating !== null && rating !== "") {
        let ratingStr = String(rating);
        const num = Number(rating);
        if (!isNaN(num) && num > 0 && num <= 5) {
            ratingStr = "⭐".repeat(Math.round(num)) + ` (${num}/5)`;
        }
        statBoxes.push({ label: "Note personnelle", val: ratingStr, icon: "⭐" });
    }

    const progress = item.progress || item.progression || item.statusProgression || item.completed;
    if (progress !== undefined && progress !== null && progress !== "") {
        let progStr = String(progress);
        if (progress === true || progress === 1 || progress === "1") progStr = "Terminé 🏆";
        statBoxes.push({ label: "Statut jeu", val: escapeHtml(progStr), icon: "🕹️" });
    }

    const storage = item.storage || item.emplacement || item.rangement || item.etagere;
    if (storage) {
        statBoxes.push({ label: "Emplacement / Rangement", val: escapeHtml(String(storage)), icon: "📦" });
    }

    const serial = item.serial || item.serialNumber || item.numeroSerie || item.numero_serie;
    if (serial) {
        statBoxes.push({ label: "Numéro de série", val: escapeHtml(String(serial)), icon: "🔢" });
    }

    const barcode = item.barcode || item.upc || item.ean || item.codeBarre || item.code_barre;
    if (barcode) {
        statBoxes.push({ label: "Code-barres / EAN", val: escapeHtml(String(barcode)), icon: "🏷️" });
    }

    const statsGridHtml = statBoxes.length > 0
        ? `
            <div class="modal-section-title">📊 Données de votre collection</div>
            <div class="modal-grid">
                ${statBoxes.map(s => `
                    <div class="modal-stat-box">
                        <div class="modal-stat-label">${s.icon} ${s.label}</div>
                        <div class="modal-stat-val">${s.val}</div>
                    </div>
                `).join("")}
            </div>
        `
        : "";

    // Comments / Notes
    const comment = item.comment || item.comments || item.notes || item.notePerso || item.description || item.remarque || item.remarques;
    const commentHtml = comment
        ? `
            <div class="modal-section-title">📝 Notes & Commentaires personnels</div>
            <div class="modal-notes-box">${escapeHtml(String(comment))}</div>
        `
        : "";

    // Extra dynamic properties (catch-all so NO data entered on mobile is lost!)
    const knownKeys = new Set([
        "id", "consoleId", "console_id", "title", "name", "titre", "platform", "platformName",
        "console", "consoleName", "system", "systemName", "brand", "manufacturer", "company",
        "coverUrl", "cover", "image", "imageUrl", "thumbnail", "boxArt", "box_art", "picture",
        "driveImage", "condition", "etat", "state", "region", "zone", "country",
        "hasBox", "box", "boite", "hasManual", "manual", "notice", "hasInsert", "insert", "cale",
        "hasCartridge", "cartridge", "cartouche", "disc", "cd",
        "purchasePrice", "buyPrice", "price", "prix", "prixAchat", "prix_achat",
        "estimatedValue", "currentValue", "value", "valeur", "cote",
        "purchaseDate", "buyDate", "dateAchat", "date_achat", "date",
        "purchaseLocation", "location", "lieu", "lieuAchat", "magasin", "store",
        "releaseYear", "releaseDate", "year", "annee", "publisher", "editor", "editeur",
        "developer", "developpeur", "genre", "genres", "edition", "version",
        "rating", "note", "score", "progress", "progression", "statusProgression", "completed",
        "storage", "emplacement", "rangement", "etagere", "serial", "serialNumber", "numeroSerie", "numero_serie",
        "barcode", "upc", "ean", "codeBarre", "code_barre", "comment", "comments", "notes", "notePerso",
        "description", "remarque", "remarques", "images", "tags"
    ]);

    const extraBoxes = [];
    Object.keys(item).forEach(key => {
        if (!knownKeys.has(key)) {
            const val = item[key];
            if (val !== undefined && val !== null && val !== "" && typeof val !== "object" && typeof val !== "function") {
                extraBoxes.push({
                    label: key.replace(/_/g, " "),
                    val: escapeHtml(String(val))
                });
            }
        }
    });

    const extraGridHtml = extraBoxes.length > 0
        ? `
            <div class="modal-section-title">ℹ️ Informations complémentaires</div>
            <div class="modal-grid">
                ${extraBoxes.map(e => `
                    <div class="modal-stat-box">
                        <div class="modal-stat-label">${escapeHtml(e.label)}</div>
                        <div class="modal-stat-val">${e.val}</div>
                    </div>
                `).join("")}
            </div>
        `
        : "";

    return `
        <div class="modal-hero">
            <div class="modal-cover-wrap">
                ${coverHtml}
            </div>
            <div class="modal-header-info">
                <h2 class="modal-title">${escapeHtml(title)}</h2>
                <div class="modal-badge-row">
                    ${statusBadgeHtml}
                    ${platformBadgeHtml}
                    ${conditionBadgeHtml}
                    ${regionBadgeHtml}
                </div>
                ${checklistHtml}
            </div>
        </div>
        ${statsGridHtml}
        ${commentHtml}
        ${extraGridHtml}
    `;
}

// Modal Listeners
if (itemModalCloseBtn) {
    itemModalCloseBtn.addEventListener("click", closeDetailModal);
}

if (itemModalOverlay) {
    itemModalOverlay.addEventListener("click", (e) => {
        if (e.target === itemModalOverlay) {
            closeDetailModal();
        }
    });
}

window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeDetailModal();
    }
});
