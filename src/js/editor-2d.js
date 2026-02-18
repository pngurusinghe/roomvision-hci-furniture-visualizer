/**
 * RoomVision 2D Editor - Professional Floor Plan Style
 * Creates architectural-style 2D floor plans with proper furniture symbols
 */

import { showError, showSuccess, showWarning, showLoading, hideLoading } from './ui-feedback.js';

// ============================================
// FURNITURE SYMBOLS CONFIGURATION
// ============================================

const FURNITURE_SYMBOLS = {
    sofa: {
        draw: (ctx, width, height) => {
            ctx.fillStyle = '#D3D3D3';
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.fillRect(0, 0, width, height);
            ctx.strokeRect(0, 0, width, height);
            const cushionCount = 3;
            const cushionWidth = width / cushionCount;
            for (let i = 0; i < cushionCount; i++) {
                ctx.strokeRect(i * cushionWidth + 5, 5, cushionWidth - 10, height - 10);
            }
            ctx.fillStyle = '#B8B8B8';
            ctx.fillRect(0, 0, 8, height);
            ctx.fillRect(width - 8, 0, 8, height);
        }
    },
    bed: {
        draw: (ctx, width, height) => {
            ctx.fillStyle = '#E8E8E8';
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.fillRect(0, height * 0.15, width, height * 0.85);
            ctx.strokeRect(0, height * 0.15, width, height * 0.85);
            ctx.fillStyle = '#C0C0C0';
            ctx.fillRect(0, 0, width, height * 0.15);
            ctx.strokeRect(0, 0, width, height * 0.15);
            const pillowWidth = width * 0.4;
            const pillowHeight = height * 0.2;
            const pillowY = height * 0.2;
            ctx.fillStyle = '#FFF';
            ctx.fillRect(width * 0.05, pillowY, pillowWidth, pillowHeight);
            ctx.strokeRect(width * 0.05, pillowY, pillowWidth, pillowHeight);
            ctx.fillRect(width * 0.55, pillowY, pillowWidth, pillowHeight);
            ctx.strokeRect(width * 0.55, pillowY, pillowWidth, pillowHeight);
        }
    },
    table: {
        draw: (ctx, width, height) => {
            ctx.fillStyle = '#C8A882';
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.fillRect(0, 0, width, height);
            ctx.strokeRect(0, 0, width, height);
            const legRadius = 4;
            const inset = 8;
            ctx.fillStyle = '#8B7355';
            ctx.beginPath();
            ctx.arc(inset, inset, legRadius, 0, 2 * Math.PI);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(width - inset, inset, legRadius, 0, 2 * Math.PI);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(inset, height - inset, legRadius, 0, 2 * Math.PI);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(width - inset, height - inset, legRadius, 0, 2 * Math.PI);
            ctx.fill();
        }
    },
    chair: {
        draw: (ctx, width, height) => {
            ctx.fillStyle = '#E0E0E0';
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.fillRect(width * 0.1, height * 0.3, width * 0.8, height * 0.5);
            ctx.strokeRect(width * 0.1, height * 0.3, width * 0.8, height * 0.5);
            ctx.fillRect(width * 0.1, 0, width * 0.8, height * 0.3);
            ctx.strokeRect(width * 0.1, 0, width * 0.8, height * 0.3);
        }
    },
    wardrobe: {
        draw: (ctx, width, height) => {
            ctx.fillStyle = '#DEB887';
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.fillRect(0, 0, width, height);
            ctx.strokeRect(0, 0, width, height);
            ctx.beginPath();
            ctx.moveTo(width / 2, 0);
            ctx.lineTo(width / 2, height);
            ctx.stroke();
            const handleY = height / 2;
            ctx.fillStyle = '#666';
            ctx.fillRect(width / 2 - 15, handleY - 2, 8, 4);
            ctx.fillRect(width / 2 + 7, handleY - 2, 8, 4);
        }
    },
    desk: {
        draw: (ctx, width, height) => {
            ctx.fillStyle = '#D2B48C';
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.fillRect(0, 0, width, height);
            ctx.strokeRect(0, 0, width, height);
            const drawerWidth = width * 0.3;
            const drawerHeight = height / 3;
            for (let i = 0; i < 3; i++) {
                const y = i * drawerHeight;
                ctx.strokeRect(width - drawerWidth, y, drawerWidth, drawerHeight);
                ctx.fillStyle = '#666';
                ctx.fillRect(width - drawerWidth / 2 - 8, y + drawerHeight / 2 - 2, 16, 4);
                ctx.fillStyle = '#D2B48C';
            }
        }
    },
    plant: {
        draw: (ctx, width, height) => {
            ctx.fillStyle = '#8B4513';
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            const potHeight = height * 0.4;
            ctx.fillRect(width * 0.2, height - potHeight, width * 0.6, potHeight);
            ctx.strokeRect(width * 0.2, height - potHeight, width * 0.6, potHeight);
            ctx.fillStyle = '#228B22';
            ctx.beginPath();
            ctx.arc(width / 2, height * 0.4, width * 0.4, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#32CD32';
            for (let i = 0; i < 5; i++) {
                const angle = (i / 5) * 2 * Math.PI;
                const x = width / 2 + Math.cos(angle) * width * 0.25;
                const y = height * 0.4 + Math.sin(angle) * width * 0.25;
                ctx.beginPath();
                ctx.arc(x, y, width * 0.15, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
    },
    rug: {
        draw: (ctx, width, height) => {
            ctx.fillStyle = '#BC8F8F';
            ctx.strokeStyle = '#8B4513';
            ctx.lineWidth = 2;
            ctx.fillRect(0, 0, width, height);
            ctx.strokeRect(0, 0, width, height);
            ctx.strokeStyle = '#A0522D';
            ctx.strokeRect(10, 10, width - 20, height - 20);
            ctx.strokeRect(15, 15, width - 30, height - 30);
            ctx.strokeStyle = '#8B7355';
            ctx.lineWidth = 1;
            for (let i = 0; i < width; i += 20) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, -5);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(i, height);
                ctx.lineTo(i, height + 5);
                ctx.stroke();
            }
        }
    },
    tv: {
        draw: (ctx, width, height) => {
            ctx.fillStyle = '#696969';
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.fillRect(0, height * 0.6, width, height * 0.4);
            ctx.strokeRect(0, height * 0.6, width, height * 0.4);
            ctx.fillStyle = '#1C1C1C';
            ctx.fillRect(width * 0.1, 0, width * 0.8, height * 0.6);
            ctx.strokeRect(width * 0.1, 0, width * 0.8, height * 0.6);
            ctx.fillStyle = '#333';
            ctx.fillRect(width * 0.15, height * 0.05, width * 0.3, height * 0.2);
        }
    },
    bookshelf: {
        draw: (ctx, width, height) => {
            ctx.fillStyle = '#8B4513';
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.fillRect(0, 0, width, height);
            ctx.strokeRect(0, 0, width, height);
            const shelfCount = 5;
            const shelfHeight = height / shelfCount;
            for (let i = 1; i < shelfCount; i++) {
                ctx.beginPath();
                ctx.moveTo(0, i * shelfHeight);
                ctx.lineTo(width, i * shelfHeight);
                ctx.stroke();
            }
            const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];
            for (let shelf = 0; shelf < shelfCount; shelf++) {
                let x = 5;
                const y = shelf * shelfHeight + 5;
                const bookHeight = shelfHeight - 10;
                for (let book = 0; book < 4; book++) {
                    const bookWidth = 10 + Math.random() * 15;
                    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
                    ctx.fillRect(x, y, bookWidth, bookHeight);
                    ctx.strokeRect(x, y, bookWidth, bookHeight);
                    x += bookWidth + 2;
                }
            }
        }
    },
    'dining-table': {
        draw: (ctx, width, height) => {
            ctx.fillStyle = '#8B4513';
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = '#654321';
            ctx.beginPath();
            ctx.ellipse(width / 2, height / 2, width / 2 - 10, height / 2 - 10, 0, 0, 2 * Math.PI);
            ctx.stroke();
        }
    },
    'round-table': {
        draw: (ctx, width, height) => {
            const radius = Math.min(width, height) / 2;
            const centerX = width / 2;
            const centerY = height / 2;
            ctx.fillStyle = '#C8A882';
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = '#A0826D';
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius - 8, 0, 2 * Math.PI);
            ctx.stroke();
        }
    }
};

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
        this.baseScale = 80;
        this.scale = this.baseScale;
        this.init();
    }
    
    async init() {
        this.loadRoomData();
        if (!this.roomData) {
            return;
        }
        this.setupCanvas();
        this.drawRoom();
        
        // 👇 LOAD FURNITURE FROM CART HERE
        await this.loadFurnitureFromCart();
        
        this.setupDragAndDrop();
        this.setupViewButtons();
        this.setupZoomControls();
        this.setupSaveButton();
        this.setupDeleteButton();
        this.setupCanvasPanning();
        this.loadSavedLayout();
        this.displayRoomInfo();
        
        setTimeout(() => {
            const instructions = document.getElementById('instructions');
            if (instructions) {
                instructions.classList.add('hidden');
            }
        }, 5000);
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
            borderStroke: '#4CAF50',
            borderStrokeWidth: 2,
            anchorStroke: '#4CAF50',
            anchorFill: '#fff',
            anchorSize: 8,
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
        const floor = new Konva.Rect({
            x: 0,
            y: 0,
            width: roomWidthPx,
            height: roomLengthPx,
            fill: '#FAFAFA',
            stroke: '#000',
            strokeWidth: 3
        });
        this.roomGroup.add(floor);
        const wallThickness = 12;
        const topWall = new Konva.Rect({
            x: -wallThickness / 2,
            y: -wallThickness / 2,
            width: roomWidthPx + wallThickness,
            height: wallThickness,
            fill: '#2C2C2C'
        });
        this.roomGroup.add(topWall);
        const bottomWall = new Konva.Rect({
            x: -wallThickness / 2,
            y: roomLengthPx - wallThickness / 2,
            width: roomWidthPx + wallThickness,
            height: wallThickness,
            fill: '#2C2C2C'
        });
        this.roomGroup.add(bottomWall);
        const leftWall = new Konva.Rect({
            x: -wallThickness / 2,
            y: -wallThickness / 2,
            width: wallThickness,
            height: roomLengthPx + wallThickness,
            fill: '#2C2C2C'
        });
        this.roomGroup.add(leftWall);
        const rightWall = new Konva.Rect({
            x: roomWidthPx - wallThickness / 2,
            y: -wallThickness / 2,
            width: wallThickness,
            height: roomLengthPx + wallThickness,
            fill: '#2C2C2C'
        });
        this.roomGroup.add(rightWall);
        this.drawArchitecturalGrid(roomWidthPx, roomLengthPx);
        this.addDimensionLabels(roomWidthPx, roomLengthPx);
        this.layer.add(this.roomGroup);
        this.layer.batchDraw();
    }
    
    drawArchitecturalGrid(width, height) {
        const gridSize = this.scale;
        const gridColor = '#E0E0E0';
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
        const fontSize = 12;
        const offset = 25;
        const topDimText = new Konva.Text({
            x: width / 2 - 30,
            y: -offset,
            text: `${this.roomData.width}m`,
            fontSize: fontSize,
            fontFamily: 'Arial',
            fill: '#333',
            fontStyle: 'bold'
        });
        this.roomGroup.add(topDimText);
        const leftDimText = new Konva.Text({
            x: -offset - 20,
            y: height / 2 - 10,
            text: `${this.roomData.length}m`,
            fontSize: fontSize,
            fontFamily: 'Arial',
            fill: '#333',
            fontStyle: 'bold',
            rotation: -90
        });
        this.roomGroup.add(leftDimText);
    }
    
    setupDragAndDrop() {
        const furnitureItems = document.querySelectorAll('.furniture-item');
        const canvasArea = document.getElementById('canvasArea');
        furnitureItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                item.classList.add('dragging');
                const furnitureType = item.dataset.furniture;
                const width = parseFloat(item.dataset.width);
                const height = parseFloat(item.dataset.height);
                e.dataTransfer.setData('furnitureType', furnitureType);
                e.dataTransfer.setData('furnitureWidth', width);
                e.dataTransfer.setData('furnitureHeight', height);
                e.dataTransfer.effectAllowed = 'copy';
            });
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
            });
        });
        canvasArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });
        canvasArea.addEventListener('drop', (e) => {
            e.preventDefault();
            const furnitureType = e.dataTransfer.getData('furnitureType');
            const furnitureWidth = parseFloat(e.dataTransfer.getData('furnitureWidth'));
            const furnitureHeight = parseFloat(e.dataTransfer.getData('furnitureHeight'));
            const stageBox = this.stage.container().getBoundingClientRect();
            const dropX = (e.clientX - stageBox.left) / this.currentZoom;
            const dropY = (e.clientY - stageBox.top) / this.currentZoom;
            this.addFurniture(furnitureType, dropX, dropY, furnitureWidth, furnitureHeight);
        });
    }
    
    createFurnitureShape(type, widthPx, heightPx) {
        const canvas = document.createElement('canvas');
        canvas.width = widthPx;
        canvas.height = heightPx;
        const ctx = canvas.getContext('2d');
        const symbol = FURNITURE_SYMBOLS[type] || FURNITURE_SYMBOLS['table'];
        symbol.draw(ctx, widthPx, heightPx);
        return canvas;
    }
    
    addFurniture(type, x, y, widthM, heightM) {
        const widthPx = widthM * this.scale;
        const heightPx = heightM * this.scale;
        const furnitureCanvas = this.createFurnitureShape(type, widthPx, heightPx);
        const furnitureImage = new Konva.Image({
            x: 0,
            y: 0,
            image: furnitureCanvas,
            width: widthPx,
            height: heightPx,
            name: 'furniture'
        });
        furnitureImage.setAttr('furnitureType', type);
        furnitureImage.setAttr('widthM', widthM);
        furnitureImage.setAttr('heightM', heightM);
        const label = new Konva.Text({
            x: 0,
            y: heightPx + 5,
            width: widthPx,
            text: type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' '),
            fontSize: 10,
            fontFamily: 'Arial',
            fill: '#666',
            align: 'center'
        });
        const group = new Konva.Group({
            x: x - widthPx / 2,
            y: y - heightPx / 2,
            draggable: true
        });
        group.add(furnitureImage);
        group.add(label);
        this.setupFurnitureInteractions(group, furnitureImage);
        this.furnitureLayer.add(group);
        this.furnitureLayer.batchDraw();
        this.selectFurniture(group);
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
                if (view !== 'top') {
                    showWarning('Architectural floor plans use top view only');
                    setTimeout(() => {
                        document.querySelector('[data-view="top"]').click();
                    }, 1500);
                }
            });
        });
    }
    
    setupSaveButton() {
        const saveBtn = document.getElementById('saveBtn');
        saveBtn.addEventListener('click', () => this.saveLayout());
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
    
    saveLayout() {
        const roomId = sessionStorage.getItem('currentRoomId');
        const furniture = [];
        this.furnitureLayer.getChildren().forEach(node => {
            if (node === this.transformer) return;
            const furnitureNode = node.findOne('.furniture');
            if (!furnitureNode) return;
            furniture.push({
                type: furnitureNode.getAttr('furnitureType'),
                x: node.x(),
                y: node.y(),
                rotation: node.rotation(),
                scaleX: node.scaleX(),
                scaleY: node.scaleY(),
                widthM: furnitureNode.getAttr('widthM'),
                heightM: furnitureNode.getAttr('heightM')
            });
        });
        const layoutData = {
            roomId: roomId,
            furniture: furniture,
            view: this.currentView,
            zoom: this.currentZoom,
            savedAt: new Date().toISOString()
        };
        sessionStorage.setItem('currentRoomLayout', JSON.stringify(layoutData));
        showSuccess('Floor plan saved successfully!', 2000);
        console.log('💾 Layout saved:', layoutData);
    }
    
    loadSavedLayout() {
        const layoutDataStr = sessionStorage.getItem('currentRoomLayout');
        if (!layoutDataStr) {
            console.log('No saved layout found');
            return;
        }
        try {
            const layoutData = JSON.parse(layoutDataStr);
            console.log('📂 Loading saved layout:', layoutData);
            const currentRoomId = sessionStorage.getItem('currentRoomId');
            if (layoutData.roomId !== currentRoomId) {
                console.log('Layout is for a different room, skipping...');
                return;
            }
            this.furnitureLayer.getChildren().forEach(node => {
                if (node !== this.transformer) {
                    node.destroy();
                }
            });
            layoutData.furniture.forEach(item => {
                const widthPx = item.widthM * this.scale;
                const heightPx = item.heightM * this.scale;
                const furnitureCanvas = this.createFurnitureShape(item.type, widthPx, heightPx);
                const furnitureImage = new Konva.Image({
                    x: 0,
                    y: 0,
                    image: furnitureCanvas,
                    width: widthPx,
                    height: heightPx,
                    name: 'furniture'
                });
                furnitureImage.setAttr('furnitureType', item.type);
                furnitureImage.setAttr('widthM', item.widthM);
                furnitureImage.setAttr('heightM', item.heightM);
                const label = new Konva.Text({
                    x: 0,
                    y: heightPx + 5,
                    width: widthPx,
                    text: item.type.charAt(0).toUpperCase() + item.type.slice(1).replace('-', ' '),
                    fontSize: 10,
                    fontFamily: 'Arial',
                    fill: '#666',
                    align: 'center'
                });
                const group = new Konva.Group({
                    x: item.x,
                    y: item.y,
                    rotation: item.rotation || 0,
                    scaleX: item.scaleX || 1,
                    scaleY: item.scaleY || 1,
                    draggable: true
                });
                group.add(furnitureImage);
                group.add(label);
                this.setupFurnitureInteractions(group, furnitureImage);
                this.furnitureLayer.add(group);
            });
            if (layoutData.zoom) {
                const zoomSlider = document.getElementById('zoomSlider');
                const zoomValue = document.getElementById('zoomValue');
                this.currentZoom = layoutData.zoom;
                this.stage.scale({ x: layoutData.zoom, y: layoutData.zoom });
                zoomSlider.value = Math.round(layoutData.zoom * 100);
                zoomValue.textContent = `${Math.round(layoutData.zoom * 100)}%`;
            }
            this.furnitureLayer.batchDraw();
            showSuccess('Previous floor plan restored!', 2000);
        } catch (e) {
            console.error('Error loading saved layout:', e);
        }
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
            roomTypeEl.textContent = 
                `Type: ${this.roomData.roomType || 'N/A'}`;
        }
        if (roomAreaEl) {
            roomAreaEl.textContent = 
                `Area: ${this.roomData.area || (this.roomData.width * this.roomData.length).toFixed(2)} m²`;
        }
    }
    
    // 👇 ADD THESE TWO NEW METHODS
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
            const spacing = 100;
            
            console.log('📐 Placing', totalItems, 'items in grid');
            
            let itemIndex = 0;
            for (const item of cart) {
                console.log('🪑 Adding:', item.name, 'x', item.quantity);
                for (let q = 0; q < item.quantity; q++) {
                    const row = Math.floor(itemIndex / itemsPerRow);
                    const col = itemIndex % itemsPerRow;
                    const x = roomCenterX + (col - itemsPerRow / 2) * spacing;
                    const y = roomCenterY + (row - itemsPerRow / 2) * spacing;
                    await this.addFurnitureFromImage(item, x, y);
                    itemIndex++;
                }
            }
            
            showSuccess(`${totalItems} furniture items loaded!`, 2000);
        } catch (e) {
            console.error('❌ Error loading cart:', e);
        }
    }
    
    async addFurnitureFromImage(item, x, y) {
        return new Promise((resolve) => {
            console.log('🖼️ Loading image:', item.image);
            const widthPx = item.width * this.scale;
            const heightPx = item.height * this.scale;
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            
            img.onload = () => {
                console.log('✅ Image loaded:', item.name);
                const furnitureImage = new Konva.Image({
                    x: 0,
                    y: 0,
                    image: img,
                    width: widthPx,
                    height: heightPx,
                    shadowColor: 'black',
                    shadowBlur: 15,
                    shadowOpacity: 0.5,
                    shadowOffset: { x: 5, y: 5 },
                    name: 'furniture'
                });
                furnitureImage.setAttr('furnitureType', item.id);
                furnitureImage.setAttr('widthM', item.width);
                furnitureImage.setAttr('heightM', item.height);
                const label = new Konva.Text({
                    x: 0,
                    y: heightPx + 5,
                    width: widthPx,
                    text: item.name,
                    fontSize: 11,
                    fontFamily: 'Arial',
                    fill: '#333',
                    align: 'center',
                    fontStyle: 'bold'
                });
                const group = new Konva.Group({
                    x: x - widthPx / 2,
                    y: y - heightPx / 2,
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
                console.error('❌ Image failed, using fallback');
                let symbolType = 'table';
                if (item.category === 'seating') symbolType = 'chair';
                if (item.category === 'bedroom') symbolType = 'bed';
                if (item.category === 'storage') symbolType = 'wardrobe';
                const furnitureCanvas = this.createFurnitureShape(symbolType, widthPx, heightPx);
                const furnitureImage = new Konva.Image({
                    x: 0,
                    y: 0,
                    image: furnitureCanvas,
                    width: widthPx,
                    height: heightPx,
                    name: 'furniture'
                });
                furnitureImage.setAttr('furnitureType', item.id);
                furnitureImage.setAttr('widthM', item.width);
                furnitureImage.setAttr('heightM', item.height);
                const label = new Konva.Text({
                    x: 0,
                    y: heightPx + 5,
                    width: widthPx,
                    text: item.name,
                    fontSize: 10,
                    fontFamily: 'Arial',
                    fill: '#666',
                    align: 'center'
                });
                const group = new Konva.Group({
                    x: x - widthPx / 2,
                    y: y - heightPx / 2,
                    draggable: true
                });
                group.add(furnitureImage);
                group.add(label);
                this.setupFurnitureInteractions(group, furnitureImage);
                this.furnitureLayer.add(group);
                this.furnitureLayer.batchDraw();
                resolve();
            };
            
            img.src = item.image;
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🏗️ Initializing 2D Floor Plan Editor...');
    new RoomEditor();
});