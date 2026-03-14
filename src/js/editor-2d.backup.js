/**
 * RoomVision 2D Editor - Professional Floor Plan Style
 * Real furniture images with proper sizing and themed UI
 */

import { showError, showSuccess, showWarning, showLoading, hideLoading } from './ui-feedback.js';
import { auth, db } from './firebase-config.js';
import { collection, addDoc, doc, updateDoc, getDoc, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { ref, uploadString, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// Initialize Firebase Storage
const storage = getStorage();

// ============================================
// ROOM EDITOR CLASS
// ============================================

class RoomEditor {
    constructor() {
        this.roomData = null;
        this.stage = null;
        this.layer = null;
        this.roomGroup = null;
        this.furnitureLayer = null;
        this.transformer = null;
        this.selectedNode = null;
        this.currentView = 'top';
        this.currentZoom = 1;

        // Project context — populated from URL query params
        this.projectId = null;
        this.roomId = null;

        // Scale: pixels per meter
        this.baseScale = 80;
        this.scale = this.baseScale;

        this.init();
    }

    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        this.projectId = urlParams.get('projectId');
        this.roomId = urlParams.get('roomId');

        // ── Recover project context when URL params are absent ─────────────
        // This happens when the furniture shop redirects back to editor-2d.html
        // without query params. The IDs were stored in currentRoomData by the
        // previous loadLayoutFromFirestore call, so we read them back.
        if (!this.projectId || !this.roomId) {
            try {
                const saved = JSON.parse(sessionStorage.getItem('currentRoomData') || '{}');
                if (saved.projectId && saved.roomId) {
                    this.projectId = saved.projectId;
                    this.roomId    = saved.roomId;
                }
            } catch (e) { /* ignore */ }
        }

        if (this.projectId && this.roomId) {
            // Primary path: load everything from Firestore
            await this.loadLayoutFromFirestore(this.projectId, this.roomId);
        } else {
            // Fallback: legacy sessionStorage path (room-setup redirect without URL params)
            this.loadRoomData();
        }

        if (!this.roomData) {
            return;
        }

        this.setupCanvas();
        this.drawRoom();

        // ── Furniture restore: priority order ──────────────────────────────
        // 1. sessionStorage current3DLayout  (freshest — returning from 3D view,
        //    images already embedded, EXACT positions preserved)
        // 2. Firestore layout in room doc    (project flow, needs Firestore fetch)
        // 3. furnitureCart                   (first-time placement, legacy flow)
        // ───────────────────────────────────────────────────────────────────
        const sessionFurniture = this._getSessionLayoutFurniture();
        if (sessionFurniture.length > 0) {
            // Restore directly from session — no Firestore lookup needed.
            await this.renderFurnitureFromSessionLayout(sessionFurniture);
        } else if (this.projectId && this.roomId && this.savedFurniture && this.savedFurniture.length > 0) {
            // Session was empty (first visit or cleared), use persisted Firestore layout.
            await this.renderSavedFurniture();
        } else if (!this.projectId) {
            // Brand-new legacy session — place items from cart at default positions.
            await this.loadFurnitureFromCart();
        }
        // else: project context but no layout yet — empty canvas is correct.

        // ── Append new furniture from shop (project flow) ──────────────────
        // If the user just returned from the furniture shop with new selections,
        // append those items on top of the already-rendered base layout instead
        // of overwriting it.
        if (this.projectId && sessionStorage.getItem('furnitureCart')) {
            await this.loadFurnitureFromCart();
        }

        this.setupViewButtons();
        this.setupZoomControls();
        this.setupSaveButton();
        this.setupDownloadButton();
        this.setupDeleteButton();
        this.setupCanvasPanning();
        this.displayRoomInfo();
        this.setupColorPanel();

        setTimeout(() => {
            const instructions = document.getElementById('instructions');
            if (instructions) {
                instructions.classList.add('hidden');
            }
        }, 5000);
    }

    /**
     * Returns the furniture array from sessionStorage current3DLayout,
     * but ONLY if it belongs to the same room as the current session.
     * Items without image data are filtered out (can't render without image).
     * Returns [] when there is nothing usable.
     */
    _getSessionLayoutFurniture() {
        try {
            const raw = sessionStorage.getItem('current3DLayout');
            if (!raw) return [];
            const layout = JSON.parse(raw);
            if (!layout.furniture || layout.furniture.length === 0) return [];

            // Guard: don't restore a layout from a DIFFERENT room
            if (this.projectId && this.roomId) {
                // Project flow: projectId + roomId must match
                if (layout.projectId !== this.projectId || layout.roomId !== this.roomId) {
                    console.log('ℹ️ Session layout belongs to a different room — skipping.');
                    return [];
                }
            } else if (layout.roomData && this.roomData) {
                // Legacy flow: room dimensions must match
                if (layout.roomData.width !== this.roomData.width ||
                    layout.roomData.length !== this.roomData.length) {
                    console.log('ℹ️ Session layout room dimensions differ — skipping.');
                    return [];
                }
            }

            // Only items with embedded image data can be restored directly
            return layout.furniture.filter(
                f => f.image && f.x !== undefined && f.y !== undefined
            );
        } catch (e) {
            console.warn('Could not read session layout:', e);
            return [];
        }
    }


    loadRoomData() {
        const roomDataStr = sessionStorage.getItem('currentRoomData');
        if (!roomDataStr) {
            showWarning('No room data found. Redirecting to room setup...');
            setTimeout(() => {
                window.location.href = 'room-setup.html';
            }, 2000);
            return;
        }
        try {
            this.roomData = JSON.parse(roomDataStr);
            console.log('✅ Loaded room data:', this.roomData);
        } catch (e) {
            console.error('Error parsing room data:', e);
            showWarning('Invalid room data. Please complete room setup again.');
            setTimeout(() => {
                window.location.href = 'room-setup.html';
            }, 2000);
        }
    }

    setupCanvas() {
        const canvasContainer = document.getElementById('canvas-container');
        if (!canvasContainer) {
            console.error('Canvas container not found');
            return;
        }

        const maxWidth = window.innerWidth - 100;
        const maxHeight = window.innerHeight - 60 - 100;
        const roomWidthPx = this.roomData.width * this.scale;
        const roomLengthPx = this.roomData.length * this.scale;
        const padding = 150;
        const canvasWidth = Math.min(roomWidthPx + padding * 2, maxWidth);
        const canvasHeight = Math.min(roomLengthPx + padding * 2, maxHeight);

        this.stage = new Konva.Stage({
            container: 'canvas-container',
            width: canvasWidth,
            height: canvasHeight,
            draggable: false
        });

        this.layer = new Konva.Layer();
        this.furnitureLayer = new Konva.Layer();
        this.stage.add(this.layer);
        this.stage.add(this.furnitureLayer);

        this.transformer = new Konva.Transformer({
            rotateEnabled: true,
            enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
            borderStroke: '#2563eb',
            borderStrokeWidth: 2,
            anchorStroke: '#2563eb',
            anchorFill: '#fff',
            anchorSize: 10,
            boundBoxFunc: (oldBox, newBox) => {
                if (newBox.width < 20 || newBox.height < 20) {
                    return oldBox;
                }
                return newBox;
            }
        });
        this.furnitureLayer.add(this.transformer);

        this.stage.on('click tap', (e) => {
            if (e.target === this.stage || e.target.getLayer() === this.layer) {
                this.deselectFurniture();
            }
        });
    }

    drawRoom() {
        const roomWidthPx = this.roomData.width * this.scale;
        const roomLengthPx = this.roomData.length * this.scale;
        const roomX = (this.stage.width() - roomWidthPx) / 2;
        const roomY = (this.stage.height() - roomLengthPx) / 2;

        this.roomGroup = new Konva.Group({
            x: roomX,
            y: roomY
        });

        // Use actual floor and wall colors from room data
        const floorColor = this.roomData.floorColor || '#F5DEB3';
        const wallColor = this.roomData.wallColor || '#FFFFFF';

        // Floor
        const floor = new Konva.Rect({
            x: 0,
            y: 0,
            width: roomWidthPx,
            height: roomLengthPx,
            fill: floorColor,
            stroke: wallColor,
            strokeWidth: 3
        });
        this.roomGroup.add(floor);

        // Walls with user's selected color
        const wallThickness = 15;

        // Top wall
        const topWall = new Konva.Rect({
            x: -wallThickness / 2,
            y: -wallThickness / 2,
            width: roomWidthPx + wallThickness,
            height: wallThickness,
            fill: wallColor,
            stroke: '#000',
            strokeWidth: 1
        });
        this.roomGroup.add(topWall);

        // Bottom wall
        const bottomWall = new Konva.Rect({
            x: -wallThickness / 2,
            y: roomLengthPx - wallThickness / 2,
            width: roomWidthPx + wallThickness,
            height: wallThickness,
            fill: wallColor,
            stroke: '#000',
            strokeWidth: 1
        });
        this.roomGroup.add(bottomWall);

        // Left wall
        const leftWall = new Konva.Rect({
            x: -wallThickness / 2,
            y: -wallThickness / 2,
            width: wallThickness,
            height: roomLengthPx + wallThickness,
            fill: wallColor,
            stroke: '#000',
            strokeWidth: 1
        });
        this.roomGroup.add(leftWall);

        // Right wall
        const rightWall = new Konva.Rect({
            x: roomWidthPx - wallThickness / 2,
            y: -wallThickness / 2,
            width: wallThickness,
            height: roomLengthPx + wallThickness,
            fill: wallColor,
            stroke: '#000',
            strokeWidth: 1
        });
        this.roomGroup.add(rightWall);

        // Subtle grid
        this.drawGrid(roomWidthPx, roomLengthPx);

        // Dimension labels
        this.addDimensionLabels(roomWidthPx, roomLengthPx);

        this.layer.add(this.roomGroup);
        this.layer.batchDraw();
    }

    drawGrid(width, height) {
        const gridSize = this.scale;
        const gridColor = '#00000008';
        const gridLineWidth = 0.5;

        for (let x = gridSize; x < width; x += gridSize) {
            const line = new Konva.Line({
                points: [x, 0, x, height],
                stroke: gridColor,
                strokeWidth: gridLineWidth,
                dash: [5, 5]
            });
            this.roomGroup.add(line);
        }

        for (let y = gridSize; y < height; y += gridSize) {
            const line = new Konva.Line({
                points: [0, y, width, y],
                stroke: gridColor,
                strokeWidth: gridLineWidth,
                dash: [5, 5]
            });
            this.roomGroup.add(line);
        }
    }

    addDimensionLabels(width, height) {
        const fontSize = 13;
        const offset = 30;

        const topDimText = new Konva.Text({
            x: width / 2 - 35,
            y: -offset,
            text: `${this.roomData.width}m`,
            fontSize: fontSize,
            fontFamily: 'Arial',
            fill: '#2563eb',
            fontStyle: 'bold'
        });
        this.roomGroup.add(topDimText);

        const leftDimText = new Konva.Text({
            x: -offset - 25,
            y: height / 2 - 10,
            text: `${this.roomData.length}m`,
            fontSize: fontSize,
            fontFamily: 'Arial',
            fill: '#2563eb',
            fontStyle: 'bold',
            rotation: -90
        });
        this.roomGroup.add(leftDimText);
    }

    setupFurnitureInteractions(group, furniture) {
        group.on('dragmove', () => {
            this.constrainToRoom(group);
        });

        group.on('dragend', () => {
            this.constrainToRoom(group);
        });

        group.on('click tap', (e) => {
            e.cancelBubble = true;
            this.selectFurniture(group);
        });

        group.on('mouseenter', () => {
            document.body.style.cursor = 'move';
        });

        group.on('mouseleave', () => {
            document.body.style.cursor = 'default';
        });
    }

    constrainToRoom(group) {
        const roomPos = this.roomGroup.position();
        const roomWidth = this.roomData.width * this.scale;
        const roomLength = this.roomData.length * this.scale;
        const box = group.getClientRect();

        let newX = group.x();
        let newY = group.y();

        if (box.x < roomPos.x) {
            newX = group.x() + (roomPos.x - box.x);
        }

        if (box.x + box.width > roomPos.x + roomWidth) {
            newX = group.x() - (box.x + box.width - (roomPos.x + roomWidth));
        }

        if (box.y < roomPos.y) {
            newY = group.y() + (roomPos.y - box.y);
        }

        if (box.y + box.height > roomPos.y + roomLength) {
            newY = group.y() - (box.y + box.height - (roomPos.y + roomLength));
        }

        group.position({ x: newX, y: newY });
    }

    selectFurniture(node) {
        this.selectedNode = node;
        this.transformer.nodes([node]);
        this.furnitureLayer.batchDraw();

        const deleteBtn = document.getElementById('deleteBtn');
        if (deleteBtn) {
            deleteBtn.classList.add('visible');
        }
    }

    deselectFurniture() {
        this.selectedNode = null;
        this.transformer.nodes([]);
        this.furnitureLayer.batchDraw();

        const deleteBtn = document.getElementById('deleteBtn');
        if (deleteBtn) {
            deleteBtn.classList.remove('visible');
        }
    }

    setupZoomControls() {
        const zoomSlider = document.getElementById('zoomSlider');
        const zoomValue = document.getElementById('zoomValue');
        const zoomIn = document.getElementById('zoomIn');
        const zoomOut = document.getElementById('zoomOut');

        const updateZoom = (value) => {
            const zoom = value / 100;
            this.currentZoom = zoom;
            this.stage.scale({ x: zoom, y: zoom });
            this.stage.batchDraw();
            zoomValue.textContent = `${value}%`;
            zoomSlider.value = value;
        };

        zoomSlider.addEventListener('input', (e) => {
            updateZoom(parseInt(e.target.value));
        });

        zoomIn.addEventListener('click', () => {
            const newValue = Math.min(200, parseInt(zoomSlider.value) + 10);
            updateZoom(newValue);
        });

        zoomOut.addEventListener('click', () => {
            const newValue = Math.max(50, parseInt(zoomSlider.value) - 10);
            updateZoom(newValue);
        });

        this.stage.on('wheel', (e) => {
            e.evt.preventDefault();
            const oldScale = this.stage.scaleX();
            const pointer = this.stage.getPointerPosition();
            const mousePointTo = {
                x: (pointer.x - this.stage.x()) / oldScale,
                y: (pointer.y - this.stage.y()) / oldScale,
            };
            const direction = e.evt.deltaY > 0 ? -1 : 1;
            const newScale = direction > 0 ? oldScale * 1.1 : oldScale / 1.1;
            const clampedScale = Math.max(0.5, Math.min(2, newScale));
            this.stage.scale({ x: clampedScale, y: clampedScale });
            const newPos = {
                x: pointer.x - mousePointTo.x * clampedScale,
                y: pointer.y - mousePointTo.y * clampedScale,
            };
            this.stage.position(newPos);
            this.stage.batchDraw();
            this.currentZoom = clampedScale;
            zoomSlider.value = Math.round(clampedScale * 100);
            zoomValue.textContent = `${Math.round(clampedScale * 100)}%`;
        });
    }

    setupCanvasPanning() {
        const container = document.getElementById('canvas-container');
        let spacePressed = false;

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !spacePressed) {
                e.preventDefault();
                spacePressed = true;
                container.style.cursor = 'grab';
                this.stage.draggable(true);
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                spacePressed = false;
                container.style.cursor = 'default';
                this.stage.draggable(false);
            }
        });

        this.stage.on('dragstart', () => {
            if (spacePressed) {
                container.classList.add('grabbing');
            }
        });

        this.stage.on('dragend', () => {
            container.classList.remove('grabbing');
        });
    }

    setupViewButtons() {
        const viewButtons = document.querySelectorAll('.view-btn');
        viewButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                viewButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const view = btn.dataset.view;
                this.currentView = view;
            });
        });

        const view3dBtn = document.getElementById('view3dBtn');
        if (view3dBtn) {
            view3dBtn.addEventListener('click', () => this.transitionTo3D());
        }
    }

    async transitionTo3D() {
        // Auto-save to Firestore before switching so 3D view always reflects latest state
        if (this.projectId && this.roomId) {
            await this.saveLayout();
        }

        // Build furniture snapshot for the 3D page (fast sessionStorage handoff)
        const furnitureData = this.collectFurnitureData();

        // Include project context so the 3D page can pass it back on "Back to 2D"
        sessionStorage.setItem('current3DLayout', JSON.stringify({
            roomData: this.roomData,
            furniture: furnitureData,
            canvasRoomOriginX: this.roomGroup ? this.roomGroup.x() : 0,
            canvasRoomOriginY: this.roomGroup ? this.roomGroup.y() : 0,
            projectId: this.projectId,
            roomId: this.roomId
        }));

        const overlay = document.getElementById('transitionOverlay');
        if (overlay) {
            overlay.classList.add('active');
            setTimeout(() => { window.location.href = 'view-3d.html'; }, 1500);
        } else {
            window.location.href = 'view-3d.html';
        }
    }

    setupSaveButton() {
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveLayout());
        }
    }

    setupDownloadButton() {
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                // Show download options
                const options = confirm('Download as IMAGE (OK) or JSON data (Cancel)?');
                if (options) {
                    this.downloadDesign(); // Download PNG
                } else {
                    this.downloadDesignJSON(); // Download JSON
                }
            });
        }
    }


    setupDeleteButton() {
        const deleteBtn = document.getElementById('deleteBtn');
        deleteBtn.addEventListener('click', () => {
            if (this.selectedNode) {
                this.selectedNode.destroy();
                this.deselectFurniture();
                this.furnitureLayer.batchDraw();
                showSuccess('Furniture deleted', 1500);
            }
        });

        document.addEventListener('keydown', (e) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedNode) {
                e.preventDefault();
                this.selectedNode.destroy();
                this.deselectFurniture();
                this.furnitureLayer.batchDraw();
                showSuccess('Furniture deleted', 1500);
            }
        });
    }

    // Add this method to RoomEditor class
    downloadDesign() {
        try {
            // Generate high-quality image
            const dataURL = this.stage.toDataURL({
                pixelRatio: 2,
                mimeType: 'image/png'
            });

            // Create download link
            const link = document.createElement('a');
            const designName = `${this.roomData.roomType || 'room'}_design_${Date.now()}.png`;
            link.download = designName;
            link.href = dataURL;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showSuccess('Design downloaded successfully!', 2000);
        } catch (error) {
            console.error('Download error:', error);
            showError('Failed to download design');
        }
    }

    // Add this method to save as JSON
    downloadDesignJSON() {
        try {
            const furnitureData = [];
            this.furnitureLayer.getChildren().forEach(node => {
                if (node === this.transformer) return;
                const furnitureNode = node.findOne('.furniture');
                if (!furnitureNode) return;

                furnitureData.push({
                    id: furnitureNode.getAttr('furnitureId'),
                    name: furnitureNode.getAttr('furnitureName'),
                    image: furnitureNode.getAttr('furnitureImage'),
                    x: node.x(),
                    y: node.y(),
                    rotation: node.rotation(),
                    scaleX: node.scaleX(),
                    scaleY: node.scaleY()
                });
            });

            const designData = {
                roomData: this.roomData,
                furniture: furnitureData,
                view: this.currentView,
                zoom: this.currentZoom,
                exportedAt: new Date().toISOString()
            };

            const dataStr = JSON.stringify(designData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);

            const link = document.createElement('a');
            link.download = `${this.roomData.roomType || 'room'}_design_${Date.now()}.json`;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showSuccess('Design data downloaded as JSON!', 2000);
        } catch (error) {
            console.error('Download error:', error);
            showError('Failed to download design data');
        }
    }



    /**
     * Collects current furniture state from the Konva layer.
     * Returns an array with complete metadata and room-relative coordinates.
     */
    collectFurnitureData() {
        const furnitureData = [];
        const roomOriginX = this.roomGroup ? this.roomGroup.x() : 0;
        const roomOriginY = this.roomGroup ? this.roomGroup.y() : 0;

        this.furnitureLayer.getChildren().forEach(node => {
            if (node === this.transformer) return;
            const furnitureNode = node.findOne('.furniture');
            if (!furnitureNode) return;

            furnitureData.push({
                furnitureId: furnitureNode.getAttr('furnitureId'),
                image: furnitureNode.getAttr('furnitureImage'),
                name: furnitureNode.getAttr('furnitureName'),
                originalWidth: furnitureNode.getAttr('originalWidth'),
                originalHeight: furnitureNode.getAttr('originalHeight'),
                displayWidth: furnitureNode.width(),
                displayHeight: furnitureNode.height(),
                // Save coordinates relative to the room walls so resizing browser doesn't break positions
                x: node.x() - roomOriginX,
                y: node.y() - roomOriginY,
                rotation: node.rotation(),
                scaleX: parseFloat(node.scaleX().toFixed(4)),
                scaleY: parseFloat(node.scaleY().toFixed(4)),
                isPurchased: furnitureNode.getAttr('isPurchased') === true
            });
        });
        return furnitureData;
    }

    async saveLayout() {
        try {
            showLoading('Saving design...');

            const user = auth.currentUser;
            if (!user) {
                hideLoading();
                showError('You must be logged in to save designs');
                return;
            }

            const furnitureData = this.collectFurnitureData();

            // Upload images to Firebase Storage and replace base64 data with URLs
            for (const item of furnitureData) {
                if (item.image && item.image.startsWith('data:image')) {
                    const storageRef = ref(storage, `furniture-images/${item.id}.png`);
                    const snapshot = await uploadString(storageRef, item.image, 'data_url');
                    item.image = await getDownloadURL(snapshot.ref);
                }
            }

            if (this.projectId && this.roomId) {
                // ── NEW PATH: save layout into the project room document ──
                const roomRef = doc(db, `projects/${this.projectId}/rooms/${this.roomId}`);

                // Save furniture data in a separate collection
                const furnitureCollectionRef = collection(db, `projects/${this.projectId}/rooms/${this.roomId}/furniture`);
                const furnitureRefs = [];
                for (const item of furnitureData) {
                    const furnitureDocRef = await addDoc(furnitureCollectionRef, item);
                    furnitureRefs.push(furnitureDocRef.id);
                }

                await updateDoc(roomRef, {
                    layout: {
                        furnitureRefs, // Save references to furniture documents
                        canvasRoomOriginX: this.roomGroup ? this.roomGroup.x() : 0,
                        canvasRoomOriginY: this.roomGroup ? this.roomGroup.y() : 0,
                        updatedAt: new Date().toISOString()
                    },
                    // Persist any colour changes made in the editor too
                    wallColor: this.roomData.wallColor || '#FFFFFF',
                    floorColor: this.roomData.floorColor || '#F5DEB3',
                    updatedAt: serverTimestamp()
                });
                console.log('✅ Layout saved to project room:', this.roomId);

                sessionStorage.removeItem('furnitureCart');
                hideLoading();
                showSuccess('Layout saved!', 2000);

            } else {
                // ── LEGACY FALLBACK: save to the standalone designs collection ──
                const designData = {
                    userId: user.uid,
                    userEmail: user.email,
                    designName: `${this.roomData.roomType || 'Room'} Design`,
                    room: {
                        width: this.roomData.width,
                        length: this.roomData.length,
                        height: this.roomData.height,
                        floorColor: this.roomData.floorColor || '#F5DEB3',
                        wallColor: this.roomData.wallColor || '#FFFFFF',
                        type: this.roomData.roomType || 'living-room'
                    },
                    furniture: furnitureData,
                    furnitureCount: furnitureData.length,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                if (JSON.stringify(designData).length > 950000) {
                    hideLoading();
                    showError('Design has too many furniture items.');
                    return;
                }

                const urlParams = new URLSearchParams(window.location.search);
                const existingId = urlParams.get('designId');
                let docId = '';

                if (existingId) {
                    await updateDoc(doc(db, 'designs', existingId), {
                        room: designData.room,
                        furniture: designData.furniture,
                        furnitureCount: designData.furnitureCount,
                        updatedAt: designData.updatedAt
                    });
                    docId = existingId;
                } else {
                    const docRef = await addDoc(collection(db, 'designs'), designData);
                    docId = docRef.id;
                }

                sessionStorage.setItem('lastSavedDesignId', docId);
                sessionStorage.removeItem('furnitureCart');
                hideLoading();
                showSuccess('Design saved!', 2000);
            }

        } catch (error) {
            console.error('❌ Error saving design:', error);
            hideLoading();
            if (error.code === 'resource-exhausted' || error.message?.includes('exceeds the maximum')) {
                showError('Design is too large. Please reduce the number of furniture items.');
            } else {
                showError('Failed to save design: ' + error.message);
            }
        }
    }

    /**
     * PRIMARY LOAD PATH (Phase 2)
     * Loads room config + furniture layout from projects/{projectId}/rooms/{roomId}.
     * Sets this.roomData and this.savedFurniture so the rest of init() can proceed.
     */
    async loadLayoutFromFirestore(projectId, roomId) {
        try {
            showLoading('Loading room layout...');
            const roomRef = doc(db, `projects/${projectId}/rooms/${roomId}`);
            const roomSnap = await getDoc(roomRef);

            if (!roomSnap.exists()) {
                showError('Room not found. Redirecting to projects...');
                setTimeout(() => window.location.href = 'projects.html', 2000);
                return;
            }

            const data = roomSnap.data();

            // Populate roomData from the room document fields
            this.roomData = {
                width: data.width,
                length: data.length,
                height: data.height || 2.8,
                wallColor: data.wallColor || '#FFFFFF',
                floorColor: data.floorColor || '#F5DEB3',
                roomType: data.roomType || 'living-room',
                area: data.area || (data.width * data.length),
                projectId,
                roomId
            };

            // Restore saved furniture layout (if any)
            if (data.layout && data.layout.furnitureRefs && Array.isArray(data.layout.furnitureRefs)) {
                // New structure: load furniture from separate collection using references
                this.savedFurniture = [];
                const furnitureCollectionRef = collection(db, `projects/${projectId}/rooms/${roomId}/furniture`);
                const furnitureSnapshot = await getDocs(furnitureCollectionRef);
                
                if (!furnitureSnapshot.empty) {
                    furnitureSnapshot.forEach((doc) => {
                        this.savedFurniture.push({
                            ...doc.data(),
                            firestoreId: doc.id
                        });
                    });
                }
                console.log('✅ Loaded', this.savedFurniture.length, 'furniture items from separate collection');
            } else if (data.layout && Array.isArray(data.layout.furniture)) {
                // Legacy structure: furniture data stored directly in layout
                this.savedFurniture = data.layout.furniture;
                console.log('✅ Loaded', this.savedFurniture.length, 'furniture items from legacy layout');
            } else {
                this.savedFurniture = [];
            }

            // Sync to sessionStorage so the 3D view (if navigated directly) can read it
            sessionStorage.setItem('currentRoomData', JSON.stringify(this.roomData));
            console.log('✅ Loaded room from Firestore:', this.roomData);

        } catch (error) {
            console.error('Error loading room layout:', error);
            showError('Failed to load room: ' + error.message);
        } finally {
            hideLoading();
        }
    }

    async loadDesignFromFirestore(designId) {
        try {
            showLoading("Loading your design...");
            const docRef = doc(db, 'designs', designId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                this.roomData = data.room;
                this.savedFurniture = data.furniture || [];
                // Update session storage so other tools like 3D view work
                sessionStorage.setItem('currentRoomData', JSON.stringify(this.roomData));
            } else {
                showError("Design not found.");
                setTimeout(() => window.location.href = 'projects.html', 2000);
            }
        } catch (error) {
            console.error("Error loading design:", error);
            showError("Failed to load design.");
        } finally {
            hideLoading();
        }
    }

    async renderSavedFurniture() {
        showLoading('Loading furniture models...');
        try {
            // Fetch all furniture to translate IDs to Images
            const furnitureSnap = await getDocs(collection(db, 'furniture'));
            const furnitureMap = {};
            furnitureSnap.forEach(doc => {
                furnitureMap[doc.id] = { id: doc.id, ...doc.data() };
            });

            for (const fData of this.savedFurniture) {
                // If the user already saved an image string, use it. Otherwise, look up via catalog.
                const itemCatalog = furnitureMap[fData.furnitureId];
                const item = {
                    id: fData.furnitureId,
                    name: fData.name || (itemCatalog ? itemCatalog.name : 'Furniture'),
                    image: fData.image || (itemCatalog ? itemCatalog.image : null)
                };

                if (item.image) {
                    // Convert relative coordinates back to absolute stage coordinates
                    const roomOriginX = this.roomGroup ? this.roomGroup.x() : 0;
                    const roomOriginY = this.roomGroup ? this.roomGroup.y() : 0;
                    const absoluteNodeData = {
                        ...fData,
                        x: fData.x + roomOriginX,
                        y: fData.y + roomOriginY
                    };
                    await this.addFurnitureWithTransforms(item, absoluteNodeData);
                } else {
                    console.warn('Furniture image not found, skipping:', fData.furnitureId);
                }
            }
            // Force a repaint so every item is visible immediately on first load.
            this.furnitureLayer.batchDraw();
            showSuccess(`Loaded ${this.savedFurniture.length} furniture items!`, 2000);
        } catch (error) {
            console.error('Error rendering saved furniture:', error);
            showWarning('Some furniture could not be loaded from catalog.');
        } finally {
            hideLoading();
        }
    }

    /**
     * Restores furniture directly from an array whose items already contain
     * image data (base64 or URL). Used when returning from the 3D view via
     * sessionStorage. No Firestore lookup required.
     */
    async renderFurnitureFromSessionLayout(furnitureItems) {
        showLoading('Restoring layout...');
        try {
            let restored = 0;
            for (const f of furnitureItems) {
                // Build a catalog-like item object from what’s in the session data
                const item = {
                    id: f.furnitureId,
                    image: f.image,
                    name: f.name || 'Furniture'
                };

                // Convert relative coordinates back to absolute stage coordinates
                const roomOriginX = this.roomGroup ? this.roomGroup.x() : 0;
                const roomOriginY = this.roomGroup ? this.roomGroup.y() : 0;
                const absoluteNodeData = {
                    ...f,
                    x: f.x + roomOriginX,
                    y: f.y + roomOriginY
                };

                await this.addFurnitureWithTransforms(item, absoluteNodeData);
                restored++;
            }
            // Force a repaint so every item is visible immediately on first load.
            this.furnitureLayer.batchDraw();
            if (restored > 0) {
                showSuccess(`Restored ${restored} item${restored > 1 ? 's' : ''} from last session!`, 2000);
            }
        } catch (error) {
            console.error('Error restoring session layout:', error);
        } finally {
            hideLoading();
        }
    }

    async addFurnitureWithTransforms(item, nodeData) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onerror = () => {
                // Resolve (not reject) so one broken image doesn't hang the
                // entire restore loop for subsequent furniture items.
                console.warn('Failed to load furniture image, skipping:', item.name);
                resolve();
            };
            img.onload = () => {
                const maxDisplaySize = 120;
                const aspectRatio = img.width / img.height;
                let displayWidth, displayHeight;
                if (img.width > img.height) {
                    displayWidth = Math.min(img.width, maxDisplaySize);
                    displayHeight = displayWidth / aspectRatio;
                } else {
                    displayHeight = Math.min(img.height, maxDisplaySize);
                    displayWidth = displayHeight * aspectRatio;
                }

                const furnitureImage = new Konva.Image({
                    x: 0, y: 0,
                    image: img,
                    width: displayWidth, height: displayHeight,
                    shadowColor: 'rgba(0, 0, 0, 0.3)',
                    shadowBlur: 12, shadowOpacity: 0.6, shadowOffset: { x: 4, y: 4 },
                    name: 'furniture'
                });

                furnitureImage.setAttr('furnitureId', item.id);
                furnitureImage.setAttr('furnitureImage', item.image);
                furnitureImage.setAttr('furnitureName', item.name);
                furnitureImage.setAttr('originalWidth', img.width);
                furnitureImage.setAttr('originalHeight', img.height);
                furnitureImage.setAttr('isPurchased', nodeData.isPurchased === true);

                const labelText = nodeData.isPurchased ? `✅ ${item.name}` : item.name;
                const labelColor = nodeData.isPurchased ? '#10b981' : '#1e293b';

                const label = new Konva.Text({
                    x: 0, y: displayHeight + 8, width: displayWidth,
                    text: labelText, fontSize: 13, fontFamily: 'Inter, Arial',
                    fill: labelColor, align: 'center', fontStyle: 'bold'
                });

                const group = new Konva.Group({
                    // If nodeData has isFromCart flag, center it. Otherwise, use exact coordinates.
                    x: nodeData.isFromCart ? nodeData.x - displayWidth / 2 : nodeData.x,
                    y: nodeData.isFromCart ? nodeData.y - displayHeight / 2 : nodeData.y,
                    rotation: nodeData.rotation || 0,
                    scaleX: nodeData.scaleX || 1,
                    scaleY: nodeData.scaleY || 1,
                    draggable: true
                });

                group.add(furnitureImage);
                group.add(label);

                // Add double-click to purchase event handler
                group.on('dblclick dbltap', () => {
                    const currentlyPurchased = furnitureImage.getAttr('isPurchased');
                    const newPurchasedState = !currentlyPurchased;
                    furnitureImage.setAttr('isPurchased', newPurchasedState);

                    label.text(newPurchasedState ? `✅ ${item.name}` : item.name);
                    label.fill(newPurchasedState ? '#10b981' : '#1e293b');
                    this.furnitureLayer.batchDraw();
                    showSuccess(newPurchasedState ? 'Marked as purchased!' : 'Removed from cart.', 1000);
                });

                this.setupFurnitureInteractions(group, furnitureImage);

                this.furnitureLayer.add(group);
                this.furnitureLayer.batchDraw();

                resolve();
            }
            img.src = item.image;
        });
    }


    displayRoomInfo() {
        const roomDimEl = document.getElementById('roomDimensions');
        const roomTypeEl = document.getElementById('roomType');
        const roomAreaEl = document.getElementById('roomArea');

        if (roomDimEl) {
            roomDimEl.textContent =
                `${this.roomData.width}m × ${this.roomData.length}m × ${this.roomData.height}m`;
        }

        if (roomTypeEl) {
            const roomType = this.roomData.roomType || 'N/A';
            roomTypeEl.textContent = `Type: ${roomType.replace('-', ' ')}`;
        }

        if (roomAreaEl) {
            roomAreaEl.textContent =
                `Area: ${this.roomData.area || (this.roomData.width * this.roomData.length).toFixed(2)} m²`;
        }
    }

    // ── Phase 3: Wall / Floor color pickers ──────────────────────────────
    setupColorPanel() {
        const wallPicker = document.getElementById('wallColorPicker2D');
        const floorPicker = document.getElementById('floorColorPicker2D');
        if (!wallPicker || !floorPicker) return;

        // Pre-fill from current room data
        wallPicker.value = this.roomData.wallColor || '#FFFFFF';
        floorPicker.value = this.roomData.floorColor || '#F5DEB3';

        let debounceTimer;
        const onChange = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                this.applyColors(wallPicker.value, floorPicker.value);
            }, 150); // debounce rapid dragging of the color wheel
        };

        wallPicker.addEventListener('input', onChange);
        floorPicker.addEventListener('input', onChange);
    }

    applyColors(wallColor, floorColor) {
        // Update in-memory room data
        this.roomData.wallColor = wallColor;
        this.roomData.floorColor = floorColor;

        // Redraw only the background room layer (not the furniture layer)
        this.layer.destroyChildren();
        this.roomGroup = null;
        this.drawRoom();

        // Sync to sessionStorage so a quick 3D preview sees the latest colors
        sessionStorage.setItem('currentRoomData', JSON.stringify(this.roomData));

        // Persist to Firestore if inside a project context
        if (this.projectId && this.roomId) {
            // A lightweight direct update avoids re-collecting furniture data:
            import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js')
                .then(({ doc, updateDoc, serverTimestamp }) => {
                    const roomRef = doc(db, `projects/${this.projectId}/rooms/${this.roomId}`);
                    updateDoc(roomRef, { wallColor, floorColor, updatedAt: serverTimestamp() })
                        .catch(e => console.warn('Color auto-save failed:', e));
                });
        }
    }
    // ─────────────────────────────────────────────────────────────────────


    // Load furniture from cart
    async loadFurnitureFromCart() {
        console.log('🔍 Checking for cart items...');
        const cartStr = sessionStorage.getItem('furnitureCart');
        console.log('📦 Raw cart data:', cartStr);

        if (!cartStr) {
            console.log('❌ No cart items found');
            return;
        }

        try {
            const cart = JSON.parse(cartStr);
            console.log('✅ Parsed cart:', cart);

            if (cart.length === 0) {
                console.log('❌ Cart is empty');
                return;
            }

            const roomCenterX = this.stage.width() / 2;
            const roomCenterY = this.stage.height() / 2;
            const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
            const itemsPerRow = Math.ceil(Math.sqrt(totalItems));
            const spacing = 150; // More spacing for larger images

            console.log('📐 Placing', totalItems, 'items in grid');

            let itemIndex = 0;
            for (const item of cart) {
                console.log('🪑 Adding:', item.name, 'x', item.quantity);
                for (let q = 0; q < item.quantity; q++) {
                    const row = Math.floor(itemIndex / itemsPerRow);
                    const col = itemIndex % itemsPerRow;
                    // Since addFurnitureWithTransforms now strictly expects relative positioning against the room origin,
                    // we need to compute these default fallbacks relative to the center of the room.
                    const relativeDefaultX = (this.roomData.width * 80 / 2) + (col - itemsPerRow / 2) * spacing;
                    const relativeDefaultY = (this.roomData.length * 80 / 2) + (row - itemsPerRow / 2) * spacing;

                    await this.addFurnitureWithTransforms(item, {
                        x: relativeDefaultX,
                        y: relativeDefaultY,
                        rotation: 0,
                        scaleX: 1,
                        scaleY: 1,
                        isFromCart: true
                    });
                    itemIndex++;
                }
            }

            showSuccess(`${totalItems} furniture items loaded!`, 2000);
        } catch (e) {
            console.error('❌ Error loading cart:', e);
        }
    }

    // Add furniture with ORIGINAL image size (scaled to fit canvas)
    async addFurnitureFromImage(item, x, y) {
        return new Promise((resolve) => {
            console.log('🖼️ Loading image:', item.image);

            const img = new Image();
            img.crossOrigin = 'Anonymous';

            img.onload = () => {
                console.log('✅ Image loaded:', item.name);
                console.log('   Original size:', img.width, 'x', img.height);

                // Calculate scale to fit within a max size while maintaining aspect ratio
                const maxDisplaySize = 120; // Max size in pixels
                const aspectRatio = img.width / img.height;

                let displayWidth, displayHeight;
                if (img.width > img.height) {
                    displayWidth = Math.min(img.width, maxDisplaySize);
                    displayHeight = displayWidth / aspectRatio;
                } else {
                    displayHeight = Math.min(img.height, maxDisplaySize);
                    displayWidth = displayHeight * aspectRatio;
                }

                console.log('   Display size:', displayWidth, 'x', displayHeight);

                const furnitureImage = new Konva.Image({
                    x: 0,
                    y: 0,
                    image: img,
                    width: displayWidth,
                    height: displayHeight,
                    shadowColor: 'rgba(0, 0, 0, 0.3)',
                    shadowBlur: 12,
                    shadowOpacity: 0.6,
                    shadowOffset: { x: 4, y: 4 },
                    name: 'furniture'
                });

                furnitureImage.setAttr('furnitureId', item.id);
                furnitureImage.setAttr('furnitureImage', item.image);
                furnitureImage.setAttr('furnitureName', item.name);
                furnitureImage.setAttr('originalWidth', img.width);
                furnitureImage.setAttr('originalHeight', img.height);

                const label = new Konva.Text({
                    x: 0,
                    y: displayHeight + 8,
                    width: displayWidth,
                    text: item.name,
                    fontSize: 12,
                    fontFamily: 'Inter, Arial',
                    fill: '#1e293b',
                    align: 'center',
                    fontStyle: 'bold'
                });

                const group = new Konva.Group({
                    x: x - displayWidth / 2,
                    y: y - displayHeight / 2,
                    draggable: true
                });

                group.add(furnitureImage);
                group.add(label);

                this.setupFurnitureInteractions(group, furnitureImage);

                this.furnitureLayer.add(group);
                this.furnitureLayer.batchDraw();

                resolve();
            };

            img.onerror = () => {
                console.error('❌ Image failed to load:', item.image);
                showWarning(`Failed to load image for ${item.name}`);
                resolve();
            };

            img.src = item.image;
        });
    }

    /**
     * Saves the current canvas state to sessionStorage (preserving project
     * context) then navigates to the furniture shop.  When the shop redirects
     * back to editor-2d.html the editor reads projectId/roomId from session
     * and merges newly selected items with the existing layout.
     */
    navigateToShop() {
        const payload = {
            roomData:          this.roomData,
            furniture:         this.collectFurnitureData(),
            canvasRoomOriginX: this.roomGroup ? this.roomGroup.x() : 0,
            canvasRoomOriginY: this.roomGroup ? this.roomGroup.y() : 0,
            projectId:         this.projectId,
            roomId:            this.roomId
        };
        sessionStorage.setItem('current3DLayout', JSON.stringify(payload));
        window.location.href = 'furniture-shop.html';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🏗️ Initializing 2D Floor Plan Editor...');
    // Expose globally so HTML onclick buttons can call instance methods.
    window.roomEditor = new RoomEditor();
});