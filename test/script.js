/*!
 * ===== DO NOT REMOVE COPYRIGHTS =====
 * Background Image Handler
 * A script for working with Hieroglyphs
 * 
 * @author   Massimo Mazzon
 * @version  1.0.0
 * @license  MIT
 * @copyright Copyright (c) 2024 Massimo Mazzon. All rights reserved.
 */
var ctx = c.getContext('2d');
// Global variable to store the background image object
let backgroundImage = null;
var mousePos = { x: 0, y: 0 }; // Object to hold mouse position
var texts = []; // Array to hold text objects
const gridSize = 10; // Grid size in pixels
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let selectedTextIndex = -1; // Added to keep track of selected text index
let currentId = 0;
let marqueeStart = { x: 0, y: 0 };
let marqueeEnd = { x: 0, y: 0 };
let isDrawingMarquee = false;
let updateHistory = [];
let scale = 1;  // Initial scale factor
const scaleSensitivity = 0.1;  // Sensitivity of scaling
var initialPosition = null;
let isPanning = false;
let lastPosX, lastPosY;
let currentGrid = null;  // Store reference to current grid
const undoHistory = [];
const redoHistory = [];
let initialRotationState = null;
let initialMoveState = null;
const threshold = 5; // Set to the minimum angle change for saving history
const rotationThreshold = 15;  // Adjust threshold as needed
let activeTextObject = null; // Track which text object is being edited
let textPosition = { x: 100, y: 100 };
let canvasModified = false;
let initialScaleState = null;
let resizeTimeout;
// ====================================


function getCanvasDimensions() {
    const searchContainer = document.getElementById('searchContainer');
    const searchWidth = searchContainer ? searchContainer.offsetWidth : 400; // 400 is default width
    
    return {
        // Calculate width by subtracting search container width and padding
        width: Math.floor(window.innerWidth - searchWidth - 25), // 40 accounts for container padding
        height: Math.floor(window.innerHeight - 20)
    };
}

// Initialize canvas with viewport dimensions

const initialDimensions = getCanvasDimensions();
var canvas = new fabric.Canvas('c', {
    isDrawingMode: false,
    selection: true,
    width: initialDimensions.width,
    height: initialDimensions.height
});
canvas.selection = true;
canvas.subTargetCheck = true;

function drawGrid() {
    const GRID_SIZE = 20;
    const zoom = canvas.getZoom();
    const vpt = canvas.viewportTransform;

    // Calculate grid dimensions with padding
    const dims = {
        left: Math.floor(-vpt[4] / zoom / GRID_SIZE) * GRID_SIZE - GRID_SIZE * 2,
        right: Math.ceil((canvas.width - vpt[4]) / zoom / GRID_SIZE) * GRID_SIZE + GRID_SIZE * 2,
        top: Math.floor(-vpt[5] / zoom / GRID_SIZE) * GRID_SIZE - GRID_SIZE * 2,
        bottom: Math.ceil((canvas.height - vpt[5]) / zoom / GRID_SIZE) * GRID_SIZE + GRID_SIZE * 2
    };

    // Clear existing grid, if necessary
    canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));

    // Create grid path
    let pathString = '';

    // Add vertical and horizontal lines
    for (let x = dims.left; x <= dims.right; x += GRID_SIZE) {
        pathString += `M ${x} ${dims.top} L ${x} ${dims.bottom} `;
    }
    for (let y = dims.top; y <= dims.bottom; y += GRID_SIZE) {
        pathString += `M ${dims.left} ${y} L ${dims.right} ${y} `;
    }

    // Create the grid path as a background object
    const gridPath = new fabric.Path(pathString, {
        stroke: 'rgba(200, 200, 200, 0.1)',
        strokeWidth: 1,
        selectable: false,
        evented: false,
        objectCaching: false
    });

    // Add as background
    canvas.setBackgroundImage(gridPath, canvas.renderAll.bind(canvas));
}

drawGrid();
// ===================== test decode characters from list of glyphs ==================

function loadCharacters(encoded) {
    // Reverse the character shift
    const unshifted = encoded.split('').map(char =>
        String.fromCharCode(char.charCodeAt(0) - 1)
    ).join('');
    
    // Decode base64 back to JSON string
    const jsonStr = decodeURIComponent(escape(atob(unshifted)));
    return JSON.parse(jsonStr);
}

// Decode and use the data
const characters = loadCharacters(table);

// =====================================================================================
const sentences = [
    { letter: "A", text: "Man and his occupations" },
    { letter: "B", text: "Woman and her occupations" },
    { letter: "C", text: "Anthropomorphic deities" },
    { letter: "D", text: "Parts of the human body" },
    { letter: "E", text: "Mammals" },
    { letter: "F", text: "Parts of mammals" },
    { letter: "G", text: "Birds" },
    { letter: "H", text: "Parts of birds" },
    { letter: "I", text: "Amphibious animals, reptiles, etc." },
    { letter: "K", text: "Fishes and parts of fishes" },
    { letter: "L", text: "Invertebrata and lesser animals" },
    { letter: "M", text: "Trees and plants" },
    { letter: "N", text: "Sky, earth, water" },
    { letter: "NU", text: "Upper nile" },
    { letter: "NL", text: "Lower nile" },
    { letter: "O", text: "Buildings, parts of buildings, etc." },
    { letter: "P", text: "Ships and parts of ships" },
    { letter: "Q", text: "Domestic and funerary furniture" },
    { letter: "R", text: "Temple furniture and sacred emblems" },
    { letter: "S", text: "Crowns, dress, staves, etc." },
    { letter: "T", text: "Warfare, hunting, butchery" },
    { letter: "U", text: "Agriculture, crafts, and professions" },
    { letter: "V", text: "Rope, fibre, baskets, bags, etc." },
    { letter: "W", text: "Vessels of stone and earthenware" },
    { letter: "X", text: "Loaves and cakes" },
    { letter: "Y", text: "Writings, games, music" },
    { letter: "Z", text: "Strokes, signs derived from Hieratic, geometrical features" },
    { letter: "Aa", text: "Unclassified signs" },
    { letter: "Hrz", text: "Horizontal Signs" },
    { letter: "Vrt", text: "Vertical Signs" },
    { letter: "Sm", text: "Small Signs" },
    { letter: "Lg", text: "Large/composite Signs" }
];
// Add alphabet
// sentences.unshift({ letter: "Alph", text: "Alphabet (A-Z representation)" });
// Add your new horizontal category at the beginning or end

