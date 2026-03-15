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
async function loadRoomFurniture(room) {
    // New path: furniture stored in Firestore sub-collection
    if (room.layout && room.layout.furnitureRefs && Array.isArray(room.layout.furnitureRefs)) {
        try {
            const furnitureCollectionRef = collection(
                db, `projects/${currentProjectId}/rooms/${room.id}/furniture`
            );
            const snap = await getDocs(furnitureCollectionRef);
            const items = [];
            snap.forEach(d => items.push({ ...d.data(), firestoreId: d.id }));
            return items;
        } catch (e) {
            console.error('Error fetching furniture sub-collection for room', room.id, e);
            return [];
        }
    }

    // Legacy path: furniture data stored directly in layout
    if (room.layout && Array.isArray(room.layout.furniture)) {
        return room.layout.furniture;
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

        // Render the Konva preview after adding to DOM, passing resolved furniture
        setTimeout(() => renderRoomPreview(room, containerId, furnitureList), 50);
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
 * Isolated in its own function to guarantee each async onload callback
 * captures its own distinct imageUrl, fData, and imgObj references —
 * preventing the "first image overrides all" browser cache/closure bug.
 */
function loadFurnitureImage(imageUrl, fData, furnGroup, layer) {
    const imgObj = new Image();
    imgObj.crossOrigin = 'Anonymous';
    imgObj.onload = function () {
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

/**
 * Render a mini Konva map for a given room.
 * @param {Object}  room          - Room data from Firestore
 * @param {string}  containerId   - DOM element ID for the Konva stage
 * @param {Array}   furnitureList  - Pre-loaded furniture items (from sub-collection or legacy)
 */
function renderRoomPreview(room, containerId, furnitureList) {
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

    // Track stage for cleanup on next re-render (Issue 2 fix)
    activeStages.push(stage);

    const layer = new Konva.Layer();
    stage.add(layer);

    const padding = 20;
    const editorBaseScale = 80;
    const roomWidthPx = (room.width || 5) * editorBaseScale;
    const roomHeightPx = (room.length || 5) * editorBaseScale;

    const contentGroup = new Konva.Group();
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

    const furnGroup = new Konva.Group();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    if (furnitureList && furnitureList.length > 0) {
        furnitureList.forEach(fData => {
            minX = Math.min(minX, fData.x);
            minY = Math.min(minY, fData.y);
            maxX = Math.max(maxX, fData.x);
            maxY = Math.max(maxY, fData.y);

            // Use the item's own saved image first, fall back to catalog lookup
            const imageUrl = fData.image || furnitureImageMap[fData.furnitureId];
            if (imageUrl) {
                // Wrap in a self-contained function to guarantee each async onload
                // captures its own distinct imageUrl, fData, and imgObj references
                loadFurnitureImage(imageUrl, fData, furnGroup, layer);
            }
        });
    }

    contentGroup.add(furnGroup);

    if (minX !== Infinity) {
        const furnCenterX = (minX + maxX) / 2;
        const furnCenterY = (minY + maxY) / 2;

        roomGroup.position({
            x: furnCenterX - (roomWidthPx / 2),
            y: furnCenterY - (roomHeightPx / 2)
        });
    }

    const scaleX = (containerWidth - padding) / roomWidthPx;
    const scaleY = (containerHeight - padding) / roomHeightPx;
    const previewScale = Math.min(scaleX, scaleY);

    contentGroup.scale({ x: previewScale, y: previewScale });
    layer.add(contentGroup);

    setTimeout(() => {
        const bounds = contentGroup.getClientRect({ skipTransform: false });
        contentGroup.x((containerWidth - bounds.width) / 2 - bounds.x + contentGroup.x());
        contentGroup.y((containerHeight - bounds.height) / 2 - bounds.y + contentGroup.y());
        layer.batchDraw();
    }, 50);
}
