/* global view, Path, Group, Point, Size, onFrame, project */
// Enabling Paperscript in this pane by loading:
// https://codepen.io/robertverdes/pen/RWgZpo

var canvas = document.querySelector("#canvas");
//var context = canvas.getContext('2d');

// Define graphical elements:
var origin = new Point(300,300);

var handle = new Path.Rectangle(origin, new Size(400,75));
handle.fillColor = {
	gradient: {
		stops: [['#220', 0.1], ['#331', 0.5], ['#220', 0.9]]
	},
	origin: handle.bounds.bottomCenter,
	destination: handle.bounds.topCenter
};
handle.rotate(45, origin);
handle.position += new Point(100,50);
handle.name = 'handle';

var pan = new Path.Circle(origin, 275);
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
pan.name= 'pan';

var panGroup = new Group([handle, pan]);
panGroup.name = 'panGroup';

// Make clipping mask to keep oil in pan:
var oilGroup = new Group({name: 'oilGroup', clipped: true});
oilGroup.addChild(new Path.Circle({
	center: origin,
	radius: 275,
	strokeWidth: 1,
	strokeColor: 'blue',
	clipMask: true
}));

// Adding oil:
var oilInPan = 0.1;
function addOil(amount) {
	var oil = new Path.Circle(origin, 150);
	oil.fillColor = {
		gradient: {
			stops: [['#997', 0], ['#997', 0.84], ['#ddb', 0.85], ['#ddb', 0.94], ['#000', 0.95]],
			radial: true
		},
		origin: oil.position + new Point(10,20),
		destination: oil.bounds.topCenter
	};
	oil.opacity = 0.05;
	oil.name = 'oil';
	oilGroup.addChild(oil);
	oilInPan += amount;
}
//addOil(1);

var remnants = new Group();
remnants.name = 'remnants';

// EGGS

var eggCounter = 0;
function createEgg(location) {
	if (eggCounter >= 1) return;

	var albumen = new Path.Star(location, 8, 60, 58);
	albumen.name = 'albumen';
	albumen.fillColor = 'white';
	albumen.opacity = 0.05;
	albumen.smooth();

	var yolk = new Path.Circle(location, 40);
	yolk.name = 'yolk';
	yolk.fillColor = {
		gradient: {
			stops: [['yellow', 0], ['orange', 0.7]],
			radial: true
		},
		origin: yolk.position,
		destination: yolk.bounds.rightCenter
	};

	var egg = new Group([albumen, yolk]);
	eggCounter++;
	egg.name = "egg"+eggCounter;
	egg.data = {
		scaling: 1,
		doneness: 0
	};
}


// PAN TILT

var mouseAt = origin;
function tiltPan(mouseEvent) {
	// Set mouse pos:
	mouseAt = mouseEvent.point;
	// Apply 3d tilt to canvas based on mouse offset:
	var dx = mouseAt.x - origin.x,
		dy = origin.y - mouseAt.y,
		distsq = dx*dx + dy*dy;
	var rotStr = 'rotate3d('+dy+','+dx+',0,'+distsq/5000+'deg)';
	canvas.style.transform = rotStr;
	// Move pan's lighting gradient:
	pan.fillColor.origin = pan.position + new Point(dx/10,-dy/10);
	return false;
}
project.activeLayer.on('mousemove', tiltPan);


// CLOCK

// Count down in 1-second steps:
var gameTimer = 30;
var clockLoop = setInterval(function() {
	gameTimer -= 1;
	// Prepare & draw HTML timer:
	var htmlTimer = document.getElementById("timer");
	var timeString = '0:';
	timeString += (gameTimer < 10) ? '0' : '';
	timeString += Math.floor(gameTimer);
	htmlTimer.innerHTML = timeString;
	if (gameTimer < 10) htmlTimer.style.color = 'red';

	// Finished timer?
	if (gameTimer <= 0.02) {
		clearInterval(clockLoop);
		// Stop animations:
		view.onFrame = null;
		// Reset pan tilt & disable event:
		project.activeLayer.off('mousemove', tiltPan);
		canvas.style.transform = null;
		pan.fillColor.origin = origin;
		canvas.classList.remove("shake-slow");
	}
}, 1000);
//canvas.classList.add("shake-slow");

var slipperiness = 0.05 * oilInPan;
var initialBounds = new Size(200,200);
var maxBounds = initialBounds * 1.75;

// Easing from https://gist.github.com/gre/1650294
function easeOutCubic(t) { return (--t)*t*t+1; }

