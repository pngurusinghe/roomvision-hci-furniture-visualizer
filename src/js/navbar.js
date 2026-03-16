import { auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

export class Navbar {
    constructor(placeholderId = 'navbar-placeholder') {
        this.placeholder = document.getElementById(placeholderId);
        this.currentPath = window.location.pathname.split('/').pop() || 'home.html';
        this.isDark = localStorage.getItem('rv-theme') === 'dark';

        if (this.placeholder) {
            this.applyTheme(this.isDark);
            this.injectStyles();
            this.render();
            this.setupScrollEffect();
            this.setupAuth();
            this.setupProfileDropdown();
            this.setupThemeToggle();
            this.setupLogout();
            this.setupMobileMenu();

            // Allow async page scripts to update the breadcrumb after fetching project data
            window.addEventListener('rv:projectContext', () => this.render());
        } else {
            console.warn(`Navbar placeholder with ID "${placeholderId}" not found.`);
        }
    }

    //Theme changer
    applyTheme(dark) {
        // data-rv-theme drives the navbar's own CSS vars
        // data-theme drives existing room.css / projects.css dark-mode blocks
        const theme = dark ? 'dark' : 'light';
        document.documentElement.setAttribute('data-rv-theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
        // Smooth body background transition
        document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    }

    injectStyles() {
        if (document.getElementById('rv-navbar-styles')) return;
        const style = document.createElement('style');
        style.id = 'rv-navbar-styles';
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

            /* ── Theme Tokens ── */
            :root,
            [data-rv-theme="light"] {
                --rv-primary: #2563eb;
                --rv-accent: #8b5cf6;
                --rv-text: #1e293b;
                --rv-text-light: #64748b;
                --rv-border: #e2e8f0;
                --rv-bg: rgba(255, 255, 255, 0.97);
                --rv-bg-solid: #ffffff;
                --rv-surface: #f1f5f9;
                --rv-surface-hover: #e2e8f0;
                --rv-dropdown-bg: #ffffff;
                --rv-dropdown-shadow: 0 8px 32px rgba(0,0,0,0.12);
                --rv-body-bg: #f8fafc;
                --rv-body-text: #1e293b;
            }

            [data-rv-theme="dark"] {
                --rv-primary: #3b82f6;
                --rv-accent: #a78bfa;
                --rv-text: #f1f5f9;
                --rv-text-light: #94a3b8;
                --rv-border: #334155;
                --rv-bg: rgba(15, 23, 42, 0.97);
                --rv-bg-solid: #0f172a;
                --rv-surface: #1e293b;
                --rv-surface-hover: #334155;
                --rv-dropdown-bg: #1e293b;
                --rv-dropdown-shadow: 0 8px 32px rgba(0,0,0,0.4);
                --rv-body-bg: #0f172a;
                --rv-body-text: #f1f5f9;
            }

            /* Apply dark mode to body */
            [data-rv-theme="dark"] body {
                background-color: var(--rv-body-bg) !important;
                color: var(--rv-body-text) !important;
            }

            /* ── Navbar Shell ── */
            #rv-navbar {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: var(--rv-bg);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                z-index: 9999;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
                transition: box-shadow 0.3s ease, background 0.3s ease;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }

            #rv-navbar.scrolled {
                box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
            }

            /* ── Container ── */
            .rv-nav-container {
                max-width: 1400px;
                margin: 0 auto;
                padding: 0 2rem;
                height: 68px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 1.5rem;
            }

            /* ── Logo ── */
            .rv-logo {
                display: flex;
                align-items: center;
                gap: 0.625rem;
                text-decoration: none;
                cursor: pointer;
                flex-shrink: 0;
            }

            .rv-logo-icon {
                width: 36px;
                height: 36px;
                border-radius: 10px;
                background: linear-gradient(135deg, var(--rv-primary), var(--rv-accent));
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 12px rgba(37, 99, 235, 0.28);
                transition: transform 0.2s ease, box-shadow 0.2s ease;
            }

            .rv-logo:hover .rv-logo-icon {
                transform: translateY(-2px);
                box-shadow: 0 6px 18px rgba(37, 99, 235, 0.36);
            }

            .rv-logo-text {
                font-size: 1.375rem;
                font-weight: 800;
                background: linear-gradient(135deg, var(--rv-primary), var(--rv-accent));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                letter-spacing: -0.02em;
            }

            /* ── Nav Links ── */
            .rv-nav-links {
                display: flex;
                align-items: center;
                gap: 0.25rem;
                list-style: none;
                margin: 0;
                padding: 0;
            }

            .rv-nav-link {
                text-decoration: none;
                color: var(--rv-text-light);
                font-weight: 500;
                font-size: 0.9rem;
                padding: 0.5rem 0.875rem;
                border-radius: 8px;
                transition: all 0.2s ease;
                position: relative;
                white-space: nowrap;
            }

            .rv-nav-link:hover {
                color: var(--rv-primary);
                background: rgba(37, 99, 235, 0.06);
            }

            .rv-nav-link.active {
                color: var(--rv-primary);
                background: rgba(37, 99, 235, 0.08);
                font-weight: 600;
            }

            .rv-nav-link.active::after {
                content: '';
                position: absolute;
                bottom: 4px;
                left: 50%;
                transform: translateX(-50%);
                width: 18px;
                height: 2px;
                background: linear-gradient(90deg, var(--rv-primary), var(--rv-accent));
                border-radius: 2px;
            }

            /* ── Right Actions ── */
            .rv-nav-actions {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                flex-shrink: 0;
                position: relative;
            }

            .rv-divider {
                width: 1px;
                height: 24px;
                background: var(--rv-border);
                flex-shrink: 0;
            }

            /* ── Profile Button (triggers dropdown) ── */
            .rv-profile-btn {
                display: flex;
                align-items: center;
                gap: 0.6rem;
                padding: 0.45rem 0.9rem 0.45rem 0.45rem;
                background: var(--rv-surface);
                border: 1px solid var(--rv-border);
                border-radius: 50px;
                cursor: pointer;
                transition: all 0.2s ease;
                text-decoration: none;
                font-family: inherit;
                outline: none;
            }

            .rv-profile-btn:hover,
            .rv-profile-btn[aria-expanded="true"] {
                background: var(--rv-surface-hover);
                border-color: var(--rv-text-light);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            }

            .rv-avatar {
                width: 30px;
                height: 30px;
                border-radius: 50%;
                background: linear-gradient(135deg, var(--rv-primary), var(--rv-accent));
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: 700;
                font-size: 0.8rem;
                flex-shrink: 0;
            }

            .rv-user-name {
                font-size: 0.875rem;
                font-weight: 600;
                color: var(--rv-text);
                max-width: 120px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .rv-chevron {
                width: 14px;
                height: 14px;
                color: var(--rv-text-light);
                transition: transform 0.2s ease;
                flex-shrink: 0;
            }

            .rv-profile-btn[aria-expanded="true"] .rv-chevron {
                transform: rotate(180deg);
            }

            /* ── Profile Dropdown ── */
            .rv-dropdown {
                position: absolute;
                top: calc(100% + 10px);
                right: 0;
                min-width: 230px;
                background: var(--rv-dropdown-bg);
                border: 1px solid var(--rv-border);
                border-radius: 14px;
                box-shadow: var(--rv-dropdown-shadow);
                padding: 0.5rem;
                opacity: 0;
                visibility: hidden;
                transform: translateY(-8px);
                transition: opacity 0.18s ease, transform 0.18s ease, visibility 0.18s;
                z-index: 10000;
            }

            .rv-dropdown.open {
                opacity: 1;
                visibility: visible;
                transform: translateY(0);
            }

            /* Dropdown user info header */
            .rv-dropdown-user {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.625rem 0.75rem 0.75rem;
                border-bottom: 1px solid var(--rv-border);
                margin-bottom: 0.375rem;
            }

            .rv-dropdown-user .rv-avatar {
                width: 36px;
                height: 36px;
                font-size: 0.9rem;
            }

            .rv-dropdown-user-info {
                display: flex;
                flex-direction: column;
                gap: 1px;
                overflow: hidden;
            }

            .rv-dropdown-user-name {
                font-size: 0.875rem;
                font-weight: 700;
                color: var(--rv-text);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .rv-dropdown-user-label {
                font-size: 0.75rem;
                color: var(--rv-text-light);
            }

            /* Dropdown items */
            .rv-dropdown-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.75rem;
                width: 100%;
                padding: 0.6rem 0.75rem;
                border-radius: 8px;
                border: none;
                background: none;
                text-align: left;
                font-family: inherit;
                font-size: 0.875rem;
                font-weight: 500;
                color: var(--rv-text);
                cursor: pointer;
                transition: background 0.15s ease;
            }

            .rv-dropdown-item:hover {
                background: var(--rv-surface);
            }

            .rv-dropdown-item-left {
                display: flex;
                align-items: center;
                gap: 0.625rem;
            }

            .rv-dropdown-item-icon {
                width: 32px;
                height: 32px;
                border-radius: 8px;
                background: var(--rv-surface);
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--rv-text-light);
                flex-shrink: 0;
            }

            /* Theme toggle switch */
            .rv-theme-switch {
                position: relative;
                width: 40px;
                height: 22px;
                flex-shrink: 0;
            }

            .rv-theme-switch input {
                opacity: 0;
                width: 0;
                height: 0;
                position: absolute;
            }

            .rv-theme-slider {
                position: absolute;
                inset: 0;
                background: #cbd5e1;
                border-radius: 50px;
                cursor: pointer;
                transition: background 0.2s ease;
            }

            .rv-theme-slider::before {
                content: '';
                position: absolute;
                width: 16px;
                height: 16px;
                left: 3px;
                top: 3px;
                background: white;
                border-radius: 50%;
                transition: transform 0.2s ease;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            }

            .rv-theme-switch input:checked + .rv-theme-slider {
                background: var(--rv-primary);
            }

            .rv-theme-switch input:checked + .rv-theme-slider::before {
                transform: translateX(18px);
            }

            /* Dropdown divider */
            .rv-dropdown-divider {
                height: 1px;
                background: var(--rv-border);
                margin: 0.375rem 0;
            }

            /* Logout item */
            .rv-dropdown-item.danger {
                color: #ef4444;
            }

            .rv-dropdown-item.danger .rv-dropdown-item-icon {
                color: #ef4444;
                background: #fef2f2;
            }

            .rv-dropdown-item.danger:hover {
                background: #fef2f2;
            }

            /* ── Mobile Hamburger ── */
            .rv-hamburger {
                display: none;
                flex-direction: column;
                gap: 5px;
                cursor: pointer;
                padding: 0.5rem;
                border-radius: 8px;
                border: none;
                background: transparent;
                transition: background 0.2s;
            }

            .rv-hamburger:hover { background: var(--rv-surface); }

            .rv-hamburger span {
                display: block;
                width: 22px;
                height: 2px;
                background: var(--rv-text);
                border-radius: 2px;
                transition: all 0.3s ease;
            }

            .rv-hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
            .rv-hamburger.open span:nth-child(2) { opacity: 0; }
            .rv-hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

            /* ── Mobile Drawer ── */
            .rv-mobile-menu {
                position: fixed;
                top: 68px;
                left: 0;
                right: 0;
                background: var(--rv-bg-solid);
                border-top: 1px solid var(--rv-border);
                padding: 1rem 1.5rem 1.5rem;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
                display: none;
                flex-direction: column;
                gap: 0.25rem;
                z-index: 9998;
                animation: rv-slideDown 0.2s ease-out;
            }

            .rv-mobile-menu.open { display: flex; }

            @keyframes rv-slideDown {
                from { opacity: 0; transform: translateY(-8px); }
                to   { opacity: 1; transform: translateY(0); }
            }

            .rv-mobile-link {
                text-decoration: none;
                color: var(--rv-text-light);
                font-weight: 500;
                font-size: 0.95rem;
                padding: 0.75rem 1rem;
                border-radius: 8px;
                transition: all 0.2s ease;
            }

            .rv-mobile-link:hover,
            .rv-mobile-link.active {
                color: var(--rv-primary);
                background: rgba(37, 99, 235, 0.06);
            }

            .rv-mobile-divider {
                height: 1px;
                background: var(--rv-border);
                margin: 0.5rem 0;
            }

            .rv-mobile-user {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.75rem 1rem;
            }

            .rv-mobile-user-name {
                font-weight: 600;
                color: var(--rv-text);
                font-size: 0.9rem;
            }

            .rv-mobile-theme-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0.75rem 1rem;
                border-radius: 8px;
            }

            .rv-mobile-theme-label {
                display: flex;
                align-items: center;
                gap: 0.625rem;
                font-size: 0.9rem;
                font-weight: 500;
                color: var(--rv-text);
            }

            .rv-mobile-logout {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.75rem 1rem;
                border-radius: 8px;
                color: #ef4444;
                font-weight: 600;
                font-size: 0.9rem;
                cursor: pointer;
                background: none;
                border: none;
                font-family: inherit;
                width: 100%;
                text-align: left;
                transition: background 0.2s;
            }

            .rv-mobile-logout:hover { background: #fef2f2; }

            /* ── Responsive ── */
            @media (max-width: 900px) {
                .rv-nav-links { display: none; }
                .rv-divider { display: none; }
                .rv-hamburger { display: flex; }
                .rv-profile-btn { display: none; }
            }

            @media (max-width: 480px) {
                .rv-nav-container { padding: 0 1.25rem; }
                .rv-logo-text { font-size: 1.2rem; }
            }

            /* ── Spacer ── */
            .rv-navbar-spacer {
                height: 68px;
                display: block;
            }

            /* ═══════════════════════════════════════════════════
               FULL-PAGE DARK MODE OVERRIDES
               Covers styles.css (home/auth pages) which have no
               [data-theme='dark'] block of their own.
               room.css & projects.css already respond to
               [data-theme='dark'] natively — those fire automatically.
            ═══════════════════════════════════════════════════ */

            /* -- Body & backgrounds -- */
            [data-rv-theme="dark"] body {
                background-color: #0f172a !important;
                color: #f1f5f9 !important;
            }

            /* styles.css variables (home/login/register pages) */
            [data-rv-theme="dark"] {
                --text-primary: #f1f5f9;
                --text-secondary: #94a3b8;
                --text-light: #64748b;
                --border-color: #334155;
                --input-bg: #1e293b;
            }

            /* Auth pages right panel & card */
            [data-rv-theme="dark"] .right-panel {
                background: #0f172a;
            }

            [data-rv-theme="dark"] .auth-card {
                background: #1e293b;
                border: 1px solid #334155;
                color: #f1f5f9;
            }

            [data-rv-theme="dark"] .auth-header h2 {
                color: #f1f5f9;
            }

            /* Inputs */
            [data-rv-theme="dark"] input[type="text"],
            [data-rv-theme="dark"] input[type="email"],
            [data-rv-theme="dark"] input[type="password"],
            [data-rv-theme="dark"] .form-input,
            [data-rv-theme="dark"] .form-textarea {
                background: #1e293b;
                border-color: #334155;
                color: #f1f5f9;
            }

            [data-rv-theme="dark"] input::placeholder {
                color: #64748b;
            }

            /* Labels */
            [data-rv-theme="dark"] label {
                color: #f1f5f9;
            }

            /* Social buttons */
            [data-rv-theme="dark"] .social-btn {
                background: #1e293b;
                border-color: #334155;
                color: #f1f5f9;
            }

            [data-rv-theme="dark"] .social-btn:hover {
                background: #334155;
            }

            /* Divider "or" text */
            [data-rv-theme="dark"] .divider span {
                background: #1e293b;
                color: #94a3b8;
            }

            [data-rv-theme="dark"] .divider::before {
                background: #334155;
            }

            /* Checkbox */
            [data-rv-theme="dark"] .checkbox-custom {
                background: #1e293b;
                border-color: #475569;
            }

            [data-rv-theme="dark"] .checkbox-text {
                color: #f1f5f9;
            }

            /* Home page hero/sections */
            [data-rv-theme="dark"] .hero-section,
            [data-rv-theme="dark"] .hero {
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) !important;
            }

            [data-rv-theme="dark"] section,
            [data-rv-theme="dark"] .section {
                background: #0f172a;
                color: #f1f5f9;
            }

            [data-rv-theme="dark"] h1,
            [data-rv-theme="dark"] h2,
            [data-rv-theme="dark"] h3,
            [data-rv-theme="dark"] h4,
            [data-rv-theme="dark"] h5,
            [data-rv-theme="dark"] h6 {
                color: #f1f5f9;
            }

            [data-rv-theme="dark"] p {
                color: #cbd5e1;
            }

            /* Generic cards/panels */
            [data-rv-theme="dark"] .card,
            [data-rv-theme="dark"] .panel,
            [data-rv-theme="dark"] .box,
            [data-rv-theme="dark"] .feature-card,
            [data-rv-theme="dark"] .stats-card {
                background: #1e293b !important;
                border-color: #334155 !important;
                color: #f1f5f9;
            }

            /* Furniture shop page */
            [data-rv-theme="dark"] .shop-container,
            [data-rv-theme="dark"] .product-card,
            [data-rv-theme="dark"] .filter-sidebar,
            [data-rv-theme="dark"] .search-bar {
                background: #1e293b;
                border-color: #334155;
                color: #f1f5f9;
            }

            /* Modals */
            [data-rv-theme="dark"] .modal-content {
                background: #1e293b;
                border-color: #334155;
                color: #f1f5f9;
            }

            [data-rv-theme="dark"] .modal-header,
            [data-rv-theme="dark"] .modal-actions {
                background: #1e293b;
                border-color: #334155;
            }

            /* Tables */
            [data-rv-theme="dark"] table {
                color: #f1f5f9;
            }

            [data-rv-theme="dark"] th {
                background: #1e293b;
                color: #94a3b8;
                border-color: #334155;
            }

            [data-rv-theme="dark"] td {
                border-color: #334155;
                color: #f1f5f9;
            }

            [data-rv-theme="dark"] tr:nth-child(even) td {
                background: #1a2540;
            }

            /* Scrollbar */
            [data-rv-theme="dark"] ::-webkit-scrollbar {
                background: #0f172a;
            }

            [data-rv-theme="dark"] ::-webkit-scrollbar-thumb {
                background: #334155;
                border-radius: 4px;
            }

            /* Selection highlight */
            [data-rv-theme="dark"] ::selection {
                background: rgba(59, 130, 246, 0.35);
                color: #f1f5f9;
            }

            /* ════════════════════════════════════════
               FURNITURE SHOP PAGE – dark mode fixes
               Targets hardcoded 'white' / light values
               in furniture-shop.html's inline <style>
            ════════════════════════════════════════ */

            /* Page body */
            [data-rv-theme="dark"] body {
                --bg-primary: #0f172a;
                --bg-secondary: #1e293b;
                --text-primary: #f1f5f9;
                --text-secondary: #94a3b8;
                --border: #334155;
            }

            /* Filter card (sidebar) */
            [data-rv-theme="dark"] .filter-card {
                background: #1e293b !important;
                border: 1px solid #334155;
                color: #f1f5f9;
            }

            [data-rv-theme="dark"] .filter-title {
                color: #f1f5f9;
            }

            [data-rv-theme="dark"] .filter-label:hover {
                background: #334155;
            }

            [data-rv-theme="dark"] .filter-label {
                color: #cbd5e1;
            }

            /* Product cards */
            [data-rv-theme="dark"] .product-card {
                background: #1e293b !important;
                border: 1px solid #334155;
                box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            }

            [data-rv-theme="dark"] .product-image {
                background: #0f172a !important;
            }

            [data-rv-theme="dark"] .product-name {
                color: #f1f5f9 !important;
            }

            [data-rv-theme="dark"] .product-category,
            [data-rv-theme="dark"] .product-dimensions {
                color: #94a3b8 !important;
            }

            [data-rv-theme="dark"] .products-count {
                color: #94a3b8;
            }

            [data-rv-theme="dark"] .section-title {
                color: #f1f5f9;
            }

            /* Search bar */
            [data-rv-theme="dark"] .search-input {
                background: #1e293b;
                border-color: #334155;
                color: #f1f5f9;
            }

            [data-rv-theme="dark"] .search-input::placeholder {
                color: #64748b;
            }

            [data-rv-theme="dark"] .search-input:focus {
                border-color: #3b82f6;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
            }

            /* Cart sidebar */
            [data-rv-theme="dark"] .cart-sidebar {
                background: #1e293b !important;
                color: #f1f5f9;
                box-shadow: -4px 0 24px rgba(0,0,0,0.5);
            }

            [data-rv-theme="dark"] .cart-header {
                border-color: #334155;
            }

            [data-rv-theme="dark"] .cart-title {
                color: #f1f5f9;
            }

            [data-rv-theme="dark"] .cart-close {
                color: #94a3b8;
            }

            [data-rv-theme="dark"] .cart-close:hover {
                color: #f1f5f9;
            }

            [data-rv-theme="dark"] .cart-item {
                border-color: #334155;
                background: #0f172a;
            }

            [data-rv-theme="dark"] .cart-item-name {
                color: #f1f5f9;
            }

            [data-rv-theme="dark"] .cart-item-image {
                background: #1e293b;
            }

            [data-rv-theme="dark"] .cart-footer {
                border-color: #334155;
            }

            [data-rv-theme="dark"] .cart-total {
                color: #f1f5f9;
            }

            [data-rv-theme="dark"] .empty-cart {
                color: #94a3b8;
            }

            /* Outline button adjustments */
            [data-rv-theme="dark"] .btn-outline {
                background: transparent;
                color: #60a5fa;
                border-color: #3b82f6;
            }

            [data-rv-theme="dark"] .btn-outline:hover {
                background: #3b82f6;
                color: white;
            }

            /* App header (furniture shop inline style) */
            [data-rv-theme="dark"] .app-header {
                background: #0f172a !important;
                border-color: #334155;
            }

            /* ═════════════════════════════════════════════
               2D EDITOR PAGE – dark mode fixes
               Covers hardcoded 'white' values in editor-2d.html's inline <style>
            ═════════════════════════════════════════════ */

            /* CSS variable overrides for 2D editor */
            [data-rv-theme="dark"] .top-toolbar {
                background: #0f172a !important;
                border-color: #1e293b !important;
                box-shadow: 0 1px 0 rgba(255,255,255,0.05);
            }

            [data-rv-theme="dark"] .canvas-area {
                background: #0d1526 !important;
            }

            [data-rv-theme="dark"] #canvas-container {
                background: #1e2d45 !important;
                box-shadow: 0 4px 24px rgba(0,0,0,0.5);
            }

            [data-rv-theme="dark"] .zoom-btn {
                background: #1e293b !important;
                border-color: #334155 !important;
                color: #94a3b8 !important;
            }

            [data-rv-theme="dark"] .zoom-btn:hover {
                background: #334155 !important;
                color: #60a5fa !important;
            }

            [data-rv-theme="dark"] .zoom-label,
            [data-rv-theme="dark"] .zoom-value {
                color: #94a3b8;
            }

            [data-rv-theme="dark"] .zoom-slider {
                background: #334155;
            }

            [data-rv-theme="dark"] .btn-secondary {
                background: #1e293b !important;
                border-color: #334155 !important;
                color: #f1f5f9 !important;
            }

            [data-rv-theme="dark"] .btn-secondary:hover {
                background: #334155 !important;
                border-color: #3b82f6 !important;
            }

            /* Room info panel (bottom-right) */
            [data-rv-theme="dark"] .room-info {
                background: #1e293b !important;
                border-color: #334155 !important;
                color: #f1f5f9;
            }

            [data-rv-theme="dark"] .room-info h4 {
                color: #f1f5f9;
            }

            [data-rv-theme="dark"] .room-info p {
                color: #94a3b8;
            }

            /* Keyboard shortcuts panel (bottom-left) */
            [data-rv-theme="dark"] .shortcuts-help {
                background: #1e293b !important;
                border-color: #334155 !important;
                color: #94a3b8;
            }

            [data-rv-theme="dark"] .shortcuts-help h4 {
                color: #f1f5f9;
            }

            [data-rv-theme="dark"] .shortcut-key {
                background: #0f172a !important;
                border-color: #475569 !important;
                color: #f1f5f9;
            }

            /* Instructions tip bar */
            [data-rv-theme="dark"] .instructions {
                background: linear-gradient(135deg, #1e3a6e, #1e40af);
                border-color: #3b82f6;
                color: #e0eeff;
            }

            /* "Optional" badge next to input labels */
            [data-rv-theme="dark"] .optional-label {
                background: #1e293b !important;
                color: #64748b !important;
                border: 1px solid #334155 !important;
            }

            /* ═════════════════════════════════════════════
               ROOM SETUP PAGE – dark mode fixes
            ═════════════════════════════════════════════ */

            /* Preset size buttons (Small / Medium / Large) */
            [data-rv-theme="dark"] .preset-btn {
                background: #1e293b !important;
                border-color: #334155 !important;
                color: #f1f5f9 !important;
            }

            [data-rv-theme="dark"] .preset-btn:hover,
            [data-rv-theme="dark"] .preset-btn.active {
                background: #1e3a6e !important;
                border-color: #3b82f6 !important;
                color: #60a5fa !important;
            }

            /* Info / preview box under dimensions */
            [data-rv-theme="dark"] .info-box {
                background: #1e293b !important;
                border-color: #334155 !important;
                color: #93c5fd !important;
            }

            [data-rv-theme="dark"] .info-box .info-icon {
                color: #3b82f6 !important;
            }

            [data-rv-theme="dark"] .info-box .info-content {
                color: #94a3b8 !important;
            }

            /* Section header icons & headings */
            [data-rv-theme="dark"] .section-icon {
                background: linear-gradient(135deg, rgba(30,58,110,0.9), rgba(59,130,246,0.15)) !important;
                color: #60a5fa !important;
            }

            [data-rv-theme="dark"] .section-header {
                border-bottom-color: #334155 !important;
            }

            [data-rv-theme="dark"] .section-header h2 {
                color: #e2e8f0 !important;
            }

            /* Shape cards (Rectangular / Square) & room type cards */
            [data-rv-theme="dark"] .shape-card {
                background: #1e293b !important;
                border-color: #334155 !important;
                color: #94a3b8 !important;
            }

            [data-rv-theme="dark"] input[type="radio"]:checked + .shape-card,
            [data-rv-theme="dark"] .shape-option input:checked ~ .shape-card,
            [data-rv-theme="dark"] .shape-card:hover {
                background: #1e3a6e !important;
                border-color: #3b82f6 !important;
                color: #60a5fa !important;
            }

            [data-rv-theme="dark"] .room-type-card {
                background: #1e293b !important;
                border-color: #334155 !important;
                color: #94a3b8 !important;
            }

            /* Selected state — covers :has(), radio sibling, JS classes */
            [data-rv-theme="dark"] .room-type-card:has(input:checked),
            [data-rv-theme="dark"] .room-type-card input:checked ~ .room-type-content,
            [data-rv-theme="dark"] .room-type-card:hover,
            [data-rv-theme="dark"] .room-type-card.selected,
            [data-rv-theme="dark"] .room-type-card.active {
                background: #1e3a6e !important;
                border-color: #3b82f6 !important;
                color: #60a5fa !important;
            }

            /* Kill any gradient on the card itself when selected */
            [data-rv-theme="dark"] .room-type-card:has(input:checked),
            [data-rv-theme="dark"] .room-type-card.selected {
                background-image: none !important;
            }

            /* Room type content span & name */
            [data-rv-theme="dark"] .room-type-content {
                color: inherit;
            }

            [data-rv-theme="dark"] .room-type-card input:checked ~ .room-type-content .room-type-name,
            [data-rv-theme="dark"] .room-type-card:has(input:checked) .room-type-name {
                color: #60a5fa !important;
            }

            [data-rv-theme="dark"] .room-icon {
                fill: currentColor;
            }

            /* Also fix shape-card when selected */
            [data-rv-theme="dark"] .shape-card:has(input:checked),
            [data-rv-theme="dark"] .shape-option input:checked ~ .shape-card {
                background: #1e3a6e !important;
                border-color: #3b82f6 !important;
                color: #60a5fa !important;
                background-image: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    render() {
        const links = [
            {
                name: 'My Projects',
                url: 'projects.html',
                icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>`
            },
        ];

        // ── Project Breadcrumb ──
        // On editor/room pages, replace nav links with a compact breadcrumb
        const editorPages = ['editor-2d.html', 'view-3d.html', 'room-setup.html', 'furniture-shop.html'];
        const isEditorPage = editorPages.includes(this.currentPath);

        let projectName = null;
        let roomName = null;
        let projectId = null;
        let roomId = null;

        if (isEditorPage) {
            try {
                const layout = JSON.parse(sessionStorage.getItem('current3DLayout') || 'null');
                if (layout) {
                    projectId = layout.projectId;
                    roomId = layout.roomId;
                    projectName = layout.projectName || layout.roomData?.projectName || null;
                    roomName = layout.roomData?.roomType || layout.roomData?.name || layout.roomName || null;
                }
                if (!projectName) {
                    const roomData = JSON.parse(sessionStorage.getItem('currentRoomData') || 'null');
                    if (roomData) {
                        projectName = roomData.projectName || null;
                        roomName = roomData.roomType || roomData.name || roomName;
                        projectId = projectId || roomData.projectId;
                        roomId = roomId || sessionStorage.getItem('currentRoomId');
                    }
                }
            } catch (e) { }
        }

        // Format room name: 'living-room' → 'Living Room'
        if (roomName) {
            roomName = roomName
                .split(/[-_\s]+/)
                .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');
        }

        const chevronSep = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.4;flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>`;
        const folderIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>`;
        const roomIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`;

        let navCenterHTML;
        if (isEditorPage) {
            const projectsLink = `<a href="projects.html" class="rv-nav-link" style="display:flex;align-items:center;gap:0.35rem;opacity:0.7;font-weight:500;">${folderIcon} My Projects</a>`;
            const projectLink = projectName && projectId
                ? `${chevronSep}<a href="project-details.html?projectId=${projectId}" class="rv-nav-link" style="opacity:0.7;font-size:0.85rem;">${projectName}</a>`
                : projectName
                    ? `${chevronSep}<span class="rv-nav-link" style="opacity:0.7;font-size:0.85rem;">${projectName}</span>`
                    : '';

            // Map each editor page to a friendly label — never use room type as the crumb label
            const pageLabels = {
                'room-setup.html': 'Room Setup',
                'editor-2d.html': '2D Editor',
                'view-3d.html': '3D View',
                'furniture-shop.html': 'Furniture Shop'
            };

            let finalCrumb = '';
            if (this.currentPath === 'room-setup.html') {
                // room-setup gets an extra Room Details crumb linking back to project
                const roomDetailsLink = projectId
                    ? `${chevronSep}<a href="project-details.html?projectId=${projectId}" class="rv-nav-link" style="opacity:0.7;font-size:0.85rem;">Room Details</a>`
                    : '';
                finalCrumb = `${roomDetailsLink}${chevronSep}<span class="rv-nav-link" style="font-size:0.85rem;font-weight:600;">Room Setup</span>`;
            } else {
                const pageLabel = pageLabels[this.currentPath] || this.currentPath;
                finalCrumb = `${chevronSep}<span class="rv-nav-link" style="font-size:0.85rem;font-weight:600;">${pageLabel}</span>`;
            }

            navCenterHTML = `<div class="rv-nav-links" style="display:flex;align-items:center;gap:0.25rem;">${projectsLink}${projectLink}${finalCrumb}</div>`;

        } else {
            const navLinksHTML = links.map(link => {
                const isActive = this.currentPath === link.url ? ' active' : '';
                const icon = link.icon ? `<span style="display:flex;align-items:center;">${link.icon}</span>` : '';
                return `<a href="${link.url}" class="rv-nav-link${isActive}" style="display:flex;align-items:center;gap:0.4rem;">${icon}${link.name}</a>`;
            }).join('');
            navCenterHTML = `<div class="rv-nav-links">${navLinksHTML}</div>`;
        }

        const mobileLinksHTML = links.map(link => {
            const isActive = this.currentPath === link.url ? ' active' : '';
            const icon = link.icon ? `<span style="display:flex;align-items:center;">${link.icon}</span>` : '';
            return `<a href="${link.url}" class="rv-mobile-link${isActive}" style="display:flex;align-items:center;gap:0.5rem;">${icon}${link.name}</a>`;
        }).join('');

        const logoSVG = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
            </svg>`;

        const sunIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
        const moonIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`;
        const logoutIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
        const chevronIcon = `<svg class="rv-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

        const themeChecked = this.isDark ? 'checked' : '';

        const html = `
            <nav id="rv-navbar">
                <div class="rv-nav-container">
                    <!-- Logo -->
                    <a href="home.html" class="rv-logo">
                        <div class="rv-logo-icon">${logoSVG}</div>
                        <span class="rv-logo-text">RoomVision</span>
                    </a>

                    <!-- Desktop Links / Breadcrumb -->
                    ${navCenterHTML}

                    <!-- Right Actions -->
                    <div class="rv-nav-actions">
                        <div class="rv-divider"></div>

                        <!-- Profile button (dropdown trigger) -->
                        <button class="rv-profile-btn" id="rv-profile-btn" aria-expanded="false" aria-haspopup="true">
                            <div class="rv-avatar" id="rv-avatar">U</div>
                            <span class="rv-user-name" id="rv-user-name">Loading</span>
                            ${chevronIcon}
                        </button>

                        <!-- Dropdown Menu -->
                        <div class="rv-dropdown" id="rv-dropdown" role="menu">
                            <!-- User info row -->
                            <div class="rv-dropdown-user">
                                <div class="rv-avatar" id="rv-dropdown-avatar">U</div>
                                <div class="rv-dropdown-user-info">
                                    <span class="rv-dropdown-user-name" id="rv-dropdown-user-name">Loading...</span>
                                    <span class="rv-dropdown-user-label">My Account</span>
                                </div>
                            </div>

                            <!-- Theme toggle -->
                            <button class="rv-dropdown-item" id="rv-theme-toggle-btn">
                                <div class="rv-dropdown-item-left">
                                    <div class="rv-dropdown-item-icon" id="rv-theme-icon">${this.isDark ? moonIcon : sunIcon}</div>
                                    <span id="rv-theme-label">${this.isDark ? 'Dark Mode' : 'Light Mode'}</span>
                                </div>
                                <label class="rv-theme-switch" onclick="event.stopPropagation()">
                                    <input type="checkbox" id="rv-theme-checkbox" ${themeChecked}>
                                    <span class="rv-theme-slider"></span>
                                </label>
                            </button>

                            <div class="rv-dropdown-divider"></div>

                            <!-- Logout -->
                            <button class="rv-dropdown-item danger" id="rv-logout-btn">
                                <div class="rv-dropdown-item-left">
                                    <div class="rv-dropdown-item-icon">${logoutIcon}</div>
                                    <span>Log Out</span>
                                </div>
                            </button>
                        </div>

                        <!-- Mobile hamburger -->
                        <button class="rv-hamburger" id="rv-hamburger" aria-label="Toggle menu">
                            <span></span><span></span><span></span>
                        </button>
                    </div>
                </div>
            </nav>

            <!-- Mobile Drawer -->
            <div class="rv-mobile-menu" id="rv-mobile-menu">
                ${mobileLinksHTML}
                <div class="rv-mobile-divider"></div>
                <div class="rv-mobile-user">
                    <div class="rv-avatar" id="rv-mobile-avatar">U</div>
                    <span class="rv-mobile-user-name" id="rv-mobile-user-name">Loading...</span>
                </div>
                <!-- Mobile theme row -->
                <div class="rv-mobile-theme-row">
                    <div class="rv-mobile-theme-label">
                        <span id="rv-mobile-theme-icon">${this.isDark ? moonIcon : sunIcon}</span>
                        <span id="rv-mobile-theme-label">${this.isDark ? 'Dark Mode' : 'Light Mode'}</span>
                    </div>
                    <label class="rv-theme-switch">
                        <input type="checkbox" id="rv-mobile-theme-checkbox" ${themeChecked}>
                        <span class="rv-theme-slider"></span>
                    </label>
                </div>
                <button class="rv-mobile-logout" id="rv-mobile-logout">
                    ${logoutIcon}
                    Log Out
                </button>
            </div>

            <!-- Spacer -->
            <div class="rv-navbar-spacer"></div>
        `;

        this.placeholder.innerHTML = html;
    }

    setupScrollEffect() {
        const navbar = document.getElementById('rv-navbar');
        if (!navbar) return;
        window.addEventListener('scroll', () => {
            navbar.classList.toggle('scrolled', window.scrollY > 20);
        }, { passive: true });
    }

    setupAuth() {
        onAuthStateChanged(auth, (user) => {
            if (!user && !['index.html', 'register.html'].includes(this.currentPath)) {
                window.location.href = 'index.html';
                return;
            }
            if (user) {
                const displayName = user.displayName || user.email?.split('@')[0] || 'User';
                const initial = displayName.charAt(0).toUpperCase();

                ['rv-user-name', 'rv-dropdown-user-name', 'rv-mobile-user-name'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = displayName;
                });
                ['rv-avatar', 'rv-dropdown-avatar', 'rv-mobile-avatar'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = initial;
                });
            }
        });
    }

    setupProfileDropdown() {
        const btn = document.getElementById('rv-profile-btn');
        const dropdown = document.getElementById('rv-dropdown');
        if (!btn || !dropdown) return;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdown.classList.toggle('open');
            btn.setAttribute('aria-expanded', isOpen);
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
                btn.setAttribute('aria-expanded', false);
            }
        });
    }

    setupThemeToggle() {
        const sunIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
        const moonIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`;

        const updateThemeUI = (dark) => {
            // Icon + label in dropdown
            const icon = document.getElementById('rv-theme-icon');
            const label = document.getElementById('rv-theme-label');
            if (icon) icon.innerHTML = dark ? moonIcon : sunIcon;
            if (label) label.textContent = dark ? 'Dark Mode' : 'Light Mode';

            // Mobile
            const mobileIcon = document.getElementById('rv-mobile-theme-icon');
            const mobileLabel = document.getElementById('rv-mobile-theme-label');
            if (mobileIcon) mobileIcon.innerHTML = dark ? moonIcon : sunIcon;
            if (mobileLabel) mobileLabel.textContent = dark ? 'Dark Mode' : 'Light Mode';

            // Sync checkboxes
            const cb = document.getElementById('rv-theme-checkbox');
            const mobileCb = document.getElementById('rv-mobile-theme-checkbox');
            if (cb) cb.checked = dark;
            if (mobileCb) mobileCb.checked = dark;

            // Apply to DOM
            this.applyTheme(dark);
            localStorage.setItem('rv-theme', dark ? 'dark' : 'light');
            this.isDark = dark;
        };

        const toggle = () => updateThemeUI(!this.isDark);

        // Desktop toggle row click
        const toggleBtn = document.getElementById('rv-theme-toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                // Only toggle if NOT clicking the label/checkbox directly
                if (!e.target.closest('label')) toggle();
            });
        }

        // Checkbox change (direct interaction)
        const checkbox = document.getElementById('rv-theme-checkbox');
        if (checkbox) checkbox.addEventListener('change', () => updateThemeUI(checkbox.checked));

        const mobileCheckbox = document.getElementById('rv-mobile-theme-checkbox');
        if (mobileCheckbox) mobileCheckbox.addEventListener('change', () => updateThemeUI(mobileCheckbox.checked));
    }

    setupLogout() {
        const doLogout = async () => {
            try {
                await signOut(auth);
                window.location.href = 'index.html';
            } catch (err) {
                console.error('Logout error:', err);
                alert('Logout failed. Please try again.');
            }
        };

        const logoutBtn = document.getElementById('rv-logout-btn');
        if (logoutBtn) logoutBtn.addEventListener('click', doLogout);

        const mobileLogout = document.getElementById('rv-mobile-logout');
        if (mobileLogout) mobileLogout.addEventListener('click', doLogout);
    }

    setupMobileMenu() {
        const hamburger = document.getElementById('rv-hamburger');
        const menu = document.getElementById('rv-mobile-menu');
        if (!hamburger || !menu) return;

        hamburger.addEventListener('click', () => {
            const isOpen = menu.classList.toggle('open');
            hamburger.classList.toggle('open', isOpen);
            hamburger.setAttribute('aria-expanded', isOpen);
        });

        menu.querySelectorAll('.rv-mobile-link').forEach(link => {
            link.addEventListener('click', () => {
                menu.classList.remove('open');
                hamburger.classList.remove('open');
            });
        });
    }
}

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('navbar-placeholder')) {
        new Navbar();
    }
});
