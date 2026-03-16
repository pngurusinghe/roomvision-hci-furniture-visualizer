/**
 * RoomVision - 2D Editor (V2 Architecture)
 * Single Source of Truth: The 3D coordinate array
 * This script serves purely as a 2D projection and interaction layer for that array.
 */
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    doc,
    getDoc,
    collection,
    getDocs,
    updateDoc,
    serverTimestamp,
    addDoc,
    deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// --- UI Elements ---
const canvasContainer = document.getElementById('canvas-container');
const roomDimensionsEl = document.getElementById('roomDimensions');
const roomTypeEl = document.getElementById('roomType');
const roomAreaEl = document.getElementById('roomArea');
const wallColorPicker = document.getElementById('wallColorPicker2D');
const floorColorPicker = document.getElementById('floorColorPicker2D');

class RoomEditor2D {
    constructor() {
        this.projectId = new URLSearchParams(window.location.search).get('projectId');
        this.roomId = new URLSearchParams(window.location.search).get('roomId');
        this.designId = new URLSearchParams(window.location.search).get('designId'); // legacy support

        // --- SINGLE SOURCE OF TRUTH STATE ---
        this.roomData = null;       // { width, length, height, wallColor, floorColor }
        this.furnitureState = [];   // The exact array `view3d.js` will read from sessionStorage
        
        // --- Catalog Map ---
        this.catalogMap = {};       // Maps furnitureId -> { image, name }

        // --- Canvas Variables ---
        this.stage = null;
        this.layer = null;          // Static room layer (floor/walls)
        this.furnLayer = null;      // Interactive furniture layer
        
        // Constants matching view3d.js logic
        this.PIXELS_PER_METER = 80;

        this.init();
    }

    async init() {
        console.log("🚀 Initializing 2D Editor V2");
        
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                window.location.href = 'index.html';
                return;
            }
            
