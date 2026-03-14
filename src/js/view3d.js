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

        // Phase 5: surface snapping — furniture items that expose a top surface
        // (tables, desks…) register themselves here so decor can snap on top.
        this.surfaceMeshes = [];

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
        this.setupSelectionAndRotation();  // Phase 4
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

    // ── Phase 5: Surface-snapping helpers ────────────────────────────────────

    /** Small decor that should rest on top of a table / desk / shelf surface. */
    _isTableTopDecor(name) {
        const kw = ['vase', 'clock', 'alarm', 'chess', 'candle', 'figurine',
                    'bowl', 'plant', 'lamp'];
        return kw.some(k => name.toLowerCase().includes(k));
    }

    /** Wall art items that snap onto a wall face instead of the floor. */
    _isWallArt(name) {
        const kw = ['painting', 'frame', 'artwork', 'picture', 'poster',
                    'canvas', 'mirror'];
        return kw.some(k => name.toLowerCase().includes(k));
    }

    /** Items that have a placeable top surface (tables, desks, cabinets…). */
    _isSurfaceItem(name) {
        const kw = ['table', 'desk', 'shelf', 'counter', 'cabinet',
                    'dresser', 'sideboard', 'tv unit'];
        return kw.some(k => name.toLowerCase().includes(k));
    }

    /**
     * Casts a ray straight down from above (x3D, z3D) and returns the Y of
     * the highest registered surface hit, or 0 (floor) when nothing is below.
     */
    _findSurfaceHeightBelow(x3D, z3D) {
        if (this.surfaceMeshes.length === 0) return 0;
        const ray = new THREE.Raycaster(
            new THREE.Vector3(x3D, 20, z3D),
            new THREE.Vector3(0, -1, 0)
        );
        const hits = ray.intersectObjects(this.surfaceMeshes, true);
        return hits.length > 0 ? hits[0].point.y : 0;
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

        if (minD === dBack)  return { x: x3D,          y: hangY, z: -hl + off,  rotY: 0 };
        if (minD === dFront) return { x: x3D,          y: hangY, z:  hl - off,  rotY: Math.PI };
        if (minD === dLeft)  return { x: -hw + off,    y: hangY, z: z3D,        rotY:  Math.PI / 2 };
                             return { x:  hw - off,    y: hangY, z: z3D,        rotY: -Math.PI / 2 };
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
        if (!furnitureItems || furnitureItems.length === 0) return;

        const roomWidthPx = this.layoutData.roomData.width * 80;
        const roomLengthPx = this.layoutData.roomData.length * 80;

        // Two-phase placement: surface items (tables, desks…) are built first so
        // their meshes are registered in this.surfaceMeshes before decor items
        // need to raycast against them.
        const phaseA = [], phaseB = [];
        furnitureItems.forEach((item, index) => {
            const isDecor = this._isTableTopDecor(item.name) || this._isWallArt(item.name);
            (isDecor ? phaseB : phaseA).push({ item, index });
        });

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

                            // Apply surface snapping based on item type
                            const scaledBox = new THREE.Box3().setFromObject(modelRoot);
                            if (this._isWallArt(item.name)) {
                                const wp = this._getWallPlacement(x3D, z3D);
                                modelRoot.position.set(wp.x, wp.y, wp.z);
                                modelRoot.rotation.y = wp.rotY;
                            } else if (this._isTableTopDecor(item.name)) {
                                const surfaceY = this._findSurfaceHeightBelow(x3D, z3D);
                                modelRoot.position.set(x3D, surfaceY + (-scaledBox.min.y), z3D);
                                modelRoot.rotation.y = rotationY;
                            } else {
                                // Default: sit the model exactly on the floor.
                                modelRoot.position.set(x3D, -scaledBox.min.y, z3D);
                                modelRoot.rotation.y = rotationY;
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
        await Promise.all(phaseB.map(buildOne));
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
        // Apply surface snapping
        if (this._isWallArt(item.name)) {
            const wp = this._getWallPlacement(x3D, z3D);
            mesh.position.set(wp.x, wp.y, wp.z);
            mesh.rotation.y = wp.rotY;
        } else if (this._isTableTopDecor(item.name)) {
            const surfaceY = this._findSurfaceHeightBelow(x3D, z3D);
            mesh.position.set(x3D, surfaceY + hMeters / 2, z3D);
            mesh.rotation.y = rotationY;
        } else {
            mesh.position.set(x3D, hMeters / 2, z3D);
            mesh.rotation.y = rotationY;
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
        }
    }

    // ── Phase 4: Selection & Rotation ──────────────────────────────────────
    setupSelectionAndRotation() {
        // Click to select furniture
        this.renderer.domElement.addEventListener('click', (event) => {
            // Only process if OrbitControls did not consume a drag click
            if (this.controls.enabled && this._isDragging) return;

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

            // Deselect previous
            if (this.selectedObject) {
                this._setHighlight(this.selectedObject, false);
            }

            if (hit) {
                this.selectedObject = hit;
                this.selectedIndex = hit.userData.furnitureIndex;
                this._setHighlight(hit, true);
                document.getElementById('rotationPanel').style.display = 'flex';
                this._updateAngleDisplay();
            } else {
                this.selectedObject = null;
                this.selectedIndex = -1;
                document.getElementById('rotationPanel').style.display = 'none';
            }
        });

        // Track drag start to avoid treating drags as clicks
        this._isDragging = false;
        this.renderer.domElement.addEventListener('mousedown', () => { this._isDragging = false; });
        this.renderer.domElement.addEventListener('mousemove', () => { this._isDragging = true; });

        // Rotation buttons
        document.getElementById('rotateLeftBtn')?.addEventListener('click', () => this.rotateSelected(+15));
        document.getElementById('rotateRightBtn')?.addEventListener('click', () => this.rotateSelected(-15));
    }

    _setHighlight(obj, on) {
        obj.traverse(child => {
            if (child.isMesh && child.material) {
                if (on) {
                    child.userData.savedEmissive = child.material.emissive?.clone();
                    if (child.material.emissive) child.material.emissive.set(0xff6600);
                } else {
                    if (child.material.emissive && child.userData.savedEmissive) {
                        child.material.emissive.copy(child.userData.savedEmissive);
                    }
                }
            }
        });
    }

    rotateSelected(deltaDeg) {
        if (!this.selectedObject) return;

        const deltaRad = THREE.MathUtils.degToRad(deltaDeg);
        this.selectedObject.rotation.y += deltaRad;

        // Accumulate delta for sessionStorage sync
        const idx = this.selectedIndex;
        if (this.pendingRotations[idx] === undefined) {
            this.pendingRotations[idx] = 0;
        }
        this.pendingRotations[idx] += deltaDeg;

        this._updateAngleDisplay();

        // Sync back to the sessionStorage layout so "Back to 2D" sees the updated rotation
        this._syncRotationToLayout(idx);
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
