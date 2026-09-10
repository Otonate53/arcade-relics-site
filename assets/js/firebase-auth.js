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

        } else {

            console.log(
                "Utilisateur déconnecté"
            );

        }

    }
);