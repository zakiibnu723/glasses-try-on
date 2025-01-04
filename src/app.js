// App.js or your main component
import { GlassesTryOn } from './GlassesTryOn.js';

// In your component:
const initGlassesTryOn = async () => {
  try {
      const video = document.getElementById('video');
      const canvas = document.getElementById('canvas3d');
      
      const glassesTryOn = new GlassesTryOn(video, canvas);
      await glassesTryOn.init();
      
      // Load your 3D glasses model
      await glassesTryOn.loadGlassesModel('/uploads_files_4881088_gltf.glb');
  } catch (error) {
      console.error('Failed to initialize:', error);
  }
}

initGlassesTryOn();
// Make sure you have these elements in your HTML/JSX:
// <video id="video" playsinline style="transform: scaleX(-1)"></video>
// <canvas id="canvas3d"></canvas>