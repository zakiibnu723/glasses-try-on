
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
        this.baseScale = 0.3; // Increased base scale
        this.userScaleFactor = 1.0;
        this.userOffset = new THREE.Vector3(0, 0, 0);
        this.lastTouchDistance = 0;
        this.isAdjusting = false;
        this.lastTouchX = 0;
        this.lastTouchY = 0;

        // Bind touch event handlers
        this.setupTouchControls();
    }

    setupTouchControls() {
        this.canvas.style.pointerEvents = 'auto'; // Enable touch events on canvas

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.isAdjusting = true;
            
            if (e.touches.length === 2) {
                // Pinch to scale
                this.lastTouchDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
            } else if (e.touches.length === 1) {
                // Single touch to move
                this.lastTouchX = e.touches[0].clientX;
                this.lastTouchY = e.touches[0].clientY;
            }
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!this.model || !this.isAdjusting) return;

            if (e.touches.length === 2) {
                // Pinch to scale
                const distance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                
                const scaleDelta = distance / this.lastTouchDistance;
                this.userScaleFactor *= scaleDelta;
                // Limit scale range
                this.userScaleFactor = Math.max(0.5, Math.min(2.0, this.userScaleFactor));
                
                this.lastTouchDistance = distance;
            } else if (e.touches.length === 1) {
                // Single touch to move
                const deltaX = (e.touches[0].clientX - this.lastTouchX) * 0.005;
                const deltaY = (e.touches[0].clientY - this.lastTouchY) * 0.005;
                
                this.userOffset.x += deltaX;
                this.userOffset.y -= deltaY;
                
                // Limit movement range
                this.userOffset.x = Math.max(-2, Math.min(2, this.userOffset.x));
                this.userOffset.y = Math.max(-1, Math.min(1, this.userOffset.y));
                
                this.lastTouchX = e.touches[0].clientX;
                this.lastTouchY = e.touches[0].clientY;
            }
        });

        this.canvas.addEventListener('touchend', () => {
            this.isAdjusting = false;
        });
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

    // Add improved lerp functions for smoother transitions
lerpVector3(current, target, factor) {
    current.x = this.smoothLerp(current.x, target.x, factor);
    current.y = this.smoothLerp(current.y, target.y, factor);
    current.z = this.smoothLerp(current.z, target.z, factor);
}

lerpEuler(current, target, factor) {
    current.x = this.smoothLerp(current.x, target.x, factor);
    current.y = this.smoothLerp(current.y, target.y, factor);
    current.z = this.smoothLerp(current.z, target.z, factor);
}

smoothLerp(start, end, factor) {
    // Cubic smoothing function for more natural movement
    const t = 1 - Math.pow(1 - factor, 3);
    return start + (end - start) * t;
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
            // Get key facial landmarks
            const leftEye = face[133];  // Left eye outer corner
            const rightEye = face[362]; // Right eye outer corner
            const nose = face[6];       // Nose tip
            const leftEar = face[234];  // Left ear
            const rightEar = face[454]; // Right ear
            const foreHead = face[10];  // Forehead point
            const chin = face[152];     // Chin point

            // Calculate face depth using eye distance
            const eyeDistance = Math.hypot(
                rightEye.x - leftEye.x,
                rightEye.y - leftEye.y,
                rightEye.z - leftEye.z
            );
            
            // Adjust depth based on eye distance (closer = larger distance)
            const depthScale = 1 / eyeDistance;
            
            // Calculate center point between eyes with depth compensation
            const targetPosition = new THREE.Vector3(
                -(((leftEye.x + rightEye.x) / 2) - 0.5) * 5 + this.userOffset.x,
                -(((leftEye.y + rightEye.y) / 2) - 0.5) * 5 + this.userOffset.y,
                -((leftEye.z + rightEye.z) / 2) * 5 * depthScale
            );

            // Calculate face normal vector for more accurate rotation
            const faceNormal = new THREE.Vector3(
                rightEye.x - leftEye.x,
                rightEye.y - leftEye.y,
                rightEye.z - leftEye.z
            ).normalize();

            // Calculate up vector using forehead and chin
            const upVector = new THREE.Vector3(
                foreHead.x - chin.x,
                foreHead.y - chin.y,
                foreHead.z - chin.z
            ).normalize();

            // Calculate forward vector (perpendicular to face plane)
            const forwardVector = new THREE.Vector3().crossVectors(faceNormal, upVector);

            // Create rotation matrix from these vectors
            const rotationMatrix = new THREE.Matrix4();
            rotationMatrix.makeBasis(faceNormal, upVector, forwardVector);

            // Convert to Euler angles
            const targetRotation = new THREE.Euler();
            targetRotation.setFromRotationMatrix(rotationMatrix);

            // Apply device orientation compensation
            if (window.DeviceOrientationEvent) {
                window.addEventListener('deviceorientation', (event) => {
                    if (event.beta && event.gamma) {
                        // Convert device orientation to radians
                        const betaRad = (event.beta * Math.PI) / 180;
                        const gammaRad = (event.gamma * Math.PI) / 180;

                        // Compensate for device orientation
                        targetRotation.x += betaRad;
                        targetRotation.y += gammaRad;
                    }
                });
            }

            // Implement variable smoothing based on movement speed
            const positionDelta = this.model.position.distanceTo(targetPosition);
            const rotationDelta = this.model.rotation.toVector3().distanceTo(targetRotation);
            
            // Adjust smoothing factor based on movement magnitude
            const positionSmoothingFactor = Math.min(1, Math.max(0.1, positionDelta * 0.8));
            const rotationSmoothingFactor = Math.min(1, Math.max(0.1, rotationDelta * 0.8));

            // Apply smoothed transformations only if not adjusting manually
            if (!this.isAdjusting) {
                // Position smoothing
                this.lerpVector3(
                    this.model.position,
                    targetPosition,
                    positionSmoothingFactor
                );

                // Rotation smoothing
                this.lerpEuler(
                    this.model.rotation,
                    targetRotation,
                    rotationSmoothingFactor
                );

                // Scale adjustment based on depth
                const finalScale = this.baseScale * this.userScaleFactor * depthScale;
                this.model.scale.set(finalScale, finalScale, finalScale);
            }
        }
    }
}



    async loadGlassesModel(modelPath) {
        try {
            const gltf = await this.loader.loadAsync(modelPath);
            this.model = gltf.scene;
            
            // Set larger initial scale
            const initialScale = this.baseScale * this.userScaleFactor;
            this.model.scale.set(initialScale, initialScale, initialScale);
            
            // Set initial position
            this.model.position.set(0, 0, 0);
            
            this.scene.add(this.model);
            console.log('Glasses model loaded successfully');

            // Add touch instructions
            this.showInstructions();
        } catch (error) {
            console.error('Error loading glasses model:', error);
            throw error;
        }
    }

    showInstructions() {
        const instructions = document.createElement('div');
        instructions.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px 20px;
            border-radius: 20px;
            font-family: Arial, sans-serif;
            text-align: center;
            z-index: 1000;
        `;
        instructions.innerHTML = 'Pinch to resize • Drag to adjust position';
        document.body.appendChild(instructions);

        // Hide instructions after 5 seconds
        setTimeout(() => {
            instructions.style.opacity = '0';
            instructions.style.transition = 'opacity 0.5s';
            setTimeout(() => instructions.remove(), 500);
        }, 5000);
    }
}
