import { initializeApp }
    from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";

import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    signOut
}
    from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

const firebaseConfig = {

    apiKey: "AIzaSyCFdQtnGEwxlNrMtKxJ6fWlRpZ0QzWzvS0",

    authDomain: "oto-retro.firebaseapp.com",

    projectId: "oto-retro",

    storageBucket: "oto-retro.firebasestorage.app",

    messagingSenderId: "546285913861",

    appId: "1:546285913861:web:e71f9d87c64a8a5950d96c",
};

const app =
    initializeApp(firebaseConfig);

const auth =
    getAuth(app);

const provider =
    new GoogleAuthProvider();

provider.addScope(
    "https://www.googleapis.com/auth/drive.appdata"
);

const googleLoginBtn =
    document.getElementById(
        "googleLoginBtn"
    );

if (googleLoginBtn) {

    googleLoginBtn.addEventListener(
        "click",
        async () => {

            try {

                const result =
                    await signInWithPopup(
                        auth,
                        provider
                    );

                const user =
                    result.user;

                const googleCredential =
                    GoogleAuthProvider
                        .credentialFromResult(
                            result
                        );

                const driveAccessToken =
                    googleCredential?.accessToken || "";

                if (driveAccessToken) {
                    sessionStorage.setItem(
                        "arcade_relics_drive_token",
                        driveAccessToken
                    );
                    localStorage.setItem(
                        "arcade_relics_drive_token",
                        driveAccessToken
                    );
                }

                localStorage.setItem("arcade_relics_logged_in", "true");
                if (user.email) {
                    localStorage.setItem("arcade_relics_user_email", user.email);
                }

                console.log(
                    "Utilisateur connecté :",
                    user.email
                );

                console.log(
                    "Firebase UID :",
                    user.uid
                );

                window.location.href = "compte.html";

            } catch (error) {

                console.error(
                    "Erreur connexion Google :",
                    error
                );

            }

        }
    );

}

onAuthStateChanged(
    auth,
    (user) => {

        const navLoginBtn = document.getElementById("navLoginBtn");
        const navLinkMobileLogin = document.getElementById("navLinkMobileLogin");

        if (user) {

            console.log(
                "Connecté :",
                user.email
            );

            console.log(
                "UID :",
                user.uid
            );

            localStorage.setItem("arcade_relics_logged_in", "true");
            if (user.email) {
                localStorage.setItem("arcade_relics_user_email", user.email);
            }

            // Update navbar on index.html to link directly to collection
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

        } else {

            console.log(
                "Utilisateur déconnecté"
            );

            localStorage.removeItem("arcade_relics_logged_in");
            localStorage.removeItem("arcade_relics_user_email");

            if (navLoginBtn) {
                navLoginBtn.classList.remove("logged-in");
                navLoginBtn.href = "#connexion";
                navLoginBtn.setAttribute("aria-label", "Se connecter avec Google");
                navLoginBtn.innerHTML = `
                    <svg class="icon nav-login-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span class="nav-login-label">Connexion</span>
                `;
            }
            if (navLinkMobileLogin) {
                navLinkMobileLogin.classList.remove("logged-in");
                navLinkMobileLogin.href = "#connexion";
                navLinkMobileLogin.innerHTML = `
                    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span>Connexion</span>
                `;
            }

        }

    }
);

export { app, auth };