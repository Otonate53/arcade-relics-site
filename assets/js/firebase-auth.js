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

        if (user) {

            console.log(
                "Connecté :",
                user.email
            );

            console.log(
                "UID :",
                user.uid
            );

            // Update navbar on index.html to link directly to collection
            const navLoginBtn = document.getElementById("navLoginBtn");
            const navLinkMobileLogin = document.getElementById("navLinkMobileLogin");
            if (navLoginBtn) {
                navLoginBtn.classList.add("logged-in");
                navLoginBtn.href = "compte.html";
                navLoginBtn.innerHTML = `
                    <span style="width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);display:inline-block;"></span>
                    <span class="nav-login-label">Ma Collection</span>
                `;
            }
            if (navLinkMobileLogin) {
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

        }

    }
);

export { app, auth };