/**
 * Furniture Shop Module - Firebase Integration
 * Handles product browsing, cart management, and room integration
 */

import { showSuccess, showWarning, showError } from './ui-feedback.js';
import { db } from './firebase-config.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ============================================
// STATE MANAGEMENT
// ============================================

let FURNITURE_CATALOG = [];
let cart = [];
let currentFilter = 'all';
let searchQuery = '';

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    loadRoomInfo();
    loadCart();
    await loadFurnitureFromFirebase();
    renderProducts();
    setupEventListeners();
});

// ============================================
// LOAD FURNITURE FROM FIREBASE
// ============================================

async function loadFurnitureFromFirebase() {
    try {
        const querySnapshot = await getDocs(collection(db, 'furniture'));
        
        FURNITURE_CATALOG = [];
        querySnapshot.forEach((doc) => {
            FURNITURE_CATALOG.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        console.log('✅ Loaded', FURNITURE_CATALOG.length, 'furniture items from Firebase');
        
    } catch (error) {
        console.error('Error loading furniture:', error);
        showError('Failed to load furniture. Please refresh the page.');
    }
}

// ============================================
// SEARCH FUNCTIONALITY
// ============================================

window.searchFurniture = function() {
    searchQuery = document.getElementById('searchInput').value.toLowerCase();
    renderProducts();
};

// Add real-time search
if (document.getElementById('searchInput')) {
    document.getElementById('searchInput').addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderProducts();
    });
}

// ============================================
// ROOM INFORMATION
// ============================================

function loadRoomInfo() {
    const roomDataStr = sessionStorage.getItem('currentRoomData');
    const roomInfoEl = document.getElementById('roomInfo');
    
    if (roomDataStr) {
        try {
            const roomData = JSON.parse(roomDataStr);
            roomInfoEl.innerHTML = `
                <strong>Your Room:</strong><br>
                ${roomData.width}m × ${roomData.length}m<br>
                ${roomData.roomType || 'Living Room'}<br>
                <small>${(roomData.width * roomData.length).toFixed(1)} m²</small>
            `;
        } catch (e) {
            roomInfoEl.textContent = 'Room data available';
        }
    } else {
        roomInfoEl.innerHTML = `
            <small style="color: var(--danger);">⚠️ No room configured</small><br>
            <a href="room-setup.html" style="color: var(--primary); font-size: 0.875rem;">Create a room first</a>
        `;
    }
}

// ============================================
// PRODUCT RENDERING
// ============================================

function renderProducts() {
    const grid = document.getElementById('productsGrid');
    const countEl = document.getElementById('productsCount');
    
    let filteredProducts = FURNITURE_CATALOG;
    
    // Apply category filter
    if (currentFilter !== 'all') {
        filteredProducts = filteredProducts.filter(p => p.category === currentFilter);
    }
    
    // Apply search filter
    if (searchQuery) {
        filteredProducts = filteredProducts.filter(p => 
            p.name.toLowerCase().includes(searchQuery) ||
            p.description.toLowerCase().includes(searchQuery) ||
            p.category.toLowerCase().includes(searchQuery)
        );
    }
    
    countEl.textContent = `${filteredProducts.length} items available`;
    
    if (filteredProducts.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #64748b;">
                <p style="font-size: 3rem; margin-bottom: 1rem;">🔍</p>
                <p style="font-size: 1.25rem; font-weight: 600;">No furniture found</p>
                <p style="margin-top: 0.5rem;">Try adjusting your search or filter</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = filteredProducts.map(product => `
        <div class="product-card" data-product-id="${product.id}">
            <div class="product-image">
                <img src="${product.image}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/260x220?text=Furniture'">
                ${product.price < 500 ? '<span class="product-badge">Best Value</span>' : ''}
            </div>
            <div class="product-info">
                <div class="product-category">${product.category}</div>
                <h3 class="product-name">${product.name}</h3>
                <p class="product-dimensions">📏 ${product.width}m × ${product.height}m</p>
                <div class="product-footer">
                    <span class="product-price">$${product.price}</span>
                    <button class="btn-add-to-cart" onclick="addToCart('${product.id}')">
                        Add to Cart
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// ============================================
// CART MANAGEMENT
// ============================================

function loadCart() {
    const savedCart = sessionStorage.getItem('furnitureCart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartUI();
    }
}

function saveCart() {
    sessionStorage.setItem('furnitureCart', JSON.stringify(cart));
}

window.addToCart = function(productId) {
    const product = FURNITURE_CATALOG.find(p => p.id === productId);
    
    if (!product) return;
    
    const existingIndex = cart.findIndex(item => item.id === productId);
    
    if (existingIndex > -1) {
        cart[existingIndex].quantity += 1;
        showSuccess('Quantity updated in cart!');
    } else {
        cart.push({
            ...product,
            quantity: 1
        });
        showSuccess(`${product.name} added to cart!`);
    }
    
    saveCart();
    updateCartUI();
    
    const btn = event.target;
    btn.textContent = '✓ Added';
    btn.classList.add('added');
    setTimeout(() => {
        btn.textContent = 'Add to Cart';
        btn.classList.remove('added');
    }, 1500);
};

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartUI();
    showSuccess('Item removed from cart');
}

function updateCartUI() {
    const cartCount = document.getElementById('cartCount');
    const cartItems = document.getElementById('cartItems');
    const totalItems = document.getElementById('totalItems');
    
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    cartCount.textContent = totalCount;
    totalItems.textContent = totalCount;
    
    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="empty-cart">
                <div class="empty-cart-icon">🛋️</div>
                <p>No furniture selected yet</p>
                <p style="font-size: 0.875rem; margin-top: 0.5rem;">Browse and add items to visualize in your room</p>
            </div>
        `;
    } else {
        cartItems.innerHTML = cart.map(item => `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.name}" class="cart-item-image" onerror="this.src='https://via.placeholder.com/80'">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-dimensions">${item.width}m × ${item.height}m</div>
                    <div class="cart-item-dimensions">Qty: ${item.quantity}</div>
                </div>
                <button class="cart-item-remove" onclick="removeFromCart('${item.id}')">×</button>
            </div>
        `).join('');
    }
}

window.removeFromCart = removeFromCart;

// ============================================
// CART TOGGLE
// ============================================

window.toggleCart = function() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');
    
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
};

// ============================================
// VIEW IN ROOM
// ============================================

window.viewInRoom = function() {
    const roomData = sessionStorage.getItem('currentRoomData');
    
    if (!roomData) {
        showWarning('Please create a room first before visualizing furniture!');
        setTimeout(() => {
            window.location.href = 'room-setup.html';
        }, 2000);
        return;
    }
    
    if (cart.length === 0) {
        showWarning('Please add some furniture to your cart first!');
        return;
    }
    
    saveCart();
    console.log('🛒 Cart being saved:', cart);
    showSuccess('Loading your room with selected furniture...');
    
    setTimeout(() => {
        window.location.href = 'editor-2d.html';
    }, 1000);
};

// ============================================
// FILTERS
// ============================================

window.filterProducts = function() {
    const checkboxes = document.querySelectorAll('.filter-label input[type="checkbox"]');
    const checked = Array.from(checkboxes).find(cb => cb.checked);
    
    if (checked) {
        currentFilter = checked.value;
        renderProducts();
    }
    
    checkboxes.forEach(cb => {
        if (cb !== checked) cb.checked = false;
    });
};

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    document.getElementById('cartToggle').addEventListener('click', toggleCart);
}