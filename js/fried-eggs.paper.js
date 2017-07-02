/* global $, view, Path, Group, Point, Size, onFrame, project */

// Enabling Paperscript in this pane by loading:
// https://codepen.io/robertverdes/pen/RWgZpo

var canvas = document.querySelector("#canvas");

// Define graphical elements:
var origin = new Point(300,300);

var panGroup = new Group({name: 'panGroup'});
function createPan() {
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

	panGroup.addChildren([handle, pan]);
}
createPan();
var pan = panGroup.children['pan'];

// Make clipping mask to keep oil in pan:
var oilClipGroup = new Group({name: 'oilClipGroup', clipped: true});
oilClipGroup.addChild(new Path.Circle({
	center: origin,
	radius: 265,	// half strokeWidth less than pan
	strokeWidth: 1,
	strokeColor: 'blue',
	clipMask: true
}));
// Make single oil group:
var oilGroup = new Group({name: 'oilGroup', clipped: true});
oilClipGroup.addChild(oilGroup);

// Adding oil:
var oilInPan = 0.1;
function addOil(amount) {
	if (oilGroup.isEmpty()) {
		var clip = new Path.Circle({
			center: origin,
			radius: 100,
			clipMask: true,
			name: 'clip'
		});

		var oil = new Path.Circle({
			center: origin,
			radius: 100,
			fillColor: '#221',
			opacity: 0.1,
			name: 'oil'
		});

		var oilSpecular = new Path.Circle({
			center: origin,
			radius: 90,
			fillColor: {
				gradient: {
					stops: ['#ffc','#bb9'],
					radial: true
				},
				origin: oil.position + [0,20],
				destination: oil.bounds.rightCenter
			},
			opacity: 0.1,
			name: 'oilSpecular'
		});

		oilGroup.addChildren([clip, oil, oilSpecular]);
	}
	else {
		// Increase radii:
		oilGroup.scale(1.2);
	}
	// Add oil numerically:
	oilInPan += amount;
}


// EGGS

var remnantGroup = new Group({name: 'remnantGroup'});
var eggGroup = new Group({name: 'eggGroup'});
var eggCounter = 0;

function createEgg(location) {
	if (eggCounter >= 2) return;

	var albumen = new Path.Star(location, 16, 60, 58);
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
	egg.name = "egg"+eggCounter;
	egg.data = {
		scaling: 1,
		doneness: 0
	};
	eggGroup.addChild(egg);
	eggCounter++;
	sounds.playSound('frying');	// 54-second mp3; need to stop at timer end
}


// PAN TILT

var mouseAt = origin;
var tiltAngle = 0;
function tiltPan(mouseEvent) {
	// Set mouse pos:
	mouseAt = mouseEvent.point;
	tiltAngle = origin.getDirectedAngle(mouseAt);
	//console.log(tiltAngle);
	// Apply 3d tilt to canvas based on mouse offset:
	var dx = origin.x - mouseAt.x,
		dy = origin.y - mouseAt.y,
		distsq = dx*dx + dy*dy;
	var rotStr = 'rotate3d('+dy+','+(-dx)+',0,'+distsq/5000+'deg)';
	canvas.style.transform = rotStr;
	// Move pan's lighting gradient:
	var vector = new Point(dx,dy);
	pan.fillColor.origin = pan.position + new Point(-dx/10,-dy/10);
	// Move oil's specular highlight:
	if (oilClipGroup.hasChildren()) {
		var oilSpecular = oilGroup.children['oilSpecular'];
		if (oilSpecular) {
			//oilSpecular.translate(-vector.normalize());
			oilSpecular.fillColor.highlight = mouseAt;
		}
	}
	return false;
}
project.activeLayer.on('mousemove', tiltPan);


// CLOCK

