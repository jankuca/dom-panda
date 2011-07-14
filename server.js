var FS = require('fs');
var HTTP = require('http');
var URL = require('url');

/** @type {Object} */
var input = require('./lib/process-input/process-input');

if (!input.params.p) {
	throw new Error('No port specified. Use the -p XXXX or --p=XXXX argument.');
}

/**
 * Gets a remote image and pipes it to the response
 * @param {Url} url The URL of the request
 * @param {http.ServerResponse} res The response
 */
function imageproxy(url, res) {
	var image_url = URL.parse(url.query.url);
	var secured = (image_url.protocol === 'https');

	var proxy_req = (secured ? HTTPS : HTTP).get({
		host: image_url.hostname,
		port: image_url.port || 80,
		path: image_url.pathname + (image_url.search ? image_url.search : '')
	}, function (proxy_res) {
		res.writeHead(proxy_res.statusCode, proxy_res.headers);
		proxy_res.on('data', function (chunk) {
			res.write(chunk, 'binary');
		});
		proxy_res.on('end', function () {
			res.end();
		});
	});
	proxy_req.on('error', function (err) {
		res.writeHead(400);
		res.end();
	});
}

/**
 * Responds with a static file
 * @param {Url} url The URL of the request
 * @param {http.ServerResponse} res The response
 */
function staticfile(url, res) {
	console.log('Requested ' + url.pathname);
	FS.readFile('.' + url.pathname, 'binary', function (err, data) {
		if (err) {
			res.writeHead(404);
		} else {
			res.writeHead(200);
			res.write(data, 'binary');
		}
		res.end();
	});
}


var server = HTTP.createServer(function (req, res) {
	var req_url = URL.parse(req.url, true);
	var pathname = req_url.pathname;

	if (pathname === '/imageproxy') {
		imageproxy(req_url, res);
	} else if (/^\/server\.js/.test(pathname) === false) {
		staticfile(req_url, res);
	} else {
		res.writeHead(403);
		res.end();
	}
});

server.listen(input.params.p);
console.log('Server started on port ' + input.params.p);
