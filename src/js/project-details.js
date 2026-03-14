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
    deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const projectTitle = document.getElementById('projectTitle');
const projectDesc = document.getElementById('projectDesc');
const roomsList = document.getElementById('roomsList');
const newRoomBtn = document.getElementById('newRoomBtn');
const backBtn = document.getElementById('backBtn');

let currentProjectId = null;
let currentUser = null;
let unsubscribe = null;

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
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = user;
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

    unsubscribe = onSnapshot(q, (snapshot) => {
        const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('📚 Rooms loaded:', rooms.length, 'rooms in project', currentProjectId);
        renderRooms(rooms);
    }, (error) => {
        console.error('Error loading rooms:', error);
        roomsList.innerHTML = '<div class="muted">Error loading rooms. Try refreshing.</div>';
    });
}

// Render rooms as cards
function renderRooms(rooms) {
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

    rooms.forEach(room => {
        const card = document.createElement('div');
        card.className = 'room-card';

        const roomName = room.roomType ? room.roomType.replace('-', ' ').toUpperCase() : 'Room';
        const dimensions = `${room.width || '?'} x ${room.length || '?'} m`;
        const area = room.area ? `${room.area.toFixed(1)} m²` : 'N/A';
        const isDraft = room.isDraft ? ' <span style="font-size:0.75rem;opacity:0.7">(Draft)</span>' : '';
        const hasLayout = room.layout && Array.isArray(room.layout.furniture) && room.layout.furniture.length > 0;

        card.innerHTML = `
            <h3>${escapeHtml(roomName)}${isDraft}</h3>
            <div class="room-meta">
                <div><strong>Dimensions:</strong> ${dimensions}</div>
                <div><strong>Height:</strong> ${room.height || 2.8} m</div>
                <div><strong>Area:</strong> ${area}</div>
                <div><strong>Shape:</strong> ${room.shape || 'rectangular'}</div>
                ${hasLayout ? `<div style="color:#10b981;font-size:0.8rem">✅ Layout saved (${room.layout.furniture.length} items)</div>` : ''}
            </div>
            <div class="room-actions" style="display:flex;gap:0.5rem;margin-top:1rem;flex-wrap:wrap;">
                <button class="btn-outline btn-sm" onclick="window.location.href='room-setup.html?projectId=${currentProjectId}&roomId=${room.id}'">
                    <span>✏️ Edit Room</span>
                </button>
                <button class="btn-primary btn-sm" onclick="window.location.href='editor-2d.html?projectId=${currentProjectId}&roomId=${room.id}'">
                    <span>🏠 Edit Design</span>
                </button>
                <button class="btn-danger btn-sm" onclick="deleteRoom('${room.id}')">
                    <span>🗑️ Delete</span>
                </button>
            </div>
        `;
        roomsList.appendChild(card);
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
