/*
 * DodgeLabels: Transform labels for a canvas into non-overlapping rows
 * Author: Bremen Braun
 */
function LabelDodge(context, opts) {
	this.context = context;
	
	opts = opts || {}
	this.left = opts.left || 0;
	this.lineLength = opts.lineLength || 10;
}

LabelDodge.prototype = function() {
	var rows = [], // rows with drawing functions postponed until dodge is called so that their coordinates can be recursively updated
	    drawLibEnd, // function to be called by the dodger after all dodgeDrawLib operations are completed. Defined here so it can only be accessed internally
		
		/*
		 * Canvas drawing operations which are dodging versions of their 
		 * regular context equivalents.
		 *
		 * TODO: Add more canvas drawing functions
		 */
	    dodgeDrawLib = function(dodger, withLine) {
			this.fillStyle = dodger.context.fillStyle;
			this.strokeStyle = dodger.context.strokeStyle;
			
			var row = { // rows should dodge together
					y: undefined,
					height: 0,
					items: [],
					draw: function() {
						for (var i = 0; i < this.items.length; i++) {
							this.items[i].op();
						}
					}
			    },
			    rowLineDrawn = false;
			
			/*
			 * Just like the regular ctx.drawImage except this one detects overlap and pushes the draw coordinates down
			 */
			this.drawImage = function(img, x, y, width, height) {
				height = height/2
				var fillStyle = this.fillStyle, // save the fill style for the op closure
				    strokeStyle = this.strokeStyle,
					func = {
						x: x,
						y: y,
						width: width,
						height: height,
						op: function() {
							dodger.context.fillStyle = fillStyle;
							dodger.context.strokeStyle = strokeStyle;
							
							if (withLine) {
								if (!rowLineDrawn) {
									dodger.context.beginPath();
									dodger.context.moveTo(dodger.left, y);
									dodger.context.lineTo(dodger.left + dodger.lineLength + this.x, row.y);
									dodger.context.stroke();
								}
								
								this.x += dodger.lineLength;
								
								rowLineDrawn = true;
							}
							
							dodger.context.drawImage(img, dodger.left + this.x, row.y-this.height, this.width, this.height); //FIXME: Use a combination of y from row and this
						}
					};
				
				/* Update row */
				if (typeof row.y === 'undefined' || y < row.y) {
					row.y = y;
				}
				if (func.height > row.height) { 
					row.height = func.height; // FIXME
				}
				row.items.push(func);
			};
			
			/*
			 * Just like the regular ctx.fillText except this one detects overlap and pushes the coordinates down
			 */
			this.fillText = function(text, x, y) {
				var fillStyle = this.fillStyle,
				    strokeStyle = this.strokeStyle,
					func = {
						x: x,
						y: y,
						width: dodger.context.measureText(text).width,
						height: 8,
						op: function() {
							dodger.context.fillStyle = fillStyle;
							dodger.context.strokeStyle = strokeStyle;
							
							if (withLine) {
								if (!rowLineDrawn) {
									dodger.context.beginPath();
									dodger.context.moveTo(dodger.left, y);
									dodger.context.lineTo(dodger.left + dodger.lineLength + this.x, row.y);
									dodger.context.stroke();
								}
								
								this.x += dodger.lineLength;
								
								rowLineDrawn = true;
							}
							
							dodger.context.fillText(text, dodger.left + this.x, row.y); // //FIXME: Use a combination of y from row and this
						}
					};
				
				/* Update row */
				if (typeof row.y === 'undefined' || y < row.y) {
					row.y = y;
				}
				if (func.height > row.height) {
					row.height = func.height;
				}
				
				row.items.push(func);
			};
			
			/*
			 * The dodger calls this after user functions have been given
			 * to push the completed row onto the rows.
			 * A row is treated as a single entity so that overlaps are
			 * dealt with on a per-row basis
			 */
			drawLibEnd = function() {
				rows.push(row);
			}
		};
	
	/* PUBLIC */
	
		/*
		 * Define a dodged row that should have a line
		 * connecting from the undodged point to the
		 * dodged point
		 */
	var lineToRow = function(fn) {
			var drawLib = new dodgeDrawLib(this, true);
			fn(drawLib);
			drawLibEnd();
	    },
		
		/*
		 * Defined a dodged row that doesn't have
		 * a line going to it
		 */
		addRow = function(fn) {
			var drawLib = new dodgeDrawLib(this, true);
			fn(drawLib);
			drawLibEnd();
		}
		
		/*
		 * Loop through stored rows and do the dodge.
		 * Dodging may cause more overlap, so this function works
		 * recursively, optionally taking a maximum number of tries to
		 * remove overlap
		 *
		 */
		dodge = function(maxTries) {
			maxTries = maxTries || undefined;
			var fitted = dodgeRecurse(this, maxTries, 0, rows);
			if (fitted) {
				for (var i = 0; i < fitted.length; i++) { // each row
					fitted[i].draw();
				}
				return true;
			}
			return false; // wasn't able to complete dodge in maxTries
		},
	
	/* PRIVATE */
		
		/*
		 * Recursively try to fit the rows by draw operations without overlap.
		 * Currently, this function isn't too smart and only moves things
		 * down, which is fine for now because it can't be tricked into
		 * infinite recursion. This function is (so far) deterministic.
		 */
	    dodgeRecurse = function(caller, maxTries, currTry, fitted) {
			var strategy = determineStrategy(fitted, maxTries);
			return strategy(caller, maxTries, currTry, fitted);
		},
		
		/*
		 * Find the best strategy for fitting the labels,
		 * working in order of preference
		 */
		determineStrategy = function(rows) {
			var preference = [
				pushDownStrategy,
				pushUpStrategy
			];
			
			return preference[0];
		},
		
		/*
		 * Organize rows by y coord starting from top of screen
		 */
		verticalSortRows = function(rows) {
			var copy = [];
			for (var i = 0; i < rows.length; i++) { // nondestructive sort on clone
				var row = rows[i];
				copy.push(row);
			}
			copy.sort(function(a, b) {
				if (a.y === b.y) {
					return 0;
				}
				if (a.y < b.y) {
					return -1;
				}
				return 1;
			});
			
			return copy;
		},
		
	  /* Fitting strategies */
		
		/*
		 * Recursively try to fit the rows by draw operations without overlap.
		 * Currently, this function isn't too smart and only moves things
		 * down, which is fine for now because it can't be tricked into
		 * infinite recursion. This function is (so far) deterministic.
		 */
	    pushDownStrategy = function(caller, maxTries, currTry, fitted) {
			if ((typeof maxTries !== 'undefined') && (currTry > maxTries)) {
				return false;
			}
			var sorted = verticalSortRows(fitted),
			    nextFitted = [],
			    recurse = false; 
			for (var i = 0; i < sorted.length-1; i++) {
				var curr = sorted[i],
				    next = sorted[i+1];
				
				if (curr.y + curr.height > next.y) { // overlap found; try to eliminate it on this pass
					next.y = curr.y + curr.height + 1;
					recurse = true;
				}
				nextFitted.push(curr);
			}
			
			if (recurse) {
				pushDownStrategy(caller, maxTries, currTry+1, nextFitted);
			}
			
			return fitted;
		},
		
		/*
		 * Align all labels one after the other vertically so that no gaps
		 * exist in the labels. This is the ideal fallback strategy since
		 * it will use space optimally and only uses a single pass, although
		 * positioning labels closer to where they belong would be visually ideal
		 */
		pushUpStrategy = function(caller, maxTries, currTry, fitted) {
			if ((typeof maxTries !== 'undefined') && (currTry > maxTries)) {
				return false;
			}
			var sorted = verticalSortRows(fitted),
			    nextFitted = [],
				recurse = false;
			for (var i = 0; i < sorted.length-1; i++) {
				var curr = sorted[i],
				    next = sorted[i+1];
				if (i == 0) {
					nextFitted.push(curr);
				}
				next.y = curr.y + curr.height;
				nextFitted.push(next);
			}
			
			return nextFitted;
		},
		
		/*
		 * !!!BETA!!!
		 * Strategy for dodging which can move rows either up or down
		 */
		bidirectionalStrategy = function(caller, maxTries, currTry, fitted) {
			if ((typeof maxTries !== 'undefined') && (currTry > maxTries)) {
				return false;
			}
			
			//TODO
			return fitted;
		},
		
		/*
		 * After running a fitting strategy, some labels may have been pushed
		 * off the page. This function determines the out-of-bounds height
		 * in hopes that a gap of equal or larger size can be found or created
		 */
		sizeOutOfBounds = function() {
		
		};
		
	
	return {
		lineToRow: lineToRow,
		addRow: addRow,
		dodge: dodge
	};
}();
