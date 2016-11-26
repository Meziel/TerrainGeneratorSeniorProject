var gl;

function initGL(canvas) {
	try {
		gl = canvas.getContext("experimental-webgl");
		gl.viewportWidth = canvas.width;
		gl.viewportHeight = canvas.height;
	} catch (e) {
	}
	if (!gl) {
		alert("Could not initialise WebGL, sorry :-(");
	}
}

function getShader(gl, id) {

	var shaderScript = document.getElementById(id);
	if (!shaderScript) {
		return null;
	}
	var str = "";
	var k = shaderScript.firstChild;
	while (k) {
		if (k.nodeType == 3) {
			str += k.textContent;
		}
		k = k.nextSibling;
	}
	
	var shader;
	if (shaderScript.type == "x-shader/x-fragment") {
		shader = gl.createShader(gl.FRAGMENT_SHADER);
	} else if (shaderScript.type == "x-shader/x-vertex") {
		shader = gl.createShader(gl.VERTEX_SHADER);
	} else {
		return null;
	}
	
	gl.shaderSource(shader, str);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		alert(gl.getShaderInfoLog(shader));
		return null;
	}
	return shader;
}

var shaderProgram;

function initShaders() {

	var vertexShader = getShader(gl, "terrain-vs");
	var fragmentShader = getShader(gl, "terrain-fs");
	
	shaderProgram = gl.createProgram();
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);
	gl.linkProgram(shaderProgram);
	if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
		alert("Could not initialise shaders");
	}
	
	//attributes
    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");		
    shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
	shaderProgram.randomAttribute = gl.getAttribLocation(shaderProgram, "aRandom");		
	
	//uniforms
	shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
	shaderProgram.vMatrixUniform = gl.getUniformLocation(shaderProgram, "uVMatrix")
	shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
	shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
	
	shaderProgram.pointLightingLocationUniform = gl.getUniformLocation(shaderProgram, "uPointLightingLocation");	
			
	shaderProgram.ambientColorUniform = gl.getUniformLocation(shaderProgram, "uAmbientColor");
	shaderProgram.materialDiffuseColorUniform = gl.getUniformLocation(shaderProgram, "uMaterialDiffuseColor");
	shaderProgram.materialSpecularColorUniform = gl.getUniformLocation(shaderProgram, "uMaterialSpecularColor");
	
	shaderProgram.materialShininessUniform = gl.getUniformLocation(shaderProgram, "uMaterialShininess");
	shaderProgram.amplitudeUniform = gl.getUniformLocation(shaderProgram, "uAmplitude");
}

var mvMatrix = mat4.create();
var pMatrix = mat4.create();

function setMatrixUniforms() {
	gl.useProgram(shaderProgram);
	gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
	gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
	var normalMatrix = mat3.create();
	mat3.normalFromMat4(normalMatrix, mvMatrix);
	gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, normalMatrix);
}

var planeVertexPositionBuffer;
var planeVertexNormalBuffer;
var planeVertexIndexBuffer;

function random(value, seed) {
	var random = (Math.sin(value+seed)*.5+.5) * 1000.0;
	return random - Math.floor(random);
}			

function lerp(a0, a1, w) {
	return (1.0 - w)*a0 + w*a1;
}

function noise(x, y, frequency, seed) {
	
	var minX = Math.floor(x/frequency) * frequency;
	var minY = Math.floor(y/frequency) * frequency;
	var maxX = minX + frequency;
	var maxY = minY + frequency;
	
	var random1 = random(minX+(minY*1000), seed);
	var random2 = random(maxX+(minY*1000), seed);
	var random3 = random(minX+(maxY*1000), seed);
	var random4 = random(maxX+(maxY*1000), seed);

	var gradient1 = [random1, random1];
	var gradient2 = [random2, random2];
	var gradient3 = [random3, random3];
	var gradient4 = [random4, random4];
	
	var distance1 = [(x-minX)/frequency, (y-minY)/frequency];
	var distance2 = [(x-maxX)/frequency, (y-minY)/frequency];
	var distance3 = [(x-minX)/frequency, (y-maxY)/frequency];
	var distance4 = [(x-maxX)/frequency, (y-maxY)/frequency];
	
	var dotGradient1 = gradient1[0]*distance1[0] + gradient1[1]*distance1[1];
	var dotGradient2 = gradient2[0]*distance2[0] + gradient2[1]*distance2[1];
	var dotGradient3 = gradient3[0]*distance3[0] + gradient3[1]*distance3[1];
	var dotGradient4 = gradient4[0]*distance4[0] + gradient4[1]*distance4[1];
	
	var lerp1 = lerp(dotGradient1, dotGradient2, (x-minX)/frequency);
	var lerp2 = lerp(dotGradient3, dotGradient4, (x-minX)/frequency);
	var lerp3 = lerp(lerp1, lerp2, (y-minY)/frequency);
	
	return lerp3;
}
 