function displayCharactersInRows(charList) {
    let content = '<div class="row">';
    charList.forEach(([code, char], index) => {
        // Extract category from code (e.g., 'NU' from 'NU1' or 'A' from 'A1')
        const category = horizontalGlyphs.includes(code) ? 'Hrz' : code.match(/[A-Z]+/)[0];
        
        content += `
            <div class="char-container" 
                 draggable="true" 
                 id="drag-${category}-${index}" 
                 data-category="${category}">
                <div class="char">${char}</div>
                <div class="name">${code}</div>
            </div>`;
        if ((index + 1) % 5 === 0) {
            content += '</div><div class="row">';
        }
    });
    content += '</div>';
    document.getElementById('charListContainer').innerHTML = content;
}
// filters hieros as search happens
function filterAndDisplayCharacters(charList, query) {
    // If the query is "Alph", only show alphabet characters (A-Z)
    if (query === "Alph") {
        const category = code.match(/[A-Z]+/)[0];  // Just use letter categories
        displayCharactersInRows(alphabetChars);
        return;
    }

    // If the query is "Horiz", show horizontal characters
    if (query === "Hrz") {
        const horizontalChars = charList.filter(([code]) => horizontalGlyphs.includes(code));
        displayCharactersInRows(horizontalChars);
        return;
    }

    // If the query is "Vert", show vertical characters
    if (query === "Vrt") {
        const verticalChars = charList.filter(([code]) => verticalGlyphs.includes(code));
        displayCharactersInRows(verticalChars);
        return;
    }
    // If the query is "Sm", show small characters
    if (query === "Sm") {
        const smallChars = charList.filter(([code]) => smallGlyphs.includes(code));
        displayCharactersInRows(smallChars);
        return;
    }
    // If the query is "Lg", show small characters
    if (query === "Lg") {
        const largeChars = charList.filter(([code]) => largeGlyphs.includes(code));
        displayCharactersInRows(largeChars);
        return;
    }
    // Otherwise, handle normal filtering
    const filteredChars = charList.filter(([code, char]) => {
        return code.toLowerCase().includes(query.toLowerCase()) || 
               char.toLowerCase().includes(query.toLowerCase());
    });
    
    displayCharactersInRows(filteredChars);
}
function addCharacterToCanvas(text, characterKey, x, y) {
    canvasModified = true;

    var textObj = new fabric.Text(text, {
        left: x,
        top: y,
        fontSize: 60,
        fill: 'black',
        originX: 'center',
        originY: 'center',
        selectable: true
    });

    // Generate a unique ID for the text object
    textObj.id = generateUniqueId();
    textObj.characterKey = characterKey;

    // Add the text object to the canvas
    canvas.add(textObj);

    // Update the position of the object (centering)
    textObj.set({
        left: x,
        top: y
    });

    // Add to pastedNamesContainer - using span method
    const pastedNamesDiv = document.getElementById('pastedNames');
    if (pastedNamesDiv) {
        const nameSpan = document.createElement('span');
        nameSpan.id = `name-${textObj.id}`;
        nameSpan.textContent = `${characterKey} - `;
        pastedNamesDiv.appendChild(nameSpan);
    }

    // Record the addition for undo functionality
    undoHistory.push({
        type: 'add',
        object: textObj.toJSON(['id', 'characterKey', 'left', 'top', 'angle']), // Store necessary properties
        id: textObj.id,
        nameSpanId: `name-${textObj.id}`
    });

    // Call renderAll to ensure the canvas is updated
    canvas.renderAll();
}
displayCharactersInRows(characters);
// Helper function to clear existing grid
function clearExistingGrid() {
    if (currentGrid) {
        canvas.remove(currentGrid);
    }
}
// =================== MOUSE ACTIONS =====================
canvas.on('mouse:down', function (options) {
    // Save the clicked position
    const pointer = canvas.getPointer(options.e);
    textPosition = {
        x: pointer.x,
        y: pointer.y
    };
    if (options.e.altKey) {
        // Start panning if Alt key is held
        isPanning = true;
        lastPosX = options.e.clientX;
        lastPosY = options.e.clientY;
        canvas.selection = false;
        return;
    }
    const clickedObject = canvas.getObjects().find(obj => obj.containsPoint(pointer));
    const activeObject = canvas.getActiveObject();

    if (clickedObject) {
        // Set clicked object as active if there's one
        canvas.setActiveObject(clickedObject);
        initialPosition = { left: clickedObject.left, top: clickedObject.top };
    } else {
        // Retain the multiple selection if already active
        if (activeObject && activeObject.type === 'activeSelection') {
            canvas.setActiveObject(activeObject);
        } else {
            // Otherwise, discard the selection
            canvas.discardActiveObject().requestRenderAll();
        }
    }
});
canvas.on('mouse:up', function (options) {
    isPanning = false;
    canvas.selection = true;

    // Handle move action for both single objects and groups
    if (initialMoveState !== null) {
        const obj = options.target;
        if (obj) {
            undoHistory.push({
                type: 'modify',  // Changed from 'move' to 'modify' to match switch case
                actionType: 'moving',
                state: initialMoveState
            });
        }
        initialMoveState = null;
    }

    const activeObject = canvas.getActiveObject();
    if (activeObject && activeObject.type === 'activeSelection') {
        activeObject.lockMovementX = false;
        activeObject.lockMovementY = false;
        activeObject.lockScalingX = false;
        activeObject.lockScalingY = false;
        activeObject.lockRotation = false;
    }
});
canvas.on('mouse:move', function (options) {
    if (isPanning) {
        const vpt = canvas.viewportTransform;
        vpt[4] += options.e.clientX - lastPosX;
        vpt[5] += options.e.clientY - lastPosY;
        lastPosX = options.e.clientX;
        lastPosY = options.e.clientY;
        canvas.requestRenderAll();
        drawGrid();
        return;
    }
});
canvas.on('mouse:wheel', function (opt) {
    var delta = opt.e.deltaY;
    var zoom = canvas.getZoom();
    zoom *= 0.999 ** delta;
    zoom = Math.min(Math.max(0.1, zoom), 5);
    canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
    requestAnimationFrame(drawGrid);
    opt.e.preventDefault();
    opt.e.stopPropagation();
});
canvas.on('drop', function (options) {
    options.e.preventDefault();
    canvasModified = true;
    const droppedData = options.e.dataTransfer.getData('text/plain');
    
    // Find the character entry by the dropped data
    const characterEntry = characters.find(([, char]) => char === droppedData);
    
    if (characterEntry) {
        // Check if this is a three-element entry (alphabet case)
        const characterKey = characterEntry.length === 3 ? characterEntry[2] : characterEntry[0];
        
        // Calculate position relative to the canvas
        const pointer = canvas.getPointer(options.e);
        const mouseX = pointer.x;
        const mouseY = pointer.y;
        
        // Add character to canvas, using the correct key for pastedNames
        addCharacterToCanvas(droppedData, characterKey, mouseX, mouseY);
    }
});
canvas.on('mouse:dblclick', function(options) {
    if (options.target && (options.target.type === 'i-text' || options.target.type === 'text')) {
        activeTextObject = options.target;
        openKeyboard();
        const keyboardInput = document.getElementById('keyboardInput');
        keyboardInput.value = activeTextObject.text;
    }
});

