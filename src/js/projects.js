/**
 * Projects UI and Firestore wiring
 * - lists projects for current user
 * - creates a project and navigates to room-setup.html?projectId=<id>
 */
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    doc,
    deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const projectsList = document.getElementById('projectsList');
const createProjectBtn = document.getElementById('createProjectBtn');
const projectModal = document.getElementById('projectModal');
const projectForm = document.getElementById('projectForm');
const cancelCreate = document.getElementById('cancelCreate');

let unsubscribe = null;
let currentUser = null;

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = user;
    startProjectListener();
});

function startProjectListener() {
    if (unsubscribe) unsubscribe();
    const q = query(collection(db, 'projects'), where('ownerUid', '==', currentUser.uid), orderBy('createdAt', 'desc'));
    unsubscribe = onSnapshot(q, snapshot => {
        renderProjects(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
}

function renderProjects(projects) {
    projectsList.innerHTML = '';
    if (!projects.length) {
        projectsList.innerHTML = '<div class="muted">No projects yet. Create one to get started.</div>';
        return;
    }
    projects.forEach(p => {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = `
            <div>
                <h3>${escapeHtml(p.title || 'Untitled Project')}</h3>
                <p>${escapeHtml(p.description || '')}</p>
            </div>
            <div class="card-actions">
                <button class="primary-btn open-btn" data-id="${p.id}">Open</button>
                <button class="secondary-btn delete-btn" data-id="${p.id}">Delete</button>
            </div>
        `;
        projectsList.appendChild(card);
    });

    // wire actions
    projectsList.querySelectorAll('.open-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            console.log('📂 Opening project:', id);
            // navigate to project details page to manage rooms
            window.location.href = `project-details.html?projectId=${id}`;
        });
    });

    projectsList.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            if (!confirm('Delete this project and its rooms? This cannot be undone.')) return;
            try {
                await deleteDoc(doc(db, 'projects', id));
            } catch (err) {
                console.error('Failed to delete project', err);
                alert('Failed to delete project');
            }
        });
    });
}

createProjectBtn.addEventListener('click', () => {
    projectModal.hidden = false;
    document.getElementById('projectTitle').focus();
});

cancelCreate.addEventListener('click', () => {
    projectModal.hidden = true;
    projectForm.reset();
});

projectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('projectTitle').value.trim();
    const description = document.getElementById('projectDesc').value.trim();
    if (!title) return alert('Please enter a project title');
    try {
        const ref = await addDoc(collection(db, 'projects'), {
            title,
            description,
            ownerUid: currentUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        projectForm.reset();
        projectModal.hidden = true;
        // open the new project
        window.location.href = `room-setup.html?projectId=${ref.id}`;
    } catch (err) {
        console.error('Error creating project', err);
        alert('Error creating project. Try again.');
    }
});

function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;" })[c]);
}