var amplitude = 20; 
function normalPlane(p1, p2, p3) {
	
	p1[1] *= amplitude;
	p2[1] *= amplitude;
	p3[1] *= amplitude;
	
	var normal = vec3.create();
	var l1 = vec3.create();
	var l2 = vec3.create();
	
	vec3.subtract(l1, p1, p2);
	vec3.subtract(l2, p3, p2);
	vec3.cross(normal, l1, l2);
	
	return normal;
}

var gradients = [];

function createPlane(rows, cols) {

	var frequency = 10;
	var seed = 100;

	var vertices = [];
	var normals = [];
	var randoms = [];
	var indices = [];

	//create vertices
	var count=0;
	for(var y=0; y<rows; y++) {
		for(var x=0; x<cols; x++) {
			
			var random1;
			var random2;
			var random3;
			var normal;
			
			random1 = noise(x+1, y, frequency, seed);
			random2 = noise(x, y, frequency, seed);
			random3 = noise(x, y+1, frequency, seed);
	
			vertices.push((x+1)-(cols/2), 0.0, y-(rows/2));
			vertices.push(x-(cols/2), 0.0, y-(rows/2));
			vertices.push(x-(cols/2), 0.0, (y+1)-(rows/2));
			
			randoms.push(random1);
			randoms.push(random2);
			randoms.push(random3);
			
			normal = normalPlane([x+1, random2, y], [x, random1, y], [x, random3, y+1]);
			
			for(var i = 0; i<3; i++) {
				normals.push(normal[0], normal[1], normal[2]);
			}
			
			//second set of triangles
			
			random1 = noise(x+1, y, frequency, seed);
			random2 = noise(x, y+1, frequency, seed);
			random3 = noise(x+1, y+1, frequency, seed);
			
			vertices.push((x+1)-(cols/2), 0.0, y-(rows/2));
			vertices.push(x-(cols/2), 0.0, (y+1)-(rows/2));
			vertices.push((x+1)-(cols/2), 0.0, (y+1)-(rows/2));
		
			randoms.push(random1);
			randoms.push(random2);
			randoms.push(random3);
	
			normal = normalPlane([x+1, random1, y], [x, random2, y+1], [x+1, random3, y+1]);
			
			for(var i = 0; i<3; i++) {
				normals.push(normal[0], normal[1], normal[2]);
			}
			
			//create indices
			indices.push(count++);
			indices.push(count++);
			indices.push(count++);
			indices.push(count++);
			indices.push(count++);
			indices.push(count++);
		}
	}

	//normals
	planeVertexNormalBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, planeVertexNormalBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
	planeVertexNormalBuffer.itemSize = 3;
	planeVertexNormalBuffer.numItems = normals.length/planeVertexNormalBuffer.itemSize;
	
	//vertex positions
	planeVertexPositionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, planeVertexPositionBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
	planeVertexPositionBuffer.itemSize = 3;
	planeVertexPositionBuffer.numItems = vertices.length/planeVertexPositionBuffer.itemSize;
	
	//random positions
	planeRandomBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, planeRandomBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(randoms), gl.STATIC_DRAW);
	planeRandomBuffer.itemSize = 1;
	planeRandomBuffer.numItems = vertices.length/planeRandomBuffer.itemSize;
	
	//indices
	planeVertexIndexBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, planeVertexIndexBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
	planeVertexIndexBuffer.itemSize = 1;
	planeVertexIndexBuffer.numItems = indices.length/planeVertexIndexBuffer.itemSize;
}
var time = 0;
function render() {
	
	gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	//gl.enable(gl.CULL_FACE);
	//gl.cullFace(gl.FRONT);
	
	//create projection matrix
	mat4.perspective(pMatrix, 45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0);

	gl.useProgram(shaderProgram);
	
	//create MV matrix
	mat4.identity(mvMatrix);
	mat4.translate(mvMatrix, mvMatrix, [0, -10, -40]);
	mat4.scale(mvMatrix, mvMatrix, [3.0, 3.0, 3.0]);
	
	setMatrixUniforms();
	
	var vMatrix = lookAt([cameraX, cameraY, cameraZ], [cameraX + (Math.sin(cameraRY)), cameraY, cameraZ - (Math.cos(cameraRY))]);
	
	gl.uniformMatrix4fv(shaderProgram.vMatrixUniform, false, vMatrix);
	
	//set attributes
	gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);
	gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);
	gl.enableVertexAttribArray(shaderProgram.randomAttribute);
	
	//vertices
	gl.bindBuffer(gl.ARRAY_BUFFER, planeVertexPositionBuffer);
	gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, planeVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

	//normals
    gl.bindBuffer(gl.ARRAY_BUFFER, planeVertexNormalBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, planeVertexNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);
	
	//randoms
	gl.bindBuffer(gl.ARRAY_BUFFER, planeRandomBuffer);
	gl.vertexAttribPointer(shaderProgram.randomAttribute, planeRandomBuffer.itemSize, gl.FLOAT, false, 0, 0);
	
	//set uniforms
	gl.uniform3f(shaderProgram.pointLightingLocationUniform, Math.cos(sunRotation), Math.sin(sunRotation), 0);
	sunRotation -= 0.001;
    gl.uniform3f(shaderProgram.ambientColorUniform, 0.2, 0.2, 0.2);
	gl.uniform3f(shaderProgram.materialDiffuseColorUniform, 0.0, 0.8, 0.1);
	gl.uniform3f(shaderProgram.materialSpecularColorUniform, 0.8, 0.8, 0.8);
	gl.uniform1f(shaderProgram.materialShininessUniform, 20.0);
	gl.uniform1f(shaderProgram.amplitudeUniform, amplitude);
	
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, planeVertexIndexBuffer);
	gl.drawElements(gl.TRIANGLES, planeVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
}

