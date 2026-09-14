import {
    app,
    auth
} from "./firebase-auth.js";

import {
    onAuthStateChanged,
    signOut,
    signInWithPopup,
    GoogleAuthProvider
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

/* =========================================================================
 * INDEXEDDB CACHE FOR PHOTOS & MANIFEST (Permanent offline cache)
 * ========================================================================= */
const DB_NAME = "ArcadeRelicsCache";
const DB_VERSION = 1;
const STORE_NAME = "media";

function openCacheDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveToCache(entries) {
    try {
        const db = await openCacheDB();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        for (const { key, val } of entries) {
            store.put(val, key);
        }
        await new Promise((res) => { tx.oncomplete = res; });
    } catch (err) {
        console.warn("Erreur sauvegarde IndexedDB :", err);
    }
}

async function getAllFromCache() {
    try {
        const db = await openCacheDB();
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.openCursor();
        const items = [];
        return new Promise((resolve) => {
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    items.push({ key: cursor.key, val: cursor.value });
                    cursor.continue();
                } else {
                    resolve(items);
                }
            };
            req.onerror = () => resolve([]);
        });
    } catch (err) {
        return [];
    }
}

async function clearCacheDB() {
    try {
        const db = await openCacheDB();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        await new Promise((res) => { tx.oncomplete = res; });
    } catch (err) { }
}

function getGameSpineUrl(game) {
    if (!game) return "";
    if (game.driveSpineImage) return game.driveSpineImage;
    if (game.spineUrl) return game.spineUrl;
    if (game.spineImage) return game.spineImage;
    if (game.spine) return game.spine;
    if (game.trancheUrl) return game.trancheUrl;
    if (game.trancheImage) return game.trancheImage;
    if (game.tranche) return game.tranche;
    if (game.photo_tranche) return game.photo_tranche;

    // Dans l'app : images[0] = face avant, images[1] = tranche, images[2] = face arrière
    const list = Array.isArray(game.images) ? game.images : (Array.isArray(game.photos) ? game.photos : []);
    if (list.length >= 3) {
        const candidate = list[1];
        if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
        if (candidate && typeof candidate === "object") {
            const u = candidate.url || candidate.uri || candidate.path || candidate.src || candidate.file;
            if (typeof u === "string" && u.trim()) return u.trim();
        }
    }

    if (game.meta && typeof game.meta === "object") {
        if (game.meta.spineImage) return game.meta.spineImage;
        if (game.meta.spine) return game.meta.spine;
        const metaList = Array.isArray(game.meta.images) ? game.meta.images : [];
        if (metaList.length >= 2) {
            const candidate = metaList[1];
            if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
            if (candidate && typeof candidate === "object") {
                return candidate.url || candidate.uri || candidate.path || "";
            }
        }
    }

    return "";
}

