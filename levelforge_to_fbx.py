# LEVELFORGE → FBX Converter
# 사용법: blender --background --python levelforge_to_fbx.py -- input.json
# 또는 같은 폴더의 .json 파일 자동 감지

import bpy
import bmesh
import json
import os
import sys
import glob
import math

# ===== 설정 =====
WALL_HEIGHT = 3.0  # 벽 높이 (미터)
GRID_SIZE = 32     # 1미터 = 32픽셀
LABEL_HEIGHT = 0.02  # 레이블 높이 (바닥 위)
LABEL_DEPTH = 0.01   # 레이블 두께

def hex_to_rgba(hex_color, alpha=1.0):
    """HEX 색상을 RGBA로 변환"""
    if not hex_color:
        return (0.5, 0.5, 0.5, alpha)
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 6:
        r, g, b = tuple(int(hex_color[i:i+2], 16) / 255.0 for i in (0, 2, 4))
        return (r, g, b, alpha)
    return (0.5, 0.5, 0.5, alpha)

def clear_scene():
    """씬 초기화"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

def get_or_create_collection(name):
    """컬렉션 가져오기 또는 생성"""
    if name in bpy.data.collections:
        collection = bpy.data.collections[name]
        for obj in list(collection.objects):
            bpy.data.objects.remove(obj)
    else:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    return collection

def move_to_collection(obj, collection):
    """오브젝트를 지정된 컬렉션으로 이동 (Blender 4.x 호환)"""
    # 기존 컬렉션에서 제거
    for coll in obj.users_collection:
        coll.objects.unlink(obj)
    # 새 컬렉션에 추가
    collection.objects.link(obj)

def create_label_mesh(collection, label_text, center_x, center_y, size, height, color):
    """레이블을 3D 텍스트 메시로 생성"""
    if not label_text or not label_text.strip():
        return None
    
    label_text = label_text.strip()
    
    # 텍스트 커브 생성
    bpy.ops.object.text_add(location=(0, 0, 0))
    text_obj = bpy.context.active_object
    text_obj.data.body = label_text
    text_obj.data.align_x = 'CENTER'
    text_obj.data.align_y = 'CENTER'
    
    # 폰트 크기 조정 (영역 크기에 맞게)
    font_size = size * 0.4 / max(len(label_text), 1)
    font_size = max(0.5, min(font_size, size * 0.3))  # 최소 0.5m, 최대 영역의 30%
    text_obj.data.size = font_size
    text_obj.data.extrude = LABEL_DEPTH
    
    # 텍스트를 메시로 변환
    bpy.ops.object.convert(target='MESH')
    text_obj.name = f"Label_{label_text}"
    
    # 위치 설정 (Y축 뒤집기 + 바닥 위에 배치)
    text_obj.location = (center_x, -center_y, height + LABEL_HEIGHT)
    
    # 회전 없음 (바닥에 평행)
    text_obj.rotation_euler = (0, 0, 0)
    
    # 매터리얼 설정 (검은색) - Blender 4.x 호환
    mat = bpy.data.materials.new(name=f"Label_{label_text}_mat")
    mat.use_nodes = True
    # Principled BSDF 노드의 Base Color를 검은색으로 설정
    if mat.node_tree:
        principled = mat.node_tree.nodes.get('Principled BSDF')
        if principled:
            principled.inputs['Base Color'].default_value = (0.0, 0.0, 0.0, 1.0)
    mat.diffuse_color = (0.0, 0.0, 0.0, 1.0)  # viewport용
    text_obj.data.materials.append(mat)
    
    move_to_collection(text_obj, collection)
    return text_obj

def create_floor(collection, name, x, y, w, h, color, height=0):
    """바닥 평면 생성"""
    # Y축 뒤집기 (LevelForge Y↓ → Blender Y↑)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(x + w/2, -(y + h/2), height))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (w, h, 1)
    bpy.ops.object.transform_apply(scale=True)
    
    mat = bpy.data.materials.new(name=f"{name}_mat")
    mat.diffuse_color = color
    obj.data.materials.append(mat)
    
    move_to_collection(obj, collection)
    return obj

def create_wall(collection, name, x, y, w, d, h, color):
    """벽 박스 생성"""
    # Y축 뒤집기
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x + w/2, -(y + d/2), h/2))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (w, d, h)
    bpy.ops.object.transform_apply(scale=True)
    
    mat = bpy.data.materials.new(name=f"{name}_mat")
    mat.diffuse_color = color
    obj.data.materials.append(mat)
    
    move_to_collection(obj, collection)
    return obj

def create_polywall(collection, name, points, scale, thickness, height, color, from_height=0):
    """폴리라인 벽 생성 (두 점 사이의 두꺼운 박스 벽) - floor 높이에서 시작"""
    if len(points) < 2:
        return None
    
    import math
    
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    
    bm = bmesh.new()
    
    for i in range(len(points) - 1):
        p1 = points[i]
        p2 = points[i + 1]
        
        x1, y1 = p1['x'] * scale, p1['y'] * scale
        x2, y2 = p2['x'] * scale, p2['y'] * scale
        
        # 벽 방향 벡터
        dx = x2 - x1
        dy = y2 - y1
        length = math.sqrt(dx*dx + dy*dy)
        
        if length < 0.01:
            continue
        
        # 수직 벡터 (두께 방향)
        nx = -dy / length * (thickness / 2)
        ny = dx / length * (thickness / 2)
        
        # 벽 시작/끝 높이 (floor 높이에서 시작)
        z_bottom = from_height
        z_top = from_height + height
        
        # 8개의 꼭짓점 (바닥 4개 + 상단 4개)
        # Y축 뒤집기
        v1 = bm.verts.new((x1 - nx, -(y1 - ny), z_bottom))
        v2 = bm.verts.new((x1 + nx, -(y1 + ny), z_bottom))
        v3 = bm.verts.new((x2 + nx, -(y2 + ny), z_bottom))
        v4 = bm.verts.new((x2 - nx, -(y2 - ny), z_bottom))
        v5 = bm.verts.new((x1 - nx, -(y1 - ny), z_top))
        v6 = bm.verts.new((x1 + nx, -(y1 + ny), z_top))
        v7 = bm.verts.new((x2 + nx, -(y2 + ny), z_top))
        v8 = bm.verts.new((x2 - nx, -(y2 - ny), z_top))
        
        # 6개 면 생성 (노멀이 바깥쪽을 향하도록 정점 순서 조정)
        try:
            bm.faces.new([v4, v3, v2, v1])  # 바닥 (아래 방향)
            bm.faces.new([v5, v6, v7, v8])  # 상단 (위 방향)
            bm.faces.new([v1, v5, v8, v4])  # 앞면
            bm.faces.new([v3, v7, v6, v2])  # 뒷면
            bm.faces.new([v2, v6, v5, v1])  # 왼쪽
            bm.faces.new([v4, v8, v7, v3])  # 오른쪽
        except:
            pass
    
    bm.normal_update()
    
    # 노멀 방향 확인 및 재계산
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    
    # 매터리얼 (양면 렌더링 활성화)
    mat = bpy.data.materials.new(name=f"{name}_mat")
    mat.diffuse_color = color
    mat.use_backface_culling = False  # 양면 렌더링
    obj.data.materials.append(mat)
    
    collection.objects.link(obj)
    return obj


def create_polycliff(collection, name, points, scale, thickness, depth, color, from_height=0):
    """폴리라인 절벽 생성 (두 점 사이, 얇은 박스 형태)"""
    if len(points) < 2:
        return None
    
    import math
    
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    
    bm = bmesh.new()
    
    wall_thickness = 0.1  # 10cm 두께
    
    for i in range(len(points) - 1):
        p1 = points[i]
        p2 = points[i + 1]
        
        x1, y1 = p1['x'] * scale, p1['y'] * scale
        x2, y2 = p2['x'] * scale, p2['y'] * scale
        
        # 벽 방향 벡터
        dx = x2 - x1
        dy = y2 - y1
        length = math.sqrt(dx*dx + dy*dy)
        
        if length < 0.01:
            continue
        
        # 수직 벡터 (두께 방향)
        nx = -dy / length * (wall_thickness / 2)
        ny = dx / length * (wall_thickness / 2)
        
        # 벽과 겹치지 않게 시작점을 약간 아래로
        z_top = from_height - 0.02
        z_bottom = from_height - depth
        
        # Y축 뒤집기 - 8개 버텍스 (박스 형태)
        v1 = bm.verts.new((x1 - nx, -(y1 - ny), z_top))
        v2 = bm.verts.new((x1 + nx, -(y1 + ny), z_top))
        v3 = bm.verts.new((x2 + nx, -(y2 + ny), z_top))
        v4 = bm.verts.new((x2 - nx, -(y2 - ny), z_top))
        v5 = bm.verts.new((x1 - nx, -(y1 - ny), z_bottom))
        v6 = bm.verts.new((x1 + nx, -(y1 + ny), z_bottom))
        v7 = bm.verts.new((x2 + nx, -(y2 + ny), z_bottom))
        v8 = bm.verts.new((x2 - nx, -(y2 - ny), z_bottom))
        
        # 6개 면 생성 (닫힌 박스)
        try:
            bm.faces.new([v4, v3, v2, v1])  # 상단
            bm.faces.new([v5, v6, v7, v8])  # 하단
            bm.faces.new([v1, v5, v8, v4])  # 앞면
            bm.faces.new([v3, v7, v6, v2])  # 뒷면
            bm.faces.new([v2, v6, v5, v1])  # 왼쪽
            bm.faces.new([v4, v8, v7, v3])  # 오른쪽
        except:
            pass
    
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    
    # 매터리얼
    mat = bpy.data.materials.new(name=f"{name}_mat")
    mat.diffuse_color = color
    obj.data.materials.append(mat)
    
    collection.objects.link(obj)
    return obj


def create_polyfloor(collection, name, points, color, height=0):
    """다각형 바닥 생성 (오목 다각형 지원, 개별 vertex 높이 지원)"""
    if len(points) < 3:
        return None
    
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    
    bm = bmesh.new()
    
    # Y축 뒤집기, 개별 Z 좌표 지원
    verts = []
    for p in points:
        z = p.get('z', height) if isinstance(p, dict) else height
        verts.append(bm.verts.new((p['x'], -p['y'], z)))
    
    # 면 생성 시도
    try:
        face = bm.faces.new(verts)
        # 오목 다각형을 삼각형으로 분할
        bmesh.ops.triangulate(bm, faces=[face])
    except ValueError:
        # 면 생성 실패 시 역순으로 시도
        bm.clear()
        reversed_points = list(reversed(points))
        verts = []
        for p in reversed_points:
            z = p.get('z', height) if isinstance(p, dict) else height
            verts.append(bm.verts.new((p['x'], -p['y'], z)))
        try:
            face = bm.faces.new(verts)
            bmesh.ops.triangulate(bm, faces=[face])
        except:
            print(f"[WARN] 다각형 생성 실패: {name}")
            bm.free()
            return None
    
    # 노멀 방향 확인 및 수정 (Z+ 방향으로)
    bm.normal_update()
    faces_to_flip = [f for f in bm.faces if f.normal.z < 0]
    if faces_to_flip:
        bmesh.ops.reverse_faces(bm, faces=faces_to_flip)
    
    bm.to_mesh(mesh)
    bm.free()
    
    # 노멀 업데이트 (Blender 4.x 호환)
    mesh.update()
    
    mat = bpy.data.materials.new(name=f"{name}_mat")
    mat.diffuse_color = color
    obj.data.materials.append(mat)
    
    collection.objects.link(obj)
    return obj

def process_object(collection, obj, scale):
    """오브젝트 처리"""
    obj_type = obj.get('type', '')
    obj_id = obj.get('id', 0)
    label = obj.get('label', '')
    display_name = label if label else obj_type
    color = hex_to_rgba(obj.get('color', '#808080'))
    
    x = obj.get('x', 0) * scale
    y = obj.get('y', 0) * scale
    w = obj.get('width', 0) * scale
    h = obj.get('height', 0) * scale
    floor_height = obj.get('floorHeight', 0)
    
    name = f"{display_name}_{obj_id}"
    result = None
    label_created = False
    
    if obj_type == 'floor-area':
        result = create_floor(collection, name, x, y, w, h, color, floor_height)
        # 레이블이 있으면 텍스트 메시 생성
        if label and label.strip():
            center_x = x + w / 2
            center_y = y + h / 2
            size = min(w, h)
            create_label_mesh(collection, label, center_x, center_y, size, floor_height, color)
            label_created = True
    
    elif obj_type == 'wall':
        result = create_wall(collection, name, x, y, w, h, WALL_HEIGHT, color)
    
    elif obj_type == 'polywall':
        # 폴리라인 벽 (두 점 사이의 두꺼운 벽)
        points = obj.get('points', [])
        thickness = obj.get('thickness', 32) * scale  # 픽셀 -> 미터
        wall_height = obj.get('height', 128) * scale  # 픽셀 -> 미터 (기본 4m)
        from_height = obj.get('fromHeight', 0) * scale  # floor 높이에서 시작
        
        if len(points) >= 2:
            result = create_polywall(collection, name, points, scale, thickness, wall_height, color, from_height)
    
    elif obj_type == 'polycliff':
        # 폴리라인 절벽 (두 점 사이, 아래로 내려가는 벽)
        points = obj.get('points', [])
        thickness = obj.get('thickness', 32) * scale
        cliff_depth = obj.get('depth', 256) * scale  # 아래로 깊이 (기본 8m)
        from_height = obj.get('fromHeight', 0) * scale  # 시작 높이
        
        if len(points) >= 2:
            result = create_polycliff(collection, name, points, scale, thickness, cliff_depth, color, from_height)
    
    elif obj_type == 'polyfloor':
        points = obj.get('points', [])
        # 개별 z좌표 포함하여 스케일 적용
        scaled_points = []
        for p in points:
            sp = {'x': p['x'] * scale, 'y': p['y'] * scale}
            if 'z' in p:
                sp['z'] = p['z']  # z는 이미 미터 단위
            scaled_points.append(sp)
        result = create_polyfloor(collection, name, scaled_points, color, floor_height)
        
        # 레이블이 있으면 텍스트 메시 생성
        if label and label.strip() and points:
            # 폴리곤 중심 계산
            sum_x = sum(p['x'] * scale for p in points)
            sum_y = sum(p['y'] * scale for p in points)
            center_x = sum_x / len(points)
            center_y = sum_y / len(points)
            
            # 폴리곤 크기 계산
            min_x = min(p['x'] * scale for p in points)
            max_x = max(p['x'] * scale for p in points)
            min_y = min(p['y'] * scale for p in points)
            max_y = max(p['y'] * scale for p in points)
            size = min(max_x - min_x, max_y - min_y)
            
            create_label_mesh(collection, label, center_x, center_y, size, floor_height, color)
            label_created = True
    
    elif obj_type in ['spawn-off', 'spawn-def', 'objective']:
        colors = {
            'spawn-off': (0.9, 0.3, 0.2, 0.7),
            'spawn-def': (0.2, 0.7, 0.4, 0.7),
            'objective': (0.95, 0.6, 0.1, 0.7)
        }
        # floor_height 적용 (spawn도 floor처럼 높이 오프셋)
        spawn_height = floor_height + 0.01  # floor 위에 살짝 띄움
        result = create_floor(collection, name, x, y, w, h, colors.get(obj_type, color), spawn_height)
        
        # 레이블이 있으면 텍스트 메시 생성
        if label and label.strip():
            center_x = x + w / 2
            center_y = y + h / 2
            size = min(w, h)
            create_label_mesh(collection, label, center_x, center_y, size, spawn_height + 0.01, color)
            label_created = True
    
    if label_created:
        print(f"      + 레이블 생성: {label}")
    
    return result

def convert_json_to_fbx(json_path, fbx_path=None):
    """JSON을 FBX로 변환"""
    print("\n" + "="*50)
    print("LEVELFORGE → FBX Converter")
    print("="*50)
    
    # JSON 읽기
    print(f"\n[1/4] JSON 파일 읽는 중: {json_path}")
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    objects = data.get('objects', [])
    grid_size = data.get('gridSize', GRID_SIZE)
    scale = 1.0 / grid_size  # 픽셀 → 미터
    
    print(f"      오브젝트 수: {len(objects)}")
    print(f"      그리드 크기: {grid_size}px = 1m")
    
    # 씬 초기화
    print(f"\n[2/4] Blender 씬 초기화...")
    clear_scene()
    collection = get_or_create_collection("LevelForge")
    
    # 오브젝트 생성
    print(f"\n[3/4] 메시 생성 중...")
    created = 0
    for obj in objects:
        result = process_object(collection, obj, scale)
        if result:
            created += 1
    
    print(f"      생성된 오브젝트: {created}개")
    
    # polycliff 병합
    cliff_objs = [o for o in collection.objects if o.name.startswith('polycliff_')]
    if len(cliff_objs) > 1:
        print(f"      절벽 병합 중: {len(cliff_objs)}개 → 1개")
        bpy.ops.object.select_all(action='DESELECT')
        for o in cliff_objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = cliff_objs[0]
        bpy.ops.object.join()
        cliff_objs[0].name = "cliffs_merged"
        # 노멀 재계산
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode='OBJECT')
    
    # polywall 병합
    wall_objs = [o for o in collection.objects if o.name.startswith('polywall_')]
    if len(wall_objs) > 1:
        print(f"      벽 병합 중: {len(wall_objs)}개 → 1개")
        bpy.ops.object.select_all(action='DESELECT')
        for o in wall_objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = wall_objs[0]
        bpy.ops.object.join()
        wall_objs[0].name = "walls_merged"
        # 노멀 재계산
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode='OBJECT')
    
    # polyfloor 중 gap fill (어두운 색) 병합
    gap_objs = [o for o in collection.objects if o.name.startswith('gap_fill_')]
    if len(gap_objs) > 1:
        print(f"      갭 필 병합 중: {len(gap_objs)}개 → 1개")
        bpy.ops.object.select_all(action='DESELECT')
        for o in gap_objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = gap_objs[0]
        bpy.ops.object.join()
        gap_objs[0].name = "gap_fills_merged"
    
    final_count = len(collection.objects)
    print(f"      최종 오브젝트: {final_count}개")
    
    # FBX 내보내기
    if fbx_path is None:
        fbx_path = os.path.splitext(json_path)[0] + '.fbx'
    
    print(f"\n[4/4] FBX 내보내기: {fbx_path}")
    
    # 모든 오브젝트 선택
    bpy.ops.object.select_all(action='DESELECT')
    for obj in collection.objects:
        obj.select_set(True)
    
    # FBX 내보내기
    bpy.ops.export_scene.fbx(
        filepath=fbx_path,
        use_selection=True,
        apply_scale_options='FBX_SCALE_ALL',
        bake_space_transform=True,
        object_types={'MESH'},
        use_mesh_modifiers=True
    )
    
    print("\n" + "="*50)
    print("[SUCCESS] 변환 완료!")
    print(f"FBX 파일: {fbx_path}")
    print("="*50 + "\n")
    
    return fbx_path

def find_json_file():
    """같은 폴더에서 .json 파일 찾기"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_files = glob.glob(os.path.join(script_dir, '*.json'))
    
    # level_ 로 시작하는 파일 우선
    level_files = [f for f in json_files if os.path.basename(f).startswith('level_')]
    if level_files:
        # 가장 최근 파일
        return max(level_files, key=os.path.getmtime)
    
    if json_files:
        return max(json_files, key=os.path.getmtime)
    
    return None

def main():
    # 커맨드라인 인자 처리 (-- 이후의 인자)
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []
    
    # JSON 파일 경로 결정
    if argv:
        json_path = argv[0]
    else:
        json_path = find_json_file()
    
    if not json_path or not os.path.exists(json_path):
        print("\n[ERROR] JSON 파일을 찾을 수 없습니다!")
        print("사용법: blender --background --python levelforge_to_fbx.py -- your_level.json")
        print("또는 스크립트와 같은 폴더에 .json 파일을 놓으세요.")
        return
    
    # 변환 실행
    convert_json_to_fbx(json_path)

if __name__ == "__main__":
    main()
