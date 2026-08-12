const crtIntro = document.getElementById("crtIntro");

if (crtIntro) {
    window.setTimeout(() => {
        crtIntro.classList.add("is-finished");
    }, 3000);
}

const menuButton = document.getElementById("menuButton");
        const navigation = document.getElementById("navigation");
        const navigationLinks = navigation.querySelectorAll("a");

        menuButton.addEventListener("click", () => {
            const isOpen = navigation.classList.toggle("open");

            menuButton.setAttribute("aria-expanded", String(isOpen));
            menuButton.setAttribute(
                "aria-label",
                isOpen ? "Fermer le menu" : "Ouvrir le menu"
            );
        });

        navigationLinks.forEach((link) => {
            link.addEventListener("click", () => {
                navigation.classList.remove("open");
                menuButton.setAttribute("aria-expanded", "false");
                menuButton.setAttribute("aria-label", "Ouvrir le menu");
            });
        });

        document.addEventListener("click", (event) => {
            const clickedInsideNavigation = navigation.contains(event.target);
            const clickedMenuButton = menuButton.contains(event.target);

            if (!clickedInsideNavigation && !clickedMenuButton) {
                navigation.classList.remove("open");
                menuButton.setAttribute("aria-expanded", "false");
                menuButton.setAttribute("aria-label", "Ouvrir le menu");
            }
        });

        const revealElements = document.querySelectorAll(".reveal");

        const revealObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("visible");
                        revealObserver.unobserve(entry.target);
                    }
                });
            },
            {
                threshold: 0.12,
                rootMargin: "0px 0px -50px 0px"
            }
        );

        revealElements.forEach((element, index) => {
            element.style.transitionDelay = `${Math.min(index % 3, 2) * 80}ms`;
            revealObserver.observe(element);
        });

        const appCarousel =
    document.getElementById("appCarousel");

if (appCarousel) {
    const carouselTrack =
        appCarousel.querySelector(
            "[data-carousel-track]"
        );

    const carouselViewport =
    appCarousel.querySelector(
        ".carousel-viewport"
    );
    
    const carouselSlides =
        Array.from(
            appCarousel.querySelectorAll(
                ".carousel-slide"
            )
        );

    const carouselDots =
        Array.from(
            appCarousel.querySelectorAll(
                "[data-carousel-dot]"
            )
        );

    const previousButton =
        appCarousel.querySelector(
            "[data-carousel-prev]"
        );

    const nextButton =
        appCarousel.querySelector(
            "[data-carousel-next]"
        );

    let currentSlide = 0;
    let autoplayTimer = null;
    let touchStartX = null;
const updateCarouselDimensions = () => {
    const activeSlide =
        carouselSlides[currentSlide];

    const activeImage =
        activeSlide.querySelector("img");

    const applyDimensions = () => {
        if (
            !activeImage.naturalWidth ||
            !activeImage.naturalHeight
        ) {
            return;
        }

        let baseSize = 520;

        if (window.innerWidth <= 820) {
            baseSize = 440;
        }

        if (window.innerWidth <= 620) {
            baseSize = Math.min(
                340,
                window.innerWidth - 40
            );
        }

        const imageRatio =
            activeImage.naturalWidth /
            activeImage.naturalHeight;

        let imageWidth;
        let imageHeight;

        if (imageRatio >= 1) {
            imageWidth = baseSize;
            imageHeight =
                baseSize / imageRatio;
        } else {
            imageHeight = baseSize;
            imageWidth =
                baseSize * imageRatio;
        }

        carouselViewport.style.width =
            `${Math.round(imageWidth)}px`;

        carouselViewport.style.height =
            `${Math.round(imageHeight)}px`;
    };

    if (activeImage.complete) {
        applyDimensions();
    } else {
        activeImage.addEventListener(
            "load",
            applyDimensions,
            {
                once: true
            }
        );
    }
};
   
    

    const displaySlide = (newIndex) => {
        const slideCount = carouselSlides.length;

        currentSlide =
            (newIndex + slideCount) % slideCount;

        carouselTrack.style.transform =
            `translateX(-${currentSlide * 100}%)`;

        carouselSlides.forEach(
            (slide, slideIndex) => {
                slide.setAttribute(
                    "aria-hidden",
                    String(slideIndex !== currentSlide)
                );
            }
        );

        carouselDots.forEach(
            (dot, dotIndex) => {
                const isActive =
                    dotIndex === currentSlide;

                dot.classList.toggle(
                    "active",
                    isActive
                );

                if (isActive) {
                    dot.setAttribute(
                        "aria-current",
                        "true"
                    );
                } else {
                    dot.removeAttribute(
                        "aria-current"
                    );
                }
            }
        );
        window.requestAnimationFrame(
  updateCarouselDimensions
);
    };

    window.addEventListener(
    "resize",
    () => {
        window.requestAnimationFrame(
           updateCarouselDimensions
        );
    }
);

    const stopAutoplay = () => {
        if (autoplayTimer) {
            window.clearInterval(autoplayTimer);
            autoplayTimer = null;
        }
    };

    const startAutoplay = () => {
        stopAutoplay();

        autoplayTimer = window.setInterval(
            () => {
                displaySlide(currentSlide + 1);
            },
            6000
        );
    };

    previousButton.addEventListener(
        "click",
        () => {
            displaySlide(currentSlide - 1);
            startAutoplay();
        }
    );

    nextButton.addEventListener(
        "click",
        () => {
            displaySlide(currentSlide + 1);
            startAutoplay();
        }
    );

    carouselDots.forEach((dot) => {
        dot.addEventListener("click", () => {
            displaySlide(
                Number(dot.dataset.carouselDot)
            );

            startAutoplay();
        });
    });

    appCarousel.addEventListener(
        "keydown",
        (event) => {
            if (event.key === "ArrowLeft") {
                displaySlide(currentSlide - 1);
                startAutoplay();
            }

            if (event.key === "ArrowRight") {
                displaySlide(currentSlide + 1);
                startAutoplay();
            }
        }
    );

    appCarousel.addEventListener(
        "mouseenter",
        stopAutoplay
    );

    appCarousel.addEventListener(
        "mouseleave",
        startAutoplay
    );

    appCarousel.addEventListener(
        "focusin",
        stopAutoplay
    );

    appCarousel.addEventListener(
        "focusout",
        startAutoplay
    );

    appCarousel.addEventListener(
        "touchstart",
        (event) => {
            touchStartX =
                event.touches[0].clientX;
        },
        {
            passive: true
        }
    );

    appCarousel.addEventListener(
        "touchend",
        (event) => {
            if (touchStartX === null) {
                return;
            }

            const touchEndX =
                event.changedTouches[0].clientX;

            const swipeDistance =
                touchEndX - touchStartX;

            if (Math.abs(swipeDistance) > 45) {
                if (swipeDistance > 0) {
                    displaySlide(
                        currentSlide - 1
                    );
                } else {
                    displaySlide(
                        currentSlide + 1
                    );
                }

                startAutoplay();
            }

            touchStartX = null;
        },
        {
            passive: true
        }
    );

    displaySlide(0);
    startAutoplay();
}
        
        document.getElementById("currentYear").textContent =
            new Date().getFullYear();