// Event handlers for rotation and scaling
canvas.on('object:moving', function(options) {
    const obj = options.target;
    if (obj && initialMoveState === null) {
        if (obj.type !== 'activeSelection') {
            initialMoveState = {
                type: 'single',
                id: obj.id,
                state: obj.toJSON(['left', 'top', 'angle', 'scaleX', 'scaleY'])
            };
        } else {
            // For groups, store the relative positions of objects
            const groupLeft = obj.left;
            const groupTop = obj.top;
            
            initialMoveState = {
                type: 'group',
                groupState: {
                    left: groupLeft,
                    top: groupTop,
                    angle: obj.angle,
                    scaleX: obj.scaleX,
                    scaleY: obj.scaleY,
                    width: obj.width,
                    height: obj.height
                },
                // Store relative positions to group center
                objects: obj.getObjects().map(o => {
                    const relativeLeft = o.left - groupLeft;
                    const relativeTop = o.top - groupTop;
                    return {
                        id: o.id,
                        relativeLeft: relativeLeft,
                        relativeTop: relativeTop,
                        left: o.left,
                        top: o.top,
                        angle: o.angle,
                        scaleX: o.scaleX,
                        scaleY: o.scaleY
                    };
                })
            };
        }
    }
    
    // Apply grid snapping
    if (obj.type !== 'activeSelection') {
        obj.set({
            left: snapToGrid(obj.left),
            top: snapToGrid(obj.top)
        });
    } else {
        const snappedLeft = snapToGrid(obj.left);
        const snappedTop = snapToGrid(obj.top);
        const deltaX = snappedLeft - obj.left;
        const deltaY = snappedTop - obj.top;
        
        obj.getObjects().forEach(o => {
            o.set({
                left: snapToGrid(o.left + deltaX),
                top: snapToGrid(o.top + deltaY)
            });
        });
        obj.set({
            left: snappedLeft,
            top: snappedTop
        });
    }
});
canvas.on('object:rotating', function(options) {
    const obj = options.target;
    if (obj && initialRotationState === null) {
        if (obj.type !== 'activeSelection') {
            initialRotationState = {
                type: 'single',
                id: obj.id,
                state: obj.toJSON(['left', 'top', 'angle', 'scaleX', 'scaleY'])
            };
        } else {
            // For group rotation, store both group and individual states
            initialRotationState = {
                type: 'group',
                groupState: {
                    left: obj.left,
                    top: obj.top,
                    angle: obj.angle,
                    scaleX: obj.scaleX,
                    scaleY: obj.scaleY
                },
                objects: obj.getObjects().map(o => ({
                    id: o.id,
                    state: o.toJSON(['left', 'top', 'angle', 'scaleX', 'scaleY'])
                }))
            };
        }
        // console.log('Rotation started. Initial state:', initialRotationState);
    }
});
canvas.on('object:scaling', function(options) {
    const obj = options.target;
    if (obj && initialScaleState === null) {
        if (obj.type !== 'activeSelection') {
            initialScaleState = {
                type: 'single',
                id: obj.id,
                state: obj.toJSON(['left', 'top', 'angle', 'scaleX', 'scaleY', 'width', 'height'])
            };
        } else {
            initialScaleState = {
                type: 'group',
                groupState: {
                    left: obj.left,
                    top: obj.top,
                    angle: obj.angle,
                    scaleX: obj.scaleX,
                    scaleY: obj.scaleY,
                    width: obj.width,
                    height: obj.height
                },
                objects: obj.getObjects().map(o => ({
                    id: o.id,
                    state: o.toJSON(['left', 'top', 'angle', 'scaleX', 'scaleY', 'width', 'height'])
                }))
            };
        }
        console.log('Scaling started. Initial state:', initialScaleState);
    }
});
canvas.on('object:modified', function(options) {
    canvasModified = true;
    
    if (initialRotationState !== null) {
        undoHistory.push({
            type: 'modify',
            actionType: 'rotation',
            state: initialRotationState
        });
        initialRotationState = null;
    }
    
    if (initialScaleState !== null) {
        undoHistory.push({
            type: 'modify',
            actionType: 'scaling',
            state: initialScaleState
        });
        initialScaleState = null;
    }
    
    if (initialMoveState !== null) {
        undoHistory.push({
            type: 'modify',
            actionType: 'moving',
            state: initialMoveState
        });
        initialMoveState = null;
    }
});
canvas.on('object:rotating', function(options) {
    const obj = options.target;
    if (obj && initialRotationState === null) {
        // Store the complete initial state when rotation starts
        initialRotationState = obj.toObject(['left', 'top', 'angle', 'scaleX', 'scaleY', 'skewX', 'skewY', 'width', 'height', 'flipX', 'flipY']);
        console.log('Rotation started. Initial state:', initialRotationState);
    }
});
// ================================== end =============================

// ============================ change bg color ===========================
function toggleColorPopup() {
    const popup = document.getElementById('colorPopup');
    popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
}

function setCanvasColor(color) {
    canvas.setBackgroundColor(color, canvas.renderAll.bind(canvas));
    document.getElementById('colorPopup').style.display = 'none';
}
//=========================== Undo function ===============================

function undoLastAction() {
    if (undoHistory.length === 0) return;

    const lastAction = undoHistory.pop();
    console.log('Undoing action:', lastAction);

    switch (lastAction.type) {
        case 'add':
            const objectToRemove = canvas.getObjects().find(obj => obj.id === lastAction.id);
            if (objectToRemove) {
                canvas.remove(objectToRemove);
                const nameSpan = document.getElementById(`name-${lastAction.id}`);
                if (nameSpan) {
                    nameSpan.remove();
                }
            }
            break;

case 'modify':
    if (['rotation', 'scaling', 'moving'].includes(lastAction.actionType)) {
        if (lastAction.state.type === 'group') {
            const objectsToGroup = [];
            
            // First pass: Reset all objects to their individual states
            lastAction.state.objects.forEach(obj => {
                const fabricObj = canvas.getObjects().find(o => o.id === obj.id);
                if (fabricObj) {
                    fabricObj.set({
                        left: obj.state.left,
                        top: obj.state.top,
                        scaleX: obj.state.scaleX,
                        scaleY: obj.state.scaleY,
                        angle: obj.state.angle,
                        flipX: obj.state.flipX,
                        flipY: obj.state.flipY
                    });
                    fabricObj.setCoords();
                    objectsToGroup.push(fabricObj);
                }
            });

            if (objectsToGroup.length > 0) {
                canvas.discardActiveObject();
                
                // Create new group with objects in their original states
                const group = new fabric.ActiveSelection(objectsToGroup, {
                    canvas: canvas,
                    ...lastAction.state.groupState  // Apply all group properties at once
                });
                
                canvas.setActiveObject(group);
                canvas.requestRenderAll();
            }
        } else if (lastAction.state.type === 'single') {
            const objectToModify = canvas.getObjects().find(obj => obj.id === lastAction.state.id);
            if (objectToModify) {
                objectToModify.set(lastAction.state.state);
                objectToModify.setCoords();
            }
        }
    }
    break;

        case 'delete':
            const deletedObj = new fabric.Text(lastAction.object.characterKey || '', {
                ...lastAction.object,
                id: lastAction.id
            });
            canvas.add(deletedObj);
            
            const pastedNamesDiv = document.getElementById('pastedNames');
            if (pastedNamesDiv && lastAction.object.characterKey) {
                const nameSpan = document.createElement('span');
                nameSpan.id = `name-${lastAction.id}`;
                nameSpan.textContent = lastAction.object.characterKey + ', ';
                pastedNamesDiv.appendChild(nameSpan);
            }
            break;

        default:
            console.warn('Unknown action type:', lastAction.type);
            undoHistory.push(lastAction);
            return;
    }
    
    canvas.requestRenderAll();
}

