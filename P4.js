// ======================== SYSTEM SETUP ========================

var scene = new THREE.Scene();
var sceneChild = new THREE.Object3D();
scene.add(sceneChild);
var clock = new THREE.Clock(false);
var clockFPS = new THREE.Clock(true);

// RENDERER
var renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000);
document.body.appendChild(renderer.domElement);

// CAMERA
var aspect = window.innerWidth / window.innerHeight;
var camera = new THREE.PerspectiveCamera(30, aspect, 0.1, 10000);
camera.position.set(0, 0, 0);
camera.lookAt(new THREE.Vector3(0, 0, 0));

// PICKING

var container = document.getElementById('container');

var containerWidth = container.clientWidth;
var containerHeight = container.clientHeight;

// ADAPT TO WINDOW RESIZE
function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    containerWidth = container.clientWidth;
    containerHeight = container.clientHeight;
}
window.addEventListener('resize', resize);
resize();

// HELPER GRID (Z to show/hide)
var gridGeometry = new THREE.Geometry();
var gridSize = 50;
for (var i = -gridSize; i < (gridSize + 1); i += 2) {
    gridGeometry.vertices.push(new THREE.Vector3(i, 0, -gridSize));
    gridGeometry.vertices.push(new THREE.Vector3(i, 0, gridSize));
    gridGeometry.vertices.push(new THREE.Vector3(-gridSize, 0, i));
    gridGeometry.vertices.push(new THREE.Vector3(gridSize, 0, i));
}
var gridMaterial = new THREE.LineBasicMaterial({color: 0xBBBBBB});
var grid = new THREE.Line(gridGeometry, gridMaterial, THREE.LinePieces);
var grid_state = false;


// ======================== VARIABLES ========================

// General Variables:
var geometry;
var material;

// Game
var isGameOver = false;
var envirn = {
    size: 150, // container box
    skyboxDiff: 300, // skybox is this much bigger than container
};

// Camera
var cameraPosition = {
    init: {x: 0, y: 0, z: -100},
    step: 1,
    rotStep: Math.PI/128,
    parent: null,
};
cameraPosition["x"] = cameraPosition.init.x;
cameraPosition["y"] = cameraPosition.init.y;
cameraPosition["z"] = cameraPosition.init.z;

// Display Board
var display = {
    difficulty: 1, // 1 = normal, 2 = hard, 3 = easy
    goal: 10,
    timeLimit: 120,
};
display["timeRemaining"] = display.timeLimit;

// Types of spheres:
//   - player sphere      (pSphere)
//   - stationary spheres (sSphere)
//   - mobile spheres     (mSphere)
//   - spiked spheres     (kSphere)

var pSphere = {
    // static
    texture: './playertexture.jpg',
    speed: 3.0,
    rotSpeed: Math.PI / 32,
    sizeIncrRate: 0.4,
    trackLine: {x: null, y: null, z: null, on: false},
    // dynamic
    mesh: null,
    mat: null,
    pos: new THREE.Vector3(0, 0, 0),
    radius: 5,
};

var sSphere = {
    initAmount: 20,
    radius: {min: 2, max: 8},
    sph: [],
    // rad
    // mesh
    // pos
    // material (shader material)
};

var mSphere = {
    initAmount: 10,
    radius: {min: 4, max: 20},
    speed: 1.5,
    rotChance: 0.02,
    sph: [],
    // rad
    // mesh
    // pos
    // moveMat
};

var kSphere = {
    initAmount: 15,
    radius: {min: 5, max: 15},
    speed: 0.01,
    rotChance: 0.0001,
    rotMatrixArray: [],
    sph: [],
    // rad
    // mesh
    // pos
    // moveMat
    // spikes
};

var sun = {
    mesh: null,
    radius: 32,
    position: {x: envirn.size, y: envirn.size, z: envirn.size},
    texture: './texture/sun.jpg',
    rotation: 0,
};
// for detecting collision use
sun["array"] = [];
sun.array.push({
    pos: {x: sun.position.x, y: sun.position.y, z: sun.position.z},
    rad: sun.radius,
});


// ======================== GAME SETUP ========================

// CAMERA *****************************
function updateCamera() {
    camera.position.x = cameraPosition.x;
    camera.position.y = cameraPosition.y;
    camera.position.z = cameraPosition.z;
    camera.lookAt(new THREE.Vector3(0, 0, 0));
}
updateCamera();

// SKYBOX *****************************

var urlPrefix = "./skybox/";
var urlSuffix = ".jpg";
var urlPic = "morning_";
var urlMid = [
    "ft", "bk",
    "up", "dn",
    "rt", "lf"
];
var urls = [];
for (var i = 0; i < 6; i++) {
    urls[i] = urlPrefix + urlPic + urlMid[i] + urlSuffix;
}

var cubemap = THREE.ImageUtils.loadTextureCube(urls);
cubemap.format = THREE.RGBFormat;

var shader = THREE.ShaderLib['cube'];
shader.uniforms['tCube'].value = cubemap;

