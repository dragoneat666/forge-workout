import React, { useEffect, useRef, useState } from 'react';

export default function ModelViewer({ modelUrl, height = 400 }) {
  const mountRef   = useRef(null);
  const sceneRef   = useRef(null);
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!modelUrl || !mountRef.current) return;

    let renderer, animId, mixer;

    async function init() {
      try {
        // Dynamically import three.js pieces
        const THREE     = await import('three');
        const { GLTFLoader }    = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

        const container = mountRef.current;
        const w = container.clientWidth;
        const h = height;

        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a1a);
        scene.fog = new THREE.Fog(0x1a1a1a, 10, 50);
        sceneRef.current = scene;

        // Camera
        const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
        camera.position.set(0, 1.5, 3.5);

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);

        // Lights
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambient);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(5, 10, 5);
        dirLight.castShadow = true;
        scene.add(dirLight);

        const fillLight = new THREE.DirectionalLight(0xe8ff00, 0.3);
        fillLight.position.set(-5, 2, -5);
        scene.add(fillLight);

        // Floor grid
        const grid = new THREE.GridHelper(10, 20, 0x333333, 0x222222);
        scene.add(grid);

        // Orbit controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 1, 0);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance   = 1;
        controls.maxDistance   = 8;
        controls.maxPolarAngle = Math.PI * 0.85;
        controls.update();

        // Load GLB model
        const loader = new GLTFLoader();
        loader.load(
          modelUrl,
          (gltf) => {
            const model = gltf.scene;

            // Center and scale model
            const box    = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size   = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale  = 2.5 / maxDim;

            model.scale.setScalar(scale);
            model.position.sub(center.multiplyScalar(scale));
            model.position.y = 0;

            model.traverse(child => {
              if (child.isMesh) {
                child.castShadow    = true;
                child.receiveShadow = true;
              }
            });

            scene.add(model);

            // Play animation if present
            if (gltf.animations && gltf.animations.length > 0) {
              mixer = new THREE.AnimationMixer(model);
              const action = mixer.clipAction(gltf.animations[0]);
              action.play();
            }

            setLoading(false);
          },
          (progress) => {
            // loading progress
          },
          (err) => {
            console.error('Model load error:', err);
            setError('Could not load 3D model');
            setLoading(false);
          }
        );

        // Animation loop
        const clock = new THREE.Clock();
        function animate() {
          animId = requestAnimationFrame(animate);
          const delta = clock.getDelta();
          if (mixer) mixer.update(delta);
          controls.update();
          renderer.render(scene, camera);
        }
        animate();

        // Handle resize
        const onResize = () => {
          const w = container.clientWidth;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        };
        window.addEventListener('resize', onResize);

        return () => window.removeEventListener('resize', onResize);

      } catch (err) {
        console.error('3D viewer init error:', err);
        setError('3D viewer failed to load');
        setLoading(false);
      }
    }

    init();

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (renderer) {
        renderer.dispose();
        if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
          mountRef.current.removeChild(renderer.domElement);
        }
      }
    };
  }, [modelUrl, height]);

  return (
    <div style={{ position:'relative', borderRadius:10, overflow:'hidden',
      border:'1px solid var(--border)', background:'#1a1a1a' }}>
      <div ref={mountRef} style={{ width:'100%', height }} />
      {loading && !error && (
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center',
          justifyContent:'center', color:'var(--text3)', fontSize:13 }}>
          Loading 3D model...
        </div>
      )}
      {error && (
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center',
          justifyContent:'center', color:'#ff6b6b', fontSize:13 }}>
          {error}
        </div>
      )}
      {!loading && !error && (
        <div style={{ position:'absolute', bottom:8, right:10, fontSize:10,
          color:'rgba(255,255,255,0.3)' }}>
          Drag to rotate · Scroll to zoom
        </div>
      )}
    </div>
  );
}
