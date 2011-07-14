window.addEventListener('load', function () {

	window.renderer = new panda.Renderer();
	var walker = new panda.Walker();
	walker.onnode = function (node) {
		renderer.renderNode(node).then(function () {
			this.walk();
		}, this);
	};
	walker.onend = function () {
		console.timeEnd('rendering');
		renderer.getImage().then(function (img) {
			img.style.position = 'absolute';
			img.style.top = '0';
			img.style.right = '0';
			img.style.zIndex = '1000';
			img.style.width = '40%';
			img.style.boxShadow = 'rgba(0, 0, 0, 0.5) 0 0 10px';
			img.style.cursor = 'pointer';

			img.full = false;
			img.opaque = true;
			img.title = 'Click for side preview';
			img.onclick = function () {
				if (img.full) {
					if (img.opaque) {
						img.opaque = false;
						img.style.opacity = '0.5';
						img.title = 'Click for side preview';
					} else {
						img.full = false;
						img.opaque = true;
						img.style.width = '40%';
						img.style.opacity = '1';
						img.title = 'Click for alpha overlay';
					}
				} else {
					img.full = true;
					img.style.width = '';
					img.title = 'Click for overlay';
				}
			};
			document.body.appendChild(img);
		}, function (err) {
			alert('It fucked up with ' + err);
		});
	};
	walker.walk();
	console.time('rendering');

}, false);
