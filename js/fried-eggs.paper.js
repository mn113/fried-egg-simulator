/* global $, view, Path, Group, Point, Size, onFrame, project */

var canvas = document.querySelector("#canvas");
var origin = new Point(300,300);

// Create Pan elements:
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
// Expose global:
var pan = panGroup.children['pan'];


// OIL

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
			radius: 125,
			clipMask: true,
			name: 'clip'
		});

		var oil = new Path.Circle({
			center: origin,
			radius: 125,
			fillColor: '#221',
			opacity: 0.1,
			name: 'oil'
		});

		var oilSpecular = new Path.Circle({
			center: origin - [0,40],
			radius: 115,
			fillColor: {
				gradient: {
					stops: ['#ffc','#bb9'],
					radial: true
				},
				origin: oil.position + [0,20],
				destination: oil.bounds.rightCenter
			},
			opacity: 0.05,
			name: 'oilSpecular'
		});
		oilSpecular.scale(1,0.7);

		oilGroup.addChildren([clip, oil, oilSpecular]);
		oilGroup.applyMatrix = false;	// needed for rotation
	}
	else {
		// Increase radii & bake in:
		oilGroup.scale(1.2);

	}
	// Add oil numerically:
	oilInPan += amount;
	console.log(oilInPan, "oil");
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
	// Rotate oil:
	oilGroup.rotation = vector.angle - 90;

	return false;
}
project.activeLayer.on('mousemove', tiltPan);


// CLOCK

var gameTimer = 60;
var running = false;
var clockLoop = null;
// Count down in 1-second steps:
function startTimer() {
	clockLoop = setInterval(function() {
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
	// Turn shakes on:
	$(canvas).addClass("shake-slow");
}

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
	canvas.classList.remove("shake-slow");
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

// Easing from https://gist.github.com/gre/1650294
function easeOutCubic(t) { return (--t)*t*t+1; }

function onFrame(event) {
	var slipperiness = 0.05 * oilInPan;
	// If an egg is present:
	if (eggGroup && project.activeLayer.lastChild.hasChildren())  {
		// Move eggs collectively towards mouseAt:
		var eggVector = mouseAt - eggGroup.position;
		if (eggVector.length > 10) eggGroup.position += eggVector * slipperiness;

		// Cook all existing eggs:
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
				albumen.scale(1.001, albumen.position);
			}

			// Increase opacity of white:
			albumen.opacity = 0.2 + (1.6 * egg.data.doneness);	// 0.2 -> 1 in 1000 iterations

			// Constantly move egg towards mouseAt:
			//var vector = mouseAt - egg.position;
			//if (vector.length > 10) egg.position += vector * slipperiness;

			// Move yolk within egg:
			var vector = mouseAt - egg.position;
			if (egg.data.doneness < 0.25 && vector.length > 10) yolk.position += vector * slipperiness/8;

			// Vary (some) edges of albumen:
			if (egg.data.doneness < 0.5) {
				albumen.segments.forEach(function(segment) {
					if (Math.random() > 0.95) {
						// Move point:
						segment.point.set(segment.point + (vector.normalize() * Point.random()));
					}
				});
			}

			// Cut albumen path if it intersects pan edge:
			if (albumen.intersects(pan)) {
				// Store chopped part elsewhere:
				var edge = albumen.subtract(pan, {insert: false});
				edge.copyTo(remnantGroup);
				edge.remove();
				// Assign remaining egg white back to albumen:
				var temp = albumen.intersect(pan);
				albumen.remove();
				albumen = temp;
			}
			// Slip yolk out of pan:
			if (yolk.intersects(pan)) {
				var overlap = yolk.subtract(pan, {insert: false});
				console.log(overlap.area, yolk.area);
				if (overlap.area > 0.5 * yolk.area) {
					egg.remove();
					sounds.playSound("slideout");
					eggCounter -= 1;

				}
			}
		});
	}
	// Move oil too (very slippery!):
	if (oilGroup && oilInPan > 0.1) {
		var oilVector = mouseAt - oilGroup.position;
		if (oilVector.length > 10) oilGroup.position += oilVector / 100;
		/*if (oilGroup.intersects(pan)) {
			// change shape?
		}*/
	}
}


// SAUCES

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
	else if (target.name === 'pan' || target.name === 'oilGroup') {
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
	else if (target.name === 'pan' || target.name === 'oilGroup') {
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


// TOOLBOX

var toolMode;
function setToolMode(mode) {
	// Stop if tool disabled:
	if ($("li#"+mode+"-tool").hasClass("disabled")) return;
	toolMode = mode;
	// Set body class:
	document.body.classList = [];
	if (mode.length > 0) document.body.classList.add(mode+'tool');
	console.log((mode ? mode : 'no') + ' tool enabled');
}

function clickHandler(event) {
	// Start clock:
	if (!running) {
		startTimer();
		running = true;
	}
	// Need to know targeted element:
	console.log("E", event);
	switch (toolMode) {
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
// Attach events:
pan.onMouseUp = clickHandler;
oilGroup.onMouseUp = clickHandler;
eggGroup.onMouseUp = clickHandler;

function wobbleToggle() {
	if ($(canvas).hasClass("shake-slow")) {
		$(canvas).removeClass("shake-slow");
		$("#wobbletoggle").addClass("disabled");
	}
	else {
		$(canvas).addClass("shake-slow");
		$("#wobbletoggle").removeClass("disabled");
	}
}


// KEY BINDINGS

document.addEventListener('keydown', function (e) {
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


// SOUNDS

var sounds = {		// Empty container for all the sounds to be used
	frying: {url: 'sfx/frying.mp3', volume: 50},
	grind: {url: 'sfx/grind_twice.mp3', volume: 50},
	splat: {url: 'sfx/splat.mp3', volume: 50},
	splurt: {url: 'sfx/splurt.mp3', volume: 50},
	slideout: {url: 'sfx/whistle.mp3', volume: 50},
	camera: {url: 'sfx/camera.mp3', volume: 50},

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


// SET GOAL EGG

var bgxPos = -100 * Math.floor(8 * Math.random());	// 0 -> -700
document.getElementById("goal").style.backgroundPosition = bgxPos + "px 0";


// Allow use in HTML document:
window.setToolMode = setToolMode;
window.wobbleToggle = wobbleToggle;
