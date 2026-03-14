/**
 * Admin Furniture Management
 * Handles adding, viewing, and deleting 2D furniture items AND 3D models.
 * 2D images stored as base64 in Firestore.
 * 3D models (.glb/.gltf) stored in Firebase Storage; metadata in Firestore `furniture3d`.
 */

import { auth, db, storage } from './firebase-config.js';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    ref as storageRef,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

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
    loadModels3D();
    loadFurnitureDropdown();
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

// ============================================================
//  3D MODEL MANAGEMENT
// ============================================================

// Populate the "Link to Furniture Item" dropdown from the `furniture` collection
async function loadFurnitureDropdown() {
    const select = document.getElementById('model3dFurnitureId');
    if (!select) return;

    try {
        const snapshot = await getDocs(collection(db, 'furniture'));
        if (snapshot.empty) {
            select.innerHTML = '<option value="">No furniture items found — add some first</option>';
            return;
        }

        let html = '<option value="">Select furniture item…</option>';
        snapshot.forEach(d => {
            const item = d.data();
            html += `<option value="${d.id}">${item.name} (${item.category || ''} · ${item.width}m × ${item.height}m)</option>`;
        });
        select.innerHTML = html;
    } catch (err) {
        console.error('Error loading furniture dropdown:', err);
        select.innerHTML = '<option value="">Error loading items</option>';
    }
}

// Show selected GLB filename
document.getElementById('model3dFile').addEventListener('change', function (e) {
    const file = e.target.files[0];
    const nameEl = document.getElementById('model3dFilename');
    if (file) {
        if (file.size > 10 * 1024 * 1024) {
            alert('File is too large. Please use a GLB file under 10 MB.');
            e.target.value = '';
            nameEl.textContent = '';
            return;
        }
        nameEl.textContent = `📎 ${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
    } else {
        nameEl.textContent = '';
    }
});

// Upload a 3D model form submission (supports both File upload and direct URL)
document.getElementById('addModel3DForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const furnitureId = document.getElementById('model3dFurnitureId').value;
    const widthM  = parseFloat(document.getElementById('model3dWidth').value);
    const depthM  = parseFloat(document.getElementById('model3dDepth').value);
    const heightM = parseFloat(document.getElementById('model3dHeight').value);
    const sourceMode = this.dataset.sourceMode || 'url';

    if (!furnitureId) { alert('Please select a furniture item to link.'); return; }

    const submitBtn = document.getElementById('addModel3DBtn');
    submitBtn.textContent = 'Saving…';
    submitBtn.disabled = true;

    try {
        let storageUrl  = '';
        let storagePath = '';
        let filename    = '';

        if (sourceMode === 'upload') {
            // ---- Firebase Storage upload path ----
            const glbFile = document.getElementById('model3dFile').files[0];
            if (!glbFile) { alert('Please select a GLB/GLTF file.'); return; }

            const progressWrap = document.getElementById('model3dProgressWrap');
            const progressBar  = document.getElementById('model3dProgress');
            progressWrap.style.display = 'block';

            storagePath = `models3d/${Date.now()}_${glbFile.name}`;
            const fileRef = storageRef(storage, storagePath);
            const uploadTask = uploadBytesResumable(fileRef, glbFile);

            await new Promise((resolve, reject) => {
                uploadTask.on(
                    'state_changed',
                    (snapshot) => {
                        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                        progressBar.style.width = `${pct}%`;
                    },
                    reject,
                    resolve
                );
            });

            storageUrl = await getDownloadURL(fileRef);
            filename   = glbFile.name;

            progressWrap.style.display = 'none';
            progressBar.style.width = '0%';

        } else {
            // ---- Direct URL path (no Firebase Storage required) ----
            storageUrl = document.getElementById('model3dUrl').value.trim();
            if (!storageUrl) { alert('Please enter a GLB URL.'); return; }
            if (!storageUrl.match(/^https?:\/\/.+\.(glb|gltf)(\?.*)?$/i)) {
                alert('URL must end in .glb or .gltf (with optional query string).');
                return;
            }
            filename = storageUrl.split('/').pop().split('?')[0];
        }

        // Save metadata to Firestore `furniture3d`
        await addDoc(collection(db, 'furniture3d'), {
            furnitureId,
            widthM,
            depthM,
            heightM,
            storagePath,
            storageUrl,
            filename,
            sourceMode,
            createdAt: new Date().toISOString()
        });

        alert('3D model saved successfully!');
        e.target.reset();
        document.getElementById('model3dFilename').textContent = '';
        loadModels3D();

    } catch (error) {
        console.error('Error saving 3D model:', error);
        alert('Failed: ' + error.message);
    } finally {
        submitBtn.textContent = 'Save 3D Model';
        submitBtn.disabled = false;
    }
});

// Load and display uploaded 3D models
async function loadModels3D() {
    const listContainer = document.getElementById('model3dList');
    if (!listContainer) return;

    try {
        const fetchPromise = getDocs(collection(db, 'furniture3d'));
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout after 10s')), 10000)
        );
        const snapshot = await Promise.race([fetchPromise, timeoutPromise]);

        if (snapshot.empty) {
            listContainer.innerHTML = '<div class="loading">No 3D models uploaded yet.</div>';
            return;
        }

        // Also build a quick name-lookup from the furniture collection
        const furnitureSnap = await getDocs(collection(db, 'furniture'));
        const nameMap = {};
        furnitureSnap.forEach(d => { nameMap[d.id] = d.data().name || d.id; });

        let html = '';
        snapshot.forEach(d => {
            const m = d.data();
            const linkedName = nameMap[m.furnitureId] || m.furnitureId;
            html += `
                <div class="model3d-item">
                    <div class="model3d-icon">🧊</div>
                    <div class="furniture-info">
                        <div class="furniture-name">${m.filename || 'model.glb'}</div>
                        <div class="furniture-meta">
                            Linked to: <strong>${linkedName}</strong> ·
                            ${m.widthM}m W × ${m.depthM}m D × ${m.heightM}m H
                        </div>
                        <div class="furniture-meta" style="margin-top:0.2rem;">
                            <a href="${m.storageUrl}" target="_blank" style="color:#7c3aed;text-decoration:underline;">
                                View / Download
                            </a>
                        </div>
                    </div>
                    <button class="btn-delete" onclick="deleteModel3D('${d.id}', '${m.storagePath}')">
                        Delete
                    </button>
                </div>
            `;
        });

        listContainer.innerHTML = html;

    } catch (error) {
        console.error('Error loading 3D models:', error);
        listContainer.innerHTML = `<div class="loading">Error loading 3D models: ${error.message}</div>`;
    }
}

// Delete a 3D model from Storage and Firestore
window.deleteModel3D = async function (docId, storagePath) {
    if (!confirm('Delete this 3D model? This cannot be undone.')) return;

    try {
        // Remove from Firebase Storage
        if (storagePath) {
            const fileRef = storageRef(storage, storagePath);
            await deleteObject(fileRef).catch(e => console.warn('Storage delete skipped:', e));
        }

        // Remove Firestore document
        await deleteDoc(doc(db, 'furniture3d', docId));

        alert('3D model deleted.');
        loadModels3D();
    } catch (error) {
        console.error('Error deleting 3D model:', error);
        alert('Error: ' + error.message);
    }
};