function deleteSelectedObjects() {
    const selectedObjects = canvas.getActiveObjects();
    if (selectedObjects.length > 0) {
        selectedObjects.forEach(obj => {
            // Store the complete object state before deletion
            const objectState = obj.toObject(['left', 'top', 'angle', 'scaleX', 'scaleY', 'width', 'height', 'flipX', 'flipY']);
            objectState.characterKey = obj.characterKey; // Preserve the character key if it exists
            
            undoHistory.push({
                type: 'delete',
                id: obj.id,
                object: objectState
            });
            
            canvas.remove(obj);
            const nameSpan = document.getElementById(`name-${obj.id}`);
            if (nameSpan) {
                nameSpan.remove();
            }
        });
        
        canvas.discardActiveObject();
        canvas.renderAll();
    }
}

// Function to snap values to the nearest grid point
function snapToGrid(value) {
    return Math.round(value / gridSize) * gridSize;
}

let lastSavedFilename = null; // Store the last used filename
// Clear references when removing objects
function cleanupObject(obj) {
    if (obj.canvas) {
        obj.canvas = null;
    }
    if (obj._objects) {
        obj._objects.forEach(cleanupObject);
    }
}
function removeCharacterFromCanvas(object) {
    canvas.remove(object);
    cleanupObject(object);
    const nameSpan = document.getElementById(`name-${object.id}`);
    if (nameSpan) {
        nameSpan.remove();
    }
}
function storeAndRemoveCharacter(obj) {
    // Store the object state before deletion
    const objectState = obj.toObject(['left', 'top', 'angle', 'scaleX', 'scaleY', 'width', 'height', 'flipX', 'flipY']);
    objectState.characterKey = obj.characterKey; // Preserve the character key

    // Add to undo history
    undoHistory.push({
        type: 'delete',
        id: obj.id,
        object: objectState
    });

    // Call the existing remove function
    removeCharacterFromCanvas(obj);
}
function mirrorTextObject() {
    // Get active selection or active object
    const activeObject = canvas.getActiveObject();
    if (!activeObject) return;

    try {
        const objects = activeObject.type === 'activeSelection'
            ? activeObject.getObjects()  // Multiple objects selected
            : [activeObject];             // Single object

        // Iterate over each object to mirror and record state for undo
        objects.forEach(obj => {
            const prevState = obj.toObject(['left', 'top', 'flipX']);
            undoHistory.push({
                type: 'modify',
                id: obj.id,
                prevState: prevState
            });

            // Toggle the flipX state to mirror
            obj.set('flipX', !obj.flipX);

            // Maintain position based on alignment
            const width = obj.getScaledWidth();
            if (obj.originX === 'left') {
                obj.set({ left: obj.flipX ? prevState.left + width : prevState.left });
            } else if (obj.originX === 'right') {
                obj.set({ left: obj.flipX ? prevState.left - width : prevState.left });
            } else {
                obj.set({ left: prevState.left, top: prevState.top });
            }

            obj.setCoords();
        });

        // Update selection and render changes
        if (activeObject.type === 'activeSelection') activeObject.setCoords();
        canvas.requestRenderAll();

    } catch (error) {
        console.error('Error mirroring object(s):', error);
    }
}

function alignObjects(direction = 'horizontal') {
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length === 0) return;

    // Store the initial states before alignment
    const prevState = activeObjects.map(obj => ({
        id: obj.id,
        prevState: obj.toJSON(['left', 'top', 'angle'])
    }));

    // Your existing alignment code
    const getRefPoint = {
        horizontal: () => {
            const center = activeObjects.reduce((sum, obj) =>
                sum + (obj.top + obj.getScaledHeight() / 2), 0);
            return center / activeObjects.length;
        },
        top: () => Math.min(...activeObjects.map(obj => obj.top)),
        bottom: () => Math.max(...activeObjects.map(obj =>
            obj.top + obj.getScaledHeight())),
        left: () => Math.min(...activeObjects.map(obj => obj.left))
    };

    const alignTo = getRefPoint[direction]();

    // Apply alignment
    activeObjects.forEach(obj => {
        const props = {
            horizontal: { top: alignTo - obj.getScaledHeight() / 2 },
            top: { top: alignTo },
            bottom: { top: alignTo - obj.getScaledHeight() },
            left: { left: alignTo }
        };
        obj.set(props[direction]);
        obj.setCoords();
    });

    // Simply store as a 'modify' action
    undoHistory.push({
        type: 'modify',
        objects: prevState
    });

    canvas.requestRenderAll();
}