            await this.loadCatalog();
            await this.loadState();
            this.initCanvas();
            this.render();
            this.setupUIBindings();
        });
    }

    // ---------------------------------------------------------
    // STEP 1: LOAD STATE
    // ---------------------------------------------------------
    async loadCatalog() {
        // Fast-path: Check session storage first to avoid 3-5s Firebase query delay
        try {
            const cachedCatalog = sessionStorage.getItem('furnitureCatalogCache');
            if (cachedCatalog) {
                this.catalogMap = JSON.parse(cachedCatalog);
                console.log("⚡ Fast-loading catalog from session storage:", Object.keys(this.catalogMap).length, "items");
                return;
            }
        } catch(e) {
            // Corrupted cache — clear it and reload from Firebase
            sessionStorage.removeItem('furnitureCatalogCache');
        }

        try {
            const snap = await getDocs(collection(db, 'furniture'));
            snap.forEach(doc => {
                this.catalogMap[doc.id] = doc.data();
            });

            // Cache a trimmed version — only fields needed by the 2D editor.
            // Full furniture docs (with modelUrl, large descriptions etc.) easily
            // exceed the 5 MB sessionStorage quota.
            try {
                const trimmed = {};
                for (const [id, item] of Object.entries(this.catalogMap)) {
                    trimmed[id] = {
                        name:      item.name      || '',
                        category:  item.category  || '',
                        width:     item.width      ?? item.w ?? null,
                        depth:     item.depth      ?? item.d ?? null,
                        height:    item.height     ?? item.h ?? null,
                        price:     item.price      ?? null,
                        thumbnail: item.thumbnail  || item.imageUrl || ''
                    };
                }
                sessionStorage.setItem('furnitureCatalogCache', JSON.stringify(trimmed));
            } catch (quotaErr) {
                // sessionStorage full — editor still works, just without the cache
                console.warn("⚠️ Could not cache catalog (storage quota full):", quotaErr.message);
                sessionStorage.removeItem('furnitureCatalogCache');
            }

            console.log("✅ Catalog loaded from Firebase:", Object.keys(this.catalogMap).length, "items");
        } catch (e) {
            console.error("Error loading catalog:", e);
        }
    }

    async loadState() {
        // 1. Session State Recovery
        let hasSessionState = false;
        
        // Step A: Recover IDs if they were not provided in the URL
        if (!this.roomId) {
            const tempRoomId = sessionStorage.getItem('currentRoomId');
            if (tempRoomId) {
                this.roomId = tempRoomId;
                const tempRoomData = sessionStorage.getItem('currentRoomData');
                if (tempRoomData) {
                    try {
                        const parsed = JSON.parse(tempRoomData);
                        if (!this.projectId && parsed.projectId) {
                            this.projectId = parsed.projectId;
                        }
                    } catch(e){}
                }
            }
        }

        // Step B: Attempt to pull 3D layout only if it matches our resolved IDs
        let fullSessionHit = false;
        try {
            const sessionRaw = sessionStorage.getItem('current3DLayout');
            if (sessionRaw) {
                const layout = JSON.parse(sessionRaw);
                // If we still don't have IDs, fall back to layout
                if (!this.projectId && layout.projectId) this.projectId = layout.projectId;
                if (!this.roomId && layout.roomId) this.roomId = layout.roomId;
                
                // Only recover the layout's furniture and roomData if it belongs to the room we're loading
                if (this.roomId === layout.roomId) {
                    if (layout.furniture && layout.furniture.length > 0) {
                        this.furnitureState = layout.furniture;
                    }
                    if (layout.roomData) {
                        this.roomData = layout.roomData;
                        hasSessionState = true;
                        fullSessionHit = true;
                    }
                }
            }
        } catch (e) {
            console.warn("Failed to parse session layout", e);
        }

        // Step C: If we still don't have room data, try `currentRoomData`
        let roomDataFromSession = null;
        try {
            const raw = sessionStorage.getItem('currentRoomData');
            if (raw) roomDataFromSession = JSON.parse(raw);
        } catch(e) {}

        if (fullSessionHit) {
            console.log("⚡ Fast-loading full layout from session storage, skipping Firebase reads!");
        } else if (
            roomDataFromSession && 
            this.roomId && 
            sessionStorage.getItem('currentRoomId') === this.roomId
        ) {
            console.log("⚡ Fast-loading room data from session storage!");
            this.roomData = {
                width: roomDataFromSession.width,
                length: roomDataFromSession.length,
                height: roomDataFromSession.height || 2.8,
                wallColor: roomDataFromSession.wallColor || '#FFFFFF',
                floorColor: roomDataFromSession.floorColor || '#F5DEB3',
                roomType: roomDataFromSession.roomType || 'room'
            };
            
            if (!hasSessionState) {
                this.furnitureState = roomDataFromSession.layout?.furniture || [];
            }
        } else if (this.projectId && this.roomId) {
            // Project-bound room
            const roomRef = doc(db, `projects/${this.projectId}/rooms/${this.roomId}`);
            const roomSnap = await getDoc(roomRef);
            
            if (!roomSnap.exists()) {
                alert('Room not found inside project.');
                window.location.href = "projects.html";
                return;
            }
            
            const data = roomSnap.data();
            this.roomData = {
                width: data.width,
                length: data.length,
                height: data.height || 2.8,
                wallColor: data.wallColor || '#FFFFFF',
                floorColor: data.floorColor || '#F5DEB3',
                roomType: data.roomType || 'room'
            };

            // Fetch project name and persist it into sessionStorage so the
            // navbar breadcrumb can show "My Projects › ProjectName › 2D Editor"
            try {
                const projectRef = doc(db, 'projects', this.projectId);
                const projectSnap = await getDoc(projectRef);
                if (projectSnap.exists()) {
                    const projectName = projectSnap.data().name || projectSnap.data().projectName || null;
                    if (projectName) {
                        // Enrich currentRoomData
                        const existing = JSON.parse(sessionStorage.getItem('currentRoomData') || '{}');
                        existing.projectName = projectName;
                        existing.projectId   = this.projectId;
                        sessionStorage.setItem('currentRoomData', JSON.stringify(existing));

                        // Enrich current3DLayout
                        const layout = JSON.parse(sessionStorage.getItem('current3DLayout') || '{}');
                        layout.projectName = projectName;
                        layout.projectId   = this.projectId;
                        layout.roomId      = this.roomId;
                        sessionStorage.setItem('current3DLayout', JSON.stringify(layout));

                        console.log(`📁 Project name set for breadcrumb: "${projectName}"`);
                        // Signal the navbar to re-render the breadcrumb now that project name is known
                        window.dispatchEvent(new CustomEvent('rv:projectContext'));
                    }
                }
            } catch (e) {
                // Non-critical — breadcrumb just won't show project name
                console.warn('Could not fetch project name for breadcrumb:', e);
            }

            if (!hasSessionState) {
                // AGGRESSIVE LOAD: Always check sub-collection first, regardless of flags
                this.furnitureState = [];
                try {
                    const furnColl = collection(db, `projects/${this.projectId}/rooms/${this.roomId}/furniture`);
                    const fSnap = await getDocs(furnColl);
                    if (!fSnap.empty) {
                        fSnap.forEach(d => {
                            this.furnitureState.push({ ...d.data(), firestoreId: d.id });
                        });
                        console.log(`✅ Loaded ${this.furnitureState.length} items from sub-collection.`);
                    } else if (data.layout && data.layout.furniture) {
                        // Fallback to legacy inline furniture
                        this.furnitureState = data.layout.furniture;
                    }
                } catch (e) {
                    console.error("Error during aggressive furniture fetch:", e);
                }
            }

        } else if (this.roomId) {
            // Standalone room (no project ID)
            const roomRef = doc(db, 'rooms', this.roomId);
            const roomSnap = await getDoc(roomRef);
            
            if (!roomSnap.exists()) {
                alert('Standalone room not found.');
                window.location.href = "projects.html";
                return;
            }
            
            const data = roomSnap.data();
            this.roomData = {
                width: data.width,
                length: data.length,
                height: data.height || 2.8,
                wallColor: data.wallColor || '#FFFFFF',
                floorColor: data.floorColor || '#F5DEB3',
                roomType: data.roomType || 'room'
            };

            if (!hasSessionState) {
                this.furnitureState = data.layout?.furniture || [];
            }
        } else if (this.designId) {
            // Legacy standalone design flow
            const docRef = doc(db, 'designs', this.designId);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = snap.data();
                this.roomData = data.room;
                if (!hasSessionState) {
                    this.furnitureState = data.furniture || [];
                }
            }
        } else {
            alert("No room specified.");
            window.location.href = "projects.html";
            return;
        }

        // 2. Cart Merge: Append any brand new items selected from the shop
        this.mergeCartItems();

        // 3. Numerical Robustness: Ensure dimensions are numeric for math calculations
        if (this.roomData) {
            this.roomData.width = parseFloat(this.roomData.width) || 5;
            this.roomData.length = parseFloat(this.roomData.length) || 4;
            this.roomData.height = parseFloat(this.roomData.height) || 2.8;
        }

        console.log("✅ State loaded:", this.roomData, this.furnitureState);
        this.updateRoomInfoUI();
    }

    mergeCartItems() {
        try {
            const cartRaw = sessionStorage.getItem('furnitureCart');
            if (!cartRaw) return;
            const cartList = JSON.parse(cartRaw);
            
            if (cartList && cartList.length > 0) {
                let currentItemYOffset = 0; // Stagger items so they don't stack perfectly

                cartList.forEach(item => {
                    for (let i = 0; i < item.quantity; i++) {
                        // Create a new proxy state object matching the unified schema
                        const wInPx = item.width ? (parseFloat(item.width) * this.PIXELS_PER_METER) : 100;
                        const hInPx = item.depth ? (parseFloat(item.depth) * this.PIXELS_PER_METER) : 100;
                        
                        // Default drop center of room (relative coordinate center)
                        const centerX = (this.roomData.width * this.PIXELS_PER_METER) / 2;
                        const centerY = (this.roomData.length * this.PIXELS_PER_METER) / 2;
                        
                        this.furnitureState.push({
                            furnitureId: item.id,
                            image: item.image,
                            name: item.name,
                            originalWidth: wInPx,
                            originalHeight: hInPx,
                            x: centerX + currentItemYOffset,
                            y: centerY + currentItemYOffset,
                            rotation: 0,
                            scaleX: 1,
                            scaleY: 1
                        });
                        currentItemYOffset += 20; // stagger next item by 20 pixels
                    }
                });

                // Clear the cart so we don't double-add them on refresh
                sessionStorage.removeItem('furnitureCart');
                console.log(`🛒 Merged ${cartList.length} cart products into room state.`);
            }
        } catch (e) {
            console.error("Cart merge error:", e);
        }
    }

    // ---------------------------------------------------------
    // STEP 2: 2D RENDERER (Read-Only Projection)
    // ---------------------------------------------------------
    initCanvas() {
        const containerWidth = canvasContainer.clientWidth || 800;
        const containerHeight = canvasContainer.clientHeight || 600;

        this.stage = new Konva.Stage({
            container: 'canvas-container',
            width: containerWidth,
            height: containerHeight,
            draggable: false // Pan via spacebar only
        });

        this.layer = new Konva.Layer();
        this.furnLayer = new Konva.Layer();
        this.stage.add(this.layer);
        this.stage.add(this.furnLayer);

        // Calculate center of canvas container
        this.canvasCenterX = containerWidth / 2;
        this.canvasCenterY = containerHeight / 2;

        this.setupCanvasPanning();
        this.setupZoomControls();
    }

    setupCanvasPanning() {
        let spacePressed = false;

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !spacePressed) {
                e.preventDefault();
                spacePressed = true;
                canvasContainer.style.cursor = 'grab';
                this.stage.draggable(true);
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                spacePressed = false;
                canvasContainer.style.cursor = 'default';
                this.stage.draggable(false);
            }
        });
    }

    setupZoomControls() {
        const zoomSlider = document.getElementById('zoomSlider');
        const zoomValue = document.getElementById('zoomValue');
        const zoomIn = document.getElementById('zoomIn');
        const zoomOut = document.getElementById('zoomOut');

        if (!zoomSlider || !zoomValue || !zoomIn || !zoomOut) return;

        const updateZoom = (value) => {
            const zoom = value / 100;
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
            
            zoomSlider.value = Math.round(clampedScale * 100);
            zoomValue.textContent = `${Math.round(clampedScale * 100)}%`;
        });
    }

    render() {
        if (!this.roomData) return;
        
        this.layer.destroyChildren();
        this.furnLayer.destroyChildren();

        this.drawRoom();
        this.drawFurnitureState();

        this.layer.batchDraw();
        this.furnLayer.batchDraw();
    }

    drawRoom() {
        // Pixel dimensions of the room based on the shared scale
        const wPx = this.roomData.width * this.PIXELS_PER_METER;
        const hPx = this.roomData.length * this.PIXELS_PER_METER;

        // Top-left of the room walls on the canvas, so it sits in the middle
        const roomOriginX = this.canvasCenterX - (wPx / 2);
        const roomOriginY = this.canvasCenterY - (hPx / 2);

        this.roomOriginX = roomOriginX;
        this.roomOriginY = roomOriginY;

        const wallThickness = 15;

        // Floor
        const floor = new Konva.Rect({
            x: roomOriginX,
            y: roomOriginY,
            width: wPx,
            height: hPx,
            fill: this.roomData.floorColor,
            stroke: this.roomData.wallColor,
            strokeWidth: 4
        });

        // Walls
        const topWall = new Konva.Rect({ x: roomOriginX - wallThickness/2, y: roomOriginY - wallThickness/2, width: wPx + wallThickness, height: wallThickness, fill: this.roomData.wallColor, stroke: '#ccc', strokeWidth: 1 });
        const bottomWall = new Konva.Rect({ x: roomOriginX - wallThickness/2, y: roomOriginY + hPx - wallThickness/2, width: wPx + wallThickness, height: wallThickness, fill: this.roomData.wallColor, stroke: '#ccc', strokeWidth: 1 });
        const leftWall = new Konva.Rect({ x: roomOriginX - wallThickness/2, y: roomOriginY - wallThickness/2, width: wallThickness, height: hPx + wallThickness, fill: this.roomData.wallColor, stroke: '#ccc', strokeWidth: 1 });
        const rightWall = new Konva.Rect({ x: roomOriginX + wPx - wallThickness/2, y: roomOriginY - wallThickness/2, width: wallThickness, height: hPx + wallThickness, fill: this.roomData.wallColor, stroke: '#ccc', strokeWidth: 1 });

        this.layer.add(floor, topWall, bottomWall, leftWall, rightWall);
    }

    drawFurnitureState() {
        // Iterate through the strict uniform state array
        this.furnitureState.forEach((itemState, index) => {
            // Find display image
            const imgUrl = itemState.image || (this.catalogMap[itemState.furnitureId] ? this.catalogMap[itemState.furnitureId].image : null);
            if (!imgUrl) return;

            const proxyGroup = new Konva.Group({
                // Convert state relative coordinates -> absolute canvas coordinates
                x: itemState.x + this.roomOriginX,
                y: itemState.y + this.roomOriginY,
                rotation: itemState.rotation || 0,
                scaleX: itemState.scaleX || 1,
                scaleY: itemState.scaleY || 1,
                draggable: true, // STEP 3: Make interactive
                dragBoundFunc: (pos) => {
                    // INDUSTRY STANDARD FIX: Convert absolute screen points to local stage points to handle Zoom/Pan
                    const stage = this.stage;
                    const transform = stage.getAbsoluteTransform().copy().invert();
                    const localPos = transform.point(pos);

                    // Calculate the real visual extent of the object including its current rotation
                    const w = (itemState.displayWidth || itemState.originalWidth || 100) * (itemState.scaleX || 1);
                    const h = (itemState.displayHeight || itemState.originalHeight || 100) * (itemState.scaleY || 1);
                    const theta = (itemState.rotation || 0) * Math.PI / 180;
                    
                    const boundingW = Math.abs(w * Math.cos(theta)) + Math.abs(h * Math.sin(theta));
                    const boundingH = Math.abs(w * Math.sin(theta)) + Math.abs(h * Math.cos(theta));
                    
                    const minX = this.roomOriginX + (boundingW / 2);
                    const maxX = this.roomOriginX + (this.roomData.width * this.PIXELS_PER_METER) - (boundingW / 2);
                    
                    const minY = this.roomOriginY + (boundingH / 2);
                    const maxY = this.roomOriginY + (this.roomData.length * this.PIXELS_PER_METER) - (boundingH / 2);

                    const clampedLocalX = Math.max(minX, Math.min(maxX, localPos.x));
                    const clampedLocalY = Math.max(minY, Math.min(maxY, localPos.y));

                    // Return absolute point for Konva
                    return stage.getAbsoluteTransform().point({ x: clampedLocalX, y: clampedLocalY });
                }
            });

            // Store the state array index so UI can modify the shared state later
            proxyGroup.setAttr('stateIndex', index);

            // STEP 3: Update shared state on drag end
            proxyGroup.on('dragend', (e) => {
                const updatedX = proxyGroup.x() - this.roomOriginX;
                const updatedY = proxyGroup.y() - this.roomOriginY;
                
                // Directly mutate the Single Source of Truth array
                this.furnitureState[index].x = updatedX;
                this.furnitureState[index].y = updatedY;
                
                // V3 PERSISTENCE SYNC: Delete any explicit mapped 3D coords so the 3D Viewer is forced to rebuild from these 2D coords
                delete this.furnitureState[index].v3Position;
                delete this.furnitureState[index].v3Rotation;
                
                console.log(`Moved item [${index}] to relatives: x=${updatedX.toFixed(1)}, y=${updatedY.toFixed(1)}`);
            });

            // STEP 3: Setup Transformer (rotation) on click
            proxyGroup.on('click tap', (e) => {
                e.cancelBubble = true;
                this.selectFurniture(proxyGroup);
            });

            const imgObj = new Image();
            imgObj.crossOrigin = 'Anonymous';
            imgObj.onload = () => {
                // Ensure displayWidth/Height calculation uses actual image size bounds
                let w = itemState.displayWidth || itemState.originalWidth;
                let h = itemState.displayHeight || itemState.originalHeight;

                if (!w || !h) {
                    const aspect = imgObj.width / imgObj.height;
                    if (imgObj.width > imgObj.height) { w = 120; h = 120 / aspect; }
                    else { h = 120; w = 120 * aspect; }
                    itemState.displayWidth = w;
                    itemState.displayHeight = h;
                }
                
                const konvaImg = new Konva.Image({
                    // Offset strictly by half so the group's x/y marks the center of the image bounds
                    x: -w / 2,
                    y: -h / 2,
                    image: imgObj,
                    width: w,
                    height: h,
                    shadowColor: 'rgba(0, 0, 0, 0.3)',
                    shadowBlur: 10,
                    shadowOffset: { x: 3, y: 3 },
                    shadowOpacity: 0.5
                });

                const itemName = itemState.name || (this.catalogMap[itemState.furnitureId] ? this.catalogMap[itemState.furnitureId].name : 'Furniture');
                // The label sits below the image. Image starts at y: -h/2, so the bottom is +h/2.
                const label = new Konva.Text({
                    x: -w / 2, 
                    y: (h / 2) + 8, 
                    width: w,
                    text: itemName, 
                    fontSize: 13, 
                    fontFamily: 'Inter, Arial',
                    fill: '#1e293b', 
                    align: 'center', 
                    fontStyle: 'bold'
                });

                // AUTO-CLAMP LOD: Forcibly push the group fully inside the newly realized bounds (fixes edge-case bleeding from 3D scaling bounds!)
                const theta = (itemState.rotation || 0) * Math.PI / 180;
                const boundingW = Math.abs(w * Math.cos(theta)) + Math.abs(h * Math.sin(theta));
                const boundingH = Math.abs(w * Math.sin(theta)) + Math.abs(h * Math.cos(theta));
                
                const minX = this.roomOriginX + (boundingW / 2);
                const maxX = this.roomOriginX + (this.roomData.width * this.PIXELS_PER_METER) - (boundingW / 2);
                const minY = this.roomOriginY + (boundingH / 2);
                const maxY = this.roomOriginY + (this.roomData.length * this.PIXELS_PER_METER) - (boundingH / 2);

                const clampedX = Math.max(minX, Math.min(maxX, proxyGroup.x()));
                const clampedY = Math.max(minY, Math.min(maxY, proxyGroup.y()));
                
                proxyGroup.position({ x: clampedX, y: clampedY });
                itemState.x = clampedX - this.roomOriginX;
                itemState.y = clampedY - this.roomOriginY;

                proxyGroup.add(konvaImg);
                proxyGroup.add(label);
                this.furnLayer.add(proxyGroup);
                this.furnLayer.batchDraw();
            };
            imgObj.src = imgUrl;
        });

        // Initialize transformer for rotation
        this.transformer = new Konva.Transformer({
            nodes: [],
            centeredScaling: true,
            enabledAnchors: [], // Disable resizing for now to keep 3D scale sync pure
            rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315]
        });

        // STEP 3: Update shared state on rotate end
        this.transformer.on('transformend', () => {
            const node = this.transformer.nodes()[0];
            if (node) {
                const idx = node.getAttr('stateIndex');
                this.furnitureState[idx].rotation = node.rotation();
                
                // V3 PERSISTENCE SYNC: Clear explicit map to force 3D editor to resync on rotation
                delete this.furnitureState[idx].v3Position;
                delete this.furnitureState[idx].v3Rotation;
                
                console.log(`Rotated item [${idx}] to ${node.rotation()} degrees`);
            }
        });

        this.furnLayer.add(this.transformer);

        // Click outside removes selection
        this.stage.on('click tap', (e) => {
            if (e.target === this.stage || e.target.getParent() === this.layer) {
                this.deselectFurniture();
            }
        });
    }

    selectFurniture(node) {
        this.transformer.nodes([node]);
        this.furnLayer.batchDraw();
    }

    deselectFurniture() {
        this.transformer.nodes([]);
        this.furnLayer.batchDraw();
    }

    // ---------------------------------------------------------
    // UI BINDINGS
    // ---------------------------------------------------------
    updateRoomInfoUI() {
        if(roomDimensionsEl) roomDimensionsEl.textContent = `${this.roomData.width}m × ${this.roomData.length}m × ${this.roomData.height}m`;
        if(roomTypeEl) roomTypeEl.textContent = `Type: ${this.roomData.roomType}`;
        const area = (this.roomData.width * this.roomData.length).toFixed(2);
        if(roomAreaEl) roomAreaEl.textContent = `Area: ${area} m²`;

        if(wallColorPicker) wallColorPicker.value = this.roomData.wallColor;
        if(floorColorPicker) floorColorPicker.value = this.roomData.floorColor;
    }

    setupUIBindings() {
        // 3D Handoff
        const view3dBtn = document.getElementById('view3dBtn');
        if (view3dBtn) {
            view3dBtn.addEventListener('click', () => {
                // Pass the EXACT state array via sessionStorage 
                // which view3d.js reads verbatim
                sessionStorage.setItem('current3DLayout', JSON.stringify({
                    roomData: this.roomData,
                    furniture: this.furnitureState,
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
            });
        }

        // STEP 4: Unified Firebase Save
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveLayout());
        }

        const addFurnitureBtn = document.getElementById('addFurnitureBtn');
        if (addFurnitureBtn) {
            addFurnitureBtn.addEventListener('click', () => this.navigateToShop());
        }

        const backToRoomBtn = document.getElementById('backToRoomBtn');
        if (backToRoomBtn) {
            backToRoomBtn.addEventListener('click', () => {
                if (this.projectId && this.roomId) {
                    window.location.href = `room-setup.html?projectId=${this.projectId}&roomId=${this.roomId}`;
                } else if (this.roomId) {
                    window.location.href = `room-setup.html?roomId=${this.roomId}`;
                } else {
                    window.location.href = 'room-setup.html';
                }
            });
        }

        // Download 2D floor plan as PNG
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                // Temporarily reset zoom/pan so the full room is captured
                const prevScale = this.stage.scaleX();
                const prevPos = this.stage.position();

                this.stage.scale({ x: 1, y: 1 });
                this.stage.position({ x: 0, y: 0 });
                this.stage.batchDraw();

                const dataURL = this.stage.toDataURL({
                    mimeType: 'image/png',
                    quality: 1,
                    pixelRatio: 2   // High-DPI output
                });

                // Restore previous view
                this.stage.scale({ x: prevScale, y: prevScale });
                this.stage.position(prevPos);
                this.stage.batchDraw();

                // Trigger download
                const link = document.createElement('a');
                const roomName = this.roomData?.roomType || 'room';
                link.download = `RoomVision-2D-${roomName}-${Date.now()}.png`;
                link.href = dataURL;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        }

        // Keyboard Deletion of elements from the shared state
        document.addEventListener('keydown', (e) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && this.transformer.nodes().length > 0) {
                e.preventDefault();
                const node = this.transformer.nodes()[0];
                const idx = node.getAttr('stateIndex');
                
                // Remove from shared state
                this.furnitureState.splice(idx, 1);
                
                // Re-render entirely from the state
                this.deselectFurniture();
                this.render();
            }
        });
    }

    /**
     * Cross-page communication to 'Add Furniture' flow
     */
    navigateToShop() {
        // Pass the exact state array via sessionStorage so the shop can read the active project room context
        sessionStorage.setItem('current3DLayout', JSON.stringify({
            roomData: this.roomData,
            furniture: this.furnitureState,
            canvasRoomOriginX: this.roomOriginX,
            canvasRoomOriginY: this.roomOriginY,
            projectId: this.projectId,
            roomId: this.roomId
        }));
        window.location.href = 'furniture-shop.html';
    }

    // ---------------------------------------------------------
    // STEP 4: UNIFIED FIREBASE SAVE
    // Writes the single-source-of-truth state back to Firestore
    // ---------------------------------------------------------
    async saveLayout() {
        if (!this.projectId || !this.roomId) {
            alert("No project context found to save in new architecture.");
            return;
        }

        const saveBtn = document.getElementById('saveBtn');
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<span>💾 Saving...</span>';
        saveBtn.disabled = true;

        try {
            // Write core room data updates
            const roomRef = doc(db, `projects/${this.projectId}/rooms/${this.roomId}`);
            
            // Delete all current documents in the furniture sub-collection (complete overwrite)
            // Note: In a production app with thousands of items, we'd want delta updates.
            // But for simple layouts, wiping and re-writing guarantees synchronization.
            const furnColl = collection(db, `projects/${this.projectId}/rooms/${this.roomId}/furniture`);
            const existingSnaps = await getDocs(furnColl);
            const deletePromises = existingSnaps.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deletePromises);

            // Add new layout documents into the sub-collection and collect references
            const furnitureRefs = [];
            for (const item of this.furnitureState) {
                // Remove the transient id fields to avoid duplication saving
                const { firestoreId, ...cleanItem } = item;
                const docRef = await addDoc(furnColl, cleanItem);
                furnitureRefs.push(docRef.id);
            }

            // Update main room layout reference block
            await updateDoc(roomRef, {
                layout: {
                    furnitureRefs: furnitureRefs,
                    canvasRoomOriginX: this.roomOriginX,
                    canvasRoomOriginY: this.roomOriginY,
                    updatedAt: new Date().toISOString()
                },
                wallColor: this.roomData.wallColor || '#FFFFFF',
                floorColor: this.roomData.floorColor || '#F5DEB3',
                updatedAt: serverTimestamp()
            });

            console.log("✅ State successfully saved to Firebase!");
            saveBtn.innerHTML = '<span>✅ Saved! Opening 3D…</span>';

            // Persist the freshly-saved layout so view-3d.html can read it immediately
            sessionStorage.setItem('current3DLayout', JSON.stringify({
                roomData:          this.roomData,
                furniture:         this.furnitureState,
                canvasRoomOriginX: this.roomOriginX,
                canvasRoomOriginY: this.roomOriginY,
                projectId:         this.projectId,
                roomId:            this.roomId
            }));

            // Navigate to 3D view after brief confirmation (800 ms)
            setTimeout(() => {
                window.location.href = `view-3d.html?projectId=${this.projectId}&roomId=${this.roomId}`;
            }, 800);

        } catch(error) {
            console.error("Save error:", error);
            saveBtn.innerHTML = '<span>❌ Error</span>';
            setTimeout(() => { saveBtn.innerHTML = originalText; saveBtn.disabled = false; }, 2000);
            alert("Error saving layout: " + error.message);
        }
    }
}

// Global initialization
window.addEventListener('DOMContentLoaded', () => {
    window.roomEditor = new RoomEditor2D();
});