var sunRotation = 0.0;

function tick() {
	requestAnimFrame(tick);
	
	if (movingForward) {
		cameraZ--;
	}
	
	if (movingBackward) {
		cameraZ++;
	}
	
	if (movingRight) {
		cameraX++;
	}
	
	if (movingLeft) {
		cameraX--;
	}
	
	if(lookingUp) {
		cameraRX+=0.1;
	}
	
	if(lookingDown) {
		cameraRX-=0.1;
	}
	
	if(lookingRight) {
		cameraRY+=0.1;
	}
	
	if(lookingLeft) {
		cameraRY-=0.1;
	}
	
	render();
}

var KeyBinds = {
	
	right : 68, //d
	left : 65, //a
	forward : 87, // w
	backward : 83, //s

	cameraDown : 40, // down arrow
	cameraUp : 38, // up arrow
	cameraLeft : 37, // left arrow
	cameraRight : 39 // right arrow
};

var cameraX = 0;
var cameraY = 0;
var cameraZ = 0;

var cameraRX = 0;
var cameraRY = 0;
var cameraRZ = 0;

var movingForward = false;
var movingBackward = false;
var movingRight = false;
var movingLeft = false;
var lookingUp = false;
var lookingDown = false;
var lookingRight = false;
var lookingLeft = false;

function initKeyHandler() {
	document.body.addEventListener("keydown", function(keyEvent) {
	
		var key = keyEvent.which || keyEvent.keyCode;
		
		switch(key) {
			case KeyBinds.forward:
				movingForward = true;
				break;
			
			case KeyBinds.backward:
				movingBackward = true;
				break;
				
			case KeyBinds.right:
				movingRight = true;
				break;
				
			case KeyBinds.left:
				movingLeft = true;
				break;
				
			case KeyBinds.cameraUp:
				lookingUp = true;
				break;
	
			case KeyBinds.cameraDown:
				lookingDown = true;
				break;
			
			case KeyBinds.cameraRight:
				lookingRight = true;
				break;
				
			case KeyBinds.cameraLeft:
				lookingLeft = true;
				break;
		}
		
	});
	
	document.body.addEventListener("keyup", function(keyEvent) {
	
		var key = keyEvent.which || keyEvent.keyCode;
		
		switch(key) {
			case KeyBinds.forward:
				movingForward = false;
				break;
			
			case KeyBinds.backward:
				movingBackward = false;
				break;
				
			case KeyBinds.right:
				movingRight = false;
				break;
				
			case KeyBinds.left:
				movingLeft = false;
				break;
				
			case KeyBinds.cameraUp:
				lookingUp = false;
				break;
	
			case KeyBinds.cameraDown:
				lookingDown = false;
				break;
			
			case KeyBinds.cameraRight:
				lookingRight = false;
				break;
				
			case KeyBinds.cameraLeft:
				lookingLeft = false;
				break;
		}
		
	});
}

function lookAt(position, target) {
	
	var up = [0.0, 1.0, 0.0];
	
	var camX = vec3.create();
	var camY = vec3.create();
	var camZ = vec3.create();
	
	vec3.subtract(camZ, position, target);
	vec3.normalize(camZ, camZ);
	vec3.cross(camX, camZ, up);
	vec3.cross(camY, camX, camZ);
	
	var camera = mat4.create();
	//mat4.rotate(camera, camera, glMatrix.toRadian(90), [1, 0, 0]);
	mat4.translate(camera, camera, [-position[0], -position[1], -position[2]]);+
	mat4.rotate(camera, camera, glMatrix.toRadian(cameraRX*-5.0), [1, 0, 0]);
	mat4.rotate(camera, camera, glMatrix.toRadian(cameraRY*20.0), [0, 1, 0]);
	mat4.rotate(camera, camera, glMatrix.toRadian(cameraRZ*-20.0), [0, 0, 1]);
	//var cameraAxis = mat4.fromValues(camX[0], camX[1], camX[2], 0.0,
	//								 camY[0], camY[1], camY[2], 0.0,
	//								 camZ[0], camZ[1], camZ[2], 0.0,
	//								 0.0,     0.0,     0.0,     1.0);							 
	//mat4.mul(camera, camera, cameraAxis);
	
	return camera;
}

function start() {
	
	initKeyHandler();
	
	var canvas = document.getElementById("canvas");
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	
	initGL(canvas);
	initShaders();
	createPlane(100, 100);
	
	gl.clearColor(0.0, 0.3, 0.7, 1.0);
	gl.enable(gl.DEPTH_TEST);
	tick();
}