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
        this.smoothingFactor = 0.5; // Increased for less delay
        this.currentPosition = new THREE.Vector3();
        this.currentRotation = new THREE.Euler();
        
        // Touch control variables
        this.isDragging = false;
        this.previousTouch = { x: 0, y: 0 };
        this.offsetPosition = new THREE.Vector3(0, 0, 0);
        this.userScale = 1.0;
        
        // Bind touch event handlers
        this.setupTouchControls();
    }

    setupTouchControls() {
        // Single touch for moving
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                this.isDragging = true;
                this.previousTouch.x = e.touches[0].clientX;
                this.previousTouch.y = e.touches[0].clientY;
            }
        });

        this.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1 && this.isDragging) {
                const deltaX = (e.touches[0].clientX - this.previousTouch.x) * 0.01;
                const deltaY = (e.touches[0].clientY - this.previousTouch.y) * 0.01;
                
                this.offsetPosition.x += deltaX;
                this.offsetPosition.y -= deltaY;

                this.previousTouch.x = e.touches[0].clientX;
                this.previousTouch.y = e.touches[0].clientY;
            }
            // Pinch to scale
            else if (e.touches.length === 2) {
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                
                if (this.previousPinchDistance) {
                    const delta = (dist - this.previousPinchDistance) * 0.01;
                    this.userScale = Math.max(0.5, Math.min(2.0, this.userScale + delta));
                }
                
                this.previousPinchDistance = dist;
            }
        });

        this.canvas.addEventListener('touchend', () => {
            this.isDragging = false;
            this.previousPinchDistance = null;
        });

        // Add double tap to reset
        let lastTap = 0;
        this.canvas.addEventListener('touchend', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            if (tapLength < 500 && tapLength > 0) {
                this.resetAdjustments();
            }
            lastTap = currentTime;
        });
    }

    resetAdjustments() {
        this.offsetPosition.set(0, 0, 0);
        this.userScale = 1.0;
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
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: "user"
                }
            })
            .then(stream => {
                this.video.srcObject = stream;
                this.video.style.display = 'block'; // Ensure video is visible
                this.video.style.transform = 'scaleX(-1)'; // Mirror the video
                this.video.style.width = '100%';
                this.video.style.height = '100%';
                this.video.style.objectFit = 'cover';
                this.video.style.position = 'absolute';
                this.video.style.top = '0';
                this.video.style.left = '0';
                
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

    lerp(start, end, factor) {
        return start + (end - start) * factor;
    }

    lerpVector3(current, target, factor) {
        current.x = this.lerp(current.x, target.x, factor);
        current.y = this.lerp(current.y, target.y, factor);
        current.z = this.lerp(current.z, target.z, factor);
    }

    lerpEuler(current, target, factor) {
        current.x = this.lerp(current.x, target.x, factor);
        current.y = this.lerp(current.y, target.y, factor);
        current.z = this.lerp(current.z, target.z, factor);
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
                const leftEye = face[133];
                const rightEye = face[362];
                const centerX = (leftEye.x + rightEye.x) / 2;
                const centerY = (leftEye.y + rightEye.y) / 2;
                const centerZ = (leftEye.z + rightEye.z) / 2;

                // Create target position with offset and increased scale
                const targetPosition = new THREE.Vector3(
                    -(centerX - 0.5) * 8 + this.offsetPosition.x,  // Increased scale
                    -(centerY - 0.5) * 8 + this.offsetPosition.y,  // Increased scale
                    -centerZ * 5 + this.offsetPosition.z           // Increased scale
                );

                const nose = face[6];
                const leftEar = face[234];
                const rightEar = face[454];

                const earDiff = {
                    x: rightEar.x - leftEar.x,
                    y: rightEar.y - leftEar.y,
                    z: rightEar.z - leftEar.z
                };

                const targetRotation = new THREE.Euler(
                    Math.atan2(nose.z, nose.y) * 0.5,
                    -Math.atan2(earDiff.z, earDiff.x) * 0.5,
                    Math.atan2(earDiff.y, earDiff.x) * 0.3
                );

                // Apply smoothing
                this.lerpVector3(this.model.position, targetPosition, this.smoothingFactor);
                this.lerpEuler(this.model.rotation, targetRotation, this.smoothingFactor);

                // Apply user scale
                const baseScale = 0.2; // Increased base scale
                this.model.scale.set(
                    baseScale * this.userScale,
                    baseScale * this.userScale,
                    baseScale * this.userScale
                );
            }
        }
    }

    async loadGlassesModel(modelPath) {
        try {
            const gltf = await this.loader.loadAsync(modelPath);
            this.model = gltf.scene;
            
            // Increased initial scale
            const baseScale = 0.2;
            this.model.scale.set(baseScale, baseScale, baseScale);
            
            this.model.position.set(0, 0, 0);
            
            this.scene.add(this.model);
            console.log('Glasses model loaded successfully');
        } catch (error) {
            console.error('Error loading glasses model:', error);
            throw error;
        }
    }
