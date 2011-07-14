/**
 * @preserve
 * DOM Panda
 * --
 * Client-side web page layout rendering engine
 *
 * @author Jan Kuca <jan@jankuca>, http://jankuca.com
 * @license Creative Commons 3.0 Attribution/Share-alike Unported License
 *
 */


var panda = {};


/**
 * Walks the DOM tree
 * @constructor
 */
panda.Walker = function (root) {
	this.root = root || this.getRootElement();
	this.index = -1;
	this.items = Array.prototype.slice.call(this.root.childNodes);
	this.sub = null;
};

/**
 * Moves to the next element
 */
panda.Walker.prototype.walk = function () {
	var that = this;

	if (this.index === -1) {
		this.index += 1;
		this.onnode(this.root);
	} else {
		if (this.items[this.index]) {
			if (this.index === 0 && typeof this.onlevelin === 'function') {
				this.onlevelin();
			}
			var node = this.items[this.index];
			switch (node.nodeType) {
				case node.ELEMENT_NODE:
					var sub = new panda.Walker(node);
					this.sub = sub;
					sub.onnode = this.onnode;
					sub.onlevelin = this.onlevelin;
					sub.onlevelout = this.onlevelout;
					sub.onend = function () {
						if (typeof this.onlevelout === 'function') {
							this.onlevelout();
						}
						that.sub = null;
						that.index += 1;
						that.walk();
					};
					sub.walk();
					sub = null;
					break;
				case node.TEXT_NODE:
					if (/\S/.test(node.nodeValue)) {
						this.index += 1;
						this.onnode(node);
						break;
					}
				default:
					this.index += 1;
					this.walk();
			}
		} else {
			if (this.sub !== null) {
				this.sub.walk();
			} else {
				this.onend();
			}
		}
	}
};


/**
 * Returns the root <html> element
 * @return {HTMLHtmlElement} The root <html> element
 */
panda.Walker.prototype.getRootElement = function () {
	return document.getElementsByTagName('head')[0].parentNode;
};


/**
 * Handles deferred calls
 */
panda.Deferred = function () {
	this.pending = [];
	this.completed = false;
	this.status = null;
	this.result = null;
};

/**
 * Attaches success and failure callback functions
 * @param {function()} successCallback The callback function to call on success
 * @param {function()=} failureCallback The callback function to call on failure
 * @param {Object=} ctx The context in which to call the callback functions
 * @return {panda.Deferred}
 */
panda.Deferred.prototype.then = function (successCallback, failureCallback, ctx) {
	this.pending.push({
		success: successCallback,
		failure: (typeof arguments[1] === 'function') ? failureCallback : null,
		_ctx: ctx || (arguments.length === 2 && typeof arguments[1] === 'object' ? arguments[1] : null) || null
	});

	if (this.completed) {
		this.callback();
	}

	return this;
};

/**
 * @param {function()} callback The callback function to call
 * @param {Object=} ctx The context in which to call the callback function
 * @return {panda.Deferred}
 */
panda.Deferred.prototype.thenEnsure = function (callback, ctx) {
	this.then(callback, callback, ctx);
	return this;
};

/**
 * Sets up piping into another {panda.Deferred} object
 * @param {panda.Deferred} target The Deferred object to pipe to
 * @return {panda.Deferred}
 */
panda.Deferred.prototype.pipe = function (target) {
	this.then(function (result) {
		target.complete('success', result);
	}, function (result) {
		target.complete('failure', result);
	});

	return this;
};

/**
 * Completes the action by calling the appropriate callback functions
 * @param {string} status Identifies the set of callback functions to call
 * @param {*} result The data to pass the callback functions
 */
panda.Deferred.prototype.complete = function (status, result) {
	this.completed = true;
	this.status = status;
	this.result = (typeof result !== 'undefined') ? result : null;

	this.callback();
};

/**
 * Calls the appropriate callback functions
 */