// Main animation loop:
function onFrame(event) {
	//console.log(project.activeLayer.children);
	// If an egg is present:
	if (project.activeLayer.lastChild.hasChildren())  {
		// Handle all existing eggs:
		var eggs = project.activeLayer.children.filter(function(item) {
			return item.name && item.name.startsWith('egg');
		});
		//console.log(eggs.length, "egg groups");
		eggs.forEach(function(egg) {
			// Cook egg:
			if (egg.data.doneness < 1) {
				egg.data.doneness += 0.0005;	// 2000 iterations -> 1
			}
			var albumen = egg.children['albumen'];
			var yolk = egg.children['yolk'];

			// Make white grow, then stop:
			if (egg.data.scaling < 1.5) {
				var pct = event.time / 30;	// goes 0 -> 1
				var growth = 1.001 * easeOutCubic(pct);
				egg.data.scaling *= 1.001;
				albumen.scale(1.001, albumen.position);	// too much
			}

			// Increase opacity of white:
			//albumen.opacity += 0.00125;	// 800 iterations -> 1
			albumen.opacity = 0.2 + (1.6 * egg.data.doneness);

			// Constantly move egg towards mouseAt:
			var vector = mouseAt - egg.position;
			if (vector.length > 10) egg.position += vector * slipperiness;

			// Move yolk within egg:
			if (egg.data.doneness < 0.25 && vector.length > 10) yolk.position += vector * slipperiness/8;


			// Cut albumen path if it intersects pan edge:
			/*
			if (albumen.intersects(pan)) {
			// Store chopped part elsewhere:
			var edge = albumen.subtract(pan, {insert: false});
			//edge.fillColor = 'green';
			edge.copyTo(remnants);
			edge.remove();
			// Assign remaining egg white to albumen:
			var temp = albumen.intersect(pan);
			albumen.remove();
			albumen = temp;
		}
		*/
		});
	}
	// Move oil too (very slippery!):
	var oil = project.activeLayer.children['oilGroup'].children['oil'];
	if (oil && oilInPan > 0.1) {
		var oilVector = mouseAt - oil.position;
		if (oilVector.length > 10) oil.position += oilVector / 100;
	}
}


// TOOLBOX

var toolMode;
function setToolMode(mode) {
	window.toolMode = mode;
	// Set body class:
	document.body.classList = [];
	if (mode.length > 0) document.body.classList.add(mode+'tool');
	console.log((mode ? mode : 'no') + ' tool enabled');
}
function clickHandler(event) {
	console.log('inside', window.toolMode);
	switch (window.toolMode) {
	case 'egg':
		createEgg(event.point);
		setToolMode('');
		break;
	case 'oil':
		addOil(0.5);
		setToolMode('');
		break;
	case 'salt':
		addSalt(event.point, null, 'salt');
		break;
	case 'pepper':
		addSalt(event.point, null, 'pepper');
		break;
	case 'ketchup':
		addSauce(event.point, null, 'ketchup');
		break;
	case 'brownsauce':
		addSauce(event.point, null, 'brownsauce');
		break;
	}
	console.log(project.activeLayer.children);
	return false;
}
/*
function dragHandler(event) {
console.log(event.point);
// salt, pepper, ketchup, brownsauce
return false;
}*/
// Attach events:
pan.onMouseUp = clickHandler;
oilGroup.onMouseUp = clickHandler;
//pan.onMouseDrag = dragHandler;
//eggs.onMouseDrag = dragHandler;	// DEFINE eggs FIRST


// EDGES

/*
albumen.onMouseUp = function(event) {
console.log("click", this.curves.length, "curves");
// Double the number of points:
var curvesNow = this.curves;
var bits = this.curves.length;
//this.curves.forEach(function(curve,i) {
for (var i = 0; i < bits; i+=2) {
this.curves[i].divideAt(0.5);	// changes array
this.smooth();
};
this.selected = false;
this.selected = true;
};
*/
var colours = {
	ketchup: 'red',
	brownsauce: 'saddlebrown',
	salt: 'white',
	pepper: 'black'
};

var sauceGroup = new Group({name: 'sauceGroup'});
function addSauce(start, end, type) {
	if (typeof end === 'undefined') end = null;
	if (typeof type === 'undefined') type = 'ketchup';

	if (end) {
		// Add line of sauce
		sauceGroup.addChild(new Path.Line({
			from: start,
			to: end,
			strokeWidth: 10 + 10 * Math.random(),
			strokeCap: 'round',
			strokeColor: colours[type]
			// random dashoffset?
		}));
	}
	else {
		// Add dot of sauce
		sauceGroup.addChild(new Path.Circle({
			center: start,
			radius: 8 + 15 * Math.random(),
			fillColor: colours[type]
		}));
	}
	console.log(project.activeLayer.children);
}
//addSauce(origin, 0, 'brownsauce');		// ok
//addSauce(origin + 50, 0, 'ketchup');	// ok
//addSauce(origin - 50, origin + 100, 'ketchup');	// ok

function addSalt(start, end, type) {
	if (typeof end === 'undefined') end = null;
	if (typeof type === 'undefined') type = 'salt';

	if (!end) {
		// Add pinch of salt
		var grains = 10 + (15 * Math.random());
		while (grains > 0) {
			grains--;
			var offset = [60*Math.random(), 60*Math.random()];
			sauceGroup.addChild(new Path.Rectangle({
				point: start + offset,
				size: 2 + (4 * Math.random()),
				fillColor: colours[type]
			}));
		}
	}
}
//addSalt(origin, 0, 'salt');		// ok
