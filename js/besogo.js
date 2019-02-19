/**
* @fileOverview Namespace declaration and construction of the main editor object.
* @version 0.0.1-TW-alpha
*/

/**
 * sgf editor module.
 * @module besogo
 */

'use strict';

/**
* besogo is the namespace holding all the editor's 
* components and the sgf data
* @namespace
*/
var besogo =  {}; /** Generic object as namespace for the module  */
besogo.VERSION = '0.0.1-TW-alpha';

/**
* Creates the complete sgf editor with all its panel component.
* @param {div} container - The div that will contain the the editor
* @param {object} options - The editor options, provides defaults
*  
*/
besogo.create = function(container, options) {
    var editor, /** Core editor object */
        resizer, /** Auto-resizing function */
        boardDiv, /** Board display container */
        panelsDiv, /** Parent container of panel divs */
        makers = { /** Map to panel creators */
            control: besogo.makeControlPanel,
            names: besogo.makeNamesPanel,
            comment: besogo.makeCommentPanel,
            tool: besogo.makeToolPanel,
            tree: besogo.makeTreePanel,
            file: besogo.makeFilePanel
        },
        insideText = container.textContent || container.innerText || '', /** the sgf record */
        i, panelName; // Scratch iteration variables

    container.className += ' besogo-container'; // Marks this div as initialized

    // Process options and set defaults
    options = options || {}; // Makes option checking simpler
    options.size = besogo.parseSize(options.size || 19);
    options.coord = options.coord || 'none';
    options.tool = options.tool || 'auto';
    if (options.panels === '') {
        options.panels = [];
    }
    options.panels = options.panels || 'control+names+comment+tool+tree+file';
    if (typeof options.panels === 'string') {
        options.panels = options.panels.split('+');
    }
    options.path = options.path || '';
    if (options.shadows === undefined) {
        options.shadows = 'auto';
    } else if (options.shadows === 'off') {
        options.shadows = false;
    }

    /** Make the core editor object */
    editor = besogo.makeEditor(options.size.x, options.size.y);
    editor.setTool(options.tool);
    editor.setCoordStyle(options.coord);
    if (options.realstones) { // Using realistic stones
        editor.REAL_STONES = true;
        editor.SHADOWS = options.shadows;
    } else { // SVG stones
        editor.SHADOWS = (options.shadows && options.shadows !== 'auto');
    }

    if (!options.nokeys) { // Add keypress handler unless nokeys option is truthy
        addKeypressHandler(container, editor);
    }

    if (options.sgf) { // Load SGF file from URL
        try {
            fetchParseLoad(options.sgf, editor, options.path);
        } catch(e) {
            // Silently fail on network error
        }
    } else if (insideText.match(/\s*\(\s*;/)) { // Text content looks like an SGF file
        parseAndLoad(insideText, editor);
        navigatePath(editor, options.path); // Navigate editor along path
    }

    if (typeof options.variants === 'number' || typeof options.variants === 'string') {
        editor.setVariantStyle(+options.variants); // Converts to number
    }

    while (container.firstChild) { // Remove all children of container
        container.removeChild(container.firstChild);
    }

    /** Make the div for the board display */
    boardDiv = makeDiv('besogo-board'); // Create div for board display
    besogo.makeBoardDisplay(boardDiv, editor); // Create board display

    if (!options.nowheel) { // Add mousewheel handler unless nowheel option is truthy
        addWheelHandler(boardDiv, editor);
    }

    if (options.panels.length > 0) { // Only create if there are panels to add
        panelsDiv = makeDiv('besogo-panels');
        for (i = 0; i < options.panels.length; i++) {
            panelName = options.panels[i];
            if (makers[panelName]) { // Only add if creator function exists
                makers[panelName](makeDiv('besogo-' + panelName, panelsDiv), editor);
            }
        }
        if (!panelsDiv.firstChild) { // If no panels were added
            container.removeChild(panelsDiv); // Remove the panels div
            panelsDiv = false; // Flags panels div as removed
        }
    }

    options.resize = options.resize || 'auto';

    if (options.resize === 'auto') { // Add auto-resizing unless resize option is truthy
        resizer = function() {
            var windowHeight = window.innerHeight, // Viewport height
                // Width of parent element is passed as an option
                // by the function calling the constructor. 
                parentWidth = options.parentWidth,
                maxWidth = +(options.maxwidth || -1),
                orientation = options.orient || 'auto',

                portraitRatio = +(options.portratio || 200) / 100,
                landscapeRatio = +(options.landratio || 200) / 100,
                minPanelsWidth = +(options.minpanelswidth || 350),
                minPanelsHeight = +(options.minpanelsheight || 400),
                minLandscapeWidth = +(options.transwidth || 600),

                // Initial width parent
                width = (maxWidth > 0 && maxWidth < parentWidth) ? maxWidth : parentWidth,
                height; // Initial height is undefined

            // Determine orientation if 'auto' or 'view'
            if (orientation !== 'portrait' && orientation !== 'landscape') {
                if (width < minLandscapeWidth || (orientation === 'view' && width < windowHeight)) {
                    orientation = 'portrait';
                } else {
                    orientation = 'landscape';
                }
            }

            if (orientation === 'portrait') { // Portrait mode
                if (!isNaN(portraitRatio)) {
                    height = portraitRatio * width;
                    if (panelsDiv) {
                        height = (height - width < minPanelsHeight) ? width + minPanelsHeight : height;
                    }
                } // Otherwise, leave height undefined
            } else if (orientation === 'landscape') { // Landscape mode
                if (!panelsDiv) { // No panels div
                    height = width; // Square overall
                } else if (isNaN(landscapeRatio)) {
                    height = windowHeight;
                } else { // Otherwise use ratio
                    height = width / landscapeRatio;
                }

                if (panelsDiv) {
                    // Reduce height to ensure minimum width of panels div
                    height = (width < height + minPanelsWidth) ? (width - minPanelsWidth) : height;
                }
            }

            setDimensions(width, height);
            container.style.width = width + 'px';
        };
        window.addEventListener("resize", resizer);
        resizer(); // Initial div sizing
    } else if (options.resize === 'fixed') {
        setDimensions(container.clientWidth, container.clientHeight);
    }

    /** Sets dimensions with optional height param, uses flex
    *   Switches to portrait mode if height missing 
    * @param {int} width  - The width of the div to set up in px
    * @param {int} [height] - The optional height of the div to set up in px
    */
    function setDimensions(width, height) {
        if (height && width > height) { // Landscape mode
            container.style['flex-direction'] = 'row';
            boardDiv.style.height = height + 'px';
            boardDiv.style.width = height + 'px';
            if (panelsDiv) {
                panelsDiv.style.height = height + 'px';
                panelsDiv.style.width = (width - height) + 'px';
            }
        } else { // Portrait mode (implied if height is missing)
            container.style['flex-direction'] = 'column';
            boardDiv.style.height = width + 'px';
            boardDiv.style.width = width + 'px';
            if (panelsDiv) {
                if (height) { // Only set height if param present
                    panelsDiv.style.height = (height - width) + 'px';
                }
                panelsDiv.style.width = width + 'px';
            }
        }
    }

/** Creates and adds div to specified parent or container
* @param {string} className - the class for the returned div 
* @param  {element} parent   - the parent element of the returned div
* @returns {div} - The created div 
*/
    function makeDiv(className, parent) {
        var div = document.createElement("div");
        if (className) {
            div.className = className;
        }
        parent = parent || container;
        parent.appendChild(div);
        return div;
    }
}; // END function besogo.create

/**
 * Parses size parameter from SGF format
 * 
 * @param {string} input - Either a number  for square boards or a nxn pattern 
 */
besogo.parseSize = function(input) {
    var matches,
        sizeX,
        sizeY;

    input = (input + '').replace(/\s/g, ''); // Convert to string and remove whitespace

    matches = input.match(/^(\d+):(\d+)$/); // Check for #:# pattern
    if (matches) { // Composed value pattern found
        sizeX = +matches[1]; // Convert to numbers
        sizeY = +matches[2];
    } else if (input.match(/^\d+$/)) { // Check for # pattern
        sizeX = +input; // Convert to numbers
        sizeY = +input; // Implied square
    } else { // Invalid input format
        sizeX = sizeY = 19; // Default size value
    }
    if (sizeX > 52 || sizeX < 1 || sizeY > 52 || sizeY < 1) {
        sizeX = sizeY = 19; // Out of range, set to default
    }

    return { x: sizeX, y: sizeY };
};

/** Init function: converts calling document elements into besogo instances
*   Not usable in TiddlyWiki
*/
besogo.autoInit = function() {
    var allDivs = document.getElementsByTagName('div'), // Live collection of divs
        targetDivs = [], // List of divs to auto-initialize
        options, // Structure to hold options
        i, j, attrs; // Scratch iteration variables

    for (i = 0; i < allDivs.length; i++) { // Iterate over all divs
        if ( (hasClass(allDivs[i], 'besogo-editor') || // Has an auto-init class
              hasClass(allDivs[i], 'besogo-viewer') ||
              hasClass(allDivs[i], 'besogo-diagram')) &&
             !hasClass(allDivs[i], 'besogo-container') ) { // Not already initialized
                targetDivs.push(allDivs[i]);
        }
    }

    for (i = 0; i < targetDivs.length; i++) { // Iterate over target divs
        options = {}; // Clear the options struct
        if (hasClass(targetDivs[i], 'besogo-editor')) {
            options.panels = ['control', 'names', 'comment', 'tool', 'tree', 'file'];
            options.tool = 'auto';
        } else if (hasClass(targetDivs[i], 'besogo-viewer')) {
            options.panels = ['control', 'names', 'comment'];
            options.tool = 'navOnly';
        } else if (hasClass(targetDivs[i], 'besogo-diagram')) {
            options.panels = [];
            options.tool = 'navOnly';
        }

        attrs = targetDivs[i].attributes;
        for (j = 0; j < attrs.length; j++) { // Load attributes as options
            options[attrs[j].name] = attrs[j].value;
        }
        besogo.create(targetDivs[i], options);
    }
/**
* Returns classname of element, if any
* @param {element} element - The DOM element
* @param {string} str  - A classname  
* @returns {boolean}
*/
    function hasClass(element, str) {
        return (element.className.split(' ').indexOf(str) !== -1);
    }
};

/**
 * Sets up keypress handling
 * 
 * @param {div} container - The container of the editor
 * @param {editor} editor - A besogo editor 
 */
function addKeypressHandler(container, editor) {
    if (!container.getAttribute('tabindex')) {
        container.setAttribute('tabindex', '0'); // Set tabindex to allow div focusing
    }

    container.addEventListener('keydown', function(evt) {
        evt = evt || window.event;
        switch (evt.keyCode) {
            case 33: // page up
                editor.prevNode(10);
                break;
            case 34: // page down
                editor.nextNode(10);
                break;
            case 35: // end
                editor.nextNode(-1);
                break;
            case 36: // home
                editor.prevNode(-1);
                break;
            case 37: // left
                editor.prevNode(1);
                break;
            case 38: // up
                editor.nextSibling(-1);
                break;
            case 39: // right
                editor.nextNode(1);
                break;
            case 40: // down
                editor.nextSibling(1);
                break;
            case 46: // delete
                editor.cutCurrent();
                break;
        } // END switch (evt.keyCode)
        if (evt.keyCode >= 33 && evt.keyCode <= 40) {
            evt.preventDefault(); // Suppress page nav controls
        }
    }); // END func() and addEventListener
} // END function addKeypressHandler

/** 
*Sets up mousewheel handling
* @param {div} boardDiv - The div containing the sgf editor
* @param {@{besogo}} editor - The sgf editor object 
*/
function addWheelHandler(boardDiv, editor) {
    boardDiv.addEventListener('wheel', function(evt) {
        evt = evt || window.event;
        if (evt.deltaY > 0) {
            editor.nextNode(1);
            evt.preventDefault();
        } else if (evt.deltaY < 0) {
            editor.prevNode(1);
            evt.preventDefault();
        }
    });
}

/** 
*Parses SGF string and loads into editor
* @param {string} text - The sgf record of a go game 
* @param {editor} editor - The sgf editor object 
*/
function parseAndLoad(text, editor) {
    var sgf;
    try {
        sgf = besogo.parseSgf(text);
    } catch (error) {
        return; // Silently fail on parse error
    }
    besogo.loadSgf(sgf, editor);
}

/** 
*Fetches sgf record from url from some move
* @param{string} url - The url of the sgf record to fetch 
* @path{string} path - The starting point the loaded  game will start from
* @param {editor} editor - The {@link editor} object 
*/
function fetchParseLoad(url, editor, path) {
    var http = new XMLHttpRequest();

    http.onreadystatechange = function() {
        if (http.readyState === 4 && http.status === 200) { // Successful fetch
            parseAndLoad(http.responseText, editor);
            navigatePath(editor, path);
        }
    };
    http.overrideMimeType('text/plain'); // Prevents XML parsing and warnings
    http.open("GET", url, true); // Asynchronous load
    http.send();
}

/**
* Navigates the given path through the sgf record  
* @param {string} path - The path leading to the game move
* @param {editor} editor - The sgf {@link editor} object 
*/
function navigatePath(editor, path) {
    var subPaths,
        i, j; // Scratch iteration variables

    path = path.split(/[Nn]+/); // Split into parts that start in next mode
    for (i = 0; i < path.length; i++) {
        subPaths = path[i].split(/[Bb]+/); // Split on switches into branch mode
        executeMoves(subPaths[0], false); // Next mode moves
        for (j = 1; j < subPaths.length; j++) { // Intentionally starting at 1
            executeMoves(subPaths[j], true); // Branch mode moves
        }
    }

/**
* Executes moves
* @param {path} part   - A path
* @param {boolean} branch - Whether to branch or not 
*/
    function executeMoves(part, branch) {
        var i;
        part = part.split(/\D+/); // Split on non-digits
        for (i = 0; i < part.length; i++) {
            if (part[i]) { // Skip empty strings
                if (branch) { // Branch mode
                    if (editor.getCurrent().children.length) {
                        editor.nextNode(1);
                        editor.nextSibling(part[i] - 1);
                    }
                } else { // Next mode
                    editor.nextNode(+part[i]); // Converts to number
                }
            }
        }
    }
}

; // END general besogo object declaration
