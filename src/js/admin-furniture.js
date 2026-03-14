/**
 * Admin Furniture Management
 * Handles adding, viewing, and deleting furniture items
 * Images stored as base64 in Firestore (no Firebase Storage required)
 */

import { auth, db } from './firebase-config.js';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Check admin access
onAuthStateChanged(auth, (user) => {
    if (!user) {
        console.log('No user logged in, redirecting to login...');
        window.location.href = 'index.html';
        return;
    }

    console.log('User logged in:', user.email);

    if (user.email !== 'admin@roomvision.com') {
        alert('Access denied. Admin only.');
        window.location.href = 'projects.html';
        return;
    }

    console.log('Admin access granted');
    loadFurniture();
});

// Logout function
window.logout = async function () {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
};

// Helper: convert File to base64 string
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result); // result is "data:image/...;base64,..."
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Image preview
document.getElementById('furnitureImage').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (file) {
        console.log('Image selected:', file.name, 'Size:', file.size);

        // Keep limit reasonable for Firestore (max ~500KB recommended)
        if (file.size > 700 * 1024) {
            alert('Image size must be less than 500KB when storing without Firebase Storage.');
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('previewImg').src = e.target.result;
            document.getElementById('imagePreview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
});

// Add furniture form submission
document.getElementById('addFurnitureForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    console.log('Form submitted');

    const name = document.getElementById('furnitureName').value;
    const category = document.getElementById('furnitureCategory').value;
    const width = parseFloat(document.getElementById('furnitureWidth').value);
    const height = parseFloat(document.getElementById('furnitureHeight').value);
    const price = parseFloat(document.getElementById('furniturePrice').value);
    const description = document.getElementById('furnitureDescription').value;
    const imageFile = document.getElementById('furnitureImage').files[0];

    if (!imageFile) {
        alert('Please select an image');
        return;
    }

    const submitBtn = e.target.querySelector('.btn-primary');

    try {
        submitBtn.textContent = 'Saving...';
        submitBtn.disabled = true;

        // Convert image to base64 and save directly in Firestore
        const imageBase64 = await fileToBase64(imageFile);
        console.log('Image converted to base64, length:', imageBase64.length);

        const furnitureData = {
            name,
            category,
            width,
            height,
            price,
            description,
            image: imageBase64,       // full base64 data URL — no Storage needed
            createdAt: new Date().toISOString()
        };

        console.log('Adding to Firestore...');
        const docRef = await addDoc(collection(db, 'furniture'), furnitureData);
        console.log('Document added with ID:', docRef.id);

        alert('Furniture added successfully!');

        e.target.reset();
        document.getElementById('imagePreview').style.display = 'none';
        loadFurniture();

    } catch (error) {
        console.error('Error adding furniture:', error);

        let errorMessage = 'Error adding furniture. ';
        if (error.code === 'permission-denied') {
            errorMessage += 'Firestore permission denied. Please check Firestore rules.';
        } else {
            errorMessage += error.message;
        }

        alert(errorMessage);
    } finally {
        submitBtn.textContent = 'Add Furniture';
        submitBtn.disabled = false;
    }
});

// Load furniture list
async function loadFurniture() {
    const listContainer = document.getElementById('furnitureList');
    console.log('Loading furniture...');

    try {
        // Add a manual timeout race since Firestore getDocs can hang silently on bad connections
        const fetchPromise = getDocs(collection(db, 'furniture'));
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Firestore connection timeout after 10s. Are you offline?')), 10000)
        );

        const querySnapshot = await Promise.race([fetchPromise, timeoutPromise]);

        console.log('Found', querySnapshot.size, 'furniture items');

        if (querySnapshot.empty) {
            listContainer.innerHTML = '<div class="loading">No furniture items found in inventory.</div>';
            return;
        }

        let html = '';
        querySnapshot.forEach((document) => {
            const item = document.data();
            html += `
                <div class="furniture-item">
                    <img src="${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/80?text=Error'">
                    <div class="furniture-info">
                        <div class="furniture-name">${item.name}</div>
                        <div class="furniture-meta">
                            ${item.category} • ${item.width}m × ${item.height}m • $${item.price}
                        </div>
                    </div>
                    <button class="btn-delete" onclick="deleteFurniture('${document.id}')">
                        Delete
                    </button>
                </div>
            `;
        });

        listContainer.innerHTML = html;

    } catch (error) {
        console.error('Error loading furniture:', error);
        listContainer.innerHTML = `<div class="loading">Error loading furniture: ${error.message}</div>`;
    }
}

// Delete furniture (Firestore only — no Storage cleanup needed)
window.deleteFurniture = async function (furnitureId) {
    if (!confirm('Are you sure you want to delete this furniture item?')) return;

    console.log('Deleting furniture:', furnitureId);

    try {
        await deleteDoc(doc(db, 'furniture', furnitureId));
        console.log('Deleted from Firestore');
        alert('Furniture deleted successfully!');
        loadFurniture();
    } catch (error) {
        console.error('Error deleting furniture:', error);
        alert('Error deleting furniture: ' + error.message);
    }
};