var skyBoxMaterial = new THREE.ShaderMaterial({
    fragmentShader: shader.fragmentShader,
    vertexShader: shader.vertexShader,
    uniforms: shader.uniforms,
    depthWrite: false,
    side: THREE.BackSide
});

var skyboxSize = 2 * (envirn.size + envirn.skyboxDiff);
var skybox = new THREE.Mesh(
    new THREE.BoxGeometry(skyboxSize, skyboxSize, skyboxSize),
    skyBoxMaterial
);

scene.add(skybox);


// LIGHTING AND SHADING ***************

// Global Lighting
var ambientLight = new THREE.AmbientLight(0x777777);
scene.add(ambientLight);

globalLight = new THREE.PointLight(0xffffff, 1, 0);
globalLight.castShadow = true;
globalLight.position.set(sun.position.x, sun.position.y, sun.position.z);
scene.add(globalLight);

// Phong Lighting
var lightColor = new THREE.Color(1, 1, 1);
var ambientColor = new THREE.Color(0.4, 0.4, 0.4);
var lightPosition = new THREE.Vector3(100, 100, -100);

var kAmbient = new THREE.Color(0.4, 0.2, 0.4);
var kDiffuse = new THREE.Color(0.8, 0.1, 0.8);
var kSpecular = new THREE.Color(0.8, 0.5, 0.8);

var shininess = 10.0;

var phongMaterial = new THREE.ShaderMaterial({
    uniforms: {
        lightColor: {type: 'c', value: lightColor},
        ambientColor: {type: 'c', value: ambientColor},
        lightPosition: {type: 'v3', value: lightPosition},
        kAmbient: {type: 'c', value: kAmbient},
        kDiffuse: {type: 'c', value: kDiffuse},
        kSpecular: {type: 'c', value: kSpecular},
        shininess: {type: 'f', value: shininess},
    },
});

var shaderFiles = [
    'glsl/phong.vs.glsl',
    'glsl/phong.fs.glsl',
    'glsl/skybox.vs.glsl',
    'glsl/reflect.fs.glsl',
    'glsl/refract.fs.glsl',
    'glsl/reflectrefract.fs.glsl',
];

new THREE.SourceLoader().load(shaderFiles, function (shaders) {
    phongMaterial.vertexShader = shaders['glsl/phong.vs.glsl'];
    phongMaterial.fragmentShader = shaders['glsl/phong.fs.glsl'];
    phongMaterial.needsUpdate = true;
});


// Textures
var textures = [];
textures.push({tex: './texture/earthmap.jpg', bump: './texture/earthmapbump.jpg'});
textures.push({tex: './texture/venusmap.jpg', bump: './texture/venusmapbump.jpg'});
textures.push({tex: './texture/plutomap.jpg', bump: './texture/plutomapbump.jpg'});
textures.push({tex: './texture/jupitermap.jpg', bump: null});
textures.push({tex: './texture/neptunemap.jpg', bump: null});
textures.push({tex: './texture/saturnmap.jpg', bump: null});


// DISPLAY BOARD **********************

updateDifficulty();
document.getElementById("time").innerHTML = "Time Remaining: " + parseInt(display.timeRemaining);
updateSize();
document.getElementById("goal").innerHTML = "Goal: " + parseInt(display.goal);
document.getElementById("myfps").innerHTML = "Frames Per Second: " + parseInt(0);

// fps display
var stats = new Stats();
stats.setMode(0); // 0: fps, 1: ms, 2: mb

// align left
stats.domElement.style.position = 'absolute';
stats.domElement.style.right = '0px';
stats.domElement.style.top = '0px';

document.body.appendChild(stats.domElement);


// COLLISION DETECTION ****************

function detectCollision(collideSphere, i, generateFunc, sphereType) {
    // calculate distance between pSphere and collideSphere
    var dx = Math.abs(pSphere.pos.x - collideSphere[i].pos.x);
    var dy = Math.abs(pSphere.pos.y - collideSphere[i].pos.y);
    var dz = Math.abs(pSphere.pos.z - collideSphere[i].pos.z);
    var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    switch (sphereType) {
        case 1: // sSphere or mSphere
            // pSphere needs to pass through sSphere/mSphere center to absorb
            if (pSphere.radius >= collideSphere[i].rad) {
                dist = dist - pSphere.radius;
            } else {
                dist = dist - collideSphere[i].rad;
            }
            break;
        case 2: // kSphere
            // any point on pSphere touches any point on kSphere
            dist = dist - collideSphere[i].rad - pSphere.radius;
            break;
        case 3: // Sun
            dist = dist - collideSphere[i].rad - pSphere.radius;
            break;
    }
    
    // collided if dist less than 0
    if (dist <= 0) {
        switch (sphereType) {
        case 1:  // sSphere or mSphere
            if (pSphere.radius < collideSphere[i].rad) {
                eaten(collideSphere, i);
                gameEndScenario(false, "You have been eaten by a sphere larger than you.");
                return false;
            } else {
                eat(collideSphere, i, generateFunc);
                return true;
            }
            break;
        case 2: // kSphere
            gameEndScenario(false, "Try to avoid the spiked spheres.");
            return false;
            break;
        case 3: // sun
            gameEndScenario(false, "You have been burned by the sun.");
            return false;
            break;
        }
    }
}