var gameTimer = 30;
// Count down in 1-second steps:
var clockLoop = setInterval(function() {
	gameTimer -= 1;
	// Prepare & draw HTML timer:
	var htmlTimer = document.getElementById("timer");
	var timeString = '0:';
	timeString += (gameTimer < 10) ? '0' : '';
	timeString += Math.floor(gameTimer);
	htmlTimer.innerHTML = timeString;
	if (gameTimer < 10) htmlTimer.style.color = 'red';
	if (gameTimer === 15) $("li.disabled").removeClass("disabled");

	// Finished timer?
	if (gameTimer <= 0.02) {
		endGame();
	}
}, 1000);
//canvas.classList.add("shake-slow");

function endGame() {
	// Stop clock:
	clearInterval(clockLoop);
	// Stop all sfx:
	sounds.stopAll();
	// Stop animations:
	view.onFrame = null;
	// Reset pan tilt & disable event:
	canvas.style.transform = null;
	pan.fillColor.origin = origin;
	project.activeLayer.off('mousemove', tiltPan);
	//canvas.classList.remove("shake-slow");
	// Finish with a freeze-frame:
	photoFinish();
}

function photoFinish() {
	// flash white
	$("<div/>").addClass("flash").appendTo($("body"));
	setTimeout(function() {
		$(".flash").remove();
	}, 1000);
	sounds.playSound('camera');
}


// MAIN ANIMATION LOOP

var slipperiness = 0.05 * oilInPan;
var initialBounds = new Size(200,200);
var maxBounds = initialBounds * 1.75;

// Easing from https://gist.github.com/gre/1650294
function easeOutCubic(t) { return (--t)*t*t+1; }

