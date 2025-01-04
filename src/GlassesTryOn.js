import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FaceMesh } from '@mediapipe/face_mesh';

export class GlassesTryOn {
    constructor(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.model = null;
        this.faceMesh = null;
        this.loader = new GLTFLoader();
        this.isTracking = false;
    }

    async init() {
        try {
            await this.setupScene();
            await this.setupWebcam();
            await this.setupFaceMesh();
            this.animate();
            console.log('Initialization complete');
        } catch (error) {
            console.error('Initialization failed:', error);
        }
    }

    async setupScene() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(0, 1, 1);
        this.scene.add(directionalLight);

        this.camera.position.z = 5;

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    async setupWebcam() {
        return new Promise((resolve, reject) => {
            navigator.mediaDevices.getUserMedia({
                video: {
                    width: 1280,
                    height: 720,
                    facingMode: 'user'
                }
            })
            .then(stream => {
                this.video.srcObject = stream;
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    resolve();
                };
            })
            .catch(error => {
                console.error('Error accessing webcam:', error);
                reject(error);
            });
        });
    }

    async setupFaceMesh() {
        this.faceMesh = new FaceMesh({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });

        await this.faceMesh.initialize();

        this.faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.faceMesh.onResults((results) => {
            this.onFaceDetected(results);
        });

        this.isTracking = true;
    }

    async startTracking() {
        if (!this.isTracking) return;
        
        try {
            await this.faceMesh.send({ image: this.video });
        } catch (error) {
            console.error('Error in face detection:', error);
        }
    }

    animate = () => {
        this.startTracking();
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(this.animate);
    }

    onFaceDetected(results) {
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const face = results.multiFaceLandmarks[0];
            
            if (this.model) {
                // Calculate center point between eyes
                const leftEye = face[133];
                const rightEye = face[362];
                const centerX = (leftEye.x + rightEye.x) / 2;
                const centerY = (leftEye.y + rightEye.y) / 2;
                const centerZ = (leftEye.z + rightEye.z) / 2;

                // Update glasses position
                this.model.position.set(
                    (centerX - 0.5) * 10,  // Increased scale factor
                    -(centerY - 0.5) * 10, // Increased scale factor
                    -centerZ * 10          // Increased scale factor
                );

                // Calculate face rotation
                const nose = face[6];
                const leftEar = face[234];
                const rightEar = face[454];

                const earDiff = {
                    x: rightEar.x - leftEar.x,
                    y: rightEar.y - leftEar.y,
                    z: rightEar.z - leftEar.z
                };

                this.model.rotation.y = Math.atan2(earDiff.z, earDiff.x);
                this.model.rotation.z = Math.atan2(earDiff.y, earDiff.x);
                this.model.rotation.x = Math.atan2(nose.z, nose.y);
            }
        }
    }

    async loadGlassesModel(modelPath) {
        try {
            const gltf = await this.loader.loadAsync(modelPath);
            this.model = gltf.scene;
            
            // Adjust initial scale (you may need to modify these values)
            this.model.scale.set(0.1, 0.1, 0.1);
            
            // Set initial position
            this.model.position.set(0, 0, 0);
            
            this.scene.add(this.model);
            console.log('Glasses model loaded successfully');
        } catch (error) {
            console.error('Error loading glasses model:', error);
            throw error;
        }
    }
}