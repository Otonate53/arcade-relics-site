/**
 * ARCADE RELICS - CONNEXION MODAL LOGIC
 * Handles smooth opening/closing of the login modal with blurred background
 */

document.addEventListener("DOMContentLoaded", () => {
    // Modal Overlay Elements
    const loginModalOverlay = document.getElementById("loginModalOverlay");
    const loginModalCloseBtn = document.getElementById("loginModalCloseBtn");
    const navLoginBtn = document.getElementById("navLoginBtn");
    const navLinkMobileLogin = document.getElementById("navLinkMobileLogin");

    function openLoginModal() {
        if (!loginModalOverlay) return;
        loginModalOverlay.classList.add("active");
        document.body.classList.add("modal-open");
    }

    function closeLoginModal() {
        if (!loginModalOverlay) return;
        loginModalOverlay.classList.remove("active");
        document.body.classList.remove("modal-open");
    }

    function handleNavLoginClick(e) {
        // Si l'utilisateur est déjà connecté ou que le bouton pointe vers compte.html, laisser la navigation se faire
        const isConnected = this.classList.contains("logged-in") || 
                            this.getAttribute("href") === "compte.html" ||
                            localStorage.getItem("arcade_relics_logged_in") === "true";
        if (isConnected) {
            return;
        }
        e.preventDefault();
        openLoginModal();
    }

    // Synchronisation immédiate si l'utilisateur était déjà connecté (évite tout clignotement)
    const isCachedLoggedIn = localStorage.getItem("arcade_relics_logged_in") === "true";
    if (isCachedLoggedIn) {
        if (navLoginBtn) {
            navLoginBtn.classList.add("logged-in");
            navLoginBtn.href = "compte.html";
            navLoginBtn.setAttribute("aria-label", "Accéder à ma collection");
            navLoginBtn.innerHTML = `
                <span style="width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);display:inline-block;"></span>
                <span class="nav-login-label">Ma Collection</span>
            `;
        }
        if (navLinkMobileLogin) {
            navLinkMobileLogin.classList.add("logged-in");
            navLinkMobileLogin.href = "compte.html";
            navLinkMobileLogin.innerHTML = `
                <span style="width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);display:inline-block;"></span>
                <span>Ma Collection</span>
            `;
        }
    }

    if (navLoginBtn) {
        navLoginBtn.addEventListener("click", handleNavLoginClick);
    }

    if (navLinkMobileLogin) {
        navLinkMobileLogin.addEventListener("click", handleNavLoginClick);
    }

    if (loginModalCloseBtn) {
        loginModalCloseBtn.addEventListener("click", closeLoginModal);
    }

    if (loginModalOverlay) {
        loginModalOverlay.addEventListener("click", (e) => {
            if (e.target === loginModalOverlay) {
                closeLoginModal();
            }
        });
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && loginModalOverlay && loginModalOverlay.classList.contains("active")) {
            closeLoginModal();
        }
    });

    // Auto-open modal if URL specifies ?login=true or #connexion (seulement si non connecté)
    if (!isCachedLoggedIn && (window.location.search.includes("login=true") || window.location.hash === "#connexion")) {
        setTimeout(openLoginModal, 250);
    }
});