function onFrame(event) {
	//console.log(project.activeLayer.children);
	// If an egg is present:
	if (eggGroup && project.activeLayer.lastChild.hasChildren())  {
		// Handle all existing eggs:
		//var eggs = project.activeLayer.children.filter(function(item) {
		//	return item.name && item.name.startsWith('egg');
		//});
		//console.log(eggs.length, "egg groups");
		eggGroup.children.forEach(function(egg) {
			// Cook egg rapidly:
			if (egg.data.doneness < 1) {
				egg.data.doneness += 0.0005;	// 2000 iterations -> 1
			}
			var albumen = egg.children['albumen'];
			var yolk = egg.children['yolk'];

			// Make white grow, then stop:
			if (egg.data.scaling < 1.7) {
				var pct = event.time / 30;	// goes 0 -> 1
				var growth = 1.001 * easeOutCubic(pct);
				egg.data.scaling *= 1.001;
				albumen.scale(1.001, albumen.position);	// too much
			}

			// Increase opacity of white:
			//albumen.opacity += 0.00125;	// 800 iterations -> 1
			albumen.opacity = 0.2 + (1.6 * egg.data.doneness);	// 0.2 -> 1 in 1000 iterations

			// Vary (some) edges of albumen:
			albumen.segments.forEach(function(segment) {
				if (Math.random() > 0.95) {
					// Move point:
					segment.point.set(segment.point + Point.random());
				}
			});
			// Also vary edges based on pan tilt

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
				edge.copyTo(remnantGroup);
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
	//var oilGroup = project.activeLayer.children['oilClipGroup'].children['oilGroup'];
	if (oilGroup && oilInPan > 0.1) {
		var oilVector = mouseAt - oilGroup.position;
		if (oilVector.length > 10) oilGroup.position += oilVector / 100;
	}
}


// TOOLBOX

var toolMode;
function setToolMode(mode) {
	// Stop if tool disabled:
	if ($("li#"+mode+"-tool").hasClass("disabled")) return;
	window.toolMode = mode;
	// Set body class:
	document.body.classList = [];
	if (mode.length > 0) document.body.classList.add(mode+'tool');
	console.log((mode ? mode : 'no') + ' tool enabled');
}

function clickHandler(event) {
	// Need to know targeted element:
	console.log("E", event);
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
		addSalt(event.target, event.point, 'salt');
		break;
	case 'pepper':
		addSalt(event.target, event.point, 'pepper');
		break;
	case 'ketchup':
		addSauce(event.target, event.point, null, 'ketchup');
		break;
	case 'brownsauce':
		addSauce(event.target, event.point, null, 'brownsauce');
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
eggGroup.onMouseUp = clickHandler;
//pan.onMouseDrag = dragHandler;

var colours = {
	ketchup: 'red',
	brownsauce: 'saddlebrown',
	salt: 'white',
	pepper: 'black'
};

var sauceGroup = null;
function addSauce(target, start, end, type) {
	// Defaults:
	if (typeof end === 'undefined') end = null;
	if (typeof type === 'undefined') type = 'ketchup';
	// New container if it doesn't exist:
	if (!sauceGroup) sauceGroup = new Group({name: 'sauceGroup'});
	// Find target:
	if (target.name === 'eggGroup') {
		// Target the specific egg:
		target.children.forEach(function (item) {
			if (start.isInside(item.bounds)) target = item;
		});
	}
	else if (target.name === 'pan') {
		target = panGroup;
	}
	else {
		target = sauceGroup;
	}

	console.log("T:", target.name);

	if (end) {
		// Add line of sauce:
		target.addChild(new Path.Line({
			from: start,
			to: end,
			strokeWidth: 10 + 10 * Math.random(),
			strokeCap: 'round',
			strokeColor: colours[type]
			// random dashoffset?
			// random width?
		}));
	}
	else {
		// Add dot of sauce:
		target.addChild(new Path.Circle({
			center: start,
			radius: 8 + 15 * Math.random(),
			fillColor: colours[type]
		}));
	}
	if (Math.random() > 0.5) sounds.playSound('splat');
	else sounds.playSound('splurt');

	console.log(project.activeLayer.children);
}

function addSalt(target, point, type) {
	// New container if it doesn't exist:
	if (!sauceGroup) sauceGroup = new Group({name: 'sauceGroup'});
	// Defaults:
	if (typeof type === 'undefined') type = 'salt';
	if (target.name === 'eggGroup') {
		// Target the specific egg:
		target.children.forEach(function (item) {
			if (point.isInside(item.bounds)) target = item;
		});
	}
	else if (target.name === 'pan') {
		target = panGroup;
	}
	else {
		target = sauceGroup;
	}

	console.log("T:", target.name);

	// Add pinch of salt/pepper
	var pinchGroup = new Group();
	var grains = 10 + (15 * Math.random());
	while (grains > 0) {
		grains--;
		var offset = [-30 + 60*Math.random(), -30 + 60*Math.random()];
		// Attach to targeted pan/egg/oil/sauce:
		pinchGroup.addChild(new Path.Rectangle({
			point: point + offset,
			size: 2 + (4 * Math.random()),
			fillColor: colours[type]
		}));
	}
	target.addChild(pinchGroup);
	sounds.playSound('grind');
}


// SOUNDS

var sounds = {		// Empty container for all the sounds to be used
	frying: {url: 'https://marthost.uk/fried-egg/sfx/frying.mp3', volume: 50},
	grind: {url: 'https://marthost.uk/fried-egg/sfx/grind_twice.mp3', volume: 50},
	splat: {url: 'https://marthost.uk/fried-egg/sfx/splat.mp3', volume: 50},
	splurt: {url: 'https://marthost.uk/fried-egg/sfx/splurt.mp3', volume: 50},
	camera: {url: 'https://marthost.uk/fried-egg/sfx/camera.mp3', volume: 50},

	playSound: function(key) {
		var snd = new Audio(sounds[key].url); 	// Audio buffers automatically when created
		snd.volume = sounds[key].volume / 100;
		snd.play();
		sounds.all.push(snd);	// store for later access
	},
	all: [],
	stopAll: function() {
		sounds.all.forEach(function(snd) {
			snd.pause();
		});
	}
};


// KEY BINDINGS

$(document).on('keydown', function (e) {
	console.log(e.key);
	switch (e.key) {
	case '1': setToolMode('oil'); break;
	case '2': setToolMode('egg'); break;
	case '3': setToolMode('salt'); break;
	case '4': setToolMode('pepper'); break;
	case '5': setToolMode('ketchup'); break;
	case '6': setToolMode('brownsauce'); break;
	}
});
