/* global view, Path, Group, Point, PointText, Size, onFrame */

var canvas = document.querySelector("#canvas");
//var context = canvas.getContext('2d');

// Define graphical elements:
var origin = new Point(300,300);
var handle = new Path.Line(origin, new Point(600,600));
handle.strokeWidth = 70;
handle.strokeColor = '#333';

var pan = new Path.Circle(origin, 275);
pan.fillColor = "#666";
pan.strokeWidth = 20;
pan.strokeColor="#333";
pan.fillColor = {
	gradient: {
		stops: [['#444', 0], ['#333', 0.7], ['#222', 0.9]],
		radial: true
	},
	origin: pan.position,
	destination: pan.bounds.rightCenter
};

var albumen = new Path.Star(origin, 4, 60, 55);
albumen.fillColor = 'white';
albumen.opacity = 0.05;
albumen.smooth();

var yolk = new Path.Circle(origin, 40);
yolk.fillColor = {
	gradient: {
		stops: [['yellow', 0], ['orange', 0.7]],
		radial: true
	},
	origin: yolk.position,
	destination: yolk.bounds.rightCenter
};

var egg = new Group([albumen, yolk]);


// EVENTS

albumen.onMouseUp = function(event) {
	console.log("click", this.curves.length, "curves");
	// Double the number of points:
	//var curvesNow = this.curves;
	var bits = this.curves.length;
	//this.curves.forEach(function(curve,i) {
	for (var i = 0; i < bits; i+=2) {
		this.curves[i].divideAt(0.5);	// changes array
		//		this.smooth();
	}
	this.selected = false;
	this.selected = true;
};

var mouseAt = origin;
pan.onMouseMove = function(event) {
	// Set mouse pos:
	mouseAt = event.point;
	// Apply 3d tilt to canvas based on mouse offset:
	var dx = mouseAt.x - origin.x,
		dy = origin.y - mouseAt.y,
		distsq = dx*dx + dy*dy;
	var rotStr = 'rotate3d('+dy+','+dx+',0,'+distsq/5000+'deg)';
	canvas.style.transform = rotStr;
	// Move pan's lighting gradient:
	pan.fillColor.origin = pan.position + new Point(dx/10,-dy/10);
	return false;
};

// Draw countdown clock:
var gameTimer = 20;
var clock = new PointText(new Point(590, 70));
clock.justification = 'right';
clock.fontSize = 75;
clock.fillColor = 'red';
clock.content = '0:20';

// Count down in 1-second steps:
var clockLoop = setInterval(function() {
	gameTimer -= 1;
	clock.content = '0:';
	clock.content += (gameTimer < 10) ? '0' : '';
	clock.content += Math.floor(gameTimer);
	if (gameTimer <= 0) {
		clearInterval(clockLoop);
		// Stop animations:
		view.onFrame = null;
		// Reset pan tilt & disable event:
		pan.off('mousemove');
		canvas.style.transform = null;
		pan.fillColor.origin = origin;
	}
}, 1000);


var slipperiness = 0.005;
var scaling = 1;
var initialBounds = new Size(egg.bounds);
var maxBounds = initialBounds * 1.75;
console.log(initialBounds, maxBounds);

// Easing from https://gist.github.com/gre/1650294
//function easeInOutCubic(t) { return t<.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1; }
function easeOutCubic(t) { return (--t)*t*t+1; }

// Main animation loop:
function onFrame(event) {
	// Make white grow, then stop:
	var eggSize = new Size(egg.bounds);
	if (eggSize < maxBounds) {
		var pct = event.time / 20;	// goes 0 -> 1
		scaling += 0.00001 * easeOutCubic(pct);
		albumen.scale(scaling, albumen.position);
		console.log(pct, scaling);
	}

	// Increase opacity of white:
	albumen.opacity += 0.0012;

	// Constantly move egg towards mouseAt:
	var vector = mouseAt - egg.position;
	if (vector.length > 10) egg.position += vector * slipperiness;

	// Move yolk within egg:
	if (vector.length > 10) yolk.position += vector * slipperiness/8;

	// Cut albumen path if it intersects pan edge:
}
