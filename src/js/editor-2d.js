/**
 * RoomVision 2D Editor - Professional Floor Plan Style
 * Real furniture images with proper sizing and themed UI
 */

import { showError, showSuccess, showWarning, showLoading, hideLoading } from './ui-feedback.js';

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
        
        // Scale: pixels per meter
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
        
        // Load furniture from cart
        await this.loadFurnitureFromCart();
        
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
                id: furnitureNode.getAttr('furnitureId'),
                image: furnitureNode.getAttr('furnitureImage'),
                name: furnitureNode.getAttr('furnitureName'),
                x: node.x(),
                y: node.y(),
                rotation: node.rotation(),
                scaleX: node.scaleX(),
                scaleY: node.scaleY(),
                originalWidth: furnitureNode.getAttr('originalWidth'),
                originalHeight: furnitureNode.getAttr('originalHeight')
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
        // Skip for now - will be implemented later
        console.log('Saved layout loading skipped');
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
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🏗️ Initializing 2D Floor Plan Editor...');
    new RoomEditor();
});