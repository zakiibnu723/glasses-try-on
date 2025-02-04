
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { FaceMesh } from "@mediapipe/face_mesh";

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

camera.position.z = 3;

let glassesModel;
const loader = new OBJLoader();
loader.load("./assets/MOSCOT_ZEV_TT_SE.obj", (object) => {
  glassesModel = object;
  glassesModel.scale.set(0.05, 0.05, 0.05);
  scene.add(glassesModel);
});

// Set up video stream and FaceMesh
navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
  video.srcObject = stream;

  const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  faceMesh.onResults(onResults);

  video.addEventListener("loadeddata", () => {
    setInterval(() => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      faceMesh.send({ image: canvas });
    }, 100);
  });
});

// Handle face mesh results
function onResults(results) {
  if (results.multiFaceLandmarks.length > 0) {
    const landmarks = results.multiFaceLandmarks[0];
    
    // Log landmarks to confirm detection
    console.log("Face landmarks detected:", landmarks);
    
    // Draw the face landmarks on the canvas
    drawLandmarks(landmarks);

    alignGlasses(landmarks);
  }
}

// Function to draw face landmarks on canvas for debugging
function drawLandmarks(landmarks) {
  const pointRadius = 2;
  ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the previous frame
  ctx.fillStyle = "red";
  
  landmarks.forEach(landmark => {
    const x = landmark.x * canvas.width;
    const y = landmark.y * canvas.height;
    ctx.beginPath();
    ctx.arc(x, y, pointRadius, 0, 2 * Math.PI);
    ctx.fill();
  });
}

// Align glasses model with face landmarks
function alignGlasses(landmarks) {
  if (!glassesModel) return;

  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const nose = landmarks[1];

  // Position glasses based on the landmarks
  glassesModel.position.set(
    (leftEye.x + rightEye.x) / 2 - 0.5,
    -(leftEye.y + rightEye.y) / 2 + 0.5,
    -nose.z * 1.5 // Adjust depth
  );

  // Scale the glasses based on the distance between eyes
  const distance = Math.sqrt(
    Math.pow(rightEye.x - leftEye.x, 2) +
    Math.pow(rightEye.y - leftEye.y, 2)
  );
  glassesModel.scale.set(distance * 0.6, distance * 0.6, distance * 0.6);
}

// Animation loop to render the 3D scene
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();
