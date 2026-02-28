import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class Room3DVisualizer {
    constructor() {
        this.container = document.getElementById('three-container');
        this.overlay = document.getElementById('transitionOverlay');
        this.layoutData = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;

        // Konva uses pixels, Three.js uses abstract units (let's say 1 unit = 1 meter)
        // We know from 2D editor: this.scale = 80 pixels per meter.
        this.pixelToMeterRatio = 1 / 80;

        this.init();
    }

    init() {
        this.loadData();
        if (!this.layoutData) return;

        this.setupScene();
        this.buildRoom();
        this.buildFurniture();
        this.setupLighting();

        this.animate();

        // Simulate short loading time to ensure textures/materials are ready, then hide overlay
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

    buildFurniture() {
        const furnitureItems = this.layoutData.furniture;
        if (!furnitureItems || furnitureItems.length === 0) return;

        const roomWidthPx = this.layoutData.roomData.width * 80;
        const roomLengthPx = this.layoutData.roomData.length * 80;

        // In 2D, the room origin (top-left) in Konva coordinates is:
        const roomTopLeftX = (window.innerWidth - 100 - roomWidthPx) / 2;
        const roomTopLeftY = (window.innerHeight - 160 - roomLengthPx) / 2;

        furnitureItems.forEach((item, index) => {
            // Calculate width and depth in meters based on original image size and scale
            // The item.originalWidth is pixels.
            const wMeters = (item.originalWidth * item.scaleX) * this.pixelToMeterRatio;
            const dMeters = (item.originalHeight * item.scaleY) * this.pixelToMeterRatio;
            const hMeters = 0.8; // Arbitrary height for placeholder

            // Map 2D coordinates to 3D
            // Konva (X, Y) relative to center of the room:
            const relativeX = item.x - roomTopLeftX - (roomWidthPx / 2);
            const relativeY = item.y - roomTopLeftY - (roomLengthPx / 2);

            const x3D = relativeX * this.pixelToMeterRatio;
            const z3D = relativeY * this.pixelToMeterRatio;
            const y3D = hMeters / 2; // Sit on the floor

            // Placeholder Geometry
            const geo = new THREE.BoxGeometry(wMeters, hMeters, dMeters);

            // Generate a random distinct color for each furniture box, or use a brand color
            const colorHue = (index * 137.5) % 360;
            const mat = new THREE.MeshStandardMaterial({
                color: new THREE.Color(`hsl(${colorHue}, 70%, 50%)`),
                roughness: 0.2,
                metalness: 0.1
            });

            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x3D, y3D, z3D);

            // Konva rotation is clockwise degrees. Three.js is radians.
            // Konva rotates around Z axis (2D plane), which corresponds to Y axis in 3D
            mesh.rotation.y = -THREE.MathUtils.degToRad(item.rotation);

            mesh.castShadow = true;
            mesh.receiveShadow = true;

            this.scene.add(mesh);
        });
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