function eat(collideSphere, i, generateFunc) {
    pSphere.radius = pSphere.radius + (pSphere.sizeIncrRate * collideSphere[i].rad);
    var geometry = new THREE.SphereGeometry(pSphere.radius, 32, 32);
    pSphere.mesh.geometry = geometry;
    updateSize();
    sceneChild.remove(collideSphere[i].mesh);
    collideSphere.splice(i, 1);
    collideSphere.push(generateFunc());
}

function eaten(collideSphere, i) {
    collideSphere.splice(i, 1); // TODO temporary
}


// PARTICLE SYSTEM ********************

var particleSystem = new THREE.Points();
var particleDir = [];

// Particle Creation
function createParticles(x, y, z, r) {
    // The number of particles in a particle system is not easily changed
    var particleCount = parseInt(pSphere.radius) * 100;

    // Particles are just individual vertices in a geometry
    // Create the geometry that will hold all of the vertices
    var particles = new THREE.Geometry();

    // Create the vertices and add them to the particles geometry
    for (var p = 0; p < particleCount; p++) {

        // Create the vertex
        var pX = x + Math.floor(Math.random() * (2 * r) - r);
        var pY = y + Math.floor(Math.random() * (2 * r) - r);
        var pZ = z + Math.floor(Math.random() * (2 * r) - r);

        var particle = new THREE.Vector3(pX, pY, pZ);

        // Add the vertex to the geometry
        particles.vertices.push(particle);

        // Set particle flying direction
        particleDir.push({
            x: (Math.random() * 5) - (5 / 2),
            y: (Math.random() * 5) - (5 / 2),
            z: (Math.random() * 5) - (5 / 2)
        });
    }

    // Create the material that will be used to render each vertex of the geometry
    var particleMaterial = new THREE.PointsMaterial(
        {
            color: 0xffffff,
            size: 4,
            map: THREE.ImageUtils.loadTexture("./particle.jpg"),
            blending: THREE.AdditiveBlending,
            transparent: true
        });

    // Create the particle system
    particleSystem = new THREE.Points(particles, particleMaterial);
    particleSystem.sortParticles = true;

    return particleSystem;
}

// Particle Animation
function animateParticles() {
    var deltaTime = clock.getDelta();
    var particles = particleSystem.geometry.vertices;
    for (var i = 0; i < particles.length; i++) {
        var particle = particles[i];
        particle.x += particleDir[i].x;
        particle.y += particleDir[i].y;
        particle.z += particleDir[i].z;
    }
    particleSystem.geometry.verticesNeedUpdate = true;
    particleSystem.rotation.x -= .1 * Math.random() * deltaTime;
    particleSystem.rotation.y -= .1 * Math.random() * deltaTime
    particleSystem.rotation.z -= .1 * Math.random() * deltaTime;

}


// PICKING ****************************


raycaster = new THREE.Raycaster();
mouseVector = new THREE.Vector2();
window.addEventListener('mousemove', onMouseMove, false);

function onMouseMove(e) {
    mouseVector.x = 2 * (e.clientX / containerWidth) - 1;
    mouseVector.y = 1 - 2 * (e.clientY / containerHeight);
    raycaster.setFromCamera(mouseVector, camera);
    var intersects = raycaster.intersectObjects(sceneChild.children);

    if (intersects.length == 0) {
        document.getElementById("selected").innerHTML = "No Object Selected!";
        return;
    }

    for (var i = 0; i < intersects.length; i++) {
        var intersection = intersects[i],
            obj = intersection.object;
        var vertices = obj.geometry.vertices;
        var radius, closestYIndex, farthestYIndex, first = true;

        for (var j = 0; j < vertices.length; j++) {
            if (first) {
                first = false;
                closestYIndex = j;
                farthestYIndex = j;
            }
            else {
                if (vertices[j].y < vertices[closestYIndex].y) {
                    closestYIndex = j;
                }
                if (vertices[j].y > vertices[farthestYIndex].y) {
                    farthestYIndex = j;
                }
                radius = (vertices[farthestYIndex].y - vertices[closestYIndex].y) / 2;
            }
        }
        document.getElementById("selected").innerHTML = "Selected Object Size: " + parseInt(radius);
    }
};


// USEFUL FUNCTIONS *******************

// Setting Matrix
THREE.Object3D.prototype.setMatrix = function (a) {
    this.matrix = a;
    this.matrix.decompose(this.position, this.quaternion, this.scale);
}

// Extract Position
function extractPosition(matrix) {
    var pos = new THREE.Vector4(0, 0, 0, 1);
    pos.applyMatrix4(matrix);
    return new THREE.Vector3(pos.x, pos.y, pos.z);
}