// Save and Load
function loadWorkspace() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';

    fileInput.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            // Read and parse file
            const jsonContent = await file.text();
            const workspace = JSON.parse(jsonContent);
            const canvasData = workspace.canvas || workspace;

            // Clear existing content
            canvas.clear();
            const pastedNames = document.getElementById('pastedNames');
            if (pastedNames) pastedNames.innerHTML = '';

            // Filter out grid objects
            if (canvasData.objects) {
                canvasData.objects = canvasData.objects.filter(obj =>
                    !obj.isGridGroup && !obj.grid
                );
            }

            // Load canvas data
            canvas.loadFromJSON(canvasData, () => {
                // Restore viewport transform
                if (canvasData.viewportTransform) {
                    canvas.setViewportTransform(canvasData.viewportTransform);
                }

                // Restore pasted names
                if (workspace.pastedNames?.length) {
                    workspace.pastedNames.forEach(({ id, text }) => {
                        if (text) {
                            const span = document.createElement('span');
                            span.id = `name-${id || Date.now()}`;
                            span.textContent = text;  // Removed the `, ` addition
                            pastedNames?.appendChild(span);
                        }
                    });
                }

                // Final rendering
                canvas.getObjects()
                    .filter(obj => obj.type === 'group')
                    .forEach(obj => obj.setCoords());

                drawGrid();
                canvas.requestRenderAll();
            });

        } catch (error) {
            console.error('Error loading workspace:', error);
            alert('Error loading workspace file');
        }
    };

    // Trigger file selection
    fileInput.click();
}
function saveWorkspace() {
    try {
        // Get canvas objects excluding grid
        const objects = canvas.getObjects().filter(obj => !obj.isGridGroup && !obj.grid);

        // Create workspace object with canvas state and names
        const workspace = {
            canvas: {
                ...canvas.toJSON(),
                objects: objects.map(obj => obj.toJSON())
            },
            pastedNames: Array.from(document.getElementById('pastedNames')?.children || [])
                .map(span => ({
                    id: span.id.replace('name-', ''),
                    text: span.textContent.replace(', ', '')
                }))
        };

        // Create and trigger download
        const blob = new Blob([JSON.stringify(workspace, null, 2)], {
            type: 'application/json'
        });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'workspace.json';
        link.click();
        URL.revokeObjectURL(link.href);

        // Show success message
        const indicator = document.createElement('div');
        indicator.textContent = 'Saved!';
        indicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            z-index: 1000;
        `;
        document.body.appendChild(indicator);
        setTimeout(() => indicator.remove(), 2000);

    } catch (error) {
        console.error('Error saving workspace:', error);
        alert('Error saving workspace');
    }
}
// =============================================== filter hieros =============================================
// dropdown logic
const dropdownContent = document.getElementById("dropdownContent");
sentences.forEach(sentence => {
    const link = document.createElement("a");
    link.href = "#";
    link.dataset.letter = sentence.letter;
    link.innerText = sentence.letter + '. ' + sentence.text;
    link.addEventListener("click", (e) => {
        e.preventDefault();
        filterAndDisplayCharacters(characters, sentence.letter);
        // Close dropdownContent when an item is clicked
        dropdownContent.style.display = 'none';
    });
    dropdownContent.appendChild(link);
});
// ==================================== MdC input interface ====================
// Add a simple input interface
function addMdCInterface() {
    const container = document.createElement('div');
    container.style.cssText = `
        position: fixed;
        bottom: 130px;
        left: 20px;
        background: white;
        padding: 10px;
        border: 1px solid #ccc;
        border-radius: 4px;
        z-index: 1000;
    `;

    const input = document.createElement('input');
    input.type = 'text';
    input.id="mdcInput";
    input.name="mdcInput";
    input.placeholder = 'Paste series (e.g., A1-D21-N35)';
    input.style.marginRight = '10px';
    input.style.width = '200px';

    // Add keydown event listener for input
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace') {
            e.stopPropagation(); // Prevent the global backspace handler
        }
        // Handle Enter/Return key
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent form submission if within a form
            handleMdCInput(this.value);
            // Optional: Clear input after processing
            this.value = '';
        }
    });

    const button = document.createElement('button');
    button.textContent = 'Add Glyphs';
    button.onclick = () => {
        handleMdCInput(input.value);
        input.value = ''; // Clear input after adding glyphs
    };

    container.appendChild(input);
    container.appendChild(button);
    document.body.appendChild(container);
}
// Initialize the interface
addMdCInterface();
// ================================= tools ===============================
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
function setupTextSubmission(x, y) {
    var textBox = new fabric.IText('Type here...', {
        left: x,
        top: y,
        fontSize: 20,
        borderColor: '#CCCCCC',
        cornerColor: '#CCCCCC',
        cornerSize: 6,
        transparentCorners: false
    });
    
    textBox.id = textBox.id || generateUniqueId();
    canvas.add(textBox);
    canvas.setActiveObject(textBox);
    
    // Show keyboard dialog when entering edit mode
    textBox.on('editing:entered', function() {
        openKeyboard();
        const keyboardInput = document.getElementById('keyboardInput');
        keyboardInput.value = this.text;
        
        // Update IText content as user types in keyboard dialog
        keyboardInput.addEventListener('input', function() {
            textBox.text = this.value;
            canvas.renderAll();
        });
    });
    
    textBox.enterEditing();
    textBox.selectAll();
    
    undoHistory.push({
        type: 'add',
        object: textBox.toJSON(),
        id: textBox.id
    });
}
function closeKeyboard() {
    document.getElementById('keyboardDialog').style.display = 'none';
    document.getElementById('keyboardOverlay').style.display = 'none';
    document.getElementById('keyboardInput').value = '';
    activeTextObject = null;
}
function addCartouche() {
    var rect = new fabric.Rect({
        left: 0,
        top: 0,
        stroke: 'orange',
        width: 600,
        height: 150,
        fill: 'transparent',
        strokeWidth: 3,
        rx: 30,
        ry: 30,
        originX: 'center',
        originY: 'center'
    });

    var lineOffset = 19;
    var line = new fabric.Line([0 - rect.width / 2 - lineOffset, -rect.height / 2, 0 - rect.width / 2 - lineOffset, rect.height / 2], {
        stroke: 'orange',
        strokeWidth: 20,
        selectable: false,
        originX: 'center',
        originY: 'center'
    });

    var cartouche = new fabric.Group([rect, line], {
        left: 100 + rect.width / 2,
        top: 100 + rect.height / 2,
        originX: 'center',
        originY: 'center'
    });

    // Generate unique ID
    cartouche.id = generateUniqueId();

    // Add to canvas
    canvas.add(cartouche);

    // Push to undoHistory instead of history
    undoHistory.push({
        type: 'add',
        object: cartouche.toJSON(['id']),
        id: cartouche.id
    });

    canvas.renderAll();
    return cartouche;
}
function addCircle() {
    var circle = new fabric.Circle({
        left: 150,
        top: 150,
        stroke: 'black',
        fill: 'transparent', // No fill color
        // fill: 'green',
        radius: 50
    });
    // Generate unique ID for the line
    circle.id = generateUniqueId();
    canvas.add(circle);

    // Push to history with the generated ID
    undoHistory.push({
        type: 'add',
        object: circle.toJSON(['id']), // Changed from rect to line
        id: circle.id
    });

    canvas.renderAll();
    return circle;
}
function addLine() {
    var x1 = 50, y1 = 100, x2 = 50, y2 = 400;
    var midX = (x1 + x2) / 2;
    var midY = (y1 + y2) / 2;

    var line = new fabric.Line([x1 - midX, y1 - midY, x2 - midX, y2 - midY], {
        left: 700 + midX,
        top: 100 + midY,
        stroke: 'black',
        strokeWidth: 3,
        originX: 'center',
        originY: 'center',
        selectable: true
    });

    // Generate unique ID for the line
    line.id = generateUniqueId();

    canvas.add(line);

    // Push to history with the generated ID
    undoHistory.push({
        type: 'add',
        object: line.toJSON(['id']), // Changed from rect to line
        id: line.id
    });

    canvas.renderAll();
    return line; // Changed from rect to line
}
function addArrow() {
    // Create a line from (100, 200) to (300, 200)
    var line = new fabric.Line([100 - 200, 200 - 200, 300 - 200, 200 - 200], {
        stroke: 'black',
        strokeWidth: 2,
        selectable: true,
        originX: 'center',
        originY: 'center'
    });

    // Create a triangle to use as the arrowhead
    var arrowhead = new fabric.Triangle({
        left: 100,  // Relative to group center
        top: 0,     // Relative to group center
        originX: 'center',
        originY: 'center',
        width: 10,
        height: 30,
        fill: 'black',
        angle: 90
    });

    // Create a group with the line and triangle
    var group = new fabric.Group([line, arrowhead], {
        left: 400 + 200,  // Matching the example's positioning
        top: 100 + 200,   // Matching the example's positioning
        originX: 'center',
        originY: 'center'
    });

    // Generate unique ID for the group
    group.id = generateUniqueId();

    canvas.add(group);

    // Push to history with the generated ID
    undoHistory.push({
        type: 'add',
        object: group.toJSON(['id']),
        id: group.id
    });

    canvas.renderAll();
    return group;
}
function addSquareBracket() {
    // Create the main vertical line
    const line = new fabric.Line([0, -50, 0, 50], {
        stroke: 'black',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center'
    });

    // Create top horizontal line
    const topLine = new fabric.Line([-15, -50, 0, -50], {
        stroke: 'black',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center'
    });

    // Create bottom horizontal line
    const bottomLine = new fabric.Line([-15, 50, 0, 50], {
        stroke: 'black',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center'
    });

    // Create a group with all lines
    const group = new fabric.Group([line, topLine, bottomLine], {
        left: 400,
        top: 300,
        originX: 'center',
        originY: 'center'
    });

    // Generate unique ID
    group.id = generateUniqueId();

    // Add to canvas
    canvas.add(group);

    // Add to history for undo
    undoHistory.push({
        type: 'add',
        object: group.toJSON(['id']),
        id: group.id
    });

    canvas.requestRenderAll();
    return group;
}
function addCustomRect(options = {}) {
    const defaults = {
        width: 200,
        height: 100,
        fill: 'transparent',
        stroke: 'orange',
        strokeWidth: 3,
        rx: 10,
        ry: 10,
        left: canvas.width / 2,
        top: canvas.height / 2,
        originX: 'center',
        originY: 'center',
        strokeUniform: true,
        selectable: true,
        hasControls: true
    };

    // Merge defaults with provided options
    const settings = { ...defaults, ...options };
    var rect = new fabric.Rect(settings);

    // Generate unique ID for the rectangle
    rect.id = generateUniqueId(); // Using your existing generateUniqueId function

    rect.setControlsVisibility({
        mt: true,
        mb: true,
        ml: true,
        mr: true,
        tl: true,
        tr: true,
        bl: true,
        br: true
    });

    canvas.add(rect);

    // Push to history with the generated ID
    undoHistory.push({
        type: 'add',
        object: rect.toJSON(['id']), // Include the id in the JSON
        id: rect.id
    });

    canvas.renderAll();
    return rect;
}
function addPencilLine() {
    const originalIsDrawingMode = canvas.isDrawingMode;

    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);

    // Customize the brush
    canvas.freeDrawingBrush.width = 2;          // Make lines thicker/thinner
    canvas.freeDrawingBrush.color = 'black';    // Change color
    canvas.freeDrawingBrush.strokeLineCap = 'round';    // round end caps
    canvas.freeDrawingBrush.strokeLineJoin = 'round';   // smooth line joins

    canvas.isDrawingMode = true;

    const originalPathCreated = canvas.onPathCreated;

    canvas.on('path:created', function pathCreatedHandler(e) {
        const path = e.path;
        path.id = generateUniqueId();

        undoHistory.push({
            type: 'add',
            object: path.toJSON(['id']),
            id: path.id
        });

        canvas.isDrawingMode = originalIsDrawingMode;
        canvas.off('path:created', pathCreatedHandler);

        if (originalPathCreated) {
            canvas.on('path:created', originalPathCreated);
        }
    });
}
function addSpeechBubble() {
    // Define the path with origin at center (0,0) for better scaling
    const path = 'M 0 -50 ' +             // Start at top center
        'A 50 50 0 1 1 0 50 ' +   // Draw right arc
        'L 0 50 ' +               // Line to bottom
        'L -30 70 ' +             // Tail point
        'L -10 50 ' +             // Back to bubble
        'A 50 50 0 1 1 0 -50 Z';  // Complete left arc and close

    const bubble = new fabric.Path(path, {
        left: 150,
        top: 150,
        stroke: 'black',
        fill: 'transparent',
        scaleX: 1.5,
        scaleY: 1.5,
        originX: 'center',
        originY: 'center',
        strokeWidth: 2,
        strokeUniform: true,    // Keep stroke width uniform during scaling
        objectCaching: false    // Disable caching for better rendering
    });

    // Add padding to ensure the path doesn't get clipped
    bubble.set({
        strokeWidth: bubble.strokeWidth,
        padding: 20
    });

    bubble.id = generateUniqueId();
    canvas.add(bubble);

    // Update history
    undoHistory.push({
        type: 'add',
        object: bubble.toJSON(['id']),
        id: bubble.id
    });

    canvas.renderAll();
    return bubble;
}
// ========================== KEYBOARD ===========================

// function openKeyboard() {
//     document.getElementById('keyboardDialog').style.display = 'block';
//     document.getElementById('keyboardOverlay').style.display = 'block';
//     document.getElementById('keyboardInput').focus();
// }
function openKeyboard() {
    document.getElementById('keyboardDialog').style.display = 'block';
    document.getElementById('keyboardOverlay').style.display = 'block';
    const keyboardInput = document.getElementById('keyboardInput');
    keyboardInput.focus();
    
    // Add keydown event listener for backspace handling
    keyboardInput.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace') {
            e.stopPropagation(); // Prevent the global backspace handler
        }
        // Handle Enter/Return key
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent form submission if within a form
            addKeyboardText();
        }
    });
}

function addKeyboardText() {
    const keyboardInput = document.getElementById('keyboardInput');
    const text = keyboardInput.value;
    
    if (text || text === '') {  // Changed condition to allow empty string
        if (activeTextObject) {
            // If we're editing an existing text object, just update it
            activeTextObject.text = text;
            canvas.renderAll();
            
            // Record the edit in history if needed
            undoHistory.push({
                type: 'modify',
                object: activeTextObject.toJSON(),
                id: activeTextObject.id
            });
        } else {
            // Create new text object at the clicked position
            var textBox = new fabric.IText(text, {
                left: textPosition.x,
                top: textPosition.y,
                fontSize: 18,
                borderColor: '#CCCCCC',
                cornerColor: '#CCCCCC',
                cornerSize: 6,
                transparentCorners: false
            });
            
            textBox.id = textBox.id || generateUniqueId();
            canvas.add(textBox);
            canvas.setActiveObject(textBox);
            
            undoHistory.push({
                type: 'add',
                object: textBox.toJSON(),
                id: textBox.id
            });
        }
    }
    closeKeyboard();
}

// Add this cleanup function to remove the event listener when closing the keyboard
function closeKeyboard() {
    const keyboardInput = document.getElementById('keyboardInput');
    // Remove the event listener when closing
    keyboardInput.removeEventListener('keydown', null);
    // Clear the input value
    keyboardInput.value = '';
    document.getElementById('keyboardDialog').style.display = 'none';
    document.getElementById('keyboardOverlay').style.display = 'none';
}
document.addEventListener('DOMContentLoaded', function() {
    const keyboardInput = document.getElementById('keyboardInput');    
    // Handle search input filtering
    searchInput.addEventListener('input', e => 
        filterAndDisplayCharacters(characters, e.target.value)
    );
    // Handle clicking keyboard buttons
    document.querySelectorAll('.key').forEach(key => {
        key.addEventListener('click', function() {
            const char = this.textContent;
            const cursorPos = keyboardInput.selectionStart;
            const textBefore = keyboardInput.value.substring(0, cursorPos);
            const textAfter = keyboardInput.value.substring(keyboardInput.selectionEnd);
            
            keyboardInput.value = textBefore + char + textAfter;
            keyboardInput.focus();
            const newPos = cursorPos + char.length;
            keyboardInput.setSelectionRange(newPos, newPos);
        });
    });

    // Close when clicking overlay
    document.getElementById('keyboardOverlay').addEventListener('click', closeKeyboard);
});

// ==================================== enhancements ===========================
function handleMdCInput(mdcString) {
    const glyphs = mdcString.split('-');
    const glyphWidth = 60;     
    const startX = 100;        
    const startY = 100;        
    const lineHeight = 30;     
    const margin = 50;         
    const maxLines = 14;       
    
    // Calculate how many glyphs can fit in one line
    const usableWidth = canvas.width - (2 * margin);
    const glyphsPerLine = Math.floor(usableWidth / glyphWidth);
    
    // Find existing objects to determine starting position
    const existingObjects = canvas.getObjects();
    let highestY = startY;
    if (existingObjects.length > 0) {
        highestY = existingObjects.reduce((maxY, obj) => {
            return Math.max(maxY, obj.top + obj.height);
        }, startY);
        highestY += lineHeight;
    }
    
    let xOffset = startX;
    let yPos = highestY;
    
    // Calculate available vertical space
    const usableHeight = canvas.height - margin;
    const availableLines = Math.floor((usableHeight - highestY) / lineHeight);
    let currentLine = 1;
    let glyphsInCurrentLine = 0;
    
    // Check if we have room for more lines
    if (availableLines <= 0) {
        alert('Canvas is full. Cannot add more glyphs.');
        return;
    }

    // Using for...of instead of forEach
    for (const glyph of glyphs) {
        // Stop if we've exceeded max lines or available space
        if (currentLine > Math.min(maxLines, availableLines)) {
            alert(`Reached line limit of ${Math.min(maxLines, availableLines)}`);
            return; // This will actually exit the function
        }
        
        const trimmedGlyph = glyph.trim();
        const match = characters.find(([code]) => code === trimmedGlyph.toUpperCase());
        
        if (match) {
            if (glyphsInCurrentLine >= glyphsPerLine) {
                xOffset = startX;
                yPos += lineHeight;
                currentLine++;
                glyphsInCurrentLine = 0;
                
                if (currentLine > Math.min(maxLines, availableLines)) {
                    alert(`Reached line limit of ${Math.min(maxLines, availableLines)}`);
                    return; // This will actually exit the function
                }
            }
            
            addCharacterToCanvas(match[1], match[0], xOffset, yPos);
            xOffset += glyphWidth;
            glyphsInCurrentLine++;
        }
    }
}
// =================================== EVENT LISTENERS ========================

document.getElementById("dropdownButton").addEventListener("click", () => {
    const content = document.getElementById("dropdownContent");
    content.style.display = content.style.display === "block" ? "none" : "block";
});

document.getElementById('help').addEventListener('click', function () {
    var helpOverlay = document.getElementById('helpOverlay');
    helpOverlay.style.display = helpOverlay.style.display === 'flex' ? 'none' : 'flex';
});

// Help content: Click outside iframe to close
document.getElementById('helpOverlay').addEventListener('click', function (e) {
    if (e.target === this) { // Only if clicking outside the iframe
        this.style.display = 'none';
    }
});
document.getElementById('searchInput').addEventListener('input', (e) => {
    // Filter and display characters based on the search query
    filterAndDisplayCharacters(characters, e.target.value);
});
// Add event listeners to the save and load buttons
document.getElementById('saveWorkspaceBtn').addEventListener('click', saveWorkspace);
document.getElementById('loadWorkspaceBtn').addEventListener('click', loadWorkspace);

//============================ Adds char to Gardiner field ===================
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('charListContainer');
    container.addEventListener('dragstart', (event) => {
        // Check if className exists and is a string
        if (event.target.className && typeof event.target.className === 'string' && 
            event.target.className.includes('char-container')) {
            event.dataTransfer.setData('text/plain', event.target.querySelector('.char').textContent);
        }
    }, false);
});
// ===================== BG load =================================
// Background image handling
document.addEventListener('DOMContentLoaded', function() {
    const bgImageInput = document.getElementById('bgImageInput');
    const bgImage = document.getElementById('bgImage');
    const opacitySlider = document.getElementById('bgOpacity');
    const zoomSlider = document.getElementById('bgZoom');
    
    // Add transition style for smooth transformations
    bgImage.style.transition = 'transform 0.2s, opacity 0.2s';

    // Function to reset image state
    function resetImageState() {
        bgImage.style.transform = 'translate(-50%, -50%) scale(1)';
        bgImage.style.opacity = '0.5';
        bgImage.style.position = 'absolute';
        bgImage.style.left = '50%';
        bgImage.style.top = '50%';
        bgImage.style.objectFit = 'contain';
        bgImage.style.maxWidth = '100%';
        bgImage.style.maxHeight = '100%';
        opacitySlider.value = 50;
        zoomSlider.value = 100;
    }

    // Function to handle image loading
    function handleImageLoad(imageUrl) {
        resetImageState();
        bgImage.src = imageUrl;
        bgImage.style.display = 'block';
    }

    // Background image handling
    bgImageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                handleImageLoad(event.target.result);
                
                // Clear the input value to allow the same file to be selected again
                bgImageInput.value = '';
            };
            reader.readAsDataURL(file);
        }
    });

    // Opacity control with debounce
    let opacityTimeout;
    opacitySlider.addEventListener('input', function(e) {
        clearTimeout(opacityTimeout);
        opacityTimeout = setTimeout(() => {
            bgImage.style.opacity = e.target.value / 100;
        }, 5); // 5ms debounce
    });

    // Zoom control with debounce and maintained center position
    let zoomTimeout;
    zoomSlider.addEventListener('input', function(e) {
        clearTimeout(zoomTimeout);
        zoomTimeout = setTimeout(() => {
            const scale = e.target.value / 100;
            bgImage.style.transform = `translate(-50%, -50%) scale(${scale})`;
        }, 5); // 5ms debounce
    });

    // Enhanced remove background function
    window.removeBackground = function() {
        bgImage.style.display = 'none';
        
        // Clear the source after a short delay to ensure proper cleanup
        setTimeout(() => {
            bgImage.src = '';
            resetImageState();
            
            // Clear the file input
            bgImageInput.value = '';
        }, 50);
    };

    // Initial reset
    resetImageState();
});
// ================================== Autosave config option ======================================

// // Autosave configuration
// const AUTOSAVE_INTERVAL = 90000;
// const SAVE_KEY = 'canvas_autosave';
// const DEBOUNCE_WAIT = 2000; // Increased from 1000ms to reduce save frequency
// const BATCH_SIZE = 10; // Number of changes before forcing a save

// // Performance optimization: Track number of changes
// let changeCount = 0;
// let lastSaveTime = Date.now();

// // Optimized debounce with maximum wait time
// function debounce(func, wait, maxWait) {
//     let timeout;
//     let lastCallTime;

//     return function executedFunction(...args) {
//         const now = Date.now();

//         // Force save if max wait time exceeded
//         if (lastCallTime && (now - lastCallTime) > maxWait) {
//             clearTimeout(timeout);
//             func.apply(this, args);
//             lastCallTime = now;
//             return;
//         }

//         lastCallTime = now;

//         clearTimeout(timeout);
//         timeout = setTimeout(() => {
//             func.apply(this, args);
//         }, wait);
//     };
// }

// Create and add program title/watermark -- DO NOT DELETE --
const programTitle = document.createElement('div');
programTitle.textContent = 'ΙΕΡΟΓΛΥΦΩ';
programTitle.style.cssText = `
    position: absolute;
    top: 50px;
    left: 11px;
    font-size: 22px;
    font-family: 'Arial', sans-serif;
    font-weight: bold;
    color: rgba(255, 255, 255, 0.13);
    pointer-events: none;
    user-select: none;
    z-index: 1000;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
    letter-spacing: 3px;
`;
document.getElementById('backgroundContainer').appendChild(programTitle);
// ============================================ kick it! ===================================================
function updateDivWidth() {
    const canvasWidth = getCanvasDimensions().width;
    document.getElementById('pastedNamesContainer').style.width = `${canvasWidth}px`;
}

// Set initial width
updateDivWidth();

// Update on window resize

window.addEventListener('load', () => window.outerWidth < screen.availWidth && alert('Please maximize your window for the best experience'));
window.addEventListener('resize', function() {
    // Clear the timeout if it exists
    if (resizeTimeout) {
        clearTimeout(resizeTimeout);
    }

    // Set a timeout to prevent excessive resizing
    resizeTimeout = setTimeout(function() {
        // Get new dimensions
        const dimensions = getCanvasDimensions();
        
        // Update canvas dimensions
        canvas.setDimensions({
            width: dimensions.width,
            height: dimensions.height
        }, {
            cssOnly: false
        });
        
        // Recalculate the grid
        clearExistingGrid();
        drawGrid();
        
        // Update viewport transform to maintain zoom and pan
        const zoom = canvas.getZoom();
        const vpt = canvas.viewportTransform;
        canvas.setViewportTransform([
            zoom, 0, 0, zoom, 
            vpt[4], vpt[5]
        ]);
        
        // Force a full re-render
        canvas.requestRenderAll();
    }, 200); // 200ms delay to debounce resize events
});

// Add window beforeunload event
window.addEventListener('beforeunload', function(e) {
    if (canvasModified) {
        e.preventDefault();
        // Most modern browsers ignore custom messages and show their own
        return e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    }
});
window.addEventListener('keydown', function (e) {
    const activeObject = canvas.getActiveObject();
    const activeGroup = canvas.getActiveObjects();
    const isInSearchInput = e.target.id === 'searchInput';
    // Handle cycling through objects (Ctrl + Arrow Keys)
    if (e.shiftKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault(); // Prevent default browser behavior

        const objects = canvas.getObjects();
        let currentIndex = objects.indexOf(activeObject);
        
        // Determine the next or previous index
        if (e.key === 'ArrowRight') {
            currentIndex = (currentIndex + 1) % objects.length;
        } else if (e.key === 'ArrowLeft') {
            currentIndex = (currentIndex - 1 + objects.length) % objects.length;
        }

        // Set the new active object
        canvas.setActiveObject(objects[currentIndex]);
        canvas.requestRenderAll();
    }
    // Handle Save (Ctrl+S)
    if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault(); // Prevent browser's save dialog
        saveWorkspace();
    }

    // Handle Background Remove (Ctrl+B)
    if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault(); // Prevent browser's bold command
        if (canvas.backgroundImage) {
            removeBackground();
            canvas.requestRenderAll();
        }
    }

    // Handling Delete or Backspace
    if (e.key === 'Delete' || e.key === 'Backspace') {
        // If we're in the search input, let it handle backspace naturally
        if (isInSearchInput) {
            return; // Let the default backspace behavior work
        }
        
        // Prevent backspace from navigating back only when not in search input
        e.preventDefault();
        
        // Handle your canvas/workspace deletion logic here
        const activeObject = canvas.getActiveObject();
        const activeGroup = canvas.getActiveObjects();
        
        if (activeGroup && activeGroup.length > 0) {
            activeGroup.forEach(object => {
                storeAndRemoveCharacter(object);
            });
            canvas.discardActiveObject();
            canvas.requestRenderAll();
        } else if (activeObject) {
            storeAndRemoveCharacter(activeObject);
            canvas.discardActiveObject();
            canvas.requestRenderAll();
        }
    }

    // Alignment shortcuts
    if (e.key === 'h' || e.key === 'H') {
        alignObjects('horizontal');
    }
    if (e.key === 't' || e.key === 'T') {
        alignObjects('top');
    }
    if (e.key === 'b' || e.key === 'B') {
        if (!e.ctrlKey) { // Only align if Ctrl isn't pressed
            alignObjects('bottom');
        }
    }
    if (e.key === 'r' || e.key === 'R') {
        mirrorTextObject(activeObject);
    }
    if (e.key === 'l' || e.key === 'L') {
        alignObjects('left');
    }

    // Handling Arrow Keys
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        if (activeObject) {
            const moveAmount = e.shiftKey ? 1 : 5; // Smaller movements with Shift key
            switch (e.key) {
                case 'ArrowLeft': activeObject.set('left', activeObject.left - moveAmount); break;
                case 'ArrowRight': activeObject.set('left', activeObject.left + moveAmount); break;
                case 'ArrowUp': activeObject.set('top', activeObject.top - moveAmount); break;
                case 'ArrowDown': activeObject.set('top', activeObject.top + moveAmount); break;
            }
            activeObject.setCoords();
            canvas.requestRenderAll();
        }
    }

    // Undo (Ctrl+Z)
    if (e.ctrlKey && e.key === 'z') {
        undoLastAction();
    }
});