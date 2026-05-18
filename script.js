/* -----------------------------------------
   ZenPexels GFX Interactive Engine (script.js)
   Custom Animations, Filtering, Lightbox, Form
   ----------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 1. Custom Cursor Interactions
    // ==========================================
    const cursor = document.querySelector('.custom-cursor');
    const cursorDot = document.querySelector('.custom-cursor-dot');
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
    
    if (cursor && cursorDot) {
        if (isTouchDevice || window.innerWidth <= 1024) {
            cursor.style.display = 'none';
            cursorDot.style.display = 'none';
        } else {
            let mouseX = 0;
            let mouseY = 0;
            let cursorX = 0;
            let cursorY = 0;
            
            // Show cursor elements once mouse moves
            document.addEventListener('mousemove', (e) => {
                mouseX = e.clientX;
                mouseY = e.clientY;
                
                // Instantly position the dot
                cursorDot.style.left = mouseX + 'px';
                cursorDot.style.top = mouseY + 'px';
                cursorDot.style.opacity = '1';
                cursor.style.opacity = '1';
            });
            
            // Smooth cursor delay loop
            const smoothCursor = () => {
                let distX = mouseX - cursorX;
                let distY = mouseY - cursorY;
                
                cursorX += distX * 0.15;
                cursorY += distY * 0.15;
                
                cursor.style.left = cursorX + 'px';
                cursor.style.top = cursorY + 'px';
                
                requestAnimationFrame(smoothCursor);
            };
            smoothCursor();
            
            // Hover effects for links & buttons
            const hoverTargets = document.querySelectorAll('a, button, select, input, textarea, .portfolio-item, .filter-btn');
            
            hoverTargets.forEach(target => {
                target.addEventListener('mouseenter', () => {
                    cursor.classList.add('hovered');
                    cursorDot.classList.add('hovered');
                });
                
                target.addEventListener('mouseleave', () => {
                    cursor.classList.remove('hovered');
                    cursorDot.classList.remove('hovered');
                });
            });
            
            // Hide cursor when leaving window
            document.addEventListener('mouseleave', () => {
                cursor.style.opacity = '0';
                cursorDot.style.opacity = '0';
            });
        }
    }

    // ==========================================
    // 2. Parallax Floating Elements in Hero
    // ==========================================
    const heroSection = document.querySelector('.hero-section');
    const floatingElements = document.querySelectorAll('.floating-element');
    
    if (heroSection && floatingElements.length > 0 && !isTouchDevice) {
        heroSection.addEventListener('mousemove', (e) => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            const moveX = (e.clientX - width / 2) / 40;
            const moveY = (e.clientY - height / 2) / 40;
            
            floatingElements.forEach(el => {
                const speed = parseFloat(el.getAttribute('data-speed')) || 1;
                el.style.transform = `translate(${moveX * speed}px, ${moveY * speed}px)`;
            });
        });
        
        heroSection.addEventListener('mouseleave', () => {
            floatingElements.forEach(el => {
                el.style.transform = 'translate(0px, 0px)';
                el.style.transition = 'transform 0.5s ease-out';
            });
        });
    }

    // ==========================================
    // 3. Navbar Sticky Effect & Navigation
    // ==========================================
    const header = document.getElementById('main-header');
    
    const handleScroll = () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    };
    
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Run once in case page loaded scrolled down

    // ==========================================
    // 4. Mobile Menu Toggler
    // ==========================================
    const menuToggle = document.getElementById('menu-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navOverlay = document.getElementById('nav-overlay');
    const navLinks = document.querySelectorAll('.nav-link');
    
    if (menuToggle && navMenu) {
        const toggleMenu = () => {
            menuToggle.classList.toggle('open');
            navMenu.classList.toggle('open');
            if (navOverlay) navOverlay.classList.toggle('open');
            document.body.classList.toggle('menu-open');
        };
        
        const closeMenu = () => {
            menuToggle.classList.remove('open');
            navMenu.classList.remove('open');
            if (navOverlay) navOverlay.classList.remove('open');
            document.body.classList.remove('menu-open');
        };
        
        menuToggle.addEventListener('click', toggleMenu);
        if (navOverlay) navOverlay.addEventListener('click', closeMenu);
        
        // Close menu when clicking a link
        navLinks.forEach(link => {
            link.addEventListener('click', closeMenu);
        });
    }

    // ==========================================
    // 5. Scroll Active Links & Reveal Animations
    // ==========================================
    const sections = document.querySelectorAll('section');
    const scrollReveals = document.querySelectorAll('.scroll-reveal');
    
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };
    
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                
                // Highlight nav link
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${id}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }, observerOptions);
    
    sections.forEach(section => sectionObserver.observe(section));

    // Scroll reveal observer
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const delay = entry.target.getAttribute('data-delay') || 0;
                setTimeout(() => {
                    entry.target.classList.add('active');
                }, delay);
                // Stop observing after reveal is active to keep performance clean
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.05
    });
    
    scrollReveals.forEach(el => revealObserver.observe(el));

    // ==========================================
    // 6. Portfolio Category Filter Engine
    // ==========================================
    const filterButtons = document.querySelectorAll('.filter-btn');
    const portfolioItems = document.querySelectorAll('.portfolio-item');
    
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active state
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const filterValue = btn.getAttribute('data-filter');
            
            portfolioItems.forEach(item => {
                const category = item.getAttribute('data-category');
                
                // First fade out
                item.style.transform = 'scale(0.8)';
                item.style.opacity = '0';
                
                setTimeout(() => {
                    if (filterValue === 'all' || category === filterValue) {
                        item.classList.remove('hide');
                        // Tiny delay to trigger CSS transition correctly
                        setTimeout(() => {
                            item.style.transform = 'scale(1)';
                            item.style.opacity = '1';
                        }, 50);
                    } else {
                        item.classList.add('hide');
                    }
                }, 300);
            });
        });
    });

    // ==========================================
    // 7. Lightbox Gallery Modal with Slideshow
    // ==========================================
    const lightbox = document.getElementById('lightbox-modal');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxTag = document.getElementById('lightbox-tag');
    const lightboxTitle = document.getElementById('lightbox-title');
    const lightboxDesc = document.getElementById('lightbox-desc');
    const lightboxClose = document.getElementById('lightbox-close');
    
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');
    
    const galleryItems = document.querySelectorAll('.portfolio-item');
    let activeIndex = 0;
    let visibleItemsList = []; // Track currently filtered/visible items for arrows

    const updateVisibleItems = () => {
        // Collect only active visible items that aren't filtered out
        visibleItemsList = Array.from(galleryItems).filter(item => !item.classList.contains('hide'));
    };

    const populateLightbox = (index) => {
        if (visibleItemsList.length === 0) return;
        
        const currentItem = visibleItemsList[index];
        const img = currentItem.querySelector('.portfolio-img');
        const tag = currentItem.querySelector('.portfolio-tag');
        const title = currentItem.querySelector('.portfolio-item-title');
        const desc = currentItem.querySelector('.portfolio-item-desc');
        
        lightboxImg.src = img.src;
        lightboxImg.alt = img.alt;
        lightboxTag.textContent = tag.textContent;
        lightboxTitle.textContent = title.textContent;
        lightboxDesc.textContent = desc.textContent;
    };
    
    // Open Lightbox when clicking item
    galleryItems.forEach(item => {
        item.querySelector('.portfolio-img-wrapper').addEventListener('click', () => {
            updateVisibleItems();
            
            // Find current visible index
            activeIndex = visibleItemsList.indexOf(item);
            
            populateLightbox(activeIndex);
            lightbox.classList.add('open');
            document.body.style.overflow = 'hidden'; // Lock main scrolling
        });
    });
    
    // Close Lightbox
    const closeLightboxModal = () => {
        lightbox.classList.remove('open');
        document.body.style.overflow = 'auto'; // Unlock main scrolling
    };
    
    if (lightboxClose) {
        lightboxClose.addEventListener('click', closeLightboxModal);
    }
    
    if (lightbox) {
        lightbox.addEventListener('click', (e) => {
            // Close if clicking outside lightbox content/arrows
            if (e.target === lightbox) {
                closeLightboxModal();
            }
        });
    }
    
    // Next / Prev Buttons
    if (lightboxNext) {
        lightboxNext.addEventListener('click', (e) => {
            e.stopPropagation();
            updateVisibleItems();
            activeIndex = (activeIndex + 1) % visibleItemsList.length;
            populateLightbox(activeIndex);
        });
    }

    if (lightboxPrev) {
        lightboxPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            updateVisibleItems();
            activeIndex = (activeIndex - 1 + visibleItemsList.length) % visibleItemsList.length;
            populateLightbox(activeIndex);
        });
    }
    
    // Keyboard navigation support
    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('open')) return;
        
        if (e.key === 'Escape') {
            closeLightboxModal();
        } else if (e.key === 'ArrowRight') {
            updateVisibleItems();
            activeIndex = (activeIndex + 1) % visibleItemsList.length;
            populateLightbox(activeIndex);
        } else if (e.key === 'ArrowLeft') {
            updateVisibleItems();
            activeIndex = (activeIndex - 1 + visibleItemsList.length) % visibleItemsList.length;
            populateLightbox(activeIndex);
        }
    });

    // ==========================================
    // 8. Interactive Contact Form Handler
    // ==========================================
    const contactForm = document.getElementById('portfolio-contact-form');
    const formSubmitBtn = document.getElementById('form-submit-btn');
    const formStatus = document.getElementById('form-status-msg');
    
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Check form validity (standard HTML5 validation handles this)
            if (!contactForm.checkValidity()) return;
            
            // Visual Submission Loading state
            formSubmitBtn.disabled = true;
            formSubmitBtn.innerHTML = 'Sending Message... <i class="fa-solid fa-spinner fa-spin"></i>';
            
            // Simulate API Call / Form Submission with 1.8 seconds timeout
            setTimeout(() => {
                // Success State animations
                contactForm.reset();
                contactForm.style.display = 'none'; // Fade form out
                formStatus.style.display = 'block'; // Trigger success box
                
                formSubmitBtn.disabled = false;
                formSubmitBtn.innerHTML = 'Send Message <i class="fa-regular fa-paper-plane"></i>';
                
                // Optional: after 8 seconds, let the user fill again if needed
                setTimeout(() => {
                    formStatus.style.display = 'none';
                    contactForm.style.display = 'flex';
                }, 8000);
                
            }, 1800000 / 1000); // 1.8s mock duration
        });
    }

});
