import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    doc,
    updateDoc,
    deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// DOM Elements
const designsList = document.getElementById('designsList');

// Modal Elements
const editModal = document.createElement('div');
editModal.className = 'modal';
editModal.id = 'editModal';
editModal.hidden = true;
editModal.setAttribute('role', 'dialog');
editModal.setAttribute('aria-modal', 'true');
editModal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content">
        <div class="modal-header">
            <h2>Edit Design Name</h2>
            <button type="button" class="modal-close" id="modalCloseEdit" aria-label="Close modal">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>
        </div>
        <form id="editDesignForm">
            <input type="hidden" id="editDesignId">
            <div class="form-group">
                <label for="editDesignName" class="form-label">
                    Design Name
                    <span class="required">*</span>
                </label>
                <input 
                    type="text" 
                    id="editDesignName" 
                    class="form-input"
                    required 
                    placeholder="e.g., Living Room Layout A"
                    maxlength="50"
                >
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" id="cancelEditBtn">Cancel</button>
                <button type="submit" class="btn-primary">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 10l3 3 7-7"/>
                    </svg>
                    <span>Save Changes</span>
                </button>
            </div>
        </form>
    </div>
`;
document.body.appendChild(editModal);

const editForm = document.getElementById('editDesignForm');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const modalCloseEditBtn = document.getElementById('modalCloseEdit');
const editDesignIdInput = document.getElementById('editDesignId');
const editDesignNameInput = document.getElementById('editDesignName');

let currentUser = null;

// Initialize
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = user;
    loadDesigns();
});

// Global Map to store furniture images
let furnitureImageMap = {};

/**
 * Fetch and display all layouts from the designs collection
 */
async function loadDesigns() {
    designsList.innerHTML = '<div class="muted" style="text-align: center; padding: 40px;"><div class="loading-spinner"></div><p>Loading your designs...</p></div>';

    try {
        const designsRef = collection(db, 'designs');
        const q = query(
            designsRef,
            where('userId', '==', currentUser.uid)
        );

        // Fetch designs and furniture catalog concurrently
        const [designsSnap, furnitureSnap] = await Promise.all([
            getDocs(q),
            getDocs(collection(db, 'furniture'))
        ]);

        // Build map of furniture ID to image URL
        furnitureImageMap = {};
        furnitureSnap.forEach(doc => {
            furnitureImageMap[doc.id] = doc.data().image;
        });

        const designs = [];
        designsSnap.forEach((doc) => {
            designs.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Sort by createdAt client-side to avoid strict index requirements
        designs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        renderDesigns(designs);
    } catch (error) {
        console.error("Error loading designs:", error);
        designsList.innerHTML = `<div class="error-message">Failed to load designs. ${error.message}</div>`;
    }
}

/**
 * Render the design cards to the DOM
 */
function renderDesigns(designs) {
    designsList.innerHTML = '';

    if (!designs || designs.length === 0) {
        designsList.innerHTML = `
            <div class="muted" style="text-align: center; padding: 40px;">
                <p>No designs saved yet. Create a project, select a room, and layout furniture using the 2D Editor to get started!</p>
                <a href="projects.html" class="primary-btn" style="display: inline-block; margin-top: 15px;">Go to Projects</a>
            </div>
        `;
        return;
    }

    designs.forEach(design => {
        const card = document.createElement('div');
        card.className = 'project-card';

        // Use designName or fallback
        const name = design.designName || 'Untitled Design';

        // Format the date
        let dateString = 'Recently';
        if (design.updatedAt) {
            dateString = new Date(design.updatedAt).toLocaleDateString();
        } else if (design.createdAt) {
            dateString = new Date(design.createdAt).toLocaleDateString();
        }

        // Safely extract room dimensions
        const room = design.room || { width: 0, length: 0 };
        const area = (room.width * room.length).toFixed(2);
        const furnCount = design.furnitureCount || (design.furniture ? design.furniture.length : 0);

        const designId = design.id;
        const containerId = `preview-${designId}`;

        card.innerHTML = `
            <div class="card-content">
                <div id="${containerId}" style="height: 180px; background: #f8fafc; border-radius: 8px; overflow: hidden; margin-bottom: 12px; border: 1px solid var(--border-light); display: flex; align-items: center; justify-content: center;"></div>
                <h3>${escapeHtml(name)}</h3>
                <div class="design-meta" style="font-size: 0.9em; color: var(--text-muted); margin-top: 8px;">
                     <p>Room: ${room.width}m × ${room.length}m (${area} m²)</p>
                     <p>Items: ${furnCount} pieces of furniture</p>
                     <p>Last edited: ${dateString}</p>
                </div>
            </div>
            <div class="card-actions" style="margin-top: 15px; display: flex; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 15px;">
                <button class="btn-primary" data-action="open" data-id="${designId}" style="flex: 1; padding: 0.625rem 1rem; border-radius: 8px; font-weight: 600;"><span>Open</span></button>
                <button class="btn-secondary" data-action="edit" data-id="${designId}" data-name="${escapeHtml(name)}" style="flex: 1; padding: 0.625rem 1rem; border-radius: 8px; font-weight: 600;"><span>Edit Name</span></button>
                <button class="btn-secondary" data-action="delete" data-id="${designId}" style="flex: 1; padding: 0.625rem 1rem; border-radius: 8px; font-weight: 600; color: var(--error); border-color: var(--error);"><span>Delete</span></button>
            </div>
        `;
        designsList.appendChild(card);

        // Render the Konva preview after adding to DOM
        setTimeout(() => renderDesignPreview(design, containerId), 50);
    });

    attachCardListeners();
}

/**
 * Render a mini Konva map for a given design
 */
function renderDesignPreview(design, containerId) {
    const container = document.getElementById(containerId);
    if (!container || !window.Konva) return;

    const containerWidth = container.clientWidth || 250;
    const containerHeight = container.clientHeight || 180;

    const stage = new Konva.Stage({
        container: containerId,
        width: containerWidth,
        height: containerHeight,
        draggable: false
    });

    const layer = new Konva.Layer();
    stage.add(layer);

    const room = design.room || { width: 5, length: 5 };
    const padding = 20;

    // Calculate global scale
    // e.g. room in meters * 80 (baseScale from editor-2d) = pixels in editor
    // We must scale editor pixels down to fit in our 180px high container

    const editorBaseScale = 80;
    const roomWidthPx = room.width * editorBaseScale;
    const roomHeightPx = room.length * editorBaseScale;

    // We MUST use the same coordinate space as the 2D editor when they hit save.
    // The editor centered the room group originally using these equations based on the user's screen dimensions:
    // const roomX = (window.innerWidth - 100 - roomWidthPx) / 2
    // const roomY = (window.innerHeight - 60 - 100 - roomHeightPx) / 2
    // Since we don't know window innerWidth/Height at the time of save, we CANNOT rely on absolute X,Y alone
    // without shifting them back relative to the minimum bounded box of the furniture.

    // Instead of absolute positioning against the screen, let's look at how the editor structured it:
    // `this.roomGroup = new Konva.Group({ x: roomX, y: roomY })`
    // where Floor is at (0,0) relative to that `roomGroup`.
    // Furniture `x,y` are relative to `roomGroup`? NO. 
    // In `editor-2d.js`: `this.furnitureLayer.add(group)`
    // The furniture groups are added to the stage directly, so they use ABSOLUTE stage coordinates.
    // That means `furniture.x` = `roomX` + some relative distance.

    // Solution step 1: Render everything as they are (absolute coords).
    const contentGroup = new Konva.Group();

    // Create room at an origin (0,0) initially, we will shift it later once we find the absolute roomX/Y.
    const roomGroup = new Konva.Group();

    const floorColor = room.floorColor || '#F5DEB3';
    const wallColor = room.wallColor || '#FFFFFF';
    const wallThickness = 15;

    // Draw Floor
    const floor = new Konva.Rect({
        x: 0, y: 0,
        width: roomWidthPx,
        height: roomHeightPx,
        fill: floorColor, stroke: wallColor, strokeWidth: 3
    });
    roomGroup.add(floor);

    // Walls
    const topWall = new Konva.Rect({ x: -wallThickness / 2, y: -wallThickness / 2, width: roomWidthPx + wallThickness, height: wallThickness, fill: wallColor, stroke: '#000', strokeWidth: 1 });
    const bottomWall = new Konva.Rect({ x: -wallThickness / 2, y: roomHeightPx - wallThickness / 2, width: roomWidthPx + wallThickness, height: wallThickness, fill: wallColor, stroke: '#000', strokeWidth: 1 });
    const leftWall = new Konva.Rect({ x: -wallThickness / 2, y: -wallThickness / 2, width: wallThickness, height: roomHeightPx + wallThickness, fill: wallColor, stroke: '#000', strokeWidth: 1 });
    const rightWall = new Konva.Rect({ x: roomWidthPx - wallThickness / 2, y: -wallThickness / 2, width: wallThickness, height: roomHeightPx + wallThickness, fill: wallColor, stroke: '#000', strokeWidth: 1 });

    roomGroup.add(topWall, bottomWall, leftWall, rightWall);
    contentGroup.add(roomGroup);

    // Add Furniture
    const furnGroup = new Konva.Group();

    // We will track the minX/minY of the furniture to guess where the room's origin (roomX, roomY) was.
    // In `editor-2d.js` the furniture is constrained:
    // `newBox.x < roomGroup.position().x + padding`
    // So furniture X and Y are mathematically bound inside the room.
    // Let's assume the user put the furniture roughly in the center, or we can just mathematically
    // calculate the room offset based on the furniture bounds. 
    // Wait... if they pushed a chair to the very top left corner (X=roomX, Y=roomY), then minX = roomX.
    // This is hard to guess accurately.

    // Let's actually check how editor-2d stores it!
    // At line 603: `room: this.roomData` -> Just height/width.
    // At line 607: `furnitureLayer.getChildren().map(group => ... { x: group.x(), y: group.y() })`.
    // It DOES NOT store `roomX` and `roomY`!
    // Since it centered the room on whatever size screen the user had at the time, 
    // the absolute `x` and `y` are entirely arbitrary.

    // To fix this perfectly: We must center the furniture cluster itself, and wrap the room around the furniture cluster.
    // Specifically, let's find the exact bounds of the furniture cluster first.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    if (design.furniture && design.furniture.length > 0) {
        design.furniture.forEach(fData => {
            minX = Math.min(minX, fData.x);
            minY = Math.min(minY, fData.y);
            maxX = Math.max(maxX, fData.x);
            maxY = Math.max(maxY, fData.y);

            const imageUrl = furnitureImageMap[fData.furnitureId];
            if (imageUrl) {
                const imgObj = new Image();
                imgObj.crossOrigin = 'Anonymous';
                imgObj.onload = () => {
                    const maxDisplaySize = 120;
                    const aspectRatio = imgObj.width / imgObj.height;
                    let dWidth, dHeight;
                    if (imgObj.width > imgObj.height) {
                        dWidth = Math.min(imgObj.width, maxDisplaySize);
                        dHeight = dWidth / aspectRatio;
                    } else {
                        dHeight = Math.min(imgObj.height, maxDisplaySize);
                        dWidth = dHeight * aspectRatio;
                    }

                    const fGroup = new Konva.Group({
                        x: fData.x,
                        y: fData.y,
                        rotation: fData.rotation || 0,
                        scaleX: fData.scaleX || 1,
                        scaleY: fData.scaleY || 1
                    });

                    const fImg = new Konva.Image({
                        x: -dWidth / 2,
                        y: -dHeight / 2,
                        image: imgObj,
                        width: dWidth,
                        height: dHeight,
                        shadowColor: 'rgba(0, 0, 0, 0.3)',
                        shadowBlur: 12,
                        shadowOpacity: 0.6,
                        shadowOffset: { x: 4, y: 4 }
                    });

                    fGroup.add(fImg);
                    furnGroup.add(fGroup);
                    layer.batchDraw();
                };
                imgObj.src = imageUrl;
            }
        });
    }

    contentGroup.add(furnGroup);

    // Now align the Room Group perfectly to enclose the Furniture Group's center.
    // If we assume the furniture was roughly placed in the middle of the room in the editor...
    // The exact absolute 'roomX' cannot be fully recreated without storing window size, 
    // so we force the room to center itself perfectly under the center of the furniture mass.
    if (minX !== Infinity) {
        const furnCenterX = (minX + maxX) / 2;
        const furnCenterY = (minY + maxY) / 2;

        // Push room so its exact center matches the furniture center
        roomGroup.position({
            x: furnCenterX - (roomWidthPx / 2),
            y: furnCenterY - (roomHeightPx / 2)
        });
    }

    // Now everything is aligned relatively to each other in absolute space.
    // We scale the ENTIRE content cluster down to fit the preview container exactly.
    // Since we forced the room to encase the furniture tightly, the total width IS exactly roomWidthPx.
    const scaleX = (containerWidth - padding) / roomWidthPx;
    const scaleY = (containerHeight - padding) / roomHeightPx;
    const previewScale = Math.min(scaleX, scaleY);

    contentGroup.scale({ x: previewScale, y: previewScale });

    // Center the entire correctly-scaled layout onto the exact center of our container
    layer.add(contentGroup);

    // We must wait for the next tick to ensure Konva updates the bounds calculations.
    setTimeout(() => {
        const bounds = contentGroup.getClientRect({ skipTransform: false });
        // Shift it so bounds.x and bounds.y land perfectly centered
        contentGroup.x((containerWidth - bounds.width) / 2 - bounds.x + contentGroup.x());
        contentGroup.y((containerHeight - bounds.height) / 2 - bounds.y + contentGroup.y());
        layer.batchDraw();
    }, 50);
}

/**
 * Attach event listeners to buttons on the cards
 */
function attachCardListeners() {
    // Open Button
    document.querySelectorAll('[data-action="open"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            // Navigates to editor-2d conceptually using the design ID parameter
            window.location.href = `editor-2d.html?designId=${id}`;
        });
    });

    // Delete Button
    document.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;

            if (!confirm('Are you sure you want to delete this design layout? This action cannot be undone.')) {
                return;
            }

            const originalText = e.currentTarget.textContent;
            e.currentTarget.textContent = 'Deleting...';
            e.currentTarget.disabled = true;

            try {
                await deleteDoc(doc(db, 'designs', id));
                // Reload list to reflect changes
                loadDesigns();
            } catch (error) {
                console.error("Error deleting design:", error);
                alert("Failed to delete design. Please try again.");
                e.currentTarget.textContent = originalText;
                e.currentTarget.disabled = false;
            }
        });
    });

    // Edit Button
    document.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const currentName = e.currentTarget.dataset.name;

            editDesignIdInput.value = id;
            editDesignNameInput.value = currentName !== 'undefined' ? currentName : '';
            editModal.hidden = false;
            editDesignNameInput.focus();
        });
    });
}

// Handle Edit Form Submission
editForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const designId = editDesignIdInput.value;
    const newDesignName = editDesignNameInput.value.trim();

    if (!newDesignName) {
        alert("Please enter a name for this design.");
        return;
    }

    const submitBtn = editForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Saving...';
    submitBtn.disabled = true;

    try {
        await updateDoc(doc(db, 'designs', designId), {
            designName: newDesignName,
            updatedAt: new Date().toISOString()
        });

        editModal.hidden = true;
        loadDesigns(); // Reload list
    } catch (error) {
        console.error("Error updating design:", error);
        alert("Failed to update design. Please try again.");
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

// Close Edit Modal
cancelEditBtn.addEventListener('click', () => {
    editModal.hidden = true;
    editForm.reset();
});

modalCloseEditBtn.addEventListener('click', () => {
    editModal.hidden = true;
    editForm.reset();
});

// Optional: Close on backdrop click
editModal.querySelector('.modal-backdrop').addEventListener('click', () => {
    editModal.hidden = true;
    editForm.reset();
});

/**
 * Utility: Escape HTML to prevent XSS
 */
function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": "&#39;" })[c]);
}
