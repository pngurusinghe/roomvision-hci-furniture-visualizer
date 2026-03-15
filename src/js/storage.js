/**
 * RoomVision - Enhanced Firebase Storage Module
 * Handles all Firestore database operations for room data
 * HCI Coursework - Demonstrates clean data persistence layer
 */

import { auth, db } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    serverTimestamp,
    doc,
    updateDoc,
    getDoc,
    query,
    where,
    getDocs,
    orderBy,
    limit
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

/**
 * Saves room configuration to Firestore
 * Creates a new document in the 'rooms' collection under the user's UID
 * 
 * @param {Object} roomData - Complete room configuration object
 * @returns {Promise<string>} Document ID of the created room
 * @throws {Error} If user is not authenticated or save fails
 */
export async function saveRoomToFirestore(roomData) {
    // Check authentication
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User must be logged in to save room data');
    }
    
    // Validate room data structure
    if (!validateRoomStructure(roomData)) {
        throw new Error('Invalid room data structure');
    }
    
    try {
        // Prepare data for Firestore
        const roomDocument = {
            userId: user.uid,
            userEmail: user.email,
            userName: user.displayName || user.email,
            
            // Room dimensions
            width: Number(roomData.width),
            length: Number(roomData.length),
            height: Number(roomData.height) || 2.8,
            
            // Room properties
            shape: roomData.shape,
            roomType: roomData.roomType,
            
            // Colors
            wallColor: roomData.wallColor,
            floorColor: roomData.floorColor,
            
            // Calculated values
            area: Number((roomData.area).toFixed(2)),
            volume: Number((roomData.width * roomData.length * (roomData.height || 2.8)).toFixed(2)),
            
            // Metadata
            isDraft: roomData.isDraft || false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastModified: new Date().toISOString(),
            
            // Status and version
            status: 'setup-complete',
            version: '1.0'
        };
        
        // Add document to Firestore
        const docRef = await addDoc(collection(db, 'rooms'), roomDocument);
        
        console.log('✅ Room saved successfully with ID:', docRef.id);
        
        // Log analytics (if needed for coursework demo)
        logRoomCreation(docRef.id, roomDocument);
        
        return docRef.id;
        
    } catch (error) {
        console.error('❌ Error saving room to Firestore:', error);
        
        // Provide user-friendly error messages
        if (error.code === 'permission-denied') {
            throw new Error('You do not have permission to save room data');
        } else if (error.code === 'unavailable') {
            throw new Error('Network error. Please check your connection and try again');
        } else {
            throw new Error('Failed to save room configuration: ' + error.message);
        }
    }
}

/**
 * Saves room configuration under a project in Firestore
 * (new: for when room is part of a project)
 * 
 * @param {Object} roomData - Room data (must include projectId)
 * @returns {Promise<string>} Document ID of the created room
 */
export async function saveRoomToProject(roomData) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User not authenticated');
    }
    
    const { projectId, ...roomFields } = roomData;
    if (!projectId) {
        throw new Error('projectId required for saving to project');
    }
    
    try {
        const docRef = await addDoc(collection(db, `projects/${projectId}/rooms`), {
            ...roomFields,
            userId: user.uid,
            userEmail: user.email,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        console.log('🏠 Room saved under project:', projectId, 'Room ID:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('Error saving room to project:', error);
        throw new Error(`Failed to save room: ${error.message}`);
    }
}

/**
 * Upserts a room inside a project — updates if roomId provided, creates if not.
 * Use this for "Save as Draft" so repeated clicks don't create new documents.
 *
 * @param {Object} roomData - Must include projectId; optionally include roomId to update.
 * @returns {Promise<string>} The document ID (existing or newly created).
 */
export async function upsertRoomInProject(roomData) {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const { projectId, roomId: existingRoomId, ...roomFields } = roomData;
    if (!projectId) throw new Error('projectId required');

    const payload = {
        ...roomFields,
        userId: user.uid,
        userEmail: user.email,
        updatedAt: serverTimestamp()
    };

    try {
        if (existingRoomId) {
            // Verify the document actually exists before trying to update
            const roomRef = doc(db, `projects/${projectId}/rooms`, existingRoomId);
            const snap = await getDoc(roomRef);

            if (snap.exists()) {
                await updateDoc(roomRef, payload);
                console.log('🔄 Room draft updated:', existingRoomId);
                return existingRoomId;
            } else {
                // Stale ID (deleted doc or wrong project) — create a fresh document
                console.warn('⚠️ Room doc not found, creating a new draft instead of updating');
                sessionStorage.removeItem('currentRoomId');  // clear stale ID
                const docRef = await addDoc(collection(db, `projects/${projectId}/rooms`), {
                    ...payload,
                    createdAt: serverTimestamp()
                });
                console.log('🏠 New room draft created (fallback):', docRef.id);
                return docRef.id;
            }
        } else {
            // First save — create a new document
            const docRef = await addDoc(collection(db, `projects/${projectId}/rooms`), {
                ...payload,
                createdAt: serverTimestamp()
            });
            console.log('🏠 New room draft created under project:', projectId, 'Room ID:', docRef.id);
            return docRef.id;
        }
    } catch (error) {
        console.error('Error upserting room in project:', error);
        throw new Error(`Failed to save room: ${error.message}`);
    }
}

/**
 * Updates an existing room document in Firestore
 * 
 * @param {string} roomId - Document ID of the room to update
 * @param {Object} updateData - Data to update
 * @returns {Promise<void>}
 * @throws {Error} If update fails
 */
export async function updateRoomInFirestore(roomId, updateData) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User must be logged in to update room data');
    }
    
    try {
        const roomRef = doc(db, 'rooms', roomId);
        
        // Verify ownership before update
        const roomSnap = await getDoc(roomRef);
        if (!roomSnap.exists()) {
            throw new Error('Room not found');
        }
        
        const roomData = roomSnap.data();
        if (roomData.userId !== user.uid) {
            throw new Error('Unauthorized: You can only update your own rooms');
        }
        
        // Update document
        await updateDoc(roomRef, {
            ...updateData,
            updatedAt: serverTimestamp(),
            lastModified: new Date().toISOString()
        });
        
        console.log('✅ Room updated successfully');
        
    } catch (error) {
        console.error('❌ Error updating room:', error);
        throw new Error('Failed to update room: ' + error.message);
    }
}

