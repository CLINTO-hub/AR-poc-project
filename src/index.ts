/* eslint-disable no-param-reassign */
/// Zappar for ThreeJS Examples
/// Instant Tracking Volumetric Video (Arcturus Hologram Web API)
// In this example, we track a 3D model using Zappar's instant world tracking

import * as THREE from 'three';
import * as ZapparThree from '@zappar/zappar-threejs';
import { showUI } from '@zappar/splash';
import './index.css';
const logo = new URL('../assets/logo.png', import.meta.url).href;
const hotspotImg = new URL('../assets/hotspot.png', import.meta.url).href;
const glbModel = new URL('../assets/studio.glb', import.meta.url).href;

declare const HoloStream: any;

// The SDK is supported on many different browsers, but there are some that
// don't provide camera access. This function detects if the browser is supported
// For more information on support, check out the readme over at
// https://www.npmjs.com/package/@zappar/zappar-threejs
if (ZapparThree.browserIncompatible()) {
  // The browserIncompatibleUI() function shows a full-page dialog that informs the user
  // they're using an unsupported browser, and provides a button to 'copy' the current page
  // URL so they can 'paste' it into the address bar of a compatible alternative.
  ZapparThree.browserIncompatibleUI();

  // If the browser is not compatible, we can avoid setting up the rest of the page
  // so we throw an exception here.
  throw new Error('Unsupported browser');
}

/*
 * *** COMMON VARIABLES ***
*/
// Placement button and variable for anchoring content
const placeButton = document.getElementById('zappar-placement-ui')!;
let hasPlaced = false;

// Create a Zappar camera that we'll use instead of a ThreeJS camera
const camera = new ZapparThree.Camera();
camera.backgroundTexture.encoding = THREE.sRGBEncoding;

/*
 * *** SPLASH SCREEN ***
 */
showUI({
  // Hide the screen when user taps on the button.
  onClick: (e) => {
    // Request the necessary permission from the user
    ZapparThree.permissionRequestUI().then((granted: boolean) => {
      if (granted) {
        // Pass 'false' to skip fading out.
        e.destroy();

        camera.start();
        placeButton.style.display = 'block';
      } else {
        e.destroy();

        camera.start();
        placeButton.style.display = 'block';
      }
    });
  },
  title: 'AR 3D Model',
  subtitle: 'Presented by: Metadrob',
  buttonText: 'Tap to Start',
  // background: "",
  logo,
});

// Construct our ThreeJS renderer and scene as usual
const renderer = new THREE.WebGLRenderer({ antialias: true });
document.body.appendChild(renderer.domElement);

// As with a normal ThreeJS scene, resize the canvas if the window resizes
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Set up shadows
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.physicallyCorrectLights = true;

// The Zappar component needs to know our WebGL context, so set it like this:
ZapparThree.glContextSet(renderer.getContext());

// Create a ThreeJS Scene and set its background to be the camera background texture
const scene = new THREE.Scene();
scene.background = camera.backgroundTexture;

/*
 * *** SET UP ZAPPAR TRACKER ***/
// Create an InstantWorldTracker and wrap it in an InstantWorldAnchorGroup for us
// to put our ThreeJS content into
const instantTracker = new ZapparThree.InstantWorldTracker();
const instantTrackerGroup = new ZapparThree.InstantWorldAnchorGroup(camera, instantTracker);
// Add our instant tracker group into the ThreeJS scene
scene.add(instantTrackerGroup);

/*
 * *** SET UP LIGHTS ***/
// Let's add some lighting, first a directional light above the model pointing down
const directionalLight = new THREE.DirectionalLight('white', 0.8);
directionalLight.target = instantTrackerGroup;
directionalLight.position.set(0, 5, 0);

// Set up ability for this light to produce shadows
directionalLight.castShadow = true;
directionalLight.shadow.bias = 0.001;
directionalLight.shadow.radius = 2;
directionalLight.shadow.mapSize.setScalar(1024);

// And then a little ambient light to brighten the video up a bit
const ambientLight = new THREE.AmbientLight('white', 0.2);

// Add the lights to the scene
instantTrackerGroup.add(ambientLight, directionalLight);

/*
 * *** LOAD GLB MODEL ***/
// Use GLTFLoader to load a .glb model and add it to the scene
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const loader = new GLTFLoader();
let model: THREE.Object3D | null = null;

loader.load(
  `${glbModel}`, // Replace with your GLB model URL
  (gltf) => {
    console.log(gltf,'GLTF');
    
    model = gltf.scene;
    model.scale.set(0.5, 0.5, 0.5); // Scale the model if necessary
    model.castShadow = true;
    model.receiveShadow = true;
    instantTrackerGroup.add(model);
  },
  undefined, // onProgress callback (optional)
  (error) => {
    console.error('Error loading the GLB model', error);
  }
);

/*
 * *** PLACEMENT HOTSPOT ***/
// Load in a hostpot texture from our ../assets folder
const hotspotTexture = new THREE.TextureLoader().load(hotspotImg);
// Create a mesh for the texture to attach to
const hotspot = new THREE.Mesh(
  new THREE.PlaneBufferGeometry(),
  new THREE.MeshBasicMaterial({
    // Get the hotspot texture and set it as the map
    map: hotspotTexture,
    // Make sure we can see it from all angles
    side: THREE.DoubleSide,
    // Set the transparency so we can see the ring
    transparent: true,
    alphaTest: 0.5,
  }),
);
hotspot.scale.setScalar(2);
// Prevent z-fighting between the hotspot and the shadow plane
hotspot.renderOrder = 1;
// Rotate the hotspot so that it is flat on the floor
hotspot.rotateX(-0.5 * Math.PI);
instantTrackerGroup.add(hotspot);

/*
 * *** SHADOW PLANE ***/
const shadowPlane = new THREE.Mesh(
  new THREE.PlaneBufferGeometry(window.innerWidth, window.innerHeight),
  new THREE.ShadowMaterial(
    {
      // Make the plane semi-transparent so some of the ground is visible under the shadow
      opacity: 0.3,
      depthWrite: false,
    },
  ),
);
shadowPlane.receiveShadow = true;
// Rotate the plane to be flat on the ground
shadowPlane.rotateX(-Math.PI / 2);
instantTrackerGroup.add(shadowPlane);

/*
 * *** PLACEMENT UI FUNCTIONALITY ***/
// When the experience loads, we'll let the user choose a place in their room for
// the content to appear using setAnchorPoseFromCameraOffset (see below)
// The user can confirm the location by tapping on the button
placeButton.addEventListener('click', () => {
  if (hasPlaced) {
    hasPlaced = false;
    placeButton.innerText = 'Tap to place';
    // Hide the model
    if (model) model.visible = false;
    hotspot.material.opacity = 1;
    return;
  }
  hasPlaced = true;
  placeButton.innerText = 'Tap to pick up';
  // Show the model
  if (model) model.visible = true;
  hotspot.material.opacity = 0;
});

/*
 * *** RENDER/ANIMATE LOOP ***/
// Use a function to render our scene as usual
function render(): void {
  if (!hasPlaced) {
    // If the user hasn't chosen a place in their room yet, update the instant tracker
    // to be directly in front of the user
    instantTrackerGroup.setAnchorPoseFromCameraOffset(0, -1.5, -6);
  }

  // The Zappar camera must have updateFrame called every frame
  camera.updateFrame(renderer);

  // Draw the ThreeJS scene in the usual way, but using the Zappar camera
  renderer.render(scene, camera);
}

// Start things off
renderer.setAnimationLoop(render);