function applyEnrichedData(
    gameImages,
    wishlistImages,
    consoleImages,
    spineImages,
    manifestItemsMap,
    manifestConsolesMap
) {
    if (parsedData.ownedGames) {
        parsedData.ownedGames = parsedData.ownedGames.map(game => {
            const id = String(game.id);
            const extra = manifestItemsMap.get(id) || {};
            const img = gameImages.get(id) || wishlistImages.get(id) || extra.image || game.driveImage || "";
            const spineImg =
                (spineImages && spineImages.get(id)) ||
                "";

            return {
                ...extra,
                ...game,
                driveImage: img,
                driveSpineImage: spineImg
            };
        });
    }

    if (parsedData.wishlistGames) {
        parsedData.wishlistGames = parsedData.wishlistGames.map(game => {
            const id = String(game.id);
            const isConsole = isConsoleItem(game) || (manifestConsolesMap && manifestConsolesMap.has(id));
            const extra = (isConsole && manifestConsolesMap ? manifestConsolesMap.get(id) : null) || (manifestItemsMap ? manifestItemsMap.get(id) : null) || (manifestConsolesMap ? manifestConsolesMap.get(id) : null) || {};
            const img = wishlistImages.get(id) || (isConsole ? consoleImages.get(id) : gameImages.get(id)) || consoleImages.get(id) || gameImages.get(id) || extra.image || game.driveImage || "";
            const spineImg =
                (spineImages && spineImages.get(id)) ||
                "";
            return {
                ...extra,
                ...game,
                ...(isConsole ? { isConsole: true } : {}),
                driveImage: img,
                driveSpineImage: spineImg
            };
        });
        updateWishlistFilterCounts();
    }

    if (parsedData.consoles) {
        parsedData.consoles = parsedData.consoles.map(consoleItem => {
            const id = String(consoleItem.id);
            const extra = manifestConsolesMap.get(id) || {};
            const img = consoleImages.get(id) || extra.image || consoleItem.driveImage || "";
            return {
                ...extra,
                ...consoleItem,
                driveImage: img
            };
        });
    }
}
async function loadCachedDataFromDB() {

    try {

        const items =
            await getAllFromCache();

        if (
            !items ||
            items.length === 0
        ) {
            return false;
        }


        /*
         * Images restaurées depuis
         * le cache IndexedDB.
         */
        const cachedGameImages =
            new Map();

        const cachedWishlistImages =
            new Map();

        const cachedConsoleImages =
            new Map();

        const cachedSpineImages =
            new Map();


        /*
         * Métadonnées du manifest.
         */
        const cachedManifestItemsMap =
            new Map();

        const cachedManifestConsolesMap =
            new Map();


        items.forEach(
            ({ key, val }) => {

                if (
                    typeof key !== "string"
                ) {
                    return;
                }


                /*
                 * JAQUETTES JEUX
                 */
                if (
                    key.startsWith(
                        "game_"
                    )
                ) {

                    const id =
                        key.replace(
                            "game_",
                            ""
                        );

                    const url =
                        URL.createObjectURL(
                            val
                        );

                    driveImageObjectUrls.push(
                        url
                    );

                    cachedGameImages.set(
                        id,
                        url
                    );

                    return;
                }


                /*
                 * JAQUETTES WISHLIST
                 */
                if (
                    key.startsWith(
                        "wishlist_"
                    )
                ) {

                    const id =
                        key.replace(
                            "wishlist_",
                            ""
                        );

                    const url =
                        URL.createObjectURL(
                            val
                        );

                    driveImageObjectUrls.push(
                        url
                    );

                    cachedWishlistImages.set(
                        id,
                        url
                    );

                    return;
                }


                /*
                 * IMAGES CONSOLES
                 */
                if (
                    key.startsWith(
                        "console_"
                    )
                ) {

                    const id =
                        key.replace(
                            "console_",
                            ""
                        );

                    const url =
                        URL.createObjectURL(
                            val
                        );

                    driveImageObjectUrls.push(
                        url
                    );

                    cachedConsoleImages.set(
                        id,
                        url
                    );

                    return;
                }


                /*
                 * PHOTOS DES TRANCHES
                 */
                if (
                    key.startsWith(
                        "spine_"
                    )
                ) {

                    const id =
                        key.replace(
                            "spine_",
                            ""
                        );

                    const url =
                        URL.createObjectURL(
                            val
                        );

                    driveImageObjectUrls.push(
                        url
                    );

                    cachedSpineImages.set(
                        id,
                        url
                    );

                    return;
                }


                /*
                 * MANIFEST DU BACKUP
                 */
                if (
                    key ===
                    "__manifest_json__"
                ) {

                    try {

                        const manifestJson =
                            JSON.parse(
                                val
                            );

                        const values =
                            manifestJson.values ||
                            manifestJson;


                        const backupItems =
                            parseBackupArray(
                                values.otr_items ||
                                values.items
                            );


                        const backupConsoles =
                            parseBackupArray(
                                values.otr_user_consoles ||
                                values.consoles
                            );


                        backupItems.forEach(
                            item => {

                                if (
                                    item &&
                                    item.id != null
                                ) {

                                    cachedManifestItemsMap.set(
                                        String(
                                            item.id
                                        ),
                                        item
                                    );
                                }
                            }
                        );


                        backupConsoles.forEach(
                            consoleItem => {

                                if (
                                    consoleItem &&
                                    consoleItem.id != null
                                ) {

                                    cachedManifestConsolesMap.set(
                                        String(
                                            consoleItem.id
                                        ),
                                        consoleItem
                                    );
                                }
                            }
                        );

                    } catch (
                    manifestError
                    ) {

                        console.warn(
                            "Erreur cache manifest :",
                            manifestError
                        );
                    }
                }

            }
        );
        // Check if any items in cachedManifestItemsMap have direct spine URLs
        if (cachedManifestItemsMap.size > 0) {
            cachedManifestItemsMap.forEach((item, id) => {
                if (!cachedSpineImages.has(id)) {
                    const spineUrl = getGameSpineUrl(item);
                    if (spineUrl && (spineUrl.startsWith("http://") || spineUrl.startsWith("https://") || spineUrl.startsWith("data:"))) {
                        cachedSpineImages.set(id, spineUrl);
                    }
                }
            });
        }

        const totalImages =
            cachedGameImages.size +
            cachedWishlistImages.size +
            cachedConsoleImages.size +
            cachedSpineImages.size;

        console.log(
            "Photos restaurées depuis le cache local IndexedDB :",
            {
                total: totalImages,
                jeux: cachedGameImages.size,
                wishlist: cachedWishlistImages.size,
                consoles: cachedConsoleImages.size,
                tranches: cachedSpineImages.size
            }
        );

        if (totalImages > 0) {
            applyEnrichedData(
                cachedGameImages,
                cachedWishlistImages,
                cachedConsoleImages,
                cachedSpineImages,
                cachedManifestItemsMap,
                cachedManifestConsolesMap
            );

            return { success: true, spineCount: cachedSpineImages.size, total: totalImages };
        }

        return { success: false, spineCount: 0, total: 0 };
    } catch (error) {
        console.warn("Erreur lecture cache local :", error);
        return { success: false, spineCount: 0, total: 0 };
    }
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
    let manifestRawText = "";
    const manifestFile = zip.file("manifest.json") || zip.file("backup.json");
    if (manifestFile) {
        try {
            manifestRawText = await manifestFile.async("string");
            const manifestJson = JSON.parse(manifestRawText);
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


    const entriesToCache = [];
    if (manifestRawText) {
        entriesToCache.push({ key: "__manifest_json__", val: manifestRawText });
    }

    const gameImages =
        new Map();

    const wishlistImages =
        new Map();

    const consoleImages =
        new Map();

    const spineImages =
        new Map();

    function extractItemSpineRef(item) {

        if (!item) {
            return "";
        }

        const list =
            Array.isArray(item.images)
                ? item.images
                : (
                    Array.isArray(item.photos)
                        ? item.photos
                        : []
                );


        /*
         * PRIORITÉ :
         * chercher l'image "_2".
         *
         * Backup Arcade Relics :
         * _1 = avant
         * _2 = tranche
         * _3 = arrière
         */
        const numberedSpine =
            list.find(
                image => {

                    if (
                        typeof image !== "string"
                    ) {
                        return false;
                    }

                    return /_2\.(webp|png|jpe?g|gif)$/i
                        .test(image);
                }
            );

        if (numberedSpine) {
            return numberedSpine;
        }


        /*
         * L'application stocke aussi
         * normalement la tranche à images[1].
         */
        if (list.length >= 3) {

            const candidate =
                list[1];

            if (
                typeof candidate === "string" &&
                candidate.trim()
            ) {
                return candidate.trim();
            }

            if (
                candidate &&
                typeof candidate === "object"
            ) {

                return (
                    candidate.path ||
                    candidate.uri ||
                    candidate.url ||
                    candidate.file ||
                    candidate.src ||
                    ""
                );
            }
        }


        /*
         * Anciens formats / compatibilité.
         */
        const directCandidates = [
            item.spineImage,
            item.spineUrl,
            item.spine,
            item.tranche,
            item.trancheImage,
            item.photo_tranche
        ];


        for (
            const candidate
            of directCandidates
        ) {

            if (
                typeof candidate === "string" &&
                candidate.trim()
            ) {
                return candidate.trim();
            }
        }


        return "";
    }

    function findFileInZip(zip, ref) {
        if (!ref || typeof ref !== "string") return null;
        let clean = ref.replace(/\\/g, "/").replace(/^\/+/, "");
        if (clean.startsWith("file://")) clean = clean.replace(/^file:\/\/\/?/, "");

        // 1. Chemin direct
        let f = zip.file(clean);
        if (f) return f;

        // 2. Avec préfixe images/ ou images/games/
        f = zip.file("images/" + clean) || zip.file("images/games/" + clean);
        if (f) return f;

        // 3. Avec juste le nom de fichier (basename)
        const base = clean.split("/").pop();
        if (base) {
            f = zip.file(base) ||
                zip.file("images/" + base) ||
                zip.file("images/games/" + base) ||
                zip.file("images/wishlist/" + base) ||
                zip.file("images/spines/" + base) ||
                zip.file("images/tranches/" + base);
            if (f) return f;

            // 4. Recherche insensible à la casse dans l'ensemble des fichiers du ZIP
            const lowerBase = base.toLowerCase();
            for (const [zPath, zFile] of Object.entries(zip.files)) {
                if (zFile.dir) continue;
                if (zPath.toLowerCase().endsWith(lowerBase)) {
                    return zFile;
                }
            }
        }
        return null;
    }

    /*
     * Parcours directement TOUS les fichiers présents dans le ZIP.
     */
    for (const [path, file] of Object.entries(zip.files)) {
        if (file.dir) continue;

        /*
         * 1. Tranches jeux possédés ou wishlist
         * Exemples : images/games/123_spine.webp, images/games/123_tranche.webp, images/games/123_1.webp, images/spines/123.webp
         */
        let spineMatch =
            path.match(
                /^images\/games\/(.+?)_(?:spine|tranche|edge|side|2)\.(webp|png|jpe?g|gif)$/i
            ) ||
            path.match(/^images\/wishlist\/(.+?)_(?:spine|tranche|edge|side)\.(webp|png|jpe?g|gif)$/i) ||
            path.match(/^images\/(?:spines?|tranches?)\/(.+?)(?:_cover|_spine|_tranche|_1)?\.(webp|png|jpe?g|gif)$/i) ||
            path.match(/^(?:spines?|tranches?)\/(.+?)\.(webp|png|jpe?g|gif)$/i);

        if (spineMatch) {
            const id = String(spineMatch[1]);
            const blob = await file.async("blob");
            entriesToCache.push({ key: `spine_${id}`, val: blob });
            const url = URL.createObjectURL(blob);
            driveImageObjectUrls.push(url);
            spineImages.set(id, url);
            continue;
        }

        /*
         * 2. Jaquettes jeux possédés
         * Exemples : images/games/123_cover.webp, images/games/123_0.webp
         */
        let match =
            path.match(/^images\/games\/(.+?)_(?:cover|0)\.(webp|png|jpe?g|gif)$/i) ||
            path.match(/^images\/games\/(.+?)\.(webp|png|jpe?g|gif)$/i);

        if (match) {
            const id = String(match[1]);
            const blob = await file.async("blob");
            entriesToCache.push({ key: `game_${id}`, val: blob });
            const url = URL.createObjectURL(blob);
            driveImageObjectUrls.push(url);
            gameImages.set(id, url);
            continue;
        }

        /*
         * 3. Wishlist
         */
        match =
            path.match(/^images\/wishlist\/(.+?)_(?:cover|0)\.(webp|png|jpe?g|gif)$/i) ||
            path.match(/^images\/wishlist\/(.+?)\.(webp|png|jpe?g|gif)$/i);

        if (match) {
            const id = String(match[1]);
            const blob = await file.async("blob");
            entriesToCache.push({ key: `wishlist_${id}`, val: blob });
            const url = URL.createObjectURL(blob);
            driveImageObjectUrls.push(url);
            wishlistImages.set(id, url);
            continue;
        }

        /*
         * 4. Consoles
         */
        match =
            path.match(/^images\/consoles\/(.+?)_cover\.(webp|png|jpe?g|gif)$/i) ||
            path.match(/^images\/consoles\/(.+?)\.(webp|png|jpe?g|gif)$/i);

        if (match) {
            const id = String(match[1]);
            const blob = await file.async("blob");
            entriesToCache.push({ key: `console_${id}`, val: blob });
            const url = URL.createObjectURL(blob);
            driveImageObjectUrls.push(url);
            consoleImages.set(id, url);
            continue;
        }
    }

    /*
     * 5. Compléter avec les références du manifest.json ou des items
     */
    const allItemsToCrossCheck = new Map(manifestItemsMap);
    if (parsedData.ownedGames) {
        parsedData.ownedGames.forEach(g => {
            const id = String(g.id);
            if (!allItemsToCrossCheck.has(id)) allItemsToCrossCheck.set(id, g);
        });
    }
    if (parsedData.wishlistGames) {
        parsedData.wishlistGames.forEach(g => {
            const id = String(g.id);
            if (!allItemsToCrossCheck.has(id)) allItemsToCrossCheck.set(id, g);
        });
    }

    for (const [id, item] of allItemsToCrossCheck.entries()) {
        if (spineImages.has(String(id))) continue;

        const ref = extractItemSpineRef(item);
        if (!ref) continue;

        if (ref.startsWith("http://") || ref.startsWith("https://") || ref.startsWith("data:")) {
            spineImages.set(String(id), ref);
            continue;
        }

        const spineFile = findFileInZip(zip, ref);
        if (spineFile) {
            const blob = await spineFile.async("blob");
            entriesToCache.push({ key: `spine_${id}`, val: blob });
            const url = URL.createObjectURL(blob);
            driveImageObjectUrls.push(url);
            spineImages.set(String(id), url);
        }
    }

    console.log("Photos trouvées dans le ZIP :", {
        jeux: gameImages.size,
        tranches: spineImages.size,
        wishlist: wishlistImages.size,
        consoles: consoleImages.size
    });

    if (spineImages.size === 0) {
        const sampleFiles = Object.keys(zip.files).filter(p => !zip.files[p].dir).slice(0, 30);
        console.warn("Aperçu des 30 premiers fichiers dans le ZIP :", sampleFiles);
    }

    if (entriesToCache.length > 0) {
        saveToCache(entriesToCache);
    }

    applyEnrichedData(gameImages, wishlistImages, consoleImages, spineImages, manifestItemsMap, manifestConsolesMap);
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
const viewModeToggle = document.getElementById("viewModeToggle");
const viewModeGrid = document.getElementById("viewModeGrid");
const viewModeShelf = document.getElementById("viewModeShelf");

// View Mode State ("grid" | "shelf")
let currentViewMode = localStorage.getItem("arcade_relics_view_mode") || "grid";

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

const wishlistFilterToggle = document.getElementById("wishlistFilterToggle");
const filterWishlistAll = document.getElementById("filterWishlistAll");
const filterWishlistGames = document.getElementById("filterWishlistGames");
const filterWishlistConsoles = document.getElementById("filterWishlistConsoles");

let parsedData = {
    ownedGames: [],
    consoles: [],
    wishlistGames: [],
    finishedIds: new Set(),
    backlogIds: new Set()
};
let currentTab = "games"; // "games" | "consoles" | "wishlist" | "profile"
let wishlistFilter = "all"; // "all" | "games" | "consoles"

// Helper to identify if an item is a console (vs a game)
function isConsoleItem(item) {
    if (!item) return false;
    if (item.isConsole === true) return true;
    const rawType = String(item.type || item.itemType || item.category || item.kind || "").toLowerCase();
    if (rawType.includes("console") || rawType.includes("hardware") || rawType.includes("machine")) return true;
    if (Array.isArray(parsedData.consoles) && parsedData.consoles.some(c => c && String(c.id) === String(item.id))) {
        return true;
    }
    if ((item.brand || item.manufacturer || item.company) && !item.console && !item.platform && !item.system && !item.consoleName && !item.platformName) {
        return true;
    }
    return false;
}

function updateWishlistFilterCounts() {
    const list = parsedData.wishlistGames || [];
    const allCount = list.length;
    const gamesCount = list.filter(it => !isConsoleItem(it)).length;
    const consolesCount = list.filter(it => isConsoleItem(it)).length;

    const elAll = document.getElementById("countWishlistAll");
    const elGames = document.getElementById("countWishlistGames");
    const elConsoles = document.getElementById("countWishlistConsoles");

    if (elAll) elAll.textContent = allCount;
    if (elGames) elGames.textContent = gamesCount;
    if (elConsoles) elConsoles.textContent = consolesCount;
}

function setWishlistFilter(filter) {
    wishlistFilter = filter;
    const filterBtns = [filterWishlistAll, filterWishlistGames, filterWishlistConsoles];
    filterBtns.forEach(btn => {
        if (!btn) return;
        const isActive = btn.dataset.filter === filter;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-pressed", String(isActive));
    });
    renderCurrentView();
}

// 1. Listen for Authentication
onAuthStateChanged(auth, async (user) => {
    if (!user) {
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

    const driveSyncBanner = document.getElementById("driveSyncBanner");

    try {
        const data =
            await loadCloudSnapshot(
                user.uid
            );

        processCollectionData(data);

        // 1. Tenter d'abord de charger immédiatement les photos depuis le cache local IndexedDB
        const cacheResult = await loadCachedDataFromDB();
        const hasCachedImages = cacheResult && cacheResult.success;
        const cachedSpines = (cacheResult && cacheResult.spineCount) || 0;
        renderCurrentView();

        if (loading) loading.style.display = "none";
        if (errorMessage) errorMessage.style.display = "none";
        if (accountContent) accountContent.style.display = "block";

        // 2. Synchroniser Google Drive si le jeton d'accès est présent
        const accessToken =
            sessionStorage.getItem("arcade_relics_drive_token") ||
            localStorage.getItem("arcade_relics_drive_token");

        if (accessToken) {
            try {
                await loadGoogleDriveImages();
                renderCurrentView();
                if (driveSyncBanner) driveSyncBanner.style.display = "none";
            } catch (driveError) {
                console.warn("Photos Google Drive :", driveError);
                if ((!hasCachedImages || cachedSpines === 0) && driveSyncBanner) {
                    driveSyncBanner.style.display = "flex";
                }
            }
        } else {
            // Aucun jeton en mémoire : si le cache n'a pas les images OU si les tranches n'ont pas encore été synchronisées
            if ((!hasCachedImages || cachedSpines === 0) && driveSyncBanner) {
                driveSyncBanner.style.display = "flex";
                const bannerTitle = driveSyncBanner.querySelector(".drive-sync-text strong");
                const bannerSpan = driveSyncBanner.querySelector(".drive-sync-text span");
                if (hasCachedImages && cachedSpines === 0 && bannerTitle && bannerSpan) {
                    bannerTitle.textContent = "Photos réelles des tranches disponibles";
                    bannerSpan.textContent = "Cliquez sur 'Charger mes photos' pour importer les photos des tranches de vos jeux depuis votre backup Google Drive.";
                }
            }
        }

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

    // Collect all wishlist items (from items, and from consoles with matching id or wishlist flag)
    const wishlistItems = items.filter(
        item =>
            wishlistIds.has(
                String(item.id)
            )
    );

    const existingWishlistIds = new Set(wishlistItems.map(it => String(it.id)));

    consoles.forEach(c => {
        if (!c) return;
        const idStr = String(c.id);
        const inWishlist = wishlistIds.has(idStr) || c.isWishlist === true || c.wishlist === true || c.status === "wishlist" || c.etat === "wishlist";
        if (inWishlist) {
            if (!existingWishlistIds.has(idStr)) {
                wishlistItems.push({ ...c, isConsole: true });
                existingWishlistIds.add(idStr);
            } else {
                const found = wishlistItems.find(it => String(it.id) === idStr);
                if (found) found.isConsole = true;
            }
        }
    });

    const extraWishlistConsoles = Array.isArray(data.wishlistConsoles)
        ? data.wishlistConsoles
        : (Array.isArray(data.wishlist_consoles) ? data.wishlist_consoles : []);
    extraWishlistConsoles.forEach(c => {
        if (c && !existingWishlistIds.has(String(c.id))) {
            wishlistItems.push({ ...c, isConsole: true });
            existingWishlistIds.add(String(c.id));
        }
    });

    parsedData.wishlistGames = wishlistItems;
    parsedData.consoles = consoles;

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

    updateWishlistFilterCounts();
}

// Nettoyage des préfixes "other:" ou "autre:" souvent présents dans les exports de consoles personnalisées
function cleanPlatformName(name) {
    if (!name) return "";
    let cleaned = String(name).trim();
    cleaned = cleaned.replace(/^(?:other|autre)\s*[:\-_]\s*/i, "").trim();
    if (/^other$/i.test(cleaned)) {
        return "Autre";
    }
    return cleaned;
}

// Helper to resolve platform name from console ID or object
function getPlatformDisplayName(game) {
    if (!game) return "Jeu";
    const rawConsole = game.console || game.platform || game.system || "";
    if (!rawConsole) return "Jeu";

    let result = rawConsole;
    const cleanedRaw = cleanPlatformName(rawConsole).toLowerCase();

    if (Array.isArray(parsedData.consoles)) {
        const found = parsedData.consoles.find(c => {
            if (!c) return false;
            if (typeof c === "string") {
                return c === rawConsole || cleanPlatformName(c).toLowerCase() === cleanedRaw;
            }
            const cId = String(c.id ?? "");
            const cConsoleId = String(c.consoleId ?? "");
            const cConsole_id = String(c.console_id ?? "");
            const cKey = String(c.key ?? "");
            const cSlug = String(c.slug ?? "");
            const cName = String(c.name || c.title || c.consoleName || c.nom || c.label || "");

            return (
                cId === rawConsole ||
                cConsoleId === rawConsole ||
                cConsole_id === rawConsole ||
                cKey === rawConsole ||
                cSlug === rawConsole ||
                cleanPlatformName(cId).toLowerCase() === cleanedRaw ||
                cleanPlatformName(cSlug).toLowerCase() === cleanedRaw ||
                cleanPlatformName(cName).toLowerCase() === cleanedRaw
            );
        });

        if (found) {
            if (typeof found === "string") {
                result = found;
            } else {
                result = found.name || found.title || found.consoleName || found.nom || found.label || rawConsole;
            }
        }
    } else if (game.consoleName) {
        result = game.consoleName;
    } else if (game.platformName) {
        result = game.platformName;
    } else if (game.systemName) {
        result = game.systemName;
    }

    const finalResult = cleanPlatformName(result) || cleanPlatformName(rawConsole) || result || "Jeu";
    return finalResult;
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

    const spinePhotoUrl =
        game.driveSpineImage ||
        "";

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
                    aria-label="Fermer la fiche détaillée"
                >
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                        <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                    </svg>
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
        if (viewModeToggle) viewModeToggle.style.display = "none";
        return;
    }

    if (profileContent) profileContent.style.display = "none";
    if (searchBoxWrap) searchBoxWrap.style.display = "flex";

    // Wishlist filter toggle visibility
    if (wishlistFilterToggle) {
        wishlistFilterToggle.style.display = (currentTab === "wishlist") ? "inline-flex" : "none";
    }

    // View mode toggle visible only for games and wishlist (when not strictly consoles)
    if (viewModeToggle) {
        const canShowShelf = currentTab === "games" || (currentTab === "wishlist" && wishlistFilter !== "consoles");
        viewModeToggle.style.display = canShowShelf ? "inline-flex" : "none";
    }

    // Sync toggle button active states
    if (viewModeGrid && viewModeShelf) {
        viewModeGrid.classList.toggle("active", currentViewMode === "grid");
        viewModeGrid.setAttribute("aria-pressed", String(currentViewMode === "grid"));
        viewModeShelf.classList.toggle("active", currentViewMode === "shelf");
        viewModeShelf.setAttribute("aria-pressed", String(currentViewMode === "shelf"));
    }

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
        if (wishlistFilter === "games") {
            itemsToRender = itemsToRender.filter(item => !isConsoleItem(item));
        } else if (wishlistFilter === "consoles") {
            itemsToRender = itemsToRender.filter(item => isConsoleItem(item));
        }
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
        const isShelfAllowed = currentViewMode === "shelf" && (currentTab === "games" || (currentTab === "wishlist" && wishlistFilter !== "consoles"));
        collectionList.style.display = isShelfAllowed ? "flex" : "grid";
    }

    // Render Cards or Shelves
    if (currentTab === "consoles" || (currentTab === "wishlist" && wishlistFilter === "consoles")) {
        collectionList.className = "items-grid";
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

            const isWishlist = currentTab === "wishlist";

            card.innerHTML = `
                <div class="game-cover-wrap">
                    ${coverHtml}
                </div>
                <div class="game-card-body">
                    <h3 class="game-title" title="${escapeHtml(name)}">${escapeHtml(name)}</h3>
                    <div class="game-meta-row">
                        <span class="platform-pill" style="color: var(--pink); border-color: rgba(255, 45, 164, 0.3); background: rgba(255, 45, 164, 0.1);" title="${escapeHtml(brand)}">${escapeHtml(brand)}</span>
                        <span class="status-indicator" style="color: ${isWishlist ? "var(--yellow)" : "var(--pink)"};">${isWishlist ? "⭐ Wishlist" : "🕹️ Console"}</span>
                    </div>
                </div>
            `;
            card.setAttribute("role", "button");
            card.setAttribute("tabindex", "0");
            card.setAttribute("aria-label", `Voir les détails de la console ${name}`);
            card.addEventListener("click", () => openDetailModal(consoleItem, isWishlist ? "wishlist" : "consoles"));
            card.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDetailModal(consoleItem, isWishlist ? "wishlist" : "consoles");
                }
            });

            collectionList.appendChild(card);
        });
    } else if (currentViewMode === "shelf") {
        // Shelf view (Tranches sur étagères de bibliothèque)
        const shelfItems = currentTab === "wishlist" ? itemsToRender.filter(it => !isConsoleItem(it)) : itemsToRender;
        renderShelfView(shelfItems);
        // If wishlist with "all" and there are consoles, display them in an elegant section below the bookcase
        if (currentTab === "wishlist" && wishlistFilter === "all") {
            const wishlistConsoles = itemsToRender.filter(it => isConsoleItem(it));
            if (wishlistConsoles.length > 0) {
                renderWishlistConsolesBelowShelf(wishlistConsoles);
            }
        }
    } else {
        // Standard Grid view (Vignettes / Jaquettes)
        collectionList.className = "items-grid";
        itemsToRender.forEach(game => {
            const isConsole = isConsoleItem(game);
            const card = document.createElement("div");
            card.className = isConsole ? "console-card" : "game-card";

            const title = game.title || game.name || game.consoleName || (isConsole ? "Console" : "Jeu sans titre");
            const platform = isConsole ? (game.brand || "Console") : getPlatformDisplayName(game);
            const coverUrl = isConsole
                ? (game.driveImage || game.image || game.cover || game.photo || "")
                : getGameCoverUrl(game);

            const coverHtml = coverUrl
                ? `<img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(title)}" class="game-cover-img" loading="lazy">`
                : `<div class="game-cover-fallback"><span>${isConsole ? "🕹️" : "🎮"}</span><small style="font-size:0.75rem;color:var(--text-dim);">${escapeHtml(platform)}</small></div>`;

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
                        <span class="platform-pill" ${isConsole ? 'style="color: var(--pink); border-color: rgba(255, 45, 164, 0.3); background: rgba(255, 45, 164, 0.1);"' : ''} title="${escapeHtml(platform)}">${escapeHtml(platform)}</span>
                        <span class="status-indicator" style="color:${statusColor}">${statusLabel}</span>
                    </div>
                </div>
            `;

            card.setAttribute("role", "button");
            card.setAttribute("tabindex", "0");
            card.setAttribute("aria-label", `Voir les détails de ${isConsole ? "la console" : "du jeu"} ${title}`);
            card.addEventListener("click", () => {
                if (isConsole) {
                    openDetailModal(game, isWishlist ? "wishlist" : "consoles");
                } else {
                    openGameDetails(
                        game,
                        currentTab === "wishlist"
                    );
                }
            });
            card.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (isConsole) {
                        openDetailModal(game, isWishlist ? "wishlist" : "consoles");
                    } else {
                        openGameDetails(
                            game,
                            currentTab === "wishlist"
                        );
                    }
                }
            });

            collectionList.appendChild(card);
        });
    }
}

// 5b. Bookshelf View Helpers & Renderer
function getSpineThemeClass(platformName) {
    const p = cleanPlatformName(platformName || "").toLowerCase();
    if (p.includes("playstation 2") || p.includes("ps2")) return "spine-ps2";
    if (p.includes("switch")) return "spine-switch";
    if (p.includes("playstation 5") || p.includes("ps5")) return "spine-ps5";
    if (p.includes("playstation 4") || p.includes("ps4")) return "spine-ps4";
    if (p.includes("playstation 3") || p.includes("ps3")) return "spine-ps3";
    if (p.includes("playstation 1") || p.includes("ps1") || p.includes("psx") || p.includes("playstation")) return "spine-ps1";
    if (p.includes("xbox 360") || p.includes("xbox one") || p.includes("xbox")) return "spine-xbox";
    if (p.includes("gamecube") || p.includes("gc")) return "spine-gamecube";
    if (p.includes("3ds") || p.includes("ds") || p.includes("nintendo ds")) return "spine-ds";
    if (p.includes("game boy") || p.includes("gameboy") || p.includes("gba")) return "spine-gameboy";
    if (p.includes("snes") || p.includes("nes") || p.includes("n64") || p.includes("nintendo 64")) return "spine-retro-nintendo";
    if (p.includes("sega") || p.includes("mega drive") || p.includes("genesis") || p.includes("dreamcast") || p.includes("saturn")) return "spine-sega";
    return "spine-default";
}

function getSpineShortTag(platformName) {
    const cleaned = cleanPlatformName(platformName || "");
    const p = cleaned.toLowerCase();
    if (p.includes("playstation 2") || p.includes("ps2")) return "PS2";
    if (p.includes("switch")) return "NSW";
    if (p.includes("playstation 5") || p.includes("ps5")) return "PS5";
    if (p.includes("playstation 4") || p.includes("ps4")) return "PS4";
    if (p.includes("playstation 3") || p.includes("ps3")) return "PS3";
    if (p.includes("playstation 1") || p.includes("ps1") || p.includes("psx")) return "PS1";
    if (p.includes("xbox 360")) return "X360";
    if (p.includes("xbox one")) return "XONE";
    if (p.includes("xbox")) return "XBOX";
    if (p.includes("gamecube")) return "NGC";
    if (p.includes("3ds")) return "3DS";
    if (p.includes("ds")) return "NDS";
    if (p.includes("gba") || p.includes("advance")) return "GBA";
    if (p.includes("game boy") || p.includes("gameboy")) return "GB";
    if (p.includes("n64") || p.includes("nintendo 64")) return "N64";
    if (p.includes("snes") || p.includes("super nintendo")) return "SNES";
    if (p.includes("nes")) return "NES";
    if (p.includes("mega drive") || p.includes("genesis")) return "MD";
    if (p.includes("dreamcast")) return "DC";
    return (cleaned || "JEU").substring(0, 4).toUpperCase();
}

let shelfSortOrder = localStorage.getItem("arcade_relics_shelf_sort_order") || "desc";

function getGameAddedTimestamp(game, fallbackIndex = null) {
    if (!game) return fallbackIndex;

    const candidates = [
        game.addedAt,
        game.added_at,
        game.createdAt,
        game.created_at,
        game.dateAjout,
        game.date_ajout,
        game.dateAdded,
        game.date_added,
        game.purchaseDate,
        game.buyDate,
        game.dateAchat,
        game.date_achat,
        game.date
    ];

    for (const raw of candidates) {
        if (raw == null || raw === "") continue;
        if (raw instanceof Date) {
            const t = raw.getTime();
            if (!isNaN(t)) return t;
        }
        if (typeof raw === "number" && raw > 0) {
            return raw < 1e11 ? raw * 1000 : raw;
        }
        if (typeof raw === "object") {
            if (typeof raw.toDate === "function") {
                try {
                    const t = raw.toDate().getTime();
                    if (!isNaN(t)) return t;
                } catch { }
            }
            if (typeof raw.seconds === "number") {
                return raw.seconds * 1000;
            }
            if (typeof raw._seconds === "number") {
                return raw._seconds * 1000;
            }
        }
        if (typeof raw === "string") {
            const str = raw.trim();
            if (!str) continue;
            if (/^\d+$/.test(str)) {
                const num = Number(str);
                if (!isNaN(num) && num > 0) {
                    return num < 1e11 ? num * 1000 : num;
                }
            }
            const parsed = Date.parse(str);
            if (!isNaN(parsed)) return parsed;

            const dmy = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/);
            if (dmy) {
                const d = new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10));
                if (!isNaN(d.getTime())) return d.getTime();
            }
        }
    }

    if (typeof game.id === "number" && game.id > 1e11) {
        return game.id;
    }
    if (typeof game.id === "string" && /^\d{12,14}$/.test(game.id)) {
        const num = Number(game.id);
        if (!isNaN(num)) return num;
    }

    return fallbackIndex;
}

function createGameSpineElement(game, platformName) {

    platformName = cleanPlatformName(platformName) || platformName || "Jeu";

    const spine =
        document.createElement("div");

    const themeClass =
        getSpineThemeClass(platformName);

    const shortTag =
        getSpineShortTag(platformName);

    spine.className =
        `game-spine ${themeClass}`;


    const title =
        game.title ||
        game.name ||
        "Jeu sans titre";

    const coverUrl =
        getGameCoverUrl(game);

    const addedTs =
        getGameAddedTimestamp(game, null);

    let addedDateStr = "";
    if (addedTs) {
        try {
            addedDateStr =
                new Date(addedTs).toLocaleDateString("fr-FR");
        } catch { }
    }

    /*
     * On utilise UNIQUEMENT l'image
     * réellement extraite de Google Drive.
     */
    const spinePhotoUrl =
        game.driveSpineImage ||
        "";

    const isWishlist =
        currentTab === "wishlist";

    const statusColor =
        isWishlist
            ? "var(--yellow)"
            : "var(--green)";


    const condition =
        game.condition ||
        game.etat ||
        "";

    const conditionLabel =
        condition
            ? escapeHtml(
                String(condition)
            )
            : "";


    const displayPreviewUrl =
        coverUrl ||
        spinePhotoUrl ||
        "";

    const previewCoverHtml =
        displayPreviewUrl
            ? `
                <img
                    src="${escapeHtml(displayPreviewUrl)}"
                    alt="${escapeHtml(title)}"
                    class="spine-preview-cover"
                    loading="lazy"
                >
              `
            : `
                <div class="spine-preview-fallback">
                    <span>🎮</span>
                </div>
              `;


    /*
     * La fausse tranche est TOUJOURS créée.
     * Si la vraie photo fonctionne,
     * elle vient se placer par-dessus.
     */
    spine.innerHTML = `

        <div class="spine-fallback-content">

            <div class="spine-top">

                <span
                    class="spine-logo-tag"
                    title="${escapeHtml(platformName)}"
                >
                    ${escapeHtml(shortTag)}
                </span>

            </div>


            <div class="spine-title-wrap">

                <span
                    class="spine-title"
                    title="${escapeHtml(title)}"
                >
                    ${escapeHtml(title)}
                </span>

            </div>


            <div class="spine-bottom">

                <span
                    class="spine-status-indicator"
                    style="color:${statusColor};"
                ></span>

            </div>

        </div>


        ${spinePhotoUrl
            ? `
                    <img
                        src="${escapeHtml(spinePhotoUrl)}"
                        alt="Tranche de ${escapeHtml(title)}"
                        class="spine-real-photo"
                        loading="lazy"
                    >
                  `
            : ""
        }


        <div
            class="spine-preview-card"
            aria-hidden="true"
        >

            ${previewCoverHtml}

            <div class="spine-preview-info">

                <div class="spine-preview-title">
                    ${escapeHtml(title)}
                </div>

                <div class="spine-preview-meta">

                    <span
                        style="
                            color:var(--cyan);
                            font-weight:600;
                        "
                    >
                        ${escapeHtml(cleanPlatformName(platformName) || platformName)}
                    </span>

                    ${conditionLabel
            ? `<span>${conditionLabel}</span>`
            : ""
        }

                    ${addedDateStr
            ? `<span style="color:var(--text-muted);font-size:0.75rem;">📅 ${escapeHtml(addedDateStr)}</span>`
            : ""
        }

                </div>

            </div>

        </div>
    `;


    /*
     * Si on possède une vraie tranche :
     * - vérifier qu'elle fonctionne
     * - adapter la largeur à son ratio
     */
    if (spinePhotoUrl) {

        const realSpineImage =
            spine.querySelector(
                ".spine-real-photo"
            );


        if (realSpineImage) {

            const applyRealSpine =
                () => {

                    const naturalWidth =
                        realSpineImage.naturalWidth;

                    const naturalHeight =
                        realSpineImage.naturalHeight;


                    if (
                        !naturalWidth ||
                        !naturalHeight
                    ) {
                        return;
                    }


                    /*
                     * Maintenant seulement,
                     * on sait que la vraie photo
                     * fonctionne.
                     */
                    spine.classList.add(
                        "has-real-spine"
                    );


                    const ratio =
                        naturalWidth /
                        naturalHeight;

                    const targetHeight =
                        280;

                    const calculatedWidth =
                        Math.round(
                            targetHeight *
                            ratio
                        );


                    /*
                     * On adapte la largeur au ratio exact de la photo
                     * pour éviter tout bord noir artificiel.
                     */
                    const finalWidth =
                        Math.max(
                            24,
                            Math.min(
                                140,
                                calculatedWidth
                            )
                        );


                    spine.style.width =
                        `${finalWidth}px`;

                    spine.style.minWidth =
                        `${finalWidth}px`;
                };


            /*
             * Image déjà chargée depuis
             * le cache navigateur.
             */
            if (
                realSpineImage.complete &&
                realSpineImage.naturalWidth > 0
            ) {

                applyRealSpine();

            } else {

                realSpineImage.addEventListener(
                    "load",
                    () => {
                        applyRealSpine();
                        scheduleShelfRepack();
                    },
                    {
                        once: true
                    }
                );
            }


            /*
             * C'EST ICI que va le code
             * "error" que tu me demandais.
             *
             * Si la vraie photo ne fonctionne pas,
             * on la supprime et la fausse tranche
             * reste visible.
             */
            realSpineImage.addEventListener(
                "error",
                () => {

                    spine.classList.remove(
                        "has-real-spine"
                    );

                    realSpineImage.remove();

                    spine.style.width =
                        "";

                    spine.style.minWidth =
                        "";

                },
                {
                    once: true
                }
            );

        }

    }


    spine.setAttribute(
        "role",
        "button"
    );

    spine.setAttribute(
        "tabindex",
        "0"
    );

    spine.setAttribute(
        "aria-label",
        `Voir les détails du jeu ${title}`
    );


    spine.addEventListener(
        "click",
        () => {

            openGameDetails(
                game,
                currentTab === "wishlist"
            );

        }
    );


    spine.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Enter" ||
                event.key === " "
            ) {

                event.preventDefault();

                openGameDetails(
                    game,
                    currentTab === "wishlist"
                );
            }

        }
    );


    return spine;
}

function renderShelfView(itemsToRender) {
    if (!collectionList) return;
    collectionList.className = "shelves-wrapper";

    if (!itemsToRender || itemsToRender.length === 0) return;

    // Trier l'ensemble des jeux par date d'ajout
    const itemsWithMeta = itemsToRender.map((game, index) => ({
        game,
        timestamp: getGameAddedTimestamp(game, null),
        originalIndex: index
    }));

    itemsWithMeta.sort((a, b) => {
        if (a.timestamp !== null && b.timestamp !== null) {
            if (a.timestamp !== b.timestamp) {
                return shelfSortOrder === "asc"
                    ? a.timestamp - b.timestamp
                    : b.timestamp - a.timestamp;
            }
        } else if (a.timestamp !== null) {
            return shelfSortOrder === "asc" ? -1 : 1;
        } else if (b.timestamp !== null) {
            return shelfSortOrder === "asc" ? 1 : -1;
        }
        return shelfSortOrder === "asc"
            ? a.originalIndex - b.originalIndex
            : b.originalIndex - a.originalIndex;
    });

    const sortedGames = itemsWithMeta.map(item => item.game);

    const isWishlist = currentTab === "wishlist";
    const shelfTitle = isWishlist ? "Étagère Wishlist" : "Bibliothèque de Collection";

    // Structure complète du Meuble Bibliothèque
    const cabinet = document.createElement("div");
    cabinet.className = "bookcase-cabinet";

    // 1. Sommet sculpté (Corniche)
    const crown = document.createElement("div");
    crown.className = "bookcase-top-crown";
    crown.innerHTML = `
        <div class="bookcase-crown-face">
            <div class="bookcase-header-left">
                <span class="bookcase-ornament">🏛️</span>
                <div>
                    <h3 class="bookcase-main-title">${escapeHtml(shelfTitle)}</h3>
                    <span class="bookcase-subtitle" id="bookcaseStatsSubtitle">${sortedGames.length} ${sortedGames.length > 1 ? "jeux" : "jeu"}</span>
                </div>
            </div>
            <div class="shelf-sort-wrap">
                <button type="button" class="shelf-sort-btn" id="shelfSortToggleBtn" title="Inverser le tri par date d'ajout">
                    <span class="shelf-sort-icon">${shelfSortOrder === "desc" ? "⬇️" : "⬆️"}</span>
                    <span class="shelf-sort-text">${shelfSortOrder === "desc" ? "Du plus récent au plus ancien" : "Du plus ancien au plus récent"}</span>
                </button>
            </div>
        </div>
    `;

    const sortBtn = crown.querySelector("#shelfSortToggleBtn");
    if (sortBtn) {
        sortBtn.addEventListener("click", () => {
            shelfSortOrder = shelfSortOrder === "desc" ? "asc" : "desc";
            try {
                localStorage.setItem("arcade_relics_shelf_sort_order", shelfSortOrder);
            } catch (e) {
                console.warn("Could not save shelf sort order:", e);
            }
            renderCurrentView();
        });
    }

    // 2. Intérieur avec montants verticaux et empilement des étagères
    const interior = document.createElement("div");
    interior.className = "bookcase-interior";

    const leftPillar = document.createElement("div");
    leftPillar.className = "bookcase-pillar bookcase-pillar-left";

    const shelvesStack = document.createElement("div");
    shelvesStack.className = "bookcase-shelves-stack";

    const rightPillar = document.createElement("div");
    rightPillar.className = "bookcase-pillar bookcase-pillar-right";

    interior.appendChild(leftPillar);
    interior.appendChild(shelvesStack);
    interior.appendChild(rightPillar);

    // 3. Socle inférieur du meuble
    const plinth = document.createElement("div");
    plinth.className = "bookcase-base-plinth";

    cabinet.appendChild(crown);
    cabinet.appendChild(interior);
    cabinet.appendChild(plinth);

    // Insérer le meuble dans le DOM pour calculer la largeur physique exacte de l'étagère
    collectionList.appendChild(cabinet);

    // Créer tous les éléments de tranches avec leur taille agrandie
    const spineItems = sortedGames.map(game => {
        const platformName = getPlatformDisplayName(game) || "Jeu";
        const spine = createGameSpineElement(game, platformName);
        return { game, spine };
    });

    // Mesurer précisément la largeur réelle disponible entre les deux montants en bois
    const stackWidth = shelvesStack.clientWidth;
    const innerWidth = stackWidth > 0 
        ? stackWidth - 28 // 28px de padding (14px gauche + 14px droite)
        : Math.max(280, (collectionList.clientWidth || window.innerWidth) - 84);

    const shelves = [];
    let currentShelf = [];
    let currentWidth = 0;
    const gap = 4;

    spineItems.forEach(({ spine }) => {
        // Largeur réelle de la tranche
        let w = parseFloat(spine.style.width);
        if (!w || isNaN(w)) {
            w = 44; // largeur par défaut agrandie
        }

        // On remplit l'étagère jusqu'au bout réel de la planche
        if (currentShelf.length > 0 && (currentWidth + w) > innerWidth) {
            shelves.push(currentShelf);
            currentShelf = [spine];
            currentWidth = w + gap;
        } else {
            currentShelf.push(spine);
            currentWidth += w + gap;
        }
    });

    if (currentShelf.length > 0) {
        shelves.push(currentShelf);
    }

    // Mettre à jour le sous-titre avec le nombre d'étagères créées
    const statsSubtitle = crown.querySelector("#bookcaseStatsSubtitle");
    if (statsSubtitle) {
        statsSubtitle.textContent = `${sortedGames.length} ${sortedGames.length > 1 ? "jeux" : "jeu"} • ${shelves.length} ${shelves.length > 1 ? "étagères" : "étagère"}`;
    }

    // Rendre chaque étage d'étagère
    shelves.forEach((shelfSpines, index) => {
        const tier = document.createElement("div");
        tier.className = "bookcase-tier";
        tier.setAttribute("data-tier", String(index + 1));

        const spinesRow = document.createElement("div");
        spinesRow.className = "bookcase-spines-row";

        shelfSpines.forEach(spine => {
            spinesRow.appendChild(spine);
        });

        const plank = document.createElement("div");
        plank.className = "bookcase-plank";

        const shadowDrop = document.createElement("div");
        shadowDrop.className = "plank-shadow-drop";
        plank.appendChild(shadowDrop);

        tier.appendChild(spinesRow);
        tier.appendChild(plank);

        shelvesStack.appendChild(tier);
    });
}

// Re-calcul automatique lors du chargement asynchrone des photos
let shelfRepackTimer = null;
function scheduleShelfRepack() {
    if (currentViewMode !== "shelf") return;
    clearTimeout(shelfRepackTimer);
    shelfRepackTimer = setTimeout(() => {
        if (currentViewMode === "shelf") {
            renderCurrentView();
        }
    }, 100);
}

// Re-calcul automatique sur redimensionnement
let shelfResizeDebounce = null;
window.addEventListener("resize", () => {
    if (currentViewMode !== "shelf") return;
    clearTimeout(shelfResizeDebounce);
    shelfResizeDebounce = setTimeout(() => {
        if (currentViewMode === "shelf") {
            renderCurrentView();
        }
    }, 150);
});

// View Mode Handler
function setViewMode(mode) {
    currentViewMode = mode;
    try {
        localStorage.setItem("arcade_relics_view_mode", mode);
    } catch (e) {
        console.warn("Could not persist view mode:", e);
    }

    if (viewModeGrid && viewModeShelf) {
        viewModeGrid.classList.toggle("active", mode === "grid");
        viewModeGrid.setAttribute("aria-pressed", String(mode === "grid"));
        viewModeShelf.classList.toggle("active", mode === "shelf");
        viewModeShelf.setAttribute("aria-pressed", String(mode === "shelf"));
    }

    renderCurrentView();
}

if (viewModeGrid) viewModeGrid.addEventListener("click", () => setViewMode("grid"));
if (viewModeShelf) viewModeShelf.addEventListener("click", () => setViewMode("shelf"));

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

    if (tabName === "wishlist") {
        updateWishlistFilterCounts();
    }

    renderCurrentView();
}

if (tabGames) tabGames.addEventListener("click", () => switchTab("games"));
if (tabConsoles) tabConsoles.addEventListener("click", () => switchTab("consoles"));
if (tabWishlist) tabWishlist.addEventListener("click", () => switchTab("wishlist"));
if (tabProfile) tabProfile.addEventListener("click", () => switchTab("profile"));

// Wishlist filter button listeners
[filterWishlistAll, filterWishlistGames, filterWishlistConsoles].forEach(btn => {
    if (btn) {
        btn.addEventListener("click", () => {
            setWishlistFilter(btn.dataset.filter || "all");
        });
    }
});

function renderWishlistConsolesBelowShelf(consolesList) {
    if (!collectionList || !consolesList || consolesList.length === 0) return;

    const section = document.createElement("div");
    section.className = "wishlist-shelf-consoles-section";
    section.style.marginTop = "28px";
    section.style.width = "100%";
    section.innerHTML = `
        <div class="bookcase-crown-face" style="margin-bottom: 16px; border-radius: var(--radius-md);">
            <div class="bookcase-header-left">
                <span class="bookcase-ornament">🕹️</span>
                <div>
                    <h3 class="bookcase-main-title">Consoles en Wishlist</h3>
                    <span class="bookcase-subtitle">${consolesList.length} ${consolesList.length > 1 ? "consoles" : "console"}</span>
                </div>
            </div>
        </div>
        <div class="items-grid" id="wishlistShelfConsolesGrid"></div>
    `;

    const grid = section.querySelector("#wishlistShelfConsolesGrid");
    consolesList.forEach(consoleItem => {
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
                    <span class="status-indicator" style="color: var(--yellow);">⭐ Wishlist</span>
                </div>
            </div>
        `;
        card.setAttribute("role", "button");
        card.setAttribute("tabindex", "0");
        card.setAttribute("aria-label", `Voir les détails de la console ${name}`);
        card.addEventListener("click", () => openDetailModal(consoleItem, "wishlist"));
        card.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openDetailModal(consoleItem, "wishlist");
            }
        });

        grid.appendChild(card);
    });

    collectionList.appendChild(section);
}