panda.Deferred.prototype.callback = function () {
	var status = this.status;
	var result = this.result;

	var step;
	while (this.pending[0]) {
		step = this.pending.shift();
		if (typeof step[status] === 'function') {
			step[status].call(step._ctx, this.result);
		}
	}
};


/**
 * Renders the DOM nodes
 * @constructor
 */
panda.Renderer = function () {
};

/**
 * Initializes the renderer
 */
panda.Renderer.prototype.init = function (root) {
	this.buildCanvas();
	this.imageProxy = new panda.ImageProxy();
};

/**
 * Gets the image out of the canvas
 * @return {panda.Deferred}
 */
panda.Renderer.prototype.getImage = function () {
	var dfr = new panda.Deferred();
	try {
		var img = new Image();
		img.onload = function () {
			dfr.complete('success', img);
		};
		img.src = this.canvas.toDataURL();
	} catch (err) {
		dfr.complete('failure', err);
	}

	return dfr;
};

/**
 * Builds a canvas
 */
panda.Renderer.prototype.buildCanvas = function (root) {
	var canvas = document.createElement('canvas');
	var bounds = this.root.getBoundingClientRect();
	canvas.width = bounds.right - bounds.left;
	canvas.height = bounds.bottom - bounds.top;
	this.canvas = canvas;
	this.ctx = canvas.getContext('2d');

	// background
	this.ctx.fillStyle = 'white';
	this.ctx.fillRect(0, 0, canvas.width, canvas.height);
};

/**
 * Renders a DOM node
 * @param {Node} node The DOM node to render
 * @return {panda.Deferred}
 */
panda.Renderer.prototype.renderNode = function (node) {
	if (!this.root) {
		this.root = node;
		this.init();
	}

	switch (node.nodeType) {
		case node.ELEMENT_NODE:
			return this.renderElement(node);
		case node.TEXT_NODE:
			return this.renderTextNode(node);
		default:
			var dfr = new panda.Deferred();
			dfr.complete('success');
			return dfr;
	}
};

/**
 * Renders a DOM element node
 * @param {Element} node The DOM element node to render
 * @return {panda.Deferred}
 */
panda.Renderer.prototype.renderElement = function (node) {
	var dfr = new panda.Deferred();

	var rects = node.getClientRects();
	if (rects.length === 0) {
		dfr.complete('success');
	} else if (rects.length === 1) {
		// implies a block or one-line inline element
		this.renderElementPart(node, rects.item(0), panda.Renderer.RenderModes.COMPLETE_PART)
			.pipe(dfr);
	} else {
		// implies an inline element
		var that = this;
		var ii = rects.length;
		var renderPart = function (i) {
			/*var mode;
			if (i === 0) {
				mode = panda.Renderer.RenderModes.FIRST_PART;
			} else if (i === ii - 1) {
				mode = panda.Renderer.RenderModes.LAST_PART;
			} else {
				mode = panda.Renderer.RenderModes.MIDDLE_PART;
			}*/
			that.renderElementPart(node, rects.item(i++)).then(function () {
				if (i !== ii) {
					renderPart(i);
				} else {
					dfr.complete('success');
				}
			});
		};
		renderPart(0);
	}

	return dfr;
};

/**
 * @param {Element} node The element to render a part of
 * @param {ClientRect} rect The client rectangle of the part
 * @param {panda.Renderer.RenderModes=} mode The mode in which to render the part
 * @return {panda.Deferred}
 */
