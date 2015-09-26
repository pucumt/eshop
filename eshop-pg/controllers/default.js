exports.install = function() {
	// COMMON
	F.route('/', view_homepage);
	F.route('/contact/', view_contact);

	// CMS rendering through the 404
	F.route('#404', view_page);

	// FILES
	F.file('Images (small, large)', file_image);
	F.file('Files', file_read);
};

// ==========================================================================
// COMMON
// ==========================================================================

// Homepage
function view_homepage() {
	var self = this;

	// Increases the performance (1 minute cache)
	self.memorize('cache.homepage', '1 minute', DEBUG, function() {
		var options = {};
		options.max = 12;
		options.homepage = true;
		GETSCHEMA('Product').query(options, function(err, response) {
			// Finds homepage page
			self.page('/', '~index', response, false, true);
		});
	});
}

// Contact with contact form
function view_contact() {
	var self = this;
	self.page(self.url, 'contact');
}

// ==========================================================================
// CMS (Content Management System)
// ==========================================================================

function view_page() {
	var self = this;
	self.page(self.url);
}

// ==========================================================================
// FILES
// ==========================================================================

// Reads a specific file from database
// For images (jpg, gif, png) supports percentual resizing according "?s=NUMBER" argument in query string e.g.: .jpg?s=50, .jpg?s=80 (for image galleries)
// URL: /download/*.*
function file_read(req, res, is) {

	if (is)
		return req.path[0] === 'download';

	var arr = req.path[1].replace('.' + req.extension, '').split('x');
	var id = arr[0];
	var count = 0;

	// Simple prevention for DDOS querying
	for (var i = 0, length = id.length; i < length; i++)
		count += id.charCodeAt(i);

	if (count.toString() !== arr[1]) {
		res.throw404();
		return;
	}

	// Small hack for the file cache.
	// F.exists() uses req.uri.pathname for creating temp identificator and skips all query strings by creating (because this hack).
	if (req.query.s)
		req.uri.pathname = req.uri.pathname.replace('.', req.query.s + '.');

	// Below method checks if the file exists (processed) in temporary directory
	// More information in total.js documentation
	F.exists(req, res, 10, function(next, filename) {

		var sql = DB();
		sql.readStream(id, function(err, stream) {

			if (err) {
				next();
				return res.throw404();
			}

			var writer = require('fs').createWriteStream(filename);
			stream.pipe(writer).on('close', function() {
				FINISHED(writer, function() {
					DESTROY(writer);

					var resize = req.query.s && (req.extension === 'jpg' || req.extension === 'gif' || req.extension === 'png') ? true : false;
					if (!resize) {
						res.file(filename, null, null, next);
						return;
					}

					F.responseImage(req, res, filename, function(image) {
						image.output(req.extension);
						if (req.extension === 'jpg')
							image.quality(85);
						image.resize(req.query.s + '%');
						image.minify();
					}, undefined, next);
				});
			});
		});
	});
}

// Reads specific picture from database
// URL: /images/small|large/*.jpg
function file_image(req, res, is) {

	if (is)
		return req.path[0] === 'images' && (req.path[1] === 'small' || req.path[1] === 'large') && req.path[2] && req.extension === 'jpg';

	var arr = req.path[2].replace('.' + req.extension, '').split('x');
	var id = arr[0];
	var count = 0;

	// Simple prevention for DDOS querying
	for (var i = 0, length = id.length; i < length; i++)
		count += id.charCodeAt(i);

	if (count.toString() !== arr[1]) {
		res.throw404();
		return;
	}

	// Below method checks if the file exists (processed) in temporary directory
	// More information in total.js documentation
	F.exists(req, res, 10, function(next, filename) {

		var sql = DB();
		sql.readStream(id, function(err, stream) {

			if (err) {
				next();
				return res.throw404();
			}

			var writer = require('fs').createWriteStream(filename);
			stream.pipe(writer).on('close', function() {
				FINISHED(writer, function() {
					DESTROY(writer);

					F.responseImage(req, res, filename, function(image) {
						image.output('jpg');
						image.quality(90);

						if (req.path[1] === 'large')
							image.miniature(600, 400);
						else
							image.miniature(200, 150);

						image.minify();
					}, undefined, next);
				});
			});
		});
	});
}