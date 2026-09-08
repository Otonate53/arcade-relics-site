/**
 * ARCADE RELICS - MAIN JAVASCRIPT 2.0
 * Interactive effects, 3D tilt, spotlight tracking, count-up animations & carousel
 */

document.addEventListener("DOMContentLoaded", () => {
    // =========================================================================
    // 1. NAVBAR & MOBILE MENU
    // =========================================================================
    const navbar = document.getElementById("navbar");
    const menuButton = document.getElementById("menuButton");
    const navigation = document.getElementById("navigation");
    const navigationLinks = navigation ? navigation.querySelectorAll("a") : [];

    // Navbar background blur & shadow on scroll
    const handleScrollNavbar = () => {
        if (window.scrollY > 20) {
            navbar.classList.add("scrolled");
        } else {
            navbar.classList.remove("scrolled");
        }
    };
    window.addEventListener("scroll", handleScrollNavbar, { passive: true });
    handleScrollNavbar();

    // Mobile Menu Toggle
    if (menuButton && navigation) {
        menuButton.addEventListener("click", () => {
            const isOpen = navigation.classList.toggle("open");
            menuButton.setAttribute("aria-expanded", String(isOpen));
            menuButton.setAttribute("aria-label", isOpen ? "Fermer le menu" : "Ouvrir le menu");
        });

        navigationLinks.forEach((link) => {
            link.addEventListener("click", () => {
                navigation.classList.remove("open");
                menuButton.setAttribute("aria-expanded", "false");
                menuButton.setAttribute("aria-label", "Ouvrir le menu");
            });
        });

        document.addEventListener("click", (event) => {
            if (!navigation.contains(event.target) && !menuButton.contains(event.target)) {
                navigation.classList.remove("open");
                menuButton.setAttribute("aria-expanded", "false");
                menuButton.setAttribute("aria-label", "Ouvrir le menu");
            }
        });
    }

    // =========================================================================
    // 2. SCROLL REVEAL OBSERVER
    // =========================================================================
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
            threshold: 0.1,
            rootMargin: "0px 0px -40px 0px"
        }
    );

    revealElements.forEach((element, index) => {
        element.style.transitionDelay = `${(index % 3) * 70}ms`;
        revealObserver.observe(element);
    });


    // =========================================================================
    // 4. MOUSE SPOTLIGHT EFFECT ON CARDS
    // =========================================================================
    const spotlightCards = document.querySelectorAll(".spotlight-card");
    spotlightCards.forEach((card) => {
        card.addEventListener("mousemove", (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty("--mouse-x", `${x}px`);
            card.style.setProperty("--mouse-y", `${y}px`);
        });
    });

    // =========================================================================
    // 5. ANIMATED STAT COUNTERS (COUNT-UP)
    // =========================================================================
    const counterElements = document.querySelectorAll(".counter-value");
    
    const animateCounter = (element) => {
        const target = parseInt(element.getAttribute("data-count"), 10);
        if (isNaN(target)) return;

        const duration = 1600; // ms
        const startTime = performance.now();

        const updateCount = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease Out Quart function for smooth braking
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const currentCount = Math.floor(easeOutQuart * target);

            element.textContent = currentCount;

            if (progress < 1) {
                requestAnimationFrame(updateCount);
            } else {
                element.textContent = target;
            }
        };

        requestAnimationFrame(updateCount);
    };

    const counterObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    counterObserver.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.2 }
    );

    counterElements.forEach((counter) => counterObserver.observe(counter));

    // =========================================================================
    // 6. APP SCREENSHOT CAROUSEL IN DEVICE FRAME
    // =========================================================================
    const appCarousel = document.getElementById("appCarousel");
    if (appCarousel) {
        const carouselTrack = appCarousel.querySelector("[data-carousel-track]");
        const carouselSlides = Array.from(appCarousel.querySelectorAll(".carousel-slide"));
        const carouselDots = Array.from(document.querySelectorAll("[data-carousel-dot]"));
        const prevButton = document.querySelector("[data-carousel-prev]");
        const nextButton = document.querySelector("[data-carousel-next]");
        const captionBadge = document.getElementById("captionBadge");
        const captionTitle = document.getElementById("captionTitle");

        let currentSlide = 0;
        let autoplayTimer = null;
        let touchStartX = null;

        const slideTitles = [
            { badge: "Aperçu 1 / 4", title: "Bibliothèque de collection" },
            { badge: "Aperçu 2 / 4", title: "Consoles & Modèles" },
            { badge: "Aperçu 3 / 4", title: "Recherche instantanée" },
            { badge: "Aperçu 4 / 4", title: "Wishlist prioritaire" }
        ];

        const displaySlide = (index) => {
            const slideCount = carouselSlides.length;
            currentSlide = (index + slideCount) % slideCount;

            carouselTrack.style.transform = `translateX(-${currentSlide * 100}%)`;

            carouselSlides.forEach((slide, idx) => {
                slide.setAttribute("aria-hidden", String(idx !== currentSlide));
            });

            carouselDots.forEach((dot, idx) => {
                const isActive = idx === currentSlide;
                dot.classList.toggle("active", isActive);
                if (isActive) {
                    dot.setAttribute("aria-current", "true");
                } else {
                    dot.removeAttribute("aria-current");
                }
            });

            // Update captions
            if (captionBadge && captionTitle && slideTitles[currentSlide]) {
                captionBadge.textContent = slideTitles[currentSlide].badge;
                captionTitle.textContent = slideTitles[currentSlide].title;
            }
        };

        const stopAutoplay = () => {
            if (autoplayTimer) {
                clearInterval(autoplayTimer);
                autoplayTimer = null;
            }
        };

        const startAutoplay = () => {
            stopAutoplay();
            autoplayTimer = setInterval(() => {
                displaySlide(currentSlide + 1);
            }, 5500);
        };

        if (prevButton) {
            prevButton.addEventListener("click", () => {
                displaySlide(currentSlide - 1);
                startAutoplay();
            });
        }

        if (nextButton) {
            nextButton.addEventListener("click", () => {
                displaySlide(currentSlide + 1);
                startAutoplay();
            });
        }

        carouselDots.forEach((dot) => {
            dot.addEventListener("click", () => {
                displaySlide(Number(dot.dataset.carouselDot));
                startAutoplay();
            });
        });

        // Touch gestures for mobile swipe
        appCarousel.addEventListener("touchstart", (e) => {
            touchStartX = e.touches[0].clientX;
        }, { passive: true });

        appCarousel.addEventListener("touchend", (e) => {
            if (touchStartX === null) return;
            const touchEndX = e.changedTouches[0].clientX;
            const diff = touchEndX - touchStartX;

            if (Math.abs(diff) > 40) {
                if (diff > 0) {
                    displaySlide(currentSlide - 1);
                } else {
                    displaySlide(currentSlide + 1);
                }
                startAutoplay();
            }
            touchStartX = null;
        }, { passive: true });

        // Pause on mouse hover
        appCarousel.addEventListener("mouseenter", stopAutoplay);
        appCarousel.addEventListener("mouseleave", startAutoplay);

        // Keyboard arrows navigation
        appCarousel.addEventListener("keydown", (e) => {
            if (e.key === "ArrowLeft") {
                displaySlide(currentSlide - 1);
                startAutoplay();
            } else if (e.key === "ArrowRight") {
                displaySlide(currentSlide + 1);
                startAutoplay();
            }
        });

        displaySlide(0);
        startAutoplay();
    }

    // =========================================================================
    // 7. FAQ ACCORDION
    // =========================================================================
    const faqItems = document.querySelectorAll(".faq-item");
    faqItems.forEach((item) => {
        const questionBtn = item.querySelector(".faq-question");
        if (!questionBtn) return;

        questionBtn.addEventListener("click", () => {
            const isActive = item.classList.contains("active");

            // Close all other items
            faqItems.forEach((otherItem) => {
                if (otherItem !== item) {
                    otherItem.classList.remove("active");
                    const otherBtn = otherItem.querySelector(".faq-question");
                    if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
                }
            });

            // Toggle current
            item.classList.toggle("active", !isActive);
            questionBtn.setAttribute("aria-expanded", String(!isActive));
        });
    });

    // =========================================================================
    // 8. FOOTER CURRENT YEAR
    // =========================================================================
    const currentYearEl = document.getElementById("currentYear");
    if (currentYearEl) {
        currentYearEl.textContent = new Date().getFullYear();
    }
});