// Check Position is Inside Environment
function isOutOfBound(posX, posY, posZ) {
    return (posX > envirn.size || posX < -envirn.size ||
            posY > envirn.size || posY < -envirn.size ||
            posZ > envirn.size || posZ < -envirn.size)
}

// Random Generator
function getRandom(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};
function getRandomAngle() {
    return Math.random() * (2 * Math.PI);
}
function getRandomRotationMatrix() {
    var rotationMatrixX = new THREE.Matrix4().makeRotationY(getRandomAngle());
    var rotationMatrixY = new THREE.Matrix4().makeRotationX(getRandomAngle());
    return new THREE.Matrix4().multiplyMatrices(rotationMatrixX, rotationMatrixY);
}


// ======================== OBJECT CREATION ========================

// camera
cameraPosition.parent = new THREE.Object3D();
cameraPosition.parent.add(camera);

// pSphere
geometry = new THREE.SphereGeometry(pSphere.radius, 32, 32);
material = new THREE.MeshBasicMaterial({
    map: new THREE.TextureLoader().load(pSphere.texture),
    transparent: true, opacity: 0.5,
});
pSphere.speed = pSphere.radius / 2;
pSphere.mesh = new THREE.Mesh(geometry, material);
pSphere.mat = new THREE.Matrix4().identity();
pSphere.mesh.setMatrix(pSphere.mat);
sceneChild.add(pSphere.mesh);
pSphere.mesh.add(cameraPosition.parent);

function createTrackLine(axis, sx, sy, sz, ex, ey, ez) {
    var lineGeometry = new THREE.Geometry();
    material = new THREE.LineBasicMaterial( { color: 0x00FF00 } );
    var startVertex = new THREE.Vector3(sx, sy, sz);
    var endVertex = new THREE.Vector3(ex, ey, ez);
    lineGeometry.vertices.push(startVertex);
    lineGeometry.vertices.push(endVertex);
    pSphere.trackLine[axis] = new THREE.Line(lineGeometry, material);
}

for (var i = 0; i < 3; i++) {
    createTrackLine("z", 0, 0, 200, 0, 0, -50);
    createTrackLine("x", 3, 0, 0, -3, 0, 0);
    createTrackLine("y", 0, 3, 0, 0, -3, 0);
}

// sSphere
function generateSSphere() {
    // create sphere object
    var newSphere = {};

    // set radius
    var rad = getRandom(sSphere.radius.min, sSphere.radius.max);
    newSphere["rad"] = rad;

    // get random location for position
    var size = envirn.size - (envirn.size / 6);
    var posX = getRandom(-size, size);
    var posY = getRandom(-size, size);
    var posZ = getRandom(-size, size);
    newSphere["pos"] = new THREE.Vector3(posX, posY, posZ);
    var positionMatrix = new THREE.Matrix4().makeTranslation(posX, posY, posZ);

    // create mesh with shader material
    geometry = new THREE.SphereGeometry(rad, 32, 32);
    newSphere["material"] = new THREE.ShaderMaterial({
        uniforms: {
            texUnit: {type: 't', value: cubemap},
            transMat: {type: 'm4', value: positionMatrix},
        },
    });
    
    var randomNum = Math.random();
    var shaderFS;
    if (randomNum < 0.2) {
        shaderFS = 'glsl/reflect.fs.glsl';
    } else if (randomNum > 0.8) {
        shaderFS = 'glsl/refract.fs.glsl';
    } else {
        shaderFS = 'glsl/reflectrefract.fs.glsl';
    }
    
    new THREE.SourceLoader().load(shaderFiles, function (shaders) {
        newSphere.material.vertexShader = shaders['glsl/skybox.vs.glsl'];
        newSphere.material.fragmentShader = shaders[shaderFS];
        newSphere.material.needsUpdate = true;
    });
    newSphere["mesh"] = new THREE.Mesh(geometry, newSphere.material);
    newSphere.mesh.setMatrix(new THREE.Matrix4().identity());

    // translate to position
    newSphere.mesh.applyMatrix(positionMatrix);

    // add to scene
    sceneChild.add(newSphere.mesh);

    return newSphere;
}

for (var i = 0; i < sSphere.initAmount; i++) {
    sSphere.sph.push(generateSSphere());
}