panda.Renderer.prototype.renderElementPart = function (node, rect, mode) {
	mode = mode || panda.Renderer.RenderModes.COMPLETE_PART;

	var ctx = this.ctx;
	var dfr = new panda.Deferred();

	if (rect.right - rect.left > 0 && rect.bottom - rect.top > 0) {
		var el_canvas = document.createElement('canvas');
		var el_ctx = el_canvas.getContext('2d');
		el_canvas.width = rect.right - rect.left;
		el_canvas.height = rect.bottom - rect.top;

		this.renderElementBackground(node, el_canvas).then(function () {
			this.renderElementBorder(node, el_canvas);

			var img_dfr = new panda.Deferred();
			if (node.tagName === 'IMG') {
				this.renderImageElementContents(node, el_canvas).pipe(img_dfr);
			} else {
				img_dfr.complete('success');
			}
			img_dfr.thenEnsure(function () {
				this.clipElement(node, el_canvas);
				ctx.drawImage(el_canvas,
					rect.left + window.scrollX,
					rect.top + window.scrollY,
					rect.right - rect.left,
					rect.bottom - rect.top
				);
				dfr.complete('success');
			}, this);
		}, this);
	} else {
		dfr.complete('success');
	}

	return dfr;
};

/**
 * @param {Element} node The element to render background of
 * @param {HTMLCanvasElement} canvas The canvas to render onto
 * @return {panda.Deferred}
 */
panda.Renderer.prototype.renderElementBackground = function (node, canvas) {
	var dfr = new panda.Deferred();
	var style = window.getComputedStyle(node, null);
	var ctx = canvas.getContext('2d');

	// color
	ctx.fillStyle = style.backgroundColor;
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	// image
	this.getBackgroundImage(style).then(function (img) {
		this.renderElementBackgroundRepeated(style, img, canvas);
		dfr.complete('success');
	}, function () {
		dfr.complete('success');
	}, this);

	return dfr;
};

/**
 * @param {CSSStyleDeclaration} style Style to get the position from
 * @param {Image} img The background image
 * @param {number} width Width of the node
 * @param {number} height Height of the node
 */
panda.Renderer.prototype.getBackgroundPosition = function (style, img, width, height) {
	var pos = style.backgroundPosition.split(' ');
	var x = pos[0];
	var y = pos[1];
	if (x.search('%') !== -1) {
		x = Math.round((width - img.width) * (parseInt(x, 10) / 100));
	} else {
		x = parseInt(x, 10);
	}
	if (y.search('%') !== -1) {
		y = Math.round((height - img.height) * (parseInt(y, 10) / 100));
	} else {
		y = parseInt(y, 10);
	}

	return [x, y];
};

/**
 * @param {CSSStyleDeclaration} style Style to get the repetition settings from
 * @param {Image} img The background image
 * @param {HTMLCanvasElement} canvas The canvas to render the background onto
 */
panda.Renderer.prototype.renderElementBackgroundRepeated = function (style, img, canvas) {
	var ctx = canvas.getContext('2d');
	var width = canvas.width;
	var height = canvas.height;

	var pos = this.getBackgroundPosition(style, img, width, height);
	var x = pos[0];
	var y = pos[1];
	var tile_width = img.width;
	var tile_height = img.height;
	var repeat = style.backgroundRepeat;
	if (repeat === 'no-repeat') {
		ctx.drawImage(img, x, y);
	} else if (repeat === 'repeat') {
		if (y > 0) y -= tile_height;
		while (y < height) {
			x = pos[0];
			if (x > 0) x -= tile_width;
			while (x < width) {
				ctx.drawImage(img, x, y);
				x += tile_width;
			}
			y += tile_height;
		}
	} else if (repeat === 'repeat-x') {
		if (x > 0) x -= tile_width;
		while (x < width) {
			ctx.drawImage(img, x, y);
			x += tile_width;
		}
	} else if (repeat === 'repeat-y') {
		if (y > 0) y -= tile_height;
		while (y < height) {
			ctx.drawImage(img, x, y);
			y += tile_height;
		}
	}
};

/**
 * @param {Element} node The element to render borders of
 * @param {HTMLCanvasElement} canvas The canvas to render onto
 */
