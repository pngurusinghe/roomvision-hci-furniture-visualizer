import { auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

/**
 * Universal Navbar Component
 * Handles injection, auth guards, and active state
 */
export class Navbar {
    constructor(placeholderId = 'navbar-placeholder') {
        this.placeholder = document.getElementById(placeholderId);
        this.currentPath = window.location.pathname.split('/').pop() || 'index.html';
        
        if (this.placeholder) {
            this.init();
        } else {
            console.warn(`Navbar placeholder with ID "${placeholderId}" not found.`);
        }
    }

    async init() {
        this.render();
        this.setupAuth();
        this.setupLogout();
    }

    render() {
        // Core links - can be expanded as needed
        const links = [
            { name: 'Home', url: 'home.html' },
            { name: 'Projects', url: 'projects.html' },
            { name: 'Furniture Shop', url: 'furniture-shop.html' }
        ];

        const navHtml = `
            <nav style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 2rem; border-bottom: 1px solid #ddd; background: #fff;">
                <div style="display: flex; align-items: center; gap: 2rem;">
                    <a href="home.html" style="font-weight: bold; text-decoration: none; color: #000; font-size: 1.25rem;">RoomVision</a>
                    <div style="display: flex; gap: 1.5rem;">
                        ${links.map(link => `
                            <a href="${link.url}" class="${this.currentPath === link.url ? 'active' : ''}" 
                               style="text-decoration: none; color: ${this.currentPath === link.url ? '#2563eb' : '#64748b'}; font-weight: ${this.currentPath === link.url ? 'bold' : 'normal'};">
                                ${link.name}
                            </a>
                        `).join('')}
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <span id="nav-user-name" style="font-size: 0.9rem; color: #475569;">Loading...</span>
                    <button id="nav-logout-btn" style="padding: 0.5rem 1rem; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Logout
                    </button>
                </div>
            </nav>
        `;

        this.placeholder.innerHTML = navHtml;
    }

    setupAuth() {
        onAuthStateChanged(auth, (user) => {
            if (!user && !['index.html', 'register.html'].includes(this.currentPath)) {
                window.location.href = 'index.html';
            } else if (user) {
                const userNameEl = document.getElementById('nav-user-name');
                if (userNameEl) {
                    userNameEl.textContent = user.displayName || user.email.split('@')[0];
                }
            }
        });
    }

    setupLogout() {
        const logoutBtn = document.getElementById('nav-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    await signOut(auth);
                    window.location.href = 'index.html';
                } catch (error) {
                    console.error('Logout error:', error);
                    alert('Logout failed');
                }
            });
        }
    }
}

// Auto-initialize if the placeholder is present
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('navbar-placeholder')) {
        new Navbar();
    }
});
