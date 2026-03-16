/**
 * Project Details - Room Management Page
 * Shows all rooms in a project and allows create/edit/delete
 */
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    doc,
    getDoc,
    collection,
    query,
    where,
    onSnapshot,
    deleteDoc,
    getDocs
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const projectTitle = document.getElementById('projectTitle');
const projectDesc = document.getElementById('projectDesc');
const roomsList = document.getElementById('roomsList');
const newRoomBtn = document.getElementById('newRoomBtn');
const backBtn = document.getElementById('backBtn');

let currentProjectId = null;
let currentUser = null;
let unsubscribe = null;
let furnitureImageMap = {};

// Track active Konva stages so we can destroy them before re-rendering
// (prevents memory leaks / DOM accumulation from onSnapshot callbacks)
let activeStages = [];

// Get projectId from URL
(function captureProjectId() {
    const params = new URLSearchParams(window.location.search);
    currentProjectId = params.get('projectId');
    console.log('🚀 Project Details page loaded. ProjectId:', currentProjectId);
    if (!currentProjectId) {
        alert('No project selected');
        window.location.href = 'projects.html';
    }
})();

// Auth check and initialize
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = user;

    try {
        const snap = await getDocs(collection(db, 'furniture'));
        furnitureImageMap = {};
        snap.forEach(doc => {
            furnitureImageMap[doc.id] = doc.data().image;
        });
    } catch (e) {
        console.error("Error loading furniture map:", e);
    }

    loadProjectDetails();
    loadRooms();
});

// Load project details (title, description)
async function loadProjectDetails() {
    try {
        const projectRef = doc(db, 'projects', currentProjectId);
        const projectSnap = await getDoc(projectRef);

        if (!projectSnap.exists()) {
            alert('Project not found');
            window.location.href = 'projects.html';
            return;
        }

        const data = projectSnap.data();
        projectTitle.textContent = data.title || 'Untitled Project';
        projectDesc.textContent = data.description || 'No description';
    } catch (error) {
        console.error('Error loading project details:', error);
        alert('Error loading project');
    }
}

// Load rooms in the project (real-time)
function loadRooms() {
    if (unsubscribe) unsubscribe();

    const q = query(
        collection(db, `projects/${currentProjectId}/rooms`),
        where('userId', '==', currentUser.uid)
        // Removed orderBy - no index needed for simple filtered query
    );

    unsubscribe = onSnapshot(q, async (snapshot) => {
        const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('📚 Rooms loaded:', rooms.length, 'rooms in project', currentProjectId);
        await renderRooms(rooms);
    }, (error) => {
        console.error('Error loading rooms:', error);
        roomsList.innerHTML = '<div class="muted">Error loading rooms. Try refreshing.</div>';
    });
}

/**
 * Fetch furniture items for a room.
 * Supports both the new sub-collection format (furnitureRefs) and the legacy
 * inline format (layout.furniture[]).
 */
async function loadRoomFurniture(room, isRetry = false) {
    if (!room || !room.id) return [];

    // Path 1: Check project-bound sub-collection (Most robust for current architecture)
    if (currentProjectId) {
        try {
            const furnColl = collection(db, `projects/${currentProjectId}/rooms/${room.id}/furniture`);
            const snap = await getDocs(furnColl);
            if (!snap.empty) {
                const items = [];
                snap.forEach(d => items.push({ ...d.data(), firestoreId: d.id }));
                return items;
            }
        } catch (e) {
            console.warn('Sub-collection fetch failed for room', room.id, e);
        }
    }

    // Path 2: Check standalone rooms sub-collection (Fallback)
    try {
        const standaloneColl = collection(db, `rooms/${room.id}/furniture`);
        const snap = await getDocs(standaloneColl);
        if (!snap.empty) {
            const items = [];
            snap.forEach(d => items.push({ ...d.data(), firestoreId: d.id }));
            return items;
        }
    } catch (e) { /* ignore fallback errors */ }

    // Path 3: Legacy path for inline furniture data
    if (room.layout) {
        if (Array.isArray(room.layout.furniture)) return room.layout.furniture;
        if (Array.isArray(room.furniture)) return room.furniture;
    }

    // RETRY LOGIC: If still empty and not already a retry, wait 500ms and try again
    // This helps handle Firestore's eventual consistency for brand new designs.
    if (!isRetry) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return loadRoomFurniture(room, true);
    }

    return [];
}