panda.Renderer.prototype.renderElementBorder = function (node, canvas) {
	var style = window.getComputedStyle(node, null);
	var ctx = canvas.getContext('2d');

	var width = canvas.width;
	var height = canvas.height;
	var top = parseInt(style.borderTopWidth || 0, 10);
	var right = parseInt(style.borderRightWidth || 0, 10);
	var bottom = parseInt(style.borderBottomWidth || 0, 10);
	var left = parseInt(style.borderLeftWidth || 0, 10);
	var top_left = parseInt(style.borderTopLeftRadius || 0, 10);
	var top_right = parseInt(style.borderTopRightRadius || 0, 10);
	var bottom_right = parseInt(style.borderBottomRightRadius || 0, 10);
	var bottom_left = parseInt(style.borderBottomLeftRadius || 0, 10);

	ctx.globalCompositeOperation = 'source-over';
	ctx.lineJoin = 'miter';
	ctx.lineCap = 'butt';

	if (top) {
		ctx.strokeStyle = style.borderTopColor;
		ctx.lineWidth = top;
		ctx.beginPath();
		ctx.moveTo(top_left, top / 2);
		ctx.lineTo(width - top_right, top / 2);
		ctx.stroke();
		ctx.closePath();
	}
	if (bottom) {
		ctx.strokeStyle = style.borderBottomColor;
		ctx.lineWidth = bottom;
		ctx.beginPath();
		ctx.moveTo(bottom_left, height - bottom / 2);
		ctx.lineTo(width - bottom_right, height - bottom / 2);
		ctx.stroke();
		ctx.closePath();
	}
	if (left) {
		ctx.strokeStyle = style.borderLeftColor;
		ctx.lineWidth = left;
		ctx.beginPath();
		ctx.moveTo(top_left, - left / 2 + top);
		ctx.quadraticCurveTo(left / 2, - left / 2 + top, left / 2, top_left);
		ctx.lineTo(left / 2, height - bottom_left);
		ctx.quadraticCurveTo(left / 2, height + left / 2 - bottom, bottom_left, height + left / 2 - bottom);
		ctx.stroke();
		ctx.closePath();
	}
	if (right) {
		ctx.strokeStyle = style.borderRightColor;
		ctx.lineWidth = right;
		ctx.beginPath();
		ctx.moveTo(width - top_right, - right / 2 + top);
		ctx.quadraticCurveTo(width - right / 2, - right / 2 + top, width - right/ 2, top_right);
		ctx.lineTo(width - right / 2, height - bottom_right);
		ctx.quadraticCurveTo(width - right / 2, height - right / 2 + bottom, width - bottom_right, height - right / 2 + bottom);
		ctx.stroke();
		ctx.closePath();
	}
};

/**
 * @param {Image} img The image element to render contents of
 * @param {HTMLCanvasElement} canvas The canvas to render onto
 * @return {panda.Deferred}
 */
panda.Renderer.prototype.renderImageElementContents = function (img, canvas) {
	var dfr = new panda.Deferred();

	var style = window.getComputedStyle(img, null);
	var ctx = canvas.getContext('2d');

	var width = canvas.width;
	var height = canvas.height;
	var top = parseInt(style.borderTopWidth || 0, 10)
		+ parseInt(style.paddingTop || 0, 10);
	var right = parseInt(style.borderRightWidth || 0, 10)
		+ parseInt(style.paddingRight || 0, 10);
	var bottom = parseInt(style.borderBottomWidth || 0, 10)
		+ parseInt(style.paddingBottom || 0, 10);
	var left = parseInt(style.borderLeftWidth || 0, 10)
		+ parseInt(style.paddingLeft || 0, 10);

	ctx.globalCompositeOperation = 'source-over';
	if (img.src.split(':')[0] === 'data') {
		ctx.drawImage(img, left, top,
			width - left - right,
			height - top - bottom
		);
		dfr.complete('success');
	} else {
		this.imageProxy.get(img.src).then(function (img) {
			ctx.drawImage(img, left, top,
				width - left - right,
				height - top - bottom
			);
			dfr.complete('success');
		}, function (err) {
			dfr.complete('failure', err);
		});
	}

	return dfr;
};

