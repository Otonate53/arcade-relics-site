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

    if (navLoginBtn) {
        navLoginBtn.addEventListener("click", (e) => {
            e.preventDefault();
            openLoginModal();
        });
    }

    if (navLinkMobileLogin) {
        navLinkMobileLogin.addEventListener("click", (e) => {
            e.preventDefault();
            openLoginModal();
        });
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

    // Auto-open modal if URL specifies ?login=true or #connexion
    if (window.location.search.includes("login=true") || window.location.hash === "#connexion") {
        setTimeout(openLoginModal, 250);
    }
});