// Render rooms as cards
async function renderRooms(rooms) {
    // ── Issue 2 fix: destroy all existing Konva stages before re-rendering ──
    activeStages.forEach(s => { try { s.destroy(); } catch (_) { /* already removed */ } });
    activeStages = [];

    roomsList.innerHTML = '';

    // Update room count dynamically
    const roomCountEl = document.getElementById('roomCount');
    if (roomCountEl) {
        const count = rooms.length;
        roomCountEl.textContent = `${count} room${count !== 1 ? 's' : ''}`;
    }

    if (!rooms.length) {
        roomsList.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #9ca3af;">
                <p>No rooms in this project yet. Create one to get started!</p>
            </div>
        `;
        return;
    }

    // ── Issue 1 fix: load furniture from sub-collection for each room ──
    const roomFurniturePromises = rooms.map(room => loadRoomFurniture(room));
    const allFurniture = await Promise.all(roomFurniturePromises);

    rooms.forEach((room, idx) => {
        const furnitureList = allFurniture[idx];
        const card = document.createElement('div');
        card.className = 'project-card';

        const roomName = room.roomType ? room.roomType.replace('-', ' ').toUpperCase() : 'Room';
        const dimensions = `${room.width || '?'} x ${room.length || '?'} m`;
        const area = room.area ? `${room.area.toFixed(1)} m²` : 'N/A';
        const isDraft = room.isDraft ? ' <span style="font-size:0.75rem;opacity:0.7">(Draft)</span>' : '';
        const hasLayout = furnitureList.length > 0;
        const containerId = `preview-${room.id}`;

        card.innerHTML = `
            <div class="card-content">
                <div id="${containerId}" style="height: 180px; background: #f8fafc; border-radius: 8px; overflow: hidden; margin-bottom: 12px; border: 1px solid var(--border-light); display: flex; align-items: center; justify-content: center;"></div>
                <h3>${escapeHtml(roomName)}${isDraft}</h3>
                <div class="design-meta" style="font-size: 0.9em; color: var(--text-muted); margin-top: 8px;">
                     <p>Room: ${dimensions} (Height: ${room.height || 2.8}m)</p>
                     <p>Area: ${area} | Shape: ${room.shape || 'rectangular'}</p>
                     ${hasLayout ? `<p style="color:#10b981;font-weight:600;margin-top:4px;">Layout saved (${furnitureList.length} items)</p>` : '<p style="color:var(--text-tertiary);margin-top:4px;">No layout saved</p>'}
                </div>
            </div>
            <div class="card-actions" style="margin-top: 15px; display: flex; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 15px;">
                <button class="btn-secondary" onclick="window.location.href='room-setup.html?projectId=${currentProjectId}&roomId=${room.id}'" style="flex: 1; padding: 0.625rem 1rem; border-radius: 8px; font-weight: 600;">
                    <span>Edit Room</span>
                </button>
                <button class="btn-primary" onclick="window.location.href='editor-2d.html?projectId=${currentProjectId}&roomId=${room.id}'" style="flex: 1; padding: 0.625rem 1rem; border-radius: 8px; font-weight: 600;">
                    <span>Edit Design</span>
                </button>
                <button class="btn-secondary" onclick="deleteRoom('${room.id}')" style="flex: 1; padding: 0.625rem 1rem; border-radius: 8px; font-weight: 600; color: var(--error); border-color: var(--error);">
                    <span>Delete</span>
                </button>
            </div>
        `;
        roomsList.appendChild(card);

        // Render the Konva preview after adding to DOM, passing resolved furniture.
        // We use a slightly longer delay and requestAnimationFrame to ensure the 
        // container width/height are accurately calculated for large rooms.
        setTimeout(() => {
            requestAnimationFrame(() => renderRoomPreview(room, containerId, furnitureList));
        }, 100);
    });
}

// Navigation handlers
newRoomBtn.addEventListener('click', () => {
    window.location.href = `room-setup.html?projectId=${currentProjectId}`;
});

backBtn.addEventListener('click', () => {
    window.location.href = 'projects.html';
});

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(text).replace(/[&<>"']/g, c => map[c]);
}

window.deleteRoom = async function (roomId) {
    if (!confirm('Delete this room and its saved layout? This cannot be undone.')) return;
    try {
        await deleteDoc(doc(db, `projects/${currentProjectId}/rooms/${roomId}`));
        console.log('✅ Room deleted:', roomId);
    } catch (error) {
        console.error('Error deleting room:', error);
        alert('Error deleting room: ' + error.message);
    }
};

/**
 * Load a single furniture image and add it to the Konva preview.
 * Dimensions are derived from the saved state (originalWidth/originalHeight at 80px/m)
 * so the preview faithfully mirrors the 2D editor's layout.
 */
function loadFurnitureImage(imageUrl, fData, furnGroup, layer) {
    const imgObj = new Image();
    imgObj.crossOrigin = 'Anonymous';
    imgObj.onload = function () {
        // Use the saved pixel dimensions (from 2D editor at 80px/m).
        // Fallback chain: originalWidth → displayWidth → image natural size capped at 100px
        const dWidth  = fData.originalWidth  || fData.displayWidth  || Math.min(imgObj.width,  100);
        const dHeight = fData.originalHeight || fData.displayHeight || Math.min(imgObj.height, 100);

        const fGroup = new Konva.Group({
            x:        fData.x,
            y:        fData.y,
            rotation: fData.rotation || 0,
            scaleX:   fData.scaleX   || 1,
            scaleY:   fData.scaleY   || 1
        });

        // Image is centered on the group origin, matching the 2D editor convention
        const fImg = new Konva.Image({
            x:      -dWidth  / 2,
            y:      -dHeight / 2,
            image:  imgObj,
            width:  dWidth,
            height: dHeight,
            shadowColor:   'rgba(0,0,0,0.3)',
            shadowBlur:    8,
            shadowOpacity: 0.5,
            shadowOffset:  { x: 3, y: 3 }
        });

        fGroup.add(fImg);
        furnGroup.add(fGroup);
        layer.batchDraw();
    };
    imgObj.src = imageUrl;
}

/**
 * Render a mini Konva map for a given room.
 * @param {Object}  room          - Room data from Firestore
 * @param {string}  containerId   - DOM element ID for the Konva stage
 * @param {Array}   furnitureList  - Pre-loaded furniture items
 */
function renderRoomPreview(room, containerId, furnitureList) {
    const container = document.getElementById(containerId);
    if (!container || !window.Konva) return;

    // 1. CLEANUP: Prevent duplicate stages stacking in the same container
    // Konva doesn't automatically clear containers. We must do it manually.
    const existingStages = Konva.stages.filter(s => s.container() === container);
    existingStages.forEach(s => s.destroy());

    // 2. DIMENSIONS: Force a measurement check
    const containerWidth = container.offsetWidth || 250;
    const containerHeight = (container.offsetHeight && container.offsetHeight > 50) ? container.offsetHeight : 180;

    const stage = new Konva.Stage({
        container: containerId,
        width: containerWidth,
        height: containerHeight,
    });
    activeStages.push(stage);

    const layer = new Konva.Layer();
    stage.add(layer);

    // 3. GEOMETRY: 80px per meter standard
    const wM = parseFloat(room.width) || 5;
    const lM = parseFloat(room.length) || 5;
    const editorScale = 80;
    const wallT = 15;

    const roomW = wM * editorScale;
    const roomH = lM * editorScale;
    
    // Total visual bounds (floor + outer wall extents)
    const totalW = roomW + wallT;
    const totalH = roomH + wallT;

    // 4. SCALING: Add generous 50px safety padding to prevent ANY clipping
    const safetyPadding = 50;
    const previewScale = Math.min(
        (containerWidth - safetyPadding) / totalW,
        (containerHeight - safetyPadding) / totalH
    );

    // 5. CENTERING: Pure mathematical pivot
    // We place the group at the container center and offset its internal center.
    const contentGroup = new Konva.Group({
        scaleX: previewScale,
        scaleY: previewScale,
        x: containerWidth / 2,
        y: containerHeight / 2,
        offset: { x: roomW / 2, y: roomH / 2 }
    });

    const floorColor = room.floorColor || '#F5DEB3';
    const wallColor = room.wallColor || '#FFFFFF';

    // Draw Floor
    contentGroup.add(new Konva.Rect({
        x: 0, y: 0, width: roomW, height: roomH,
        fill: floorColor, stroke: wallColor, strokeWidth: 1
    }));

    // Draw Walls (Correctly centered at -wallT/2)
    // CRITICAL: We use 'strokeScaleEnabled: false' so the border lines 
    // remain 2px thick and visible regardless of how small the room is scaled.
    const wallStyle = { 
        fill: wallColor, 
        stroke: '#475569', 
        strokeWidth: 2.5, 
        strokeScaleEnabled: false 
    };

    contentGroup.add(new Konva.Rect({ ...wallStyle, x: -wallT/2, y: -wallT/2, width: roomW + wallT, height: wallT }));
    contentGroup.add(new Konva.Rect({ ...wallStyle, x: -wallT/2, y: roomH - wallT/2, width: roomW + wallT, height: wallT }));
    contentGroup.add(new Konva.Rect({ ...wallStyle, x: -wallT/2, y: -wallT/2, width: wallT, height: roomH + wallT }));
    contentGroup.add(new Konva.Rect({ ...wallStyle, x: roomW - wallT/2, y: -wallT/2, width: wallT, height: roomH + wallT }));

    const furnGroup = new Konva.Group();
    contentGroup.add(furnGroup);
    layer.add(contentGroup);

    // 6. Furniture
    if (furnitureList && furnitureList.length > 0) {
        furnitureList.forEach(fData => {
            const imageUrl = fData.image || furnitureImageMap[fData.furnitureId];
            if (imageUrl) {
                loadFurnitureImage(imageUrl, fData, furnGroup, layer);
            }
        });
    }

    layer.batchDraw();
}