panda.Renderer.prototype.getOverflowParentOf = function (node) {
	var root = this.root;
	var style;
	while (node !== root) {
		node = node.parentNode;
		style = window.getComputedStyle(node, null);
		if (style.overflow === 'hidden') {
			return node;
		}
	}
	return null;
};

/**
 * @param {Element} node The node
 * @param {HTMLCanvasElement} canvas The canvas to clip
 */
panda.Renderer.prototype.clipElement = function (node, canvas) {
	this.clipElementWithBorderRadius(node, canvas);
	this.clipElementWithParentOverflow(node, canvas);
};

/**
 * @param {Element} node The node
 * @param {HTMLCanvasElement} canvas The canvas to clip
 */
panda.Renderer.prototype.clipElementWithBorderRadius = function (node, canvas) {
	var style = window.getComputedStyle(node, null);
	var ctx = canvas.getContext('2d');
	var width = canvas.width;
	var height = canvas.height;
	var top_left = parseInt(style.borderTopLeftRadius || 0, 10);
	var top_right = parseInt(style.borderTopRightRadius || 0, 10);
	var bottom_right = parseInt(style.borderBottomRightRadius || 0, 10);
	var bottom_left = parseInt(style.borderBottomLeftRadius || 0, 10);

	ctx.globalCompositeOperation = 'destination-out';
	ctx.fillStyle = 'black';
	if (top_left) {
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(top_left, 0);
		ctx.quadraticCurveTo(0, 0, 0, top_left);
		ctx.lineTo(0, 0);
		ctx.closePath();
		ctx.fill();
	};
	if (top_right) {
		ctx.beginPath();
		ctx.moveTo(width, 0);
		ctx.lineTo(width - top_right, 0);
		ctx.quadraticCurveTo(width, 0, width, top_right);
		ctx.lineTo(width, 0);
		ctx.closePath();
		ctx.fill();
	};
	if (bottom_right) {
		ctx.beginPath();
		ctx.moveTo(width, height);
		ctx.lineTo(width - bottom_right, height);
		ctx.quadraticCurveTo(width, height, width, height - bottom_right);
		ctx.lineTo(width, height);
		ctx.closePath();
		ctx.fill();
	};
	if (bottom_left) {
		ctx.beginPath();
		ctx.moveTo(0, height);
		ctx.lineTo(bottom_left, height);
		ctx.quadraticCurveTo(0, height, 0, height - bottom_left);
		ctx.lineTo(0, height);
		ctx.closePath();
		ctx.fill();
	};
};

/**
 * @param {Element} node The node
 * @param {HTMLCanvasElement} canvas The canvas to clip
 */
panda.Renderer.prototype.clipElementWithParentOverflow = function (node, canvas) {
	var clip = this.getOverflowParentOf(node);
	if (clip) {
		var ctx = canvas.getContext('2d');
		var width = canvas.width;
		var height = canvas.height;

		var style = window.getComputedStyle(clip);
		var top = parseInt(style.borderTopWidth || 0, 10)
			+ parseInt(style.paddingTop || 0, 10);
		var right = parseInt(style.borderRightWidth || 0, 10)
			+ parseInt(style.paddingRight || 0, 10);
		var bottom = parseInt(style.borderBottomWidth || 0, 10)
			+ parseInt(style.paddingBottom || 0, 10);
		var left = parseInt(style.borderLeftWidth || 0, 10)
			+ parseInt(style.paddingLeft || 0, 10);

		var node_rect = node.getBoundingClientRect();
		var clip_rect = clip.getBoundingClientRect();
		var clip_left = clip_rect.left - node_rect.left + left;
		var clip_top = clip_rect.top - node_rect.top + top;
		var clip_right = node_rect.right - clip_rect.right + right;
		var clip_bottom = node_rect.bottom - clip_rect.bottom + bottom;

		ctx.globalCompositeOperation = 'destination-out';
		ctx.fillStyle = 'black';
		// TODO: take overflow parent border radius into account
		if (clip_top > 0) {
			ctx.fillRect(0, 0, width, clip_top);
		}
		if (clip_left > 0) {
			ctx.fillRect(0, 0, clip_left, height);
		}
		if (clip_right > 0) {
			ctx.fillRect(width - clip_right, 0, clip_right, height);
		}
		if (clip_bottom > 0) {
			ctx.fillRect(0, height - clip_bottom, width, clip_bottom);
		}
	}
};

