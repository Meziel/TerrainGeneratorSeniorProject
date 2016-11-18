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

function createPlane(rows, cols) {

	var vertices = [];
	var normals = [];
	var indices = [];
	var random = [];

	//create vertices
	for(var y=0; y<=rows; y++) {
		for(var x=0; x<=cols; x++) {
			vertices.push(x-(cols/2), y-(rows/2), 0);
			normals.push(0.0, 1.0, 0.0);
			random.push(Math.random());
		}
	}
	
	//create indices
	for(var y=0; y<rows; y++) {
		for(var x=0; x<cols; x++) {
			indices.push(y*(cols+1) + x);
			indices.push(y*(cols+1) + (x+1));
			indices.push((y+1)*(cols+1) + x);
			
			indices.push(y*(cols+1) + (x+1));
			indices.push((y+1)*(cols+1) + x);
			indices.push((y+1)*(cols+1) + (x+1))
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
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(random), gl.STATIC_DRAW);
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
	mat4.rotate(mvMatrix, mvMatrix, glMatrix.toRadian(90), [1, 0, 0]);
	mat4.scale(mvMatrix, mvMatrix, [3.0, 3.0, 3.0]);
	
	setMatrixUniforms();
	
	var vMatrix = lookAt([cameraX, cameraY, cameraZ], [cameraX, cameraY, cameraZ-1.0]);
	
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
	gl.uniform3f(shaderProgram.pointLightingLocationUniform, 0, 1, 0);
    gl.uniform3f(shaderProgram.ambientColorUniform, 0.3, 0.3, 0.3);
	gl.uniform3f(shaderProgram.materialDiffuseColorUniform, 0.0, 0.8, 0.1);
	gl.uniform3f(shaderProgram.materialSpecularColorUniform, 0.8, 0.8, 0.8);
	gl.uniform1f(shaderProgram.materialShininessUniform, 20.0);
	
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, planeVertexIndexBuffer);
	gl.drawElements(gl.TRIANGLES, planeVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
}

function tick() {
	requestAnimFrame(tick);
	
	if (movingForward) {
		cameraZ++;
	}
	
	if (movingBackward) {
		cameraZ--;
	}
	
	if (movingRight) {
		cameraX--;
	}
	
	if (movingLeft) {
		cameraX++;
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

var movingForward = false;
var movingBackward = false;
var movingRight = false;
var movingLeft = false;

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
	
	var camera = mat4.fromValues(camX[0], camX[1], camX[2], 0.0,
								 camY[0], camY[1], camY[2], 0.0,
								 camZ[0], camZ[1], camZ[2], 0.0,
								 position[0],  position[1],  position[2],  1.0);
	
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