// mSphere
function generateMSphere() {
    // create sphere object
    var newSphere = {};
    
    // set radius
    var rad = getRandom(mSphere.radius.min, mSphere.radius.max);
    newSphere["rad"] = rad;

    // get random initial location
    var size = envirn.size - (envirn.size / 5);
    var posX = getRandom(-size, size);
    var posY = getRandom(-size, size);
    var posZ = getRandom(-size, size);

    // create mesh
    geometry = new THREE.SphereGeometry(rad, 32, 32);
    var randomTexture = getRandom(0, textures.length - 1);
    var textureMaterial = new THREE.MeshPhongMaterial({
        map: new THREE.TextureLoader().load(textures[randomTexture].tex),
        emissive: 0x303030,
    });
    if (textures[randomTexture].bump != null) {
        textureMaterial.bumpMap = new THREE.TextureLoader().load(textures[randomTexture].bump);
        textureMaterial.bumpScale = 2.0;
    }
    newSphere["mesh"] = new THREE.Mesh(geometry, textureMaterial);
    newSphere.mesh.setMatrix(new THREE.Matrix4().identity());
    
    // set random location and rotation to movement matrix
    var translationMatrix = new THREE.Matrix4().makeTranslation(posX, posY, posZ);
    var rotationMatrix = getRandomRotationMatrix();
    newSphere["moveMat"] = new THREE.Matrix4().multiplyMatrices(rotationMatrix, translationMatrix);

    // set and store current position of newSphere
    newSphere["pos"] = extractPosition(newSphere.moveMat);
    var positionMatrix = new THREE.Matrix4().makeTranslation(newSphere.pos.x, newSphere.pos.y, newSphere.pos.z);
    newSphere.mesh.setMatrix(positionMatrix);

    // add to scene
    sceneChild.add(newSphere.mesh);

    return newSphere;
}

for (var i = 0; i < mSphere.initAmount; i++) {
    mSphere.sph.push(generateMSphere());
}


// kSphere

// six basic surfaces
kSphere.rotMatrixArray.push(new THREE.Matrix4().makeRotationZ(0));
kSphere.rotMatrixArray.push(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
kSphere.rotMatrixArray.push(new THREE.Matrix4().makeRotationZ(Math.PI));
kSphere.rotMatrixArray.push(new THREE.Matrix4().makeRotationZ(-Math.PI / 2));
kSphere.rotMatrixArray.push(new THREE.Matrix4().makeRotationX(Math.PI / 2));
kSphere.rotMatrixArray.push(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
// half angles
kSphere.rotMatrixArray.push(new THREE.Matrix4().makeRotationZ(Math.PI / 4));
kSphere.rotMatrixArray.push(new THREE.Matrix4().makeRotationZ(-Math.PI / 4));
kSphere.rotMatrixArray.push(new THREE.Matrix4().makeRotationZ(3 * Math.PI / 4));
kSphere.rotMatrixArray.push(new THREE.Matrix4().makeRotationZ(-3 * Math.PI / 4));
kSphere.rotMatrixArray.push(new THREE.Matrix4().makeRotationX(Math.PI / 4));
kSphere.rotMatrixArray.push(new THREE.Matrix4().makeRotationX(-Math.PI / 4));
kSphere.rotMatrixArray.push(new THREE.Matrix4().makeRotationX(3 * Math.PI / 4));
kSphere.rotMatrixArray.push(new THREE.Matrix4().makeRotationX(-3 * Math.PI / 4));
kSphere.rotMatrixArray.push(new THREE.Matrix4().multiplyMatrices(
    new THREE.Matrix4().makeRotationZ(-Math.PI / 2),
    new THREE.Matrix4().makeRotationX(-Math.PI / 4)));
kSphere.rotMatrixArray.push(new THREE.Matrix4().multiplyMatrices(
    new THREE.Matrix4().makeRotationZ(-Math.PI / 2),
    new THREE.Matrix4().makeRotationX(Math.PI / 4)));
kSphere.rotMatrixArray.push(new THREE.Matrix4().multiplyMatrices(
    new THREE.Matrix4().makeRotationZ(Math.PI / 2),
    new THREE.Matrix4().makeRotationX(-Math.PI / 4)));
kSphere.rotMatrixArray.push(new THREE.Matrix4().multiplyMatrices(
    new THREE.Matrix4().makeRotationZ(Math.PI / 2),
    new THREE.Matrix4().makeRotationX(Math.PI / 4)));

// kSphere
function generateKSphere() {
    // create sphere object
    var newSphere = {};
    
    // set radius
    var rad = getRandom(kSphere.radius.min, kSphere.radius.max);
    newSphere["rad"] = rad;

    // get random initial location
    var size = envirn.size - (envirn.size / 5);
    var posX = getRandom(-size, size);
    var posY = getRandom(-size, size);
    var posZ = getRandom(-size, size);

    // create mesh
    geometry = new THREE.SphereGeometry(rad / 4, 32, 32);
    newSphere["mesh"] = new THREE.Mesh(geometry, phongMaterial);
    newSphere.mesh.setMatrix(new THREE.Matrix4().identity());
    
    // create spikes
    var kTranslationMatrix = new THREE.Matrix4().makeTranslation(0, newSphere.rad / 2, 0);
    newSphere["spikes"] = [];
    for (var i = 0; i < kSphere.rotMatrixArray.length; i++) {
        var spikeGeometry = new THREE.CylinderGeometry(0, newSphere.rad / 12, newSphere.rad, 32);
        newSphere.spikes.push({});
        newSphere.spikes[i]["mesh"] = new THREE.Mesh(spikeGeometry, phongMaterial);
        var kRotationMatrix = kSphere.rotMatrixArray[i];
        var kTransformMatrix = new THREE.Matrix4().multiplyMatrices(kRotationMatrix, kTranslationMatrix);
        newSphere.spikes[i].mesh.applyMatrix(kTransformMatrix);
        newSphere.mesh.add(newSphere.spikes[i].mesh);
    }
    
    // set random location and rotation to movement matrix
    var translationMatrix = new THREE.Matrix4().makeTranslation(posX, posY, posZ);
    var rotationMatrix = getRandomRotationMatrix();
    newSphere["moveMat"] = new THREE.Matrix4().multiplyMatrices(rotationMatrix, translationMatrix);

    // set and store current position of newSphere
    newSphere["pos"] = extractPosition(newSphere.moveMat);
    var positionMatrix = new THREE.Matrix4().makeTranslation(newSphere.pos.x, newSphere.pos.y, newSphere.pos.z);
    newSphere.mesh.setMatrix(positionMatrix);

    // add to scene
    sceneChild.add(newSphere.mesh);

    return newSphere;
}

for (var i = 0; i < kSphere.initAmount; i++) {
    kSphere.sph.push(generateKSphere());
}

//sun
geometry = new THREE.SphereGeometry(sun.radius, 32, 32);
material = new THREE.MeshBasicMaterial({
    map: new THREE.TextureLoader().load(sun.texture)
});

sun.mesh = new THREE.Mesh(geometry, material);
sun.mesh.setMatrix(new THREE.Matrix4().makeTranslation(sun.position.x, sun.position.y, sun.position.z));
sceneChild.add(sun.mesh);


// ======================== UPDATE ========================

var currentTime = clockFPS.getElapsedTime();
var startTime = currentTime;
var aveFPS = [];

function updateWorld() {
    
    currentTime = clockFPS.getElapsedTime();
    var deltaTime = currentTime - startTime;
    startTime = currentTime;
    var myfps = 1 / deltaTime;
    if (aveFPS.length < 30) {
        aveFPS.push(myfps);
    } else {
        aveFPS.splice(0, 1);
        aveFPS.push(myfps);
    }
    
    var sum = 0;
    for (var i = 0; i < aveFPS.length; i++) {
        sum = sum + aveFPS[i];
    }
    var average = Math.round(sum / aveFPS.length);
    
    document.getElementById("myfps").innerHTML = "Frames Per Second: " + parseInt(average);
    
    if (!freeze) {
        updateTime();

        // ROTATE SUN
        updateSun();
        
        // MOVE pSphere
        updatePSphere();

        // MOUSE EVENTS
        if (mouseDown) {
            if (mouseX <= (window.innerWidth / 2 - 300) || mouseY <= (window.innerHeight / 2 - 190)) {
                var rotationMatrixX = new THREE.Matrix4().makeRotationY(
                    (pSphere.rotSpeed * -mouseX) / window.innerWidth);
                var rotationMatrixY = new THREE.Matrix4().makeRotationX(
                    (pSphere.rotSpeed * mouseY) / window.innerWidth);
                var rotationMatrix = new THREE.Matrix4().multiplyMatrices(rotationMatrixX, rotationMatrixY);
                pSphere.mat = new THREE.Matrix4().multiplyMatrices(pSphere.mat, rotationMatrix);
            }

        }

        // MOVE mSphere
        for (var i = 0; i < mSphere.sph.length; i++) {
            updateMSphere(mSphere.sph[i]);
        }
        
        // MOVE kSphere
        for (var i = 0; i < kSphere.sph.length; i++) {
            updateMSphere(kSphere.sph[i]);
        }

        // DETECT COLLISION with other spheres
        for (var i = 0; i < sSphere.sph.length; i++) {
            if (detectCollision(sSphere.sph, i, generateSSphere, 1)) {
                i--;
            }
        }
        for (var i = 0; i < mSphere.sph.length; i++) {
            if (detectCollision(mSphere.sph, i, generateMSphere, 1)) {
                i--;
            }
        }
        for (var i = 0; i < kSphere.sph.length; i++) {
            detectCollision(kSphere.sph, i, generateKSphere, 2);
        }
        detectCollision(sun.array, 0, null, 3);
    }
    animateParticles();
}

function updateSun() {
    sun.rotation = (sun.rotation + Math.PI/1024) % (2 * Math.PI);
    var translationMatrix = new THREE.Matrix4().makeTranslation(sun.position.x, sun.position.y, sun.position.z);
    var rotationMatrix = new THREE.Matrix4().makeRotationY(sun.rotation);
    var transformMatrix = new THREE.Matrix4().multiplyMatrices(translationMatrix, rotationMatrix);
    sun.mesh.setMatrix(transformMatrix);
}

function updatePSphere() {
    var translationMatrix = new THREE.Matrix4().makeTranslation(0, 0,
        ((1 / pSphere.radius) * pSphere.speed));
    
    // detect collision with wall
    var tempMatrix = new THREE.Matrix4().multiplyMatrices(pSphere.mat, translationMatrix);
    var pos = extractPosition(tempMatrix);
    if (isOutOfBound(pos.x, pos.y, pos.z)) {
        if (!isGameOver) {
            document.getElementById("environmentBound").innerHTML = "You have gone outside of the environment." + "<br/>" + "Please stay inside the environment";
        } else {
            document.getElementById("environmentBound").innerHTML = "";
        }
    } else {
        document.getElementById("environmentBound").innerHTML = "";
        pSphere.mat = tempMatrix;
        pSphere.pos = extractPosition(pSphere.mat);
    }
    
    pSphere.mesh.setMatrix(pSphere.mat);
}

function updateMSphere(curSphere) {
    var randomNum = Math.random();
    if (randomNum <= mSphere.rotChance) {
        var rotationMatrix = getRandomRotationMatrix();
        curSphere.moveMat = new THREE.Matrix4().multiplyMatrices(curSphere.moveMat, rotationMatrix);
    } else {
        var translateAmount = Math.pow(1 / curSphere.rad, 1/2) * mSphere.speed;
        var translationMatrix = new THREE.Matrix4().makeTranslation(0, 0, translateAmount);

        // check detection with wall
        var tempMatrix = new THREE.Matrix4().multiplyMatrices(curSphere.moveMat, translationMatrix);
        
        var pos = extractPosition(tempMatrix);
        if (isOutOfBound(pos.x, pos.y, pos.z)) {
            var outRotationMatrix = new THREE.Matrix4().makeRotationX(Math.PI);
            curSphere.moveMat = new THREE.Matrix4().multiplyMatrices(curSphere.moveMat, outRotationMatrix);
        } else {
            curSphere.moveMat = tempMatrix;
        }
        
    }
    // update current position of curSphere
    curSphere.pos = extractPosition(curSphere.moveMat);
    
    // set mSphere to position
    var positionMatrix = new THREE.Matrix4().makeTranslation(curSphere.pos.x, curSphere.pos.y, curSphere.pos.z);
    curSphere.mesh.setMatrix(positionMatrix);
}


function updateDifficulty() {
    var text = "";
    if (display.difficulty == 1) {
        text = "Difficulty: normal";
        display.goal = 10;
    }
    if (display.difficulty == 2) {
        text = "Difficulty: hard";
        display.goal = 20;
    }
    if (display.difficulty == 3) {
        text = "Difficulty: easy";
        display.goal = 6;
    }
    document.getElementById("difficulty").innerHTML = text;
    document.getElementById("goal").innerHTML = "Goal: " + parseInt(display.goal);
}

function updateTime() {
    // Game Over
    if (display.timeRemaining == 0) {
        gameEndScenario(false, "TIME'S UP! You have not reached the goal size within the time limit.");
        return;
    }
    display.timeRemaining = Math.floor(display.timeLimit - clock.getElapsedTime());
    document.getElementById("time").innerHTML = "Time Remaining: " + parseInt(display.timeRemaining);
}

function updateSize() {
    document.getElementById("size").innerHTML = "Current Size: " + parseInt(pSphere.radius);
    if (pSphere.radius >= display.goal) {
        win = true;
        gameEndScenario(true, "YOU WON!");
    }
}


// Game Over
function gameEndScenario(win, s) {
    var boldText;
    if (win) {
        pSphere.texture = './texture/doge.jpg';
        material = new THREE.MeshBasicMaterial({map: new THREE.TextureLoader().load(pSphere.texture)});
        pSphere.mesh.material = material;
        s = "";
        boldText = "YOU'RE WINNER!";
    }
    if (!win) {
        sceneChild.remove(pSphere.mesh);
        particleSystem = createParticles(pSphere.pos.x, pSphere.pos.y, pSphere.pos.z, pSphere.radius);
        scene.add(particleSystem);
        boldText = "Game Over!";
    }
    freeze = true;
    isGameOver = true;
    document.getElementById("environmentBound").innerHTML = "";
    console.log("HIII");
    document.getElementById("endGame").innerHTML = boldText + "<br />" + "Press Space to Restart";
    document.getElementById("endGameDescrip").innerHTML = s;
}


// ======================== KEYBOARD AND MOUSE ========================

// KEYBOARD CONTROL
var keyboard = new THREEx.KeyboardState();
keyboard.domElement.addEventListener('keydown', keyEvent);

var freeze = true;
function keyEvent(event) {
    // helper grid (convenient for debugging)
    if (keyboard.eventMatches(event, "Z")) {
        grid_state = !grid_state;
        grid_state ? scene.add(grid) : scene.remove(grid);
    }

    // PAUSE GAME and RESTART GAME
    else if (keyboard.eventMatches(event, "space")) {
        if (!isGameOver) {
            freeze = !freeze;
            if (freeze) {
                clock.stop();
                document.getElementById("endGame").innerHTML = "Game Paused";
                document.getElementById("environmentBound").innerHTML = "";
            }
            if (!freeze) {
                clock.start();
                document.getElementById("endGame").innerHTML = "";
                document.getElementById("environmentBound").innerHTML = "";
            }
        }
        else {
            location.reload();
        }
    }

    // TOGGLE DIFFICULTY
    else if (keyboard.eventMatches(event, "t")) {
        if (display.difficulty == 3) {
            display.difficulty = 1;
        }
        else {
            display.difficulty = display.difficulty + 1;
        }
        updateDifficulty();
    }
    
    // MOVEMENT BY KEYBOARD
    else if (keyboard.eventMatches(event, "d")) {
        keyMove("right");
    }
    else if (keyboard.eventMatches(event, "a")) {
        keyMove("left");
    }
    else if (keyboard.eventMatches(event, "w")) {
        keyMove("up");
    }
    else if (keyboard.eventMatches(event, "s")) {
        keyMove("down");
    }
    
    // CAMERA MOVEMENT
    else if (keyboard.eventMatches(event, "o")) {
        cameraPosition.x = cameraPosition.init.x;
        cameraPosition.y = cameraPosition.init.y;
        cameraPosition.z = cameraPosition.init.z;
        cameraPosition.parent.setMatrix(new THREE.Matrix4().identity());
        updateCamera();
    }
    else if (keyboard.eventMatches(event, "i")) {
        var newZ = cameraPosition.z + cameraPosition.step;
        newZ = Math.min(-cameraPosition.step, newZ);
        cameraPosition.z = newZ;
        updateCamera();
    }
    else if (keyboard.eventMatches(event, "k")) {
        var newZ = cameraPosition.z - cameraPosition.step;
        newZ = Math.max(-envirn.skyboxDiff, newZ);
        cameraPosition.z = newZ;
        updateCamera();
    }
    else if (keyboard.eventMatches(event, "up")) {
        cameraPosition.parent.applyMatrix(new THREE.Matrix4().makeRotationX(cameraPosition.rotStep));
        updateCamera();
    }
    
    else if (keyboard.eventMatches(event, "down")) {
        cameraPosition.parent.applyMatrix(new THREE.Matrix4().makeRotationX(-cameraPosition.rotStep));
        updateCamera();
    }
    else if (keyboard.eventMatches(event, "left")) {
        cameraPosition.parent.applyMatrix(new THREE.Matrix4().makeRotationY(-cameraPosition.rotStep));
        updateCamera();
    }
    else if (keyboard.eventMatches(event, "right")) {
        cameraPosition.parent.applyMatrix(new THREE.Matrix4().makeRotationY(cameraPosition.rotStep));
        updateCamera();
    }
    
    // HELPER TRACK LINE
    else if (keyboard.eventMatches(event, "l")) {
        if (pSphere.trackLine.on) {
            pSphere.mesh.remove(pSphere.trackLine.x);
            pSphere.mesh.remove(pSphere.trackLine.y);
            pSphere.mesh.remove(pSphere.trackLine.z);
            pSphere.trackLine.on = false;
        } else {
            pSphere.mesh.add(pSphere.trackLine.x);
            pSphere.mesh.add(pSphere.trackLine.y);
            pSphere.mesh.add(pSphere.trackLine.z);
            pSphere.trackLine.on = true;
        }
    }
    
    
};


function keyMove(dir) {
    if (dir == "up") {
        var rotationMatrix = new THREE.Matrix4().makeRotationX(-pSphere.rotSpeed);
        pSphere.mat = new THREE.Matrix4().multiplyMatrices(pSphere.mat, rotationMatrix);
    }
    if (dir == "down") {
        var rotationMatrix = new THREE.Matrix4().makeRotationX(pSphere.rotSpeed);
        pSphere.mat = new THREE.Matrix4().multiplyMatrices(pSphere.mat, rotationMatrix);
    }
    if (dir == "left") {
        var rotationMatrix = new THREE.Matrix4().makeRotationY(pSphere.rotSpeed);
        pSphere.mat = new THREE.Matrix4().multiplyMatrices(pSphere.mat, rotationMatrix);
    }
    if (dir == "right") {
        var rotationMatrix = new THREE.Matrix4().makeRotationY(-pSphere.rotSpeed);
        pSphere.mat = new THREE.Matrix4().multiplyMatrices(pSphere.mat, rotationMatrix);
    }
}

// MOUSE CONTROL
var mouseDown = false;
var mouseX;
var mouseY;

document.addEventListener('mousedown', function (event) {
    mouseDown = true;
});
document.addEventListener('mouseup', function (event) {
    mouseDown = false;
});
document.addEventListener('mousemove', function (event) {
    mouseX = event.clientX - (window.innerWidth / 2);
    mouseY = event.clientY - (window.innerHeight / 2);
});


// ======================== UPDATE CALL-BACK ========================

// SETUP UPDATE CALL-BACK
function update() {
    stats.begin();
    updateWorld();
    stats.end();
    requestAnimationFrame(update);
    renderer.render(scene, camera)
}

update();


