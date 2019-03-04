/**
* @fileOverview Namespace declaration and construction of the main editor object.
* @version 0.0.3-TW-alpha
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
        panelsDiv, /** Parent container of panel divs (not used in TW5 version)*/
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
    options.label = options.label || '1';
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
    editor.setLabel(options.label);
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

    // TW5: set current node  to stored position, defaults to root
    var previousPosInTree = besogo.widget.wiki.getTiddler(besogo.widget.getVariable("currentTiddler")).fields["editor-pos-in-tree"];
    // If we are at root do nothing
    if (previousPosInTree &&  previousPosInTree !== "0,0"){
        goToPosInTree(previousPosInTree.trim().split(",")[0],
                      previousPosInTree.trim().split(",")[1], editor);
    };
    

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
    // SF: move all the panels we are making to children of the container div, ignore panelsDiv 
    if (options.panels.length > 0) { // Only create if there are panels to add
        for (i = 0; i < options.panels.length; i++) {
            panelName = options.panels[i];
            if (makers[panelName]) { // Only add if creator function exists
                //SF: removed panelsDiv from next line, makeDiv defaults to container
                makers[panelName](makeDiv('besogo-' + panelName, container), editor);
            }
        }
    //     SF: removed these lines, panelsDiv is now empty 
    //     if (!panelsDiv.firstChild) { // If no panels were added
    //         container.removeChild(panelsDiv); // Remove the panels div
    //         panelsDiv = false; // Flags panels div as removed
    //     }
    }

    options.resize = options.resize || 'fixed';  // Always default to fix for TW-5

    if (options.resize === 'auto') { // Add auto-resizing unless resize option is truthy
        // Width of parent element is passed as an option
        // by the function calling the constructor. 
        var parentWidth = options.parentWidth,
        maxWidth = +(options.maxwidth || -1),
         // Initial width parent
         width = (maxWidth > 0 && maxWidth < parentWidth) ? maxWidth : parentWidth;

        resizer = function() {
            var windowHeight = window.innerHeight, // Viewport height
                orientation = options.orient || 'auto',
                portraitRatio = +(options.portratio || 200) / 100,
                landscapeRatio = +(options.landratio || 200) / 100,
                minPanelsWidth = +(options.minpanelswidth || 350),
                minPanelsHeight = +(options.minpanelsheight || 400),
                minLandscapeWidth = +(options.transwidth || 600),
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
    } else if (options.resize === 'fixed') { //Set to fixed ratio if in TW5
        if (options.TW5Ratio){
            setDimensions(width, width *  options.TW5Ratio);
        }
        else{
            setDimensions(container.clientWidth, container.clientHeight);
        }
    }

    /** Sets dimensions with optional height param, uses flex
    *   Switches to portrait mode if height missing 
    * @param {int} width    - The width of the div to set up in px
    * @param {int} [height] - The optional height of the div to set up in px
    */
    //SF: FIXME: Need to change this function to switch to new CSS-grid layout. NO FLEX! 
    function setDimensions(width, height) {
        // SF: Quick hack for testing
        // Do nothing! All div's dimensions are set by CSS-grid
    }
    //   ORIGINAL CODE ALL COMMENTED OUT    
    //     if (height && width > height) { // Landscape mode
    //         container.style['flex-direction'] = 'row';
    //         boardDiv.style.height = height + 'px';
    //         boardDiv.style.width = height + 'px';
    //         if (panelsDiv) {
    //             panelsDiv.style.height = height + 'px';
    //             panelsDiv.style.width = (width - height) + 'px';
    //         }
    //     } else { // Portrait mode (implied if height is missing)
    //         container.style['flex-direction'] = 'column';
    //         boardDiv.style.height = width + 'px';
    //         boardDiv.style.width = width + 'px';
    //         if (panelsDiv) {
    //             if (height) { // Only set height if param present
    //                 panelsDiv.style.height = (height - width) + 'px';
    //             }
    //             panelsDiv.style.width = width + 'px';
    //         }
    //     }
    // }

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
/**
*  TW5: Additional functions Tiddlywiki 5 needs to keep the 
* editor's game tree in sync with the underlying tiddler
*/
    /** 
    * TW5: Adds an event listener to the besogo editor 
    * with the callback function
    *        
    * @param {function} tiddlerUpdate - the callback function to update the tiddler
    */
    editor.addListener(tiddlerUpdate); 

    /**
    * TW5: Updates the widget's underlying tiddler
    * @param {Object} msg - The message sent from the notifier
    */
    function tiddlerUpdate (msg){
        var tiddlerTitle = besogo.widget.parentWidget.transcludeTitle;
        if (msg.treeChange || msg.stoneChange ||
            msg.markupChange || msg.comment ||
            msg.coord || msg.label ||
            msg.tool || msg.variantStyle){
            
            saveSgfToTiddler(tiddlerTitle);
            saveTW5OptionsToTiddler(tiddlerTitle);
        };
        if (msg.gameInfo){
            saveInfoToTiddler(tiddlerTitle);
        };
        savePosToTiddler(tiddlerTitle);
    }

    /** 
    * TW5: save goban size and editor options into 
    *      widget's underlying tiddler's fields
    * @param {string} tiddlerTitle - The title of the underlying tiddler 
    *                                holding the sgf record  
    */ 
    function saveTW5OptionsToTiddler(tiddlerTitle){
        var options = {};  //editor options to save in tiddler
        options.tool = editor.getTool();
        options.label = editor.getLabel();
        options.variantStyle=editor.getVariantStyle();
        options.coord=editor.getCoordStyle();  ; 
        besogo.widget.wiki.setText(tiddlerTitle, "size", null,
                                   editor.getRoot().getSize().x+":" +
                                   editor.getRoot().getSize().y, null);
        for (var option in options){
            besogo.widget.wiki.setText(tiddlerTitle, option, null,
                                       options[option], null);
        }
    }

    /**
    * TW5: Asks the editor for all the info about the current game 
    * and saves them to the widget's underlying tiddler.
    * @param {string} tiddlerTitle - The title of the underlying tiddler 
                                     holding the sgf record  
    */
    function saveInfoToTiddler (tiddlerTitle){
        var gameInfo = editor.getGameInfo(tiddlerTitle);
        for (var field in gameInfo){
            var fieldName = besogo.sgfInfoToTW5[field];
            var fieldValue = gameInfo[field];
            besogo.widget.wiki.setText(tiddlerTitle, fieldName, null, fieldValue, null);
        };
    };
    
    /**
    * TW5: Creates the sgf record from the tree and 
    *      saves it to the editor's widget's underlying tiddler.
    * @param {string} tiddlerTitle - The title of the underlying tiddler 
                                     holding the sgf record  
    */
    function saveSgfToTiddler(tiddlerTitle){
        besogo.widget.wiki.setText(tiddlerTitle, "text", null,
                                   besogo.composeSgf(editor), null);
    }

    /**
    * TW5: Save current position in the game tree to tiddler.
    *      Needed because TW5 saves and reloads the game record 
    *      on every tree change. 
    */
    function savePosToTiddler(tiddlerTitle){
        besogo.widget.wiki.setText(tiddlerTitle, "editor-pos-in-tree", null, moveFromNode(editor.getCurrent()), null);
    }

    /**
    * TW5: Returns a  x,y string indicating move (x) and variation (y)
    *      of given node. TW5 needs to save current position in tree, 
    *      because it is reloaded on every editor change. 
    * @param {node} node - A position in the game tree.
    */
    function moveFromNode(node){
        var x, y = 0;
        x = node.moveNumber;
        if (x===0){
            y = 0;   // we are at the root, return 0,0
        }
        else {
            for (var sibling of node.parent.children){
                y++;
                if (sibling.move == node.move){
                    break;
                }
            }
        }
        return x + "," + y; 
    }
    /** 
    * TW5: Navigates to move m and variation v in game tree
    * @param {int} m - The move (depth level) in the game tree
    * @param {int] v - The variant (breadth span) of move m
    * @param {editor} editor - The besogo editor holding the game tree
    */
    function goToPosInTree(m,v,editor){
        editor.nextNode(m); //Goes to first variation of move m 
        var siblings = editor.getCurrent().parent.children;
        editor.setCurrent(siblings[v-1]); // Choose the v-th sibling, 0-based
        for (var i = 0; i< m; i++){
            
        }
    };

    
    /** TW5: The map between sgf format's cryptic gameInfo codes 
    *   and TW5's field names. From the official specs at: 
    *   https://www.red-bean.com/sgf/properties.html#AN
    */
        besogo.sgfInfoToTW5 = {
            "AP" : "application",
            "CA" : "charset",
            "FF" : "file-format",
            "SZ" : "size",  
            "AN" : "annotator",
            "BR" : "black-rank",
            "BT" : "black-team",
            "CP" : "copyright",
            "DT" : "date",
            "EV" : "event",
            "GN" : "game-name",
            "GC" : "game-summary-info",
            "ON" : "opening",
            "OT" : "overtime",
            "PB" : "black-player",
            "PC" : "location",
            "PW" : "white-player",
            "RE" : "result",
            "RO" : "round-number",
            "RU" : "rules",
            "SO" : "source",
            "TM" : "time-limits",
            "US" : "sgf-creator",
            "WR" : "white-rank",
            "WT" : "white-team",
            "HA" : "handicap",
            "KM" : "komi" 
        };  // END TW5 update code
    
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
};

// END general besogo object declaration