/**
 * Retrieves a room document from Firestore
 * 
 * @param {string} roomId - Document ID of the room to retrieve
 * @returns {Promise<Object>} Room data object
 * @throws {Error} If retrieval fails or room doesn't exist
 */
export async function getRoomFromFirestore(roomId) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User must be logged in to retrieve room data');
    }
    
    try {
        const roomRef = doc(db, 'rooms', roomId);
        const roomSnap = await getDoc(roomRef);
        
        if (!roomSnap.exists()) {
            throw new Error('Room not found');
        }
        
        const roomData = roomSnap.data();
        
        // Verify ownership
        if (roomData.userId !== user.uid) {
            throw new Error('Unauthorized: You can only access your own rooms');
        }
        
        console.log('✅ Room retrieved successfully');
        
        return {
            id: roomSnap.id,
            ...roomData
        };
        
    } catch (error) {
        console.error('❌ Error retrieving room:', error);
        throw new Error('Failed to retrieve room: ' + error.message);
    }
}

/**
 * Retrieves all rooms for the current user
 * 
 * @param {Object} options - Query options (limit, orderBy, etc.)
 * @returns {Promise<Array>} Array of room objects
 */
export async function getUserRooms(options = {}) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User must be logged in to retrieve rooms');
    }
    
    try {
        const roomsRef = collection(db, 'rooms');
        let q = query(
            roomsRef, 
            where('userId', '==', user.uid)
        );
        
        // Apply ordering
        if (options.orderBy) {
            q = query(q, orderBy(options.orderBy, options.orderDirection || 'desc'));
        } else {
            q = query(q, orderBy('createdAt', 'desc'));
        }
        
        // Apply limit
        if (options.limit) {
            q = query(q, limit(options.limit));
        }
        
        const querySnapshot = await getDocs(q);
        const rooms = [];
        
        querySnapshot.forEach((doc) => {
            rooms.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        console.log(`✅ Retrieved ${rooms.length} rooms`);
        
        return rooms;
        
    } catch (error) {
        console.error('❌ Error retrieving user rooms:', error);
        throw new Error('Failed to retrieve rooms: ' + error.message);
    }
}

/**
 * Validates that room data structure is correct before saving
 * 
 * @param {Object} roomData - Room data to validate
 * @returns {boolean} True if structure is valid
 */
function validateRoomStructure(roomData) {
    const requiredFields = [
        'width',
        'length',
        'shape',
        'wallColor',
        'floorColor',
        'roomType'
    ];
    
    // Check if all required fields are present
    const hasAllFields = requiredFields.every(field => 
        roomData.hasOwnProperty(field) && roomData[field] !== null && roomData[field] !== undefined
    );
    
    if (!hasAllFields) {
        console.error('❌ Missing required fields in room data');
        return false;
    }
    
    // Validate data types
    if (typeof roomData.width !== 'number' || roomData.width <= 0) {
        console.error('❌ Invalid width value');
        return false;
    }
    
    if (typeof roomData.length !== 'number' || roomData.length <= 0) {
        console.error('❌ Invalid length value');
        return false;
    }
    
    return true;
}

/**
 * Logs room creation for analytics/debugging
 * 
 * @param {string} roomId - Room document ID
 * @param {Object} roomData - Room data
 */
function logRoomCreation(roomId, roomData) {
    const logData = {
        event: 'room_created',
        roomId: roomId,
        timestamp: new Date().toISOString(),
        dimensions: {
            width: roomData.width,
            length: roomData.length,
            height: roomData.height,
            area: roomData.area
        },
        roomType: roomData.roomType,
        isDraft: roomData.isDraft
    };
    
    console.log('📊 Room Creation Log:', logData);
    
    // In a production app, you might send this to an analytics service
    // For coursework, logging to console is sufficient
}

/**
 * Deletes a room from Firestore (bonus functionality)
 * 
 * @param {string} roomId - Room document ID to delete
 * @returns {Promise<void>}
 */
export async function deleteRoomFromFirestore(roomId) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User must be logged in to delete rooms');
    }
    
    try {
        const roomRef = doc(db, 'rooms', roomId);
        const roomSnap = await getDoc(roomRef);
        
        if (!roomSnap.exists()) {
            throw new Error('Room not found');
        }
        
        const roomData = roomSnap.data();
        if (roomData.userId !== user.uid) {
            throw new Error('Unauthorized: You can only delete your own rooms');
        }
        
        await deleteDoc(roomRef);
        console.log('✅ Room deleted successfully');
        
    } catch (error) {
        console.error('❌ Error deleting room:', error);
        throw new Error('Failed to delete room: ' + error.message);
    }
}