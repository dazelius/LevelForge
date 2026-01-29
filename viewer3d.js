/**
 * LEVELFORGE - 3D Viewer
 * Three.js based 3D visualization of level design
 */

class Viewer3D {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.objects = [];
        this.gridHelper = null;
        this.wireframe = false;
        this.isOpen = false;
        
        // 3인칭 워크 모드
        this.walkMode = false;
        this.player = null;
        this.playerSpeed = 4.5;  // m/s
        this.playerRotation = 0;  // Y축 회전
        this.cameraDistance = 5;  // 카메라 거리
        this.cameraHeight = 2.5;  // 카메라 높이
        this.playerHeight = 1.8;  // 플레이어 키
        
        // 입력 상태
        this.keys = { w: false, a: false, s: false, d: false, shift: false };
        this.mouse = { x: 0, y: 0, locked: false };
        this.lastTime = performance.now();
        
        this.bindEvents();
    }
    
    bindEvents() {
        document.getElementById('view3dBtn').addEventListener('click', () => this.open());
        document.getElementById('close3dBtn').addEventListener('click', () => this.close());
        document.getElementById('resetCamera3d').addEventListener('click', () => this.resetCamera());
        document.getElementById('wireframeToggle').addEventListener('change', (e) => {
            this.wireframe = e.target.checked;
            this.rebuild();
        });
        document.getElementById('gridToggle3d').addEventListener('change', (e) => {
            if (this.gridHelper) this.gridHelper.visible = e.target.checked;
        });
        
        // 워크 모드 토글 버튼 이벤트
        const walkBtn = document.getElementById('walkModeBtn');
        if (walkBtn) {
            walkBtn.addEventListener('click', () => this.toggleWalkMode());
        }
        
        // 키보드 이벤트
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                if (this.walkMode) {
                    this.exitPointerLock();
                } else {
                    this.close();
                }
            }
            
            // 워크 모드 키 입력
            if (this.isOpen && this.walkMode) {
                const key = e.key.toLowerCase();
                if (key === 'w') this.keys.w = true;
                if (key === 'a') this.keys.a = true;
                if (key === 's') this.keys.s = true;
                if (key === 'd') this.keys.d = true;
                if (key === 'shift') this.keys.shift = true;
            }
        });
        
        document.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (key === 'w') this.keys.w = false;
            if (key === 'a') this.keys.a = false;
            if (key === 's') this.keys.s = false;
            if (key === 'd') this.keys.d = false;
            if (key === 'shift') this.keys.shift = false;
        });
        
        // 마우스 이벤트 (포인터 락)
        document.addEventListener('mousemove', (e) => {
            if (this.walkMode && this.mouse.locked) {
                this.playerRotation -= e.movementX * 0.003;
            }
        });
        
        document.addEventListener('pointerlockchange', () => {
            this.mouse.locked = document.pointerLockElement === this.renderer?.domElement;
            if (!this.mouse.locked && this.walkMode) {
                // 포인터 락 해제 시 안내 표시
            }
        });
        
        window.addEventListener('resize', () => {
            if (this.isOpen) this.resize();
        });
    }
    
    toggleWalkMode() {
        this.walkMode = !this.walkMode;
        const walkBtn = document.getElementById('walkModeBtn');
        const infoText = document.getElementById('viewerInfoText');
        
        if (this.walkMode) {
            // 워크 모드 활성화
            walkBtn.textContent = '🚶 워크 모드 ON';
            walkBtn.style.background = '#4ecdc4';
            walkBtn.style.color = '#000';
            if (infoText) infoText.textContent = 'WASD: 이동 (4.5m/s) | Shift: 달리기 | 마우스: 회전 | ESC: 해제';
            
            if (this.controls) this.controls.enabled = false;
            this.createPlayer();
            this.requestPointerLock();
        } else {
            // 오빗 모드로 복귀
            walkBtn.textContent = '🚶 워크 모드';
            walkBtn.style.background = '';
            walkBtn.style.color = '';
            if (infoText) infoText.textContent = '마우스 드래그: 회전 | 스크롤: 줌 | 우클릭 드래그: 이동';
            
            if (this.controls) this.controls.enabled = true;
            this.removePlayer();
            this.exitPointerLock();
        }
    }
    
    createPlayer() {
        if (this.player) this.removePlayer();
        
        // 플레이어 그룹
        this.player = new THREE.Group();
        
        // 몸체 (캡슐 형태)
        const bodyGeom = new THREE.CylinderGeometry(0.3, 0.3, 1.4, 16);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4ecdc4 });
        const body = new THREE.Mesh(bodyGeom, bodyMat);
        body.position.y = 0.9;
        body.castShadow = true;
        this.player.add(body);
        
        // 머리
        const headGeom = new THREE.SphereGeometry(0.25, 16, 16);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x4ecdc4 });
        const head = new THREE.Mesh(headGeom, headMat);
        head.position.y = 1.7;
        head.castShadow = true;
        this.player.add(head);
        
        // 방향 표시 (앞쪽)
        const dirGeom = new THREE.ConeGeometry(0.15, 0.3, 8);
        const dirMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const dir = new THREE.Mesh(dirGeom, dirMat);
        dir.position.set(0, 1.3, -0.4);
        dir.rotation.x = -Math.PI / 2;
        this.player.add(dir);
        
        // 초기 위치 설정 (Defence 스폰이 있으면 그 위치, 아니면 원점)
        let startPos = { x: 0, z: 0 };
        if (window.app && window.app.objects) {
            const defSpawn = window.app.objects.find(o => o.type === 'spawn-def');
            if (defSpawn) {
                const toWorld = (px) => px / window.app.pixelsPerMeter;
                if (defSpawn.width) {
                    startPos.x = toWorld(defSpawn.x + defSpawn.width / 2);
                    startPos.z = toWorld(defSpawn.y + defSpawn.height / 2);
                } else {
                    startPos.x = toWorld(defSpawn.x);
                    startPos.z = toWorld(defSpawn.y);
                }
            }
        }
        
        this.player.position.set(startPos.x, 0, startPos.z);
        this.scene.add(this.player);
    }
    
    removePlayer() {
        if (this.player) {
            this.scene.remove(this.player);
            this.player = null;
        }
    }
    
    requestPointerLock() {
        if (this.renderer?.domElement) {
            this.renderer.domElement.requestPointerLock();
        }
    }
    
    exitPointerLock() {
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }
    
    updatePlayer(deltaTime) {
        if (!this.player || !this.walkMode) return;
        
        // 이동 속도 (Shift로 달리기)
        const speed = this.keys.shift ? this.playerSpeed * 1.8 : this.playerSpeed;
        const moveSpeed = speed * deltaTime;
        
        // 이동 방향 계산
        let moveX = 0;
        let moveZ = 0;
        
        if (this.keys.w) moveZ -= 1;
        if (this.keys.s) moveZ += 1;
        if (this.keys.a) moveX -= 1;
        if (this.keys.d) moveX += 1;
        
        if (moveX !== 0 || moveZ !== 0) {
            // 방향 정규화
            const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
            moveX /= length;
            moveZ /= length;
            
            // 플레이어 회전 적용
            const sin = Math.sin(this.playerRotation);
            const cos = Math.cos(this.playerRotation);
            const dx = moveX * cos - moveZ * sin;
            const dz = moveX * sin + moveZ * cos;
            
            this.player.position.x += dx * moveSpeed;
            this.player.position.z += dz * moveSpeed;
        }
        
        // 플레이어 회전 적용
        this.player.rotation.y = this.playerRotation;
        
        // 3인칭 카메라 업데이트
        const cameraOffset = new THREE.Vector3(
            Math.sin(this.playerRotation) * this.cameraDistance,
            this.cameraHeight,
            Math.cos(this.playerRotation) * this.cameraDistance
        );
        
        this.camera.position.copy(this.player.position).add(cameraOffset);
        this.camera.lookAt(
            this.player.position.x,
            this.player.position.y + this.playerHeight * 0.7,
            this.player.position.z
        );
    }
    
    open() {
        document.getElementById('viewer3dModal').style.display = 'flex';
        this.isOpen = true;
        this.init();
        this.rebuild();
        this.animate();
    }
    
    close() {
        document.getElementById('viewer3dModal').style.display = 'none';
        this.isOpen = false;
        
        // 워크 모드 해제
        if (this.walkMode) {
            this.walkMode = false;
            const walkBtn = document.getElementById('walkModeBtn');
            if (walkBtn) {
                walkBtn.textContent = '🚶 워크 모드';
                walkBtn.style.background = '';
                walkBtn.style.color = '';
            }
            this.exitPointerLock();
        }
        
        if (this.renderer) {
            this.renderer.dispose();
            const container = document.getElementById('viewer3dContainer');
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
        }
    }
    
    init() {
        const container = document.getElementById('viewer3dContainer');
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a12);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
        this.camera.position.set(30, 25, 30);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);
        
        // Controls (Orbit)
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, 0, 0);
        
        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(50, 100, 50);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 500;
        dirLight.shadow.camera.left = -100;
        dirLight.shadow.camera.right = 100;
        dirLight.shadow.camera.top = 100;
        dirLight.shadow.camera.bottom = -100;
        this.scene.add(dirLight);
        
        // Grid
        this.gridHelper = new THREE.GridHelper(100, 100, 0x444466, 0x222233);
        this.scene.add(this.gridHelper);
        
        // Axes helper
        const axesHelper = new THREE.AxesHelper(5);
        this.scene.add(axesHelper);
        
        // 플레이어 초기화
        this.player = null;
        this.playerRotation = 0;
        this.keys = { w: false, a: false, s: false, d: false, shift: false };
    }
    
    rebuild() {
        if (!this.scene) return;
        
        // 기존 오브젝트 제거
        this.objects.forEach(obj => this.scene.remove(obj));
        this.objects = [];
        
        // app에서 오브젝트 가져오기
        const levelObjects = window.app.objects;
        const pixelsPerMeter = window.app.pixelsPerMeter || 32;
        
        levelObjects.forEach(obj => {
            this.addObject(obj, pixelsPerMeter);
        });
        
        // 카메라 위치 조정
        this.fitCameraToScene();
    }
    
    addObject(obj, scale) {
        const toWorld = (px) => px / scale;
        
        switch (obj.type) {
            case 'floor-area':
                this.addFloor(obj, toWorld);
                break;
            case 'polyfloor':
                this.addPolyFloor(obj, toWorld);
                break;
            case 'ramp':
                this.addRamp(obj, toWorld);
                break;
            case 'wall':
            case 'cover-full':
            case 'cover-half':
                this.addWall(obj, toWorld);
                break;
            case 'wall-diag':
                this.addDiagonalWall(obj, toWorld);
                break;
            case 'polywall':
                this.addPolyWall(obj, toWorld);
                break;
            case 'door':
                this.addDoor(obj, toWorld);
                break;
            case 'spawn-def':
            case 'spawn-off':
            case 'objective':
            case 'item':
                this.addMarker(obj, toWorld);
                break;
            case 'zone':
                this.addZone(obj, toWorld);
                break;
        }
    }
    
    addFloor(obj, toWorld) {
        const width = toWorld(obj.width) || 1;
        const depth = toWorld(obj.height) || 1;
        const height = parseFloat(obj.floorHeight) || 0;
        
        // NaN 체크
        if (isNaN(width) || isNaN(depth) || isNaN(height)) {
            console.warn('Floor has invalid dimensions:', obj);
            return;
        }
        
        // 높이에 따른 색상 계산
        const color = this.getFloorColorByHeight(height);
        
        const geometry = new THREE.BoxGeometry(width, 0.15, depth);
        const material = new THREE.MeshStandardMaterial({
            color: color,
            transparent: true,
            opacity: 0.85,
            wireframe: this.wireframe
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        const centerX = toWorld(obj.x) + width / 2;
        const centerZ = toWorld(obj.y) + depth / 2;
        mesh.position.set(centerX, height, centerZ);
        mesh.receiveShadow = true;
        
        this.scene.add(mesh);
        this.objects.push(mesh);
        
        // 레이블이 있으면 바닥에 텍스트 표시
        if (obj.label && obj.label.trim()) {
            this.addRectFloorLabel(obj.label, centerX, centerZ, width, depth, height);
        }
    }
    
    // 사각형 바닥 레이블
    addRectFloorLabel(label, centerX, centerZ, width, depth, height) {
        if (!label || !label.trim()) return;
        
        const labelSize = Math.min(width, depth) * 0.7;
        
        // 캔버스에 텍스트 그리기
        const canvas = document.createElement('canvas');
        const resolution = 512;
        canvas.width = resolution;
        canvas.height = resolution;
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, resolution, resolution);
        
        const fontSize = Math.floor(resolution * 0.35);
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = fontSize * 0.08;
        ctx.strokeText(label.trim(), resolution / 2, resolution / 2);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText(label.trim(), resolution / 2, resolution / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        const planeSize = Math.max(labelSize, 2);
        const geometry = new THREE.PlaneGeometry(planeSize, planeSize);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(centerX, height + 0.02, centerZ);
        
        this.scene.add(mesh);
        this.objects.push(mesh);
    }
    
    addPolyFloor(obj, toWorld) {
        if (!obj.points || obj.points.length < 3) return;
        
        const baseHeight = parseFloat(obj.floorHeight) || 0;
        const color = this.getFloorColorByHeight(baseHeight);
        
        // 개별 점에 z(높이)가 있는지 체크
        const hasIndividualZ = obj.points.some(p => p.z !== undefined && p.z !== 0);
        
        if (hasIndividualZ) {
            // 개별 점 높이가 있는 경우 - BufferGeometry로 직접 생성
            this.addPolyFloorWithSlope(obj, toWorld, color);
        } else {
            // 평면 바닥 - Shape + Extrude 사용
            // Shape의 Y좌표를 음수로 해서 rotateX(-90도) 후 올바른 Z좌표가 되도록
            const points2D = obj.points.map(p => ({
                x: toWorld(p.x),
                z: toWorld(p.y)
            }));
            
            const shape = new THREE.Shape();
            shape.moveTo(points2D[0].x, -points2D[0].z);  // 음수 Z
            for (let i = 1; i < points2D.length; i++) {
                shape.lineTo(points2D[i].x, -points2D[i].z);  // 음수 Z
            }
            shape.closePath();
            
            const extrudeSettings = {
                depth: 0.15,
                bevelEnabled: false
            };
            
            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            geometry.rotateX(-Math.PI / 2);
            
            const material = new THREE.MeshStandardMaterial({
                color: color,
                transparent: true,
                opacity: 0.85,
                wireframe: this.wireframe,
                side: THREE.DoubleSide
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.y = baseHeight;
            mesh.receiveShadow = true;
            
            this.scene.add(mesh);
            this.objects.push(mesh);
        }
        
        // 레이블이 있으면 바닥에 텍스트 표시
        if (obj.label && obj.label.trim()) {
            this.addFloorLabel(obj, toWorld, baseHeight);
        }
    }
    
    // 바닥에 레이블 텍스트 표시 (텍스처 방식)
    addFloorLabel(obj, toWorld, height) {
        const label = obj.label.trim();
        if (!label) return;
        
        // 폴리곤 중심 및 크기 계산
        const points = obj.points;
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let sumX = 0, sumY = 0;
        
        for (const p of points) {
            sumX += p.x;
            sumY += p.y;
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        }
        
        const centerX = toWorld(sumX / points.length);
        const centerZ = toWorld(sumY / points.length);
        const sizeX = toWorld(maxX - minX);
        const sizeZ = toWorld(maxY - minY);
        const labelSize = Math.min(sizeX, sizeZ) * 0.7;  // 영역의 70% 크기
        
        // 캔버스에 텍스트 그리기
        const canvas = document.createElement('canvas');
        const resolution = 512;
        canvas.width = resolution;
        canvas.height = resolution;
        const ctx = canvas.getContext('2d');
        
        // 배경 투명
        ctx.clearRect(0, 0, resolution, resolution);
        
        // 텍스트 설정
        const fontSize = Math.floor(resolution * 0.35);
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 텍스트 외곽선 (가독성)
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = fontSize * 0.08;
        ctx.strokeText(label, resolution / 2, resolution / 2);
        
        // 텍스트 채우기 (밝은 색)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText(label, resolution / 2, resolution / 2);
        
        // 텍스처 생성
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        // Plane 생성
        const planeSize = Math.max(labelSize, 2);  // 최소 2m
        const geometry = new THREE.PlaneGeometry(planeSize, planeSize);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;  // 바닥에 눕히기
        mesh.position.set(centerX, height + 0.02, centerZ);  // 바닥 위 살짝
        
        this.scene.add(mesh);
        this.objects.push(mesh);
    }
    
    // 경사면 바닥 (개별 점 높이)
    addPolyFloorWithSlope(obj, toWorld, color) {
        const baseHeight = parseFloat(obj.floorHeight) || 0;
        const points = obj.points;
        const n = points.length;
        
        // 정점 배열 생성 (상단면)
        const vertices = [];
        const indices = [];
        
        // 상단 정점
        for (let i = 0; i < n; i++) {
            const p = points[i];
            const y = (p.z !== undefined ? p.z : baseHeight);
            vertices.push(toWorld(p.x), y, toWorld(p.y));
        }
        
        // 삼각형 분할 (fan triangulation - 볼록 다각형에서만 완벽)
        for (let i = 1; i < n - 1; i++) {
            indices.push(0, i, i + 1);
        }
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        
        const material = new THREE.MeshStandardMaterial({
            color: color,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide,
            wireframe: this.wireframe
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.receiveShadow = true;
        
        this.scene.add(mesh);
        this.objects.push(mesh);
    }
    
    // 높이에 따른 바닥 색상 계산
    getFloorColorByHeight(height) {
        // 높이 범위: -5m ~ +10m
        const minH = -5;
        const maxH = 10;
        const normalized = Math.max(0, Math.min(1, (height - minH) / (maxH - minH)));
        
        // 낮은 곳: 짙은 파랑 (#1a3a5c) → 높은 곳: 밝은 청록 (#4ecdc4)
        const r1 = 0x1a, g1 = 0x3a, b1 = 0x5c;  // 낮은 곳
        const r2 = 0x4e, g2 = 0xcd, b2 = 0xc4;  // 높은 곳
        
        const r = Math.round(r1 + (r2 - r1) * normalized);
        const g = Math.round(g1 + (g2 - g1) * normalized);
        const b = Math.round(b1 + (b2 - b1) * normalized);
        
        return (r << 16) | (g << 8) | b;
    }
    
    addRamp(obj, toWorld) {
        const width = toWorld(obj.width) || 1;
        const depth = toWorld(obj.height) || 1;
        const heightStart = parseFloat(obj.heightStart) || 0;
        const heightEnd = parseFloat(obj.heightEnd) || 1;
        const dir = obj.direction || 'right';
        const thickness = 0.1;
        
        // NaN 체크
        if (isNaN(width) || isNaN(depth) || isNaN(heightStart) || isNaN(heightEnd)) {
            console.warn('Ramp has invalid dimensions:', obj);
            return;
        }
        
        // 방향에 따른 정점 계산
        // 좌표: (x, y, z) where y = height
        let vertices;
        
        if (dir === 'right') {
            // X 방향으로 올라감 (왼→우)
            vertices = new Float32Array([
                // 바닥면
                0, heightStart, 0,
                width, heightEnd, 0,
                width, heightEnd, depth,
                0, heightStart, depth,
                // 윗면
                0, heightStart + thickness, 0,
                width, heightEnd + thickness, 0,
                width, heightEnd + thickness, depth,
                0, heightStart + thickness, depth,
            ]);
        } else if (dir === 'left') {
            // X 방향 반대로 올라감 (우→좌)
            vertices = new Float32Array([
                0, heightEnd, 0,
                width, heightStart, 0,
                width, heightStart, depth,
                0, heightEnd, depth,
                0, heightEnd + thickness, 0,
                width, heightStart + thickness, 0,
                width, heightStart + thickness, depth,
                0, heightEnd + thickness, depth,
            ]);
        } else if (dir === 'down') {
            // Z 방향으로 올라감 (위→아래)
            vertices = new Float32Array([
                0, heightStart, 0,
                width, heightStart, 0,
                width, heightEnd, depth,
                0, heightEnd, depth,
                0, heightStart + thickness, 0,
                width, heightStart + thickness, 0,
                width, heightEnd + thickness, depth,
                0, heightEnd + thickness, depth,
            ]);
        } else { // up
            // Z 방향 반대로 올라감 (아래→위)
            vertices = new Float32Array([
                0, heightEnd, 0,
                width, heightEnd, 0,
                width, heightStart, depth,
                0, heightStart, depth,
                0, heightEnd + thickness, 0,
                width, heightEnd + thickness, 0,
                width, heightStart + thickness, depth,
                0, heightStart + thickness, depth,
            ]);
        }
        
        const indices = [
            0, 1, 2, 0, 2, 3,  // bottom
            4, 6, 5, 4, 7, 6,  // top
            0, 4, 5, 0, 5, 1,  // front
            2, 6, 7, 2, 7, 3,  // back
            0, 3, 7, 0, 7, 4,  // left
            1, 5, 6, 1, 6, 2,  // right
        ];
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        
        const material = new THREE.MeshStandardMaterial({
            color: 0x8b7355,
            wireframe: this.wireframe
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(toWorld(obj.x), 0, toWorld(obj.y));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        this.scene.add(mesh);
        this.objects.push(mesh);
    }
    
    addWall(obj, toWorld) {
        const width = toWorld(obj.width) || 0.1;
        const depth = toWorld(obj.height) || 0.1;
        const wallHeight = obj.type === 'cover-half' ? 1 : 2.5;
        
        // NaN 체크
        if (isNaN(width) || isNaN(depth)) {
            console.warn('Wall has invalid dimensions:', obj);
            return;
        }
        
        const geometry = new THREE.BoxGeometry(width, wallHeight, depth);
        
        let color = 0x2d3436;
        if (obj.type === 'cover-full') color = 0x636e72;
        if (obj.type === 'cover-half') color = 0x95a5a6;
        
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(obj.color || color),
            wireframe: this.wireframe
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
            toWorld(obj.x) + width / 2,
            wallHeight / 2,
            toWorld(obj.y) + depth / 2
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        this.scene.add(mesh);
        this.objects.push(mesh);
    }
    
    addDiagonalWall(obj, toWorld) {
        // wall-diag는 x1, y1, x2, y2를 사용
        const x1 = toWorld(obj.x1);
        const z1 = toWorld(obj.y1);
        const x2 = toWorld(obj.x2);
        const z2 = toWorld(obj.y2);
        
        // NaN 체크
        if (isNaN(x1) || isNaN(z1) || isNaN(x2) || isNaN(z2)) {
            console.warn('Diagonal wall has invalid coordinates:', obj);
            return;
        }
        
        const length = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
        if (length < 0.01) return;  // 너무 짧은 벽 무시
        
        const angle = Math.atan2(z2 - z1, x2 - x1);
        const thickness = toWorld(obj.thickness || 8) || 0.25;
        const wallHeight = 2.5;
        
        const geometry = new THREE.BoxGeometry(length, wallHeight, thickness);
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(obj.color || '#2d3436'),
            wireframe: this.wireframe
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
            (x1 + x2) / 2,
            wallHeight / 2,
            (z1 + z2) / 2
        );
        mesh.rotation.y = -angle;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        this.scene.add(mesh);
        this.objects.push(mesh);
    }
    
    addPolyWall(obj, toWorld) {
        if (!obj.points || obj.points.length < 2) return;
        
        const thickness = toWorld(obj.thickness || 8);
        const wallHeight = 2.5;
        
        for (let i = 0; i < obj.points.length - 1; i++) {
            const p1 = obj.points[i];
            const p2 = obj.points[i + 1];
            
            const x1 = toWorld(p1.x);
            const z1 = toWorld(p1.y);
            const x2 = toWorld(p2.x);
            const z2 = toWorld(p2.y);
            
            const length = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
            const angle = Math.atan2(z2 - z1, x2 - x1);
            
            const geometry = new THREE.BoxGeometry(length, wallHeight, thickness);
            const material = new THREE.MeshStandardMaterial({
                color: new THREE.Color(obj.color || '#2d3436'),
                wireframe: this.wireframe
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(
                (x1 + x2) / 2,
                wallHeight / 2,
                (z1 + z2) / 2
            );
            mesh.rotation.y = -angle;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            this.scene.add(mesh);
            this.objects.push(mesh);
        }
    }
    
    addDoor(obj, toWorld) {
        const width = toWorld(obj.width) || 0.5;
        const depth = toWorld(obj.height) || 0.1;
        const doorHeight = 2.2;
        
        // NaN 체크
        if (isNaN(width) || isNaN(depth)) {
            console.warn('Door has invalid dimensions:', obj);
            return;
        }
        
        const geometry = new THREE.BoxGeometry(width, doorHeight, depth);
        const material = new THREE.MeshStandardMaterial({
            color: 0x8b4513,
            wireframe: this.wireframe
        });
        
        const x = toWorld(obj.x) || 0;
        const z = toWorld(obj.y) || 0;
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
            x + width / 2,
            doorHeight / 2,
            z + depth / 2
        );
        mesh.castShadow = true;
        
        this.scene.add(mesh);
        this.objects.push(mesh);
    }
    
    addMarker(obj, toWorld) {
        let color;
        switch (obj.type) {
            case 'spawn-def': color = 0x00b894; break;
            case 'spawn-off': color = 0xd63031; break;
            case 'objective': color = 0xffe66d; break;
            case 'item': color = 0xa29bfe; break;
            default: color = 0xffffff;
        }
        
        // 스폰 영역 (사각형)
        if (obj.type.startsWith('spawn') && obj.width !== undefined) {
            const width = toWorld(obj.width) || 1;
            const depth = toWorld(obj.height) || 1;
            const x = toWorld(obj.x) || 0;
            const z = toWorld(obj.y) || 0;
            
            // NaN 체크
            if (isNaN(width) || isNaN(depth) || isNaN(x) || isNaN(z)) {
                console.warn('Spawn marker has invalid dimensions:', obj);
                return;
            }
            
            const cx = x + width / 2;
            const cz = z + depth / 2;
            
            // 바닥 영역 표시
            const floorGeometry = new THREE.PlaneGeometry(width, depth);
            const floorMaterial = new THREE.MeshStandardMaterial({
                color: color,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide,
                wireframe: this.wireframe
            });
            
            const floor = new THREE.Mesh(floorGeometry, floorMaterial);
            floor.rotation.x = -Math.PI / 2;
            floor.position.set(cx, 0.05, cz);
            
            this.scene.add(floor);
            this.objects.push(floor);
            
            // 테두리
            const edgeGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(width, 0.1, depth));
            const edgeMaterial = new THREE.LineBasicMaterial({ color: color });
            const edge = new THREE.LineSegments(edgeGeometry, edgeMaterial);
            edge.position.set(cx, 0.05, cz);
            
            this.scene.add(edge);
            this.objects.push(edge);
            
            // 중앙에 사람 모양 실린더
            const personRadius = 0.3;
            const personHeight = 1.8;
            const personGeometry = new THREE.CylinderGeometry(personRadius, personRadius, personHeight, 16);
            const personMaterial = new THREE.MeshStandardMaterial({
                color: color,
                wireframe: this.wireframe
            });
            
            const person = new THREE.Mesh(personGeometry, personMaterial);
            person.position.set(cx, personHeight / 2, cz);
            person.castShadow = true;
            
            this.scene.add(person);
            this.objects.push(person);
            
            // 방향 표시 (삼각형)
            const coneGeometry = new THREE.ConeGeometry(0.15, 0.3, 4);
            const coneMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
            const cone = new THREE.Mesh(coneGeometry, coneMaterial);
            cone.position.set(cx, personHeight + 0.25, cz);
            cone.rotation.x = Math.PI;
            
            this.scene.add(cone);
            this.objects.push(cone);
            
            // 레이블이 있으면 바닥에 표시
            if (obj.label && obj.label.trim()) {
                this.addRectFloorLabel(obj.label, cx, cz, width, depth, 0.06);
            }
        }
        // 거점 영역 (사각형)
        else if (obj.type === 'objective' && obj.width !== undefined) {
            const width = toWorld(obj.width) || 1;
            const depth = toWorld(obj.height) || 1;
            const x = toWorld(obj.x) || 0;
            const z = toWorld(obj.y) || 0;
            
            // NaN 체크
            if (isNaN(width) || isNaN(depth) || isNaN(x) || isNaN(z)) {
                console.warn('Objective marker has invalid dimensions:', obj);
                return;
            }
            
            const cx = x + width / 2;
            const cz = z + depth / 2;
            
            // 바닥 발광 영역
            const geometry = new THREE.PlaneGeometry(width, depth);
            const material = new THREE.MeshStandardMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 0.5,
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide,
                wireframe: this.wireframe
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(cx, 0.1, cz);
            
            this.scene.add(mesh);
            this.objects.push(mesh);
            
            // 수직 빔 (거점 표시)
            const beamGeometry = new THREE.CylinderGeometry(0.1, 0.3, 3, 8);
            const beamMaterial = new THREE.MeshStandardMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 0.8,
                transparent: true,
                opacity: 0.5
            });
            
            const beam = new THREE.Mesh(beamGeometry, beamMaterial);
            beam.position.set(cx, 1.5, cz);
            
            this.scene.add(beam);
            this.objects.push(beam);
            
            // 레이블이 있으면 바닥에 표시
            if (obj.label && obj.label.trim()) {
                this.addRectFloorLabel(obj.label, cx, cz, width, depth, 0.12);
            }
        } 
        // 아이템은 구체
        else if (obj.type === 'item') {
            const x = toWorld(obj.x) || 0;
            const z = toWorld(obj.y) || 0;
            
            // NaN 체크
            if (isNaN(x) || isNaN(z)) {
                console.warn('Item marker has invalid position:', obj);
                return;
            }
            
            const radius = 0.4;
            const geometry = new THREE.SphereGeometry(radius, 16, 16);
            const material = new THREE.MeshStandardMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 0.3,
                wireframe: this.wireframe
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(
                x,
                radius + 0.1,
                z
            );
            mesh.castShadow = true;
            
            this.scene.add(mesh);
            this.objects.push(mesh);
        }
    }
    
    addZone(obj, toWorld) {
        const width = toWorld(obj.width);
        const depth = toWorld(obj.height);
        
        let color;
        switch (obj.zoneType) {
            case 'combat': color = 0xd63031; break;
            case 'safe': color = 0x00b894; break;
            case 'flank': color = 0xe17055; break;
            case 'sniper': color = 0x6c5ce7; break;
            case 'choke': color = 0xfdcb6e; break;
            default: color = 0x3498db;
        }
        
        const geometry = new THREE.PlaneGeometry(width, depth);
        const material = new THREE.MeshStandardMaterial({
            color: color,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
            wireframe: this.wireframe
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(
            toWorld(obj.x) + width / 2,
            0.05,
            toWorld(obj.y) + depth / 2
        );
        
        this.scene.add(mesh);
        this.objects.push(mesh);
    }
    
    fitCameraToScene() {
        if (this.objects.length === 0) {
            this.camera.position.set(30, 25, 30);
            this.controls.target.set(0, 0, 0);
            return;
        }
        
        // 바운딩 박스 계산
        const box = new THREE.Box3();
        this.objects.forEach(obj => {
            box.expandByObject(obj);
        });
        
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 1.5;
        
        this.camera.position.set(
            center.x + distance,
            center.y + distance * 0.7,
            center.z + distance
        );
        this.controls.target.copy(center);
    }
    
    resetCamera() {
        this.fitCameraToScene();
    }
    
    resize() {
        const container = document.getElementById('viewer3dContainer');
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    
    animate() {
        if (!this.isOpen) return;
        
        requestAnimationFrame(() => this.animate());
        
        // 델타 타임 계산
        const now = performance.now();
        const deltaTime = (now - this.lastTime) / 1000;
        this.lastTime = now;
        
        // 워크 모드에서 플레이어 업데이트
        if (this.walkMode) {
            this.updatePlayer(deltaTime);
        } else {
            this.controls.update();
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.viewer3d = new Viewer3D();
});