if (profileLogoutBtn) {
    profileLogoutBtn.addEventListener("click", async () => {
        try {
            localStorage.removeItem("arcade_relics_logged_in");
            localStorage.removeItem("arcade_relics_user_email");
            localStorage.removeItem("arcade_relics_drive_token");
            sessionStorage.removeItem("arcade_relics_drive_token");
            await clearCacheDB();
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
            await clearCacheDB();
            await signOut(auth);
            window.location.href = "index.html";
        } catch (e) {
            console.error("Erreur déconnexion :", e);
            window.location.href = "index.html";
        }
    });
}

// Drive Sync Button Handler (Charger / Synchroniser les photos Google Drive)
const driveSyncBtn = document.getElementById("driveSyncBtn");
if (driveSyncBtn) {
    driveSyncBtn.addEventListener("click", async () => {
        try {
            driveSyncBtn.disabled = true;
            driveSyncBtn.innerHTML = "<span>⏳ Connexion Google...</span>";

            const provider = new GoogleAuthProvider();
            provider.addScope("https://www.googleapis.com/auth/drive.appdata");

            const result = await signInWithPopup(auth, provider);
            const googleCredential = GoogleAuthProvider.credentialFromResult(result);
            const driveAccessToken = googleCredential?.accessToken || "";

            if (driveAccessToken) {
                localStorage.setItem("arcade_relics_drive_token", driveAccessToken);
                sessionStorage.setItem("arcade_relics_drive_token", driveAccessToken);
                localStorage.setItem("arcade_relics_logged_in", "true");

                driveSyncBtn.innerHTML = "<span>⏳ Téléchargement des photos...</span>";
                await loadGoogleDriveImages();
                renderCurrentView();

                const banner = document.getElementById("driveSyncBanner");
                if (banner) banner.style.display = "none";
            } else {
                driveSyncBtn.disabled = false;
                driveSyncBtn.innerHTML = "<span>🔄 Charger mes photos</span>";
            }
        } catch (syncErr) {
            console.error("Erreur autorisation Google Drive :", syncErr);
            driveSyncBtn.disabled = false;
            driveSyncBtn.innerHTML = "<span>🔄 Réessayer</span>";
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
