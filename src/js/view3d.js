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

        // Konva uses pixels, Three.js uses abstract units.
        // The 2D editor uses scale = 80 pixels per meter.
        this.pixelToMeterRatio = 1 / 80;

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

        const roomWidthPx  = this.layoutData.roomData.width  * 80;
        const roomLengthPx = this.layoutData.roomData.length * 80;

        // ---------------------------------------------------------------
        // BUG FIX: use the room origin that was recorded in the 2D editor
        // (this.roomGroup.x / y at transition time) instead of recalculating
        // from window dimensions on the 3D page, which are always different.
        // ---------------------------------------------------------------
        const roomTopLeftX = this.layoutData.canvasRoomOriginX;
        const roomTopLeftY = this.layoutData.canvasRoomOriginY;

        const promises = furnitureItems.map((item, index) =>
            new Promise((resolve) => {
                // ---------------------------------------------------------------
                // PLACEMENT FIX:
                // item.x / item.y is the Konva GROUP's top-left corner (the group
                // was placed at x - displayWidth/2, y - displayHeight/2 so its
                // visual centre sat at the drop point).
                //
                // The 3D world uses the CENTRE of an object as its position, so
                // we must add half the displayed size (in stage pixels, including
                // the group's own scaleX/scaleY) to get the true centre, then
                // convert to metres.
                //
                // displayWidth/displayHeight = the Konva image's canvas size
                // (clamped to 120 px) — NOT originalWidth/originalHeight which
                // are the raw image pixel dimensions and are far too large.
                // ---------------------------------------------------------------
                const displayW = item.displayWidth  || item.originalWidth;
                const displayH = item.displayHeight || item.originalHeight;

                // Actual displayed size in metres (used for placeholder box & 3D model scaling)
                const wMeters = displayW * item.scaleX * this.pixelToMeterRatio;
                const dMeters = displayH * item.scaleY * this.pixelToMeterRatio;
                const hMeters = 0.8;

                // Centre of the furniture in stage coordinates
                const centreStagePx = {
                    x: item.x + (displayW * item.scaleX) / 2,
                    y: item.y + (displayH * item.scaleY) / 2,
                };

                // Convert to room-relative coordinates then to metres
                const relativeX = centreStagePx.x - roomTopLeftX - (roomWidthPx  / 2);
                const relativeY = centreStagePx.y - roomTopLeftY - (roomLengthPx / 2);

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
                                const targetW = model3D.widthM  || wMeters;
                                const targetH = model3D.heightM || hMeters;
                                const targetD = model3D.depthM  || dMeters;
                                modelRoot.scale.set(
                                    targetW / size.x,
                                    targetH / size.y,
                                    targetD / size.z
                                );
                            }

                            // Sit the model exactly on the floor.
                            // Re-compute the bounding box after scaling and offset by -min.y
                            // so the lowest vertex of the mesh is at y=0, regardless of
                            // where the model's internal pivot/origin sits.
                            const scaledBox = new THREE.Box3().setFromObject(modelRoot);
                            modelRoot.position.set(x3D, -scaledBox.min.y, z3D);
                            modelRoot.rotation.y = rotationY;

                            modelRoot.traverse(child => {
                                if (child.isMesh) {
                                    child.castShadow = true;
                                    child.receiveShadow = true;
                                }
                            });

                            this.scene.add(modelRoot);
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
            })
        );

        await Promise.all(promises);
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
        mesh.position.set(x3D, hMeters / 2, z3D);
        mesh.rotation.y = rotationY;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
    }

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
