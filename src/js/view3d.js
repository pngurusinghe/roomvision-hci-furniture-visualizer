import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { db } from './firebase-config.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class Room3DVisualizer {
    constructor() {
        this.container = document.getElementById('three-container');
        this.overlay = document.getElementById('transitionOverlay');
        this.layoutData = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.gltfLoader = new GLTFLoader();

        // furnitureId -> { widthM, depthM, heightM, storageUrl }
        this.models3DMap = {};

        // Phase 4: selection + rotation state
        this.selectedObject = null;    // currently selected Three.js Object3D
        this.selectedIndex = -1;      // index into layoutData.furniture
        this.furnitureObjects = [];    // ordered list of scene objects (parallel to layoutData.furniture)
        this.raycaster = new THREE.Raycaster();
        this.pendingRotations = {};    // index -> totalRotationDeg (delta from original)

        // Konva uses pixels, Three.js uses abstract units.
        // The 2D editor uses scale = 80 pixels per meter.
        this.pixelToMeterRatio = 1 / 80;

        // Phase 5: Enhanced surface snapping — furniture items that expose a top surface
        // (tables, desks…) register themselves here so decor can snap on top.
        this.surfaceMeshes = [];
        
        // Enhanced 3D move feature
        this.isDraggingObject = false;
        this.dragPlane = new THREE.Plane();
        this.dragOffset = new THREE.Vector3();
        this.dragIntersection = new THREE.Vector3();
        this.moveHelper = null; // Visual helper for move operations
        
        console.log('🏗️ Initializing 3D View with enhanced surface snapping and 3D move feature...');
        console.log('📋 Surface detection categories:');
        console.log('   - Table-top decor: vase, clock, alarm, chess, candle, lamp, etc.');
        console.log('   - Wall art: painting, frame, artwork, picture, mirror, etc.');
        console.log('   - Surface items: table, desk, shelf, cabinet, dresser, etc.');
        console.log('🎮 Move controls: Click and drag objects to move them with surface snapping!');

        this.init();
    }

    async init() {
        this.loadData();
        if (!this.layoutData) return;

        this.setupScene();
        this.buildRoom();

        // Fetch the 3D model catalogue from Firestore before building furniture
        await this.loadModels3D();

        // Build furniture (GLTF models where available, placeholder boxes otherwise)
        await this.buildFurniture();

        this.setupLighting();
        this.setupSelectionAndMovement();
        this.setupRotationButtons();  // Phase 4
        this.animate();

        // Hide transition overlay once scene is ready
        setTimeout(() => {
            if (this.overlay) {
                this.overlay.classList.add('hidden');
            }
        }, 800);

        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    loadData() {
        const dataStr = sessionStorage.getItem('current3DLayout');
        if (!dataStr) {
            console.error("No 3D layout data found.");
            alert("No room data found! Returning to 2D editor.");
            window.location.href = 'editor-2d.html';
            return;
        }
        this.layoutData = JSON.parse(dataStr);
        console.log("Loaded 3D Layout Data:", this.layoutData);
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf8fafc); // Light sleek background

        this.camera = new THREE.PerspectiveCamera(
            50,
            this.container.clientWidth / this.container.clientHeight,
            0.1,
            1000
        );

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't let camera go below floor

        // Calculate initial camera position based on room size
        const w = this.layoutData.roomData.width;
        const l = this.layoutData.roomData.length;
        const maxDim = Math.max(w, l);

        this.camera.position.set(0, maxDim * 1.2, maxDim * 1.2);
        this.controls.target.set(0, 0, 0);
    }

    buildRoom() {
        const room = this.layoutData.roomData;
        const width = room.width;     // X dimension
        const length = room.length;   // Z dimension
        const height = room.height;   // Y dimension
        const wallThickness = 0.2;

        const floorColor = new THREE.Color(room.floorColor || '#F5DEB3');
        const wallColor = new THREE.Color(room.wallColor || '#FFFFFF');

        // Floor (Width is X, Length is Z in 3D)
        const floorGeo = new THREE.PlaneGeometry(width, length);
        const floorMat = new THREE.MeshStandardMaterial({
            color: floorColor,
            roughness: 0.8
        });
        const floorMesh = new THREE.Mesh(floorGeo, floorMat);
        floorMesh.rotation.x = -Math.PI / 2;
        floorMesh.receiveShadow = true;
        this.scene.add(floorMesh);

        // Grid helper for floor
        const gridHelper = new THREE.GridHelper(Math.max(width, length), Math.max(width, length), 0x000000, 0x000000);
        gridHelper.material.opacity = 0.1;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);

        const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.9 });

        // Helper function to build a wall
        const buildWall = (w, h, d, x, y, z) => {
            const geo = new THREE.BoxGeometry(w, h, d);
            const mesh = new THREE.Mesh(geo, wallMat);
            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            return mesh;
        };

        const halfH = height / 2;

        // Top Wall (Back in 3D: -Z)
        buildWall(width + wallThickness * 2, height, wallThickness, 0, halfH, -length / 2 - wallThickness / 2);
        // Bottom Wall (Front initially invisible or transparent so we can see inside, so let's skip it or make it very low)
        // We will build a small lip for the front wall to show boundary
        buildWall(width + wallThickness * 2, 0.2, wallThickness, 0, 0.1, length / 2 + wallThickness / 2);

        // Left Wall (-X)
        buildWall(wallThickness, height, length, -width / 2 - wallThickness / 2, halfH, 0);
        // Right Wall (+X)
        buildWall(wallThickness, height, length, width / 2 + wallThickness / 2, halfH, 0);
    }

    // ── Phase 5: Enhanced Surface-snapping helpers ──────────────────────────

    /** Small decor that should rest on top of a table / desk / shelf surface. */
    _isTableTopDecor(name) {
        const nameLower = name.toLowerCase();
        
        // Prevent large furniture from accidentally triggering decor rules (e.g. "Display Cabinet")
        const largeExclusions = ['cabinet', 'shelf', 'stand', 'unit', 'table', 'desk', 'dresser'];
        if (largeExclusions.some(ex => nameLower.includes(ex))) {
            return false;
        }

        const kw = [
            'vase', 'clock', 'alarm', 'chess', 'candle', 'figurine',
            'bowl', 'plant', 'lamp', 'book', 'statue', 'ornament',
            'decoration', 'display', 'artifact', 'trophy', 'mug',
            'cup', 'glass', 'bottle', 'jar', 'photo', 'frame'
        ];
        const isDecor = kw.some(k => nameLower.includes(k));
        if (isDecor) {
            console.log(`🎯 Detected table-top decor: "${name}"`);
        }
        return isDecor;
    }

    /** Wall art items that snap onto a wall face instead of the floor. */
    _isWallArt(name) {
        const nameLower = name.toLowerCase();
        const kw = [
            'painting', 'frame', 'artwork', 'picture', 'poster',
            'canvas', 'mirror', 'art', 'portrait', 'print',
            'hanging', 'wall', 'mounted'
        ];
        const isWallArt = kw.some(k => nameLower.includes(k));
        if (isWallArt) {
            console.log(`🖼️ Detected wall art: "${name}"`);
        }
        return isWallArt;
    }

    /** Items that have a placeable top surface (tables, desks, cabinets…). */
    _isSurfaceItem(name) {
        const nameLower = name.toLowerCase();
        const kw = [
            'table', 'desk', 'shelf', 'counter', 'cabinet',
            'dresser', 'sideboard', 'tv unit', 'console',
            'stand', 'bench', 'ottoman', 'stool', 'surface'
        ];
        const isSurface = kw.some(k => nameLower.includes(k));
        if (isSurface) {
            console.log(`📦 Registering surface item: "${name}"`);
        }
        return isSurface;
    }

    /**
     * Enhanced surface detection with multiple raycasts and better height calculation.
     * Casts rays from above and finds the highest valid surface below the given position.
     */
    _findSurfaceHeightBelow(x3D, z3D) {
        if (this.surfaceMeshes.length === 0) {
            console.log(`📍 No surface meshes registered yet for position (${x3D.toFixed(2)}, ${z3D.toFixed(2)})`);
            return 0;
        }

        console.log(`🎯 Surface detection for position (${x3D.toFixed(2)}, ${z3D.toFixed(2)}) with ${this.surfaceMeshes.length} surfaces`);
        
        // Cast multiple rays in a small area to ensure we don't miss surfaces
        const rayPoints = [
            { x: x3D, z: z3D },
            { x: x3D + 0.01, z: z3D },
            { x: x3D - 0.01, z: z3D },
            { x: x3D, z: z3D + 0.01 },
            { x: x3D, z: z3D - 0.01 }
        ];
        
        let bestHit = null;
        let maxHeight = 0;
        
        for (const point of rayPoints) {
            const ray = new THREE.Raycaster(
                new THREE.Vector3(point.x, 20, point.z),
                new THREE.Vector3(0, -1, 0)
            );
            
            const hits = ray.intersectObjects(this.surfaceMeshes, true);
            
            // Find the highest surface hit
            for (const hit of hits) {
                if (hit.point.y > maxHeight) {
                    maxHeight = hit.point.y;
                    bestHit = hit;
                }
            }
        }
        
        if (bestHit) {
            const surfaceY = bestHit.point.y;
            console.log(`✅ Found surface at height: ${surfaceY.toFixed(2)}m`);
            return surfaceY;
        }
        
        console.log(`❌ No surface found, using floor (0m)`);
        return 0;
    }

    /**
     * Returns { x, y, z, rotY } that places wall art on the nearest room wall
     * at a natural hanging height (~55 % of wall height).
     */
    _getWallPlacement(x3D, z3D) {
        const room   = this.layoutData.roomData;
        const hw     = room.width  / 2;
        const hl     = room.length / 2;
        const hangY  = room.height * 0.55;
        const off    = 0.06; // metres in front of the wall

        const dBack  = Math.abs(z3D + hl);
        const dFront = Math.abs(z3D - hl);
        const dLeft  = Math.abs(x3D + hw);
        const dRight = Math.abs(x3D - hw);
        const minD   = Math.min(dBack, dFront, dLeft, dRight);
        
        // Clamp the sliding coordinates so the frame doesn't stick out past the wall corners
        const clampX = Math.max(-hw + 0.3, Math.min(hw - 0.3, x3D));
        const clampZ = Math.max(-hl + 0.3, Math.min(hl - 0.3, z3D));

        if (minD === dBack)  return { x: clampX,       y: hangY, z: -hl + off,  rotY: 0 };
        if (minD === dFront) return { x: clampX,       y: hangY, z:  hl - off,  rotY: Math.PI };
        if (minD === dLeft)  return { x: -hw + off,    y: hangY, z: clampZ,     rotY:  Math.PI / 2 };
                             return { x:  hw - off,    y: hangY, z: clampZ,     rotY: -Math.PI / 2 };
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Load 3D model metadata from Firestore `furniture3d` collection
    async loadModels3D() {
        try {
            const snapshot = await getDocs(collection(db, 'furniture3d'));
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (data.furnitureId) {
                    this.models3DMap[data.furnitureId] = {
                        widthM: data.widthM,
                        depthM: data.depthM,
                        heightM: data.heightM,
                        storageUrl: data.storageUrl
                    };
                }
            });
            console.log(`Loaded ${Object.keys(this.models3DMap).length} 3D model(s) from Firestore.`);
        } catch (e) {
            console.warn('Could not load 3D models from Firestore (falling back to placeholder boxes):', e);
        }
    }

    async buildFurniture() {
        const furnitureItems = this.layoutData.furniture;
        console.log(`🏗️ Building ${furnitureItems ? furnitureItems.length : 0} furniture items with enhanced surface snapping`);
        
        if (!furnitureItems || furnitureItems.length === 0) {
            console.log('🚨 No furniture items found');
            return;
        }

        const roomWidthPx = this.layoutData.roomData.width * 80;
        const roomLengthPx = this.layoutData.roomData.length * 80;

        // Enhanced two-phase placement: surface items (tables, desks…) are built first so
        // their meshes are registered in this.surfaceMeshes before decor items
        // need to raycast against them.
        const phaseA = [], phaseB = [];
        furnitureItems.forEach((item, index) => {
            const isDecor = this._isTableTopDecor(item.name) || this._isWallArt(item.name);
            (isDecor ? phaseB : phaseA).push({ item, index });
        });
        
        console.log(`🔄 Phase A (main furniture): ${phaseA.length} items`);
        console.log(`🔄 Phase B (decor/wall-art): ${phaseB.length} items`);
        console.log('🚧 Starting Phase A - main furniture placement...');

        const buildOne = ({ item, index }) => new Promise((resolve) => {
                const displayW = item.displayWidth || item.originalWidth;
                const displayH = item.displayHeight || item.originalHeight;

                // Actual displayed size in metres (used for placeholder box & 3D model scaling)
                const wMeters = displayW * item.scaleX * this.pixelToMeterRatio;
                const dMeters = displayH * item.scaleY * this.pixelToMeterRatio;
                const hMeters = 0.8;

                // ---------------------------------------------------------------
                // PLACEMENT FIX (Phase 2):
                // The item.x and item.y from the 2D editor are now saved RELATIVE
                // to the top-left of the room walls, NOT absolute stage pixels.
                // We add half the scaled display size to find the object's centre relative to the room's top-left.
                // ---------------------------------------------------------------
                const centreRelativeXPx = item.x + (displayW * item.scaleX) / 2;
                const centreRelativeYPx = item.y + (displayH * item.scaleY) / 2;

                // The 3D world origin (0,0,0) is placed at the exact centre of the room.
                // Convert top-left relative coordinates to center-origin relative coordinates.
                const relativeX = centreRelativeXPx - (roomWidthPx / 2);
                const relativeY = centreRelativeYPx - (roomLengthPx / 2);

                const x3D = relativeX * this.pixelToMeterRatio;
                const z3D = relativeY * this.pixelToMeterRatio;

                // Konva rotation (clockwise degrees) → Three.js Y-axis rotation (radians)
                const rotationY = -THREE.MathUtils.degToRad(item.rotation);

                const model3D = this.models3DMap[item.furnitureId];

                if (model3D && model3D.storageUrl) {
                    // ---- Render uploaded GLB/GLTF model ----
                    this.gltfLoader.load(
                        model3D.storageUrl,
                        (gltf) => {
                            const modelRoot = gltf.scene;

                            // Scale the model to match the admin-specified real-world dimensions
                            const box = new THREE.Box3().setFromObject(modelRoot);
                            const size = new THREE.Vector3();
                            box.getSize(size);

                            if (size.x > 0 && size.y > 0 && size.z > 0) {
                                const targetW = model3D.widthM || wMeters;
                                const targetH = model3D.heightM || hMeters;
                                const targetD = model3D.depthM || dMeters;
                                modelRoot.scale.set(
                                    targetW / size.x,
                                    targetH / size.y,
                                    targetD / size.z
                                );
                            }

                            // Apply enhanced surface snapping based on item type
                            const scaledBox = new THREE.Box3().setFromObject(modelRoot);
                            const itemHeight = scaledBox.max.y - scaledBox.min.y;
                            
                            console.log(`🏗️ Placing 3D model "${item.name}" at (${x3D.toFixed(2)}, ${z3D.toFixed(2)})`);
                            
                            if (item.v3Position) {
                                // V3 PERSISTENCE: Restore exact xyz and rotation if it was saved during a previous drag
                                modelRoot.position.set(item.v3Position.x, item.v3Position.y, item.v3Position.z);
                                modelRoot.rotation.y = item.v3Rotation !== undefined ? item.v3Rotation : rotationY;
                                console.log(`🔄 Restored exact V3 coordinates: (${item.v3Position.x.toFixed(2)}, ${item.v3Position.y.toFixed(2)}, ${item.v3Position.z.toFixed(2)})`);
                            } else if (this._isWallArt(item.name)) {
                                const wp = this._getWallPlacement(x3D, z3D);
                                modelRoot.position.set(wp.x, wp.y, wp.z);
                                modelRoot.rotation.y = wp.rotY;
                                console.log(`🖼️ Wall art placed at (${wp.x.toFixed(2)}, ${wp.y.toFixed(2)}, ${wp.z.toFixed(2)})`);
                            } else if (this._isTableTopDecor(item.name)) {
                                const surfaceY = this._findSurfaceHeightBelow(x3D, z3D);
                                const finalY = surfaceY + (-scaledBox.min.y);
                                modelRoot.position.set(x3D, finalY, z3D);
                                modelRoot.rotation.y = rotationY;
                                console.log(`🎯 Table-top decor placed at surface height: ${finalY.toFixed(2)}m`);
                            } else {
                                // Default: sit the model exactly on the floor.
                                const floorY = -scaledBox.min.y;
                                modelRoot.position.set(x3D, floorY, z3D);
                                modelRoot.rotation.y = rotationY;
                                console.log(`🏠 Floor item placed at: ${floorY.toFixed(2)}m`);
                            }

                            // Tag for raycaster selection (Phase 4)
                            modelRoot.userData.furnitureIndex = index;
                            this.furnitureObjects[index] = modelRoot;

                            modelRoot.traverse(child => {
                                if (child.isMesh) {
                                    child.castShadow = true;
                                    child.receiveShadow = true;
                                }
                            });

                            this.scene.add(modelRoot);
                            
                            // Register as snappable surface for later decor items
                            if (this._isSurfaceItem(item.name)) {
                                this.surfaceMeshes.push(modelRoot);
                                console.log(`📦 Registered "${item.name}" as surface. Total surfaces: ${this.surfaceMeshes.length}`);
                            }
                            
                            resolve();
                        },
                        undefined,
                        (err) => {
                            console.warn(`GLB load failed for "${item.name}", using placeholder:`, err);
                            this.addPlaceholderBox(item, index, x3D, z3D, wMeters, hMeters, dMeters, rotationY);
                            resolve();
                        }
                    );
                } else {
                    // ---- Placeholder coloured box (original behaviour) ----
                    this.addPlaceholderBox(item, index, x3D, z3D, wMeters, hMeters, dMeters, rotationY);
                    resolve();
                }
            });

        // Phase A (main furniture) must complete before Phase B (decor/wall-art)
        // so surface meshes are registered before snapping is attempted.
        await Promise.all(phaseA.map(buildOne));
        console.log(`✅ Phase A complete. ${this.surfaceMeshes.length} surfaces registered.`);
        
        console.log('🚧 Starting Phase B - decor/wall-art placement with surface snapping...');
        await Promise.all(phaseB.map(buildOne));
        console.log('✅ Phase B complete. All furniture placed with surface snapping.');
        
        console.log(`🏁 Final summary: ${furnitureItems.length} items placed, ${this.surfaceMeshes.length} surfaces available for snapping`);
        
        console.log(`🏁 Final summary: ${furnitureItems.length} items placed, ${this.surfaceMeshes.length} surfaces available for snapping`);
    }

    addPlaceholderBox(item, index, x3D, z3D, wMeters, hMeters, dMeters, rotationY) {
        const geo = new THREE.BoxGeometry(wMeters, hMeters, dMeters);
        const colorHue = (index * 137.5) % 360;
        const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(`hsl(${colorHue}, 70%, 50%)`),
            roughness: 0.2,
            metalness: 0.1
        });
        const mesh = new THREE.Mesh(geo, mat);
        // Apply enhanced surface snapping for placeholder boxes
        console.log(`🎁 Placing placeholder box "${item.name}" at (${x3D.toFixed(2)}, ${z3D.toFixed(2)})`);
        
        if (this._isWallArt(item.name)) {
            const wp = this._getWallPlacement(x3D, z3D);
            mesh.position.set(wp.x, wp.y, wp.z);
            mesh.rotation.y = wp.rotY;
            console.log(`🖼️ Wall art placeholder placed at (${wp.x.toFixed(2)}, ${wp.y.toFixed(2)}, ${wp.z.toFixed(2)})`);
        } else if (this._isTableTopDecor(item.name)) {
            const surfaceY = this._findSurfaceHeightBelow(x3D, z3D);
            const finalY = surfaceY + hMeters / 2;
            mesh.position.set(x3D, finalY, z3D);
            mesh.rotation.y = rotationY;
            console.log(`🎯 Table-top decor placeholder placed at surface height: ${finalY.toFixed(2)}m`);
        } else {
            const floorY = hMeters / 2;
            mesh.position.set(x3D, floorY, z3D);
            mesh.rotation.y = rotationY;
            console.log(`🏠 Floor placeholder placed at: ${floorY.toFixed(2)}m`);
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.furnitureIndex = index;  // tag for raycaster
        mesh.userData.originalColor = mat.color.clone();
        this.scene.add(mesh);
        this.furnitureObjects[index] = mesh;   // register
        
        // Register as snappable surface for later decor items
        if (this._isSurfaceItem(item.name)) {
            this.surfaceMeshes.push(mesh);
            console.log(`📦 Registered placeholder "${item.name}" as surface. Total surfaces: ${this.surfaceMeshes.length}`);
        }
    }

    // ── Enhanced Phase 4: Selection, Movement & Rotation ──────────────────────────────────────
    
    setupSelectionAndMovement() {
        this.isMouseDown = false;
        
        // Mouse events for object selection and movement
        this.renderer.domElement.addEventListener('mousedown', (event) => this.onMouseDown(event));
        this.renderer.domElement.addEventListener('mousemove', (event) => this.onMouseMove(event));
        this.renderer.domElement.addEventListener('mouseup', (event) => this.onMouseUp(event));
        window.addEventListener('mouseup', (event) => this.onMouseUp(event));
        
        // Mouse hover effects for better UX
        this.renderer.domElement.addEventListener('mousemove', (event) => this.updateCursor(event));
        
        // Track drag start to avoid treating drags as clicks
        this._isDragging = false;
        
        console.log('🎮 Enhanced 3D move controls initialized');
    }
    
    onMouseDown(event) {
        if (event.button !== 0) return; // Only accept left clicks
        this._isDragging = false;
        this.isMouseDown = true;
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        
        this.raycaster.setFromCamera(mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        let hit = null;
        for (const i of intersects) {
            // Walk up the parent chain to find an object tagged with furnitureIndex
            let obj = i.object;
            while (obj) {
                if (obj.userData && obj.userData.furnitureIndex !== undefined) {
                    hit = obj; break;
                }
                obj = obj.parent;
            }
            if (hit) break;
        }
        
        if (hit) {
            // Deselect previous
            if (this.selectedObject && this.selectedObject !== hit) {
                this._setHighlight(this.selectedObject, false);
            }
            
            // Select new object
            this.selectedObject = hit;
            this.selectedIndex = hit.userData.furnitureIndex;
            this._setHighlight(hit, true);
            document.getElementById('rotationPanel').style.display = 'flex';
            this._updateAngleDisplay();            this._updateSelectedObjectName();            
            // Setup for potential dragging
            this.setupDragOperation(hit, intersects[0].point);
            
            console.log(`🎯 Selected: "${this.layoutData.furniture[this.selectedIndex]?.name}"`);
        } else {
            // Deselect all
            if (this.selectedObject) {
                this._setHighlight(this.selectedObject, false);
            }
            this.selectedObject = null;
            this.selectedIndex = -1;
            document.getElementById('rotationPanel').style.display = 'none';
            this._updateSelectedObjectName();
        }
    }
    
    setupDragOperation(object, intersectionPoint) {
        // Calculate drag offset relative to the object origin
        this.dragOffset.copy(intersectionPoint).sub(object.position);
        
        // INDUSTRY STANDARD: Create drag plane through the exact intersection point
        // to prevent parallax shifting and erratic Z/Y values when the camera angle is shallow.
        this.dragPlane.setFromNormalAndCoplanarPoint(
            new THREE.Vector3(0, 1, 0),
            intersectionPoint
        );
        
        // Create visual helper for movement
        this.createMoveHelper(object.position);
    }
    
    onMouseMove(event) {
        // Only drag if the mouse is explicitly held down and we have a selection
        if (!this.selectedObject || !this.isMouseDown) return;
        
        this._isDragging = true;
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        
        this.raycaster.setFromCamera(mouse, this.camera);
        
        // Calculate new position based on drag plane intersection
        if (this.raycaster.ray.intersectPlane(this.dragPlane, this.dragIntersection)) {
            const newPosition = this.dragIntersection.clone().sub(this.dragOffset);
            
            // Apply boundary constraints and object-specific snapping rules
            const room = this.layoutData.roomData;
            const halfWidth = room.width / 2;
            const halfLength = room.length / 2;
            
            const itemName = this.layoutData.furniture[this.selectedIndex]?.name || '';
            const isWallArt = this._isWallArt(itemName);
            
            let finalX = newPosition.x;
            let finalY = newPosition.y;
            let finalZ = newPosition.z;
            let finalRotY = this.selectedObject.rotation.y;

            if (isWallArt) {
                // Completely take over math for Wall Art to ensure it glues to the nearest vertical surface
                const wp = this._getWallPlacement(newPosition.x, newPosition.z);
                finalX = wp.x;
                finalY = wp.y;
                finalZ = wp.z;
                finalRotY = wp.rotY;
            } else {
                // For floor and decor items, dynamically constrain them inside the room walls
                const currentBox = new THREE.Box3().setFromObject(this.selectedObject);
                const size = new THREE.Vector3();
                currentBox.getSize(size);
                
                const padding = 0.05; // Prevent z-fighting with walls
                const extentX = (size.x / 2) + padding;
                const extentZ = (size.z / 2) + padding;
                
                finalX = Math.max(-halfWidth + extentX, Math.min(halfWidth - extentX, newPosition.x));
                finalZ = Math.max(-halfLength + extentZ, Math.min(halfLength - extentZ, newPosition.z));
                
                finalY = this.calculateSnappedHeight(finalX, finalZ, itemName, this.selectedObject);
            }
            
            // Add subtle visual feedback when snapping occurs
            if (Math.abs(this.selectedObject.position.y - finalY) > 0.1) {
                console.log(`✨ Surface snap: ${this.selectedObject.position.y.toFixed(2)}m → ${finalY.toFixed(2)}m`);
            }
            
            // Update object position with snapping
            this.selectedObject.position.set(finalX, finalY, finalZ);
            if (isWallArt) {
                this.selectedObject.rotation.y = finalRotY;
            }
            
            if (this.highlightHelper && this.highlightHelper.visible) {
                this.highlightHelper.update();
            }
            
            // Update move helper
            if (this.moveHelper) {
                this.moveHelper.position.copy(this.selectedObject.position);
                this.moveHelper.position.y += 0.05; // Slightly above object
            }
            
            this.isDraggingObject = true;
            
            // Disable orbit controls during drag
            this.controls.enabled = false;
        }
    }
    
    onMouseUp(event) {
        if (event.button !== 0 && event.type !== 'mouseleave') return;
        this.isMouseDown = false;

        if (this.isDraggingObject && this.selectedObject) {
            // Finalize move operation
            this.finalizeMoveOperation();
            console.log(`🎯 Moved "${this.layoutData.furniture[this.selectedIndex]?.name}" to new position`);
        }
        
        // Re-enable orbit controls
        this.controls.enabled = true;
        this.isDraggingObject = false;
        this._isDragging = false;
        
        // Remove move helper
        this.removeMoveHelper();
    }
    
    calculateSnappedHeight(x, z, itemName, object) {
        // Get bounding box for proper height calculation
        const box = new THREE.Box3().setFromObject(object);
        const localMinY = box.min.y - object.position.y;
        
        if (this._isWallArt(itemName)) {
            const wp = this._getWallPlacement(x, z);
            return wp.y;
        } else if (this._isTableTopDecor(itemName)) {
            const surfaceY = this._findSurfaceHeightBelow(x, z);
            return surfaceY - localMinY; // Place bottom of object on surface
        } else {
            return -localMinY; // Place on floor
        }
    }
    
    createMoveHelper(position) {
        // Create a subtle visual indicator for movement
        const geometry = new THREE.RingGeometry(0.2, 0.25, 16);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff88,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        
        this.moveHelper = new THREE.Mesh(geometry, material);
        this.moveHelper.position.copy(position);
        this.moveHelper.position.y += 0.05;
        this.moveHelper.rotation.x = -Math.PI / 2; // Lay flat
        
        this.scene.add(this.moveHelper);
    }
    
    removeMoveHelper() {
        if (this.moveHelper) {
            this.scene.remove(this.moveHelper);
            this.moveHelper.geometry.dispose();
            this.moveHelper.material.dispose();
            this.moveHelper = null;
        }
    }
    
    finalizeMoveOperation() {
        if (!this.selectedObject || this.selectedIndex === -1) return;
        
        // Update the furniture data with new position
        const furniture = this.layoutData.furniture[this.selectedIndex];
        const newPos = this.selectedObject.position;
        
        // Convert 3D position back to 2D editor coordinates
        const roomWidthPx = this.layoutData.roomData.width * 80;
        const roomLengthPx = this.layoutData.roomData.length * 80;
        
        const relativeX = newPos.x / this.pixelToMeterRatio;
        const relativeY = newPos.z / this.pixelToMeterRatio;
        
        const centreRelativeXPx = relativeX + (roomWidthPx / 2);
        const centreRelativeYPx = relativeY + (roomLengthPx / 2);
        
        // Update furniture position (the 2D editor uses object center relative to top-left of room)
        furniture.x = centreRelativeXPx;
        furniture.y = centreRelativeYPx;
        
        // Ensure rotation is synced (especially important for Wall Art that auto-rotates to face normal)
        furniture.rotation = -Math.round(THREE.MathUtils.radToDeg(this.selectedObject.rotation.y));
        
        // V3 PERSISTENCE: Save exact fractional 3D coordinates so the 3D Viewer doesn't have to recalculate heights next load
        furniture.v3Position = { x: newPos.x, y: newPos.y, z: newPos.z };
        furniture.v3Rotation = this.selectedObject.rotation.y;
        
        // Update session storage so 2D editor stays in sync
        this.layoutData.furnitureItems = this.layoutData.furniture;
        sessionStorage.setItem('current3DLayout', JSON.stringify(this.layoutData));
        
        console.log(`💾 Updated furniture position: (${furniture.x.toFixed(1)}, ${furniture.y.toFixed(1)})`);
    }
    
    setupRotationButtons() {
        // Rotation buttons
        document.getElementById('rotateLeftBtn')?.addEventListener('click', () => this.rotateSelected(+15));
        document.getElementById('rotateRightBtn')?.addEventListener('click', () => this.rotateSelected(-15));
    }
    
    _updateSelectedObjectName() {
        const nameElement = document.getElementById('selectedObjectName');
        if (nameElement) {
            if (this.selectedObject && this.selectedIndex >= 0) {
                const furniture = this.layoutData.furniture[this.selectedIndex];
                nameElement.textContent = furniture?.name || 'Unknown Object';
            } else {
                nameElement.textContent = 'No object selected';
            }
        }
    }
    
    updateCursor(event) {
        // Don't change cursor while dragging
        if (this.isDraggingObject) return;
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        
        this.raycaster.setFromCamera(mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        let hovering = false;
        for (const i of intersects) {
            let obj = i.object;
            while (obj) {
                if (obj.userData && obj.userData.furnitureIndex !== undefined) {
                    hovering = true;
                    break;
                }
                obj = obj.parent;
            }
            if (hovering) break;
        }
        
        // Update cursor based on hover state
        this.renderer.domElement.style.cursor = hovering ? 'move' : 'default';
    }

    _setHighlight(obj, on) {
        if (!this.highlightHelper) {
            this.highlightHelper = new THREE.BoxHelper(new THREE.Mesh(), 0xff6600);
            this.highlightHelper.material.depthTest = false;
            this.scene.add(this.highlightHelper);
        }
        
        if (on && obj) {
            this.highlightHelper.setFromObject(obj);
            this.highlightHelper.visible = true;
        } else {
            this.highlightHelper.visible = false;
        }
    }

    rotateSelected(deltaDeg) {
        if (!this.selectedObject) return;

        const deltaRad = THREE.MathUtils.degToRad(deltaDeg);
        this.selectedObject.rotation.y += deltaRad;

        if (this.highlightHelper && this.highlightHelper.visible) {
            this.highlightHelper.update();
        }

        // Accumulate delta for sessionStorage sync
        const idx = this.selectedIndex;
        if (this.pendingRotations[idx] === undefined) {
            this.pendingRotations[idx] = 0;
        }
        this.pendingRotations[idx] += deltaDeg;

        this._updateAngleDisplay();

        // Sync back to the sessionStorage layout so "Back to 2D" sees the updated rotation
        this._syncRotationToLayout(idx);
        
        // Finalize state to save the rotation in case the user navigates away
        this.finalizeMoveOperation();
    }

    _updateAngleDisplay() {
        const el = document.getElementById('rotationAngle');
        if (!el || !this.selectedObject) return;
        const deg = Math.round(THREE.MathUtils.radToDeg(this.selectedObject.rotation.y));
        el.textContent = `${deg}°`;
    }

    _syncRotationToLayout(index) {
        if (!this.layoutData || !this.layoutData.furniture[index]) return;
        // Convert Three.js radians back to Konva degrees (opposite sign)
        const rotDeg = -Math.round(THREE.MathUtils.radToDeg(this.selectedObject.rotation.y));
        this.layoutData.furniture[index].rotation = rotDeg;
        sessionStorage.setItem('current3DLayout', JSON.stringify(this.layoutData));
    }
    // ───────────────────────────────────────────────────────────────────────


    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        // Adjust shadow properties
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.left = -10;
        dirLight.shadow.camera.right = 10;
        dirLight.shadow.camera.top = 10;
        dirLight.shadow.camera.bottom = -10;
        this.scene.add(dirLight);
    }

    onWindowResize() {
        if (!this.camera || !this.renderer) return;
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        if (this.controls) this.controls.update();
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new Room3DVisualizer();
});
