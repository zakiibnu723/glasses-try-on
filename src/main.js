import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { FaceMesh } from "@mediapipe/face_mesh";

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

camera.position.z = 2;

let glassesModel;
const loader = new GLTFLoader();
loader.load("./assets/MOSCOT_ZEV_TT_SE.obj", (gltf) => {
  glassesModel = gltf.scene;
  glassesModel.scale.set(0.05, 0.05, 0.05);
  scene.add(glassesModel);
});

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

function onResults(results) {
  if (results.multiFaceLandmarks.length > 0) {
    const landmarks = results.multiFaceLandmarks[0];
    alignGlasses(landmarks);
  }
}

function alignGlasses(landmarks) {
  if (!glassesModel) return;

  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const nose = landmarks[1];

  // Position
  glassesModel.position.set(
    (leftEye.x + rightEye.x) / 2 - 0.5,
    -(leftEye.y + rightEye.y) / 2 + 0.5,
    -nose.z * 2
  );

  // Scale
  const distance = Math.sqrt(
    Math.pow(rightEye.x - leftEye.x, 2) +
    Math.pow(rightEye.y - leftEye.y, 2)
  );
  glassesModel.scale.set(distance * 5, distance * 5, distance * 5);
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