/**
 * Renders a DOM text node
 * @param {Text} node The text node to render
 * @return {panda.Deferred}
 */
panda.Renderer.prototype.renderTextNode = function (node) {
	var dfr = new panda.Deferred();

	var range = document.createRange();
	range.selectNode(node);
	var rects = range.getClientRects();

	if (rects.length !== 0) {
		var parent = node.parentNode;
		var first = (parent.firstChild === node);
		var style = window.getComputedStyle(parent);
		var ctx = this.ctx;
		ctx.fillStyle = style.color;
		ctx.textBaseline = 'top';
		ctx.font = [
			style.fontStyle, style.fontVariant, style.fontWeight,
			style.fontSize,
			style.fontFamily
		].join(' ').replace('normal normal normal ', '');

		var words = node.nodeValue
			.replace(/\s{2,}/g, ' ')
			.replace(/(^\s+|\s+$)/g, '')
			.split(/(?: +| *\n+ *)/);
		var r = 0;
		var rect = rects.item(r++);
		var buffer = '';
		var fitting = '';
		words.forEach(function (word, i) {
			if (i !== 0) {
				buffer += ' ';
			}
			buffer += word;
			var measure = ctx.measureText(buffer).width;
			if (measure > rect.width) {
				ctx.fillText(fitting,
						rect.left + window.scrollX,
						rect.top + window.scrollY
				);
				buffer = word;
				fitting = word;
				rect = rects.item(r++) || rect;
			} else {
				fitting = buffer;
			}
		});
		if (fitting !== '') {
			ctx.fillText(fitting,
					rect.left + window.scrollX,
					rect.top + window.scrollY
			);
		}
	}

	dfr.complete('success');
	return dfr;
};

/**
 * @param {CSSStyleDeclaration} style Style to get the background from
 * @return {panda.Deferred}
 */
panda.Renderer.prototype.getBackgroundImage = function (style) {
	var dfr = new panda.Deferred();

	if (/^url\(/.test(style.backgroundImage)) {
		var url = style.backgroundImage.match(/^url\('?"?(.+?)"?'?\)/)[1];
		this.imageProxy.get(url).pipe(dfr);
	} else {
		dfr.complete('failure');
	}

	return dfr;
};


/**
 * @enum {number}
 */
panda.Renderer.RenderModes = {
	COMPLETE_PART: 0,
	FIRST_PART: 1,
	MIDDLE_PART: 2,
	LAST_PART: 3
};


/**
 * @constructor
 */
panda.ImageProxy = function () {
};

/**
 * @param {string} url A URL of the image to load
 * @return {panda.Deferred}
 */
panda.ImageProxy.prototype.get = function (url) {
	var dfr = new panda.Deferred();
	var img = new Image();
	img.onload = function () {
		dfr.complete('success', img);
	};
	img.onerror = function (err) {
		dfr.complete('failure', err);
	};
	img.src = this.getProxyURL(url);

	return dfr;
};

/**
 * @param {string} url The original URL
 * @return {string} A proxy URL
 */
panda.ImageProxy.prototype.getProxyURL = function (url) {
	return '/imageproxy?url=' + url;
};
