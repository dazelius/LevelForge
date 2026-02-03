"""
Map API Server - 방/통로 개별 폴리곤 (경계 접합)
- 각 방과 통로가 별도 폴리곤
- 하지만 경계는 정확히 접합
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import random
import sys
import os
from typing import List, Tuple, Set
from collections import deque

sys.path.insert(0, os.path.dirname(__file__))

from map_templates.procedural_v2 import ProceduralV2Template
from map_templates.procedural_v3 import ProceduralV3Template
from map_templates.procedural_vector import generate_vector_map
from map_templates.base import Tile

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*", "methods": ["GET", "POST", "OPTIONS"]}})


class TileMapConverter:
    """타일맵 → 개별 방/통로 폴리곤 (경계 접합)"""
    
    SCALE = 32
    WALKABLE = {Tile.FLOOR}
    
    for attr in ['COVER', 'COVER_HALF', 'COVER_FULL', 'BOX']:
        if hasattr(Tile, attr):
            WALKABLE.add(getattr(Tile, attr))
    
    def __init__(self, tile_map: np.ndarray, rooms: dict, scale_factor: float = 1.0):
        # 타일맵의 작은 구멍 채우기
        self.map = self._fill_small_holes(tile_map)
        self.rooms = rooms
        self.scale = self.SCALE * scale_factor
        self.size = tile_map.shape[0]
        self.objects = []
        self.next_id = 1
    
    def _fill_small_holes(self, tile_map: np.ndarray) -> np.ndarray:
        """타일맵 그대로 반환 (구멍 채우기 비활성화)"""
        return tile_map
    
    def convert(self) -> list:
        self.objects = []
        self.next_id = 1
        
        # 1. 마커
        self._add_markers()
        
        # 2. 각 방을 개별 폴리곤으로
        self._add_room_polygons()
        
        # 3. 통로 (방에 속하지 않는 영역)
        self._add_corridor_polygons()
        
        return self.objects
    
    def _add_markers(self):
        for name, room in self.rooms.items():
            rx = room.get('x', 0)
            ry = room.get('y', 0)
            rw = room.get('w', 10)
            rh = room.get('h', 10)
            
            wx = (rx - self.size/2) * self.scale
            wy = (ry - self.size/2) * self.scale
            w = rw * self.scale
            h = rh * self.scale
            
            if 'atk' in name.lower() or 'off' in name.lower():
                self.objects.append({
                    'id': self._get_id(),
                    'type': 'spawn-off',
                    'category': 'markers',
                    'floor': 0,
                    'color': '#d63031',
                    'x': wx, 'y': wy,
                    'width': w, 'height': h,
                    'fixedSize': True,
                    'label': 'OFFENCE'
                })
            elif 'def' in name.lower():
                self.objects.append({
                    'id': self._get_id(),
                    'type': 'spawn-def',
                    'category': 'markers',
                    'floor': 0,
                    'color': '#00b894',
                    'x': wx, 'y': wy,
                    'width': w, 'height': h,
                    'fixedSize': True,
                    'label': 'DEFENCE'
                })
            elif 'site' in name.lower():
                self.objects.append({
                    'id': self._get_id(),
                    'type': 'objective',
                    'category': 'markers',
                    'floor': 0,
                    'color': '#ffe66d',
                    'x': wx, 'y': wy,
                    'width': w, 'height': h,
                    'minSize': 64,
                    'label': name.upper().replace('_', ' ')
                })
    
    def _add_room_polygons(self):
        """각 방을 개별 폴리곤으로 (겹침 방지)"""
        # 방 우선순위: SITE > SPAWN > CHOKE > 나머지
        priority_order = []
        for name in self.rooms.keys():
            if 'SITE' in name.upper():
                priority_order.append((0, name))
            elif 'SPAWN' in name.upper() or 'ATK' in name.upper() or 'DEF' in name.upper():
                priority_order.append((1, name))
            elif 'CHOKE' in name.upper():
                priority_order.append((2, name))
            else:
                priority_order.append((3, name))
        
        priority_order.sort(key=lambda x: x[0])
        
        # 이미 할당된 타일 추적
        assigned_tiles = set()
        
        for _, name in priority_order:
            room = self.rooms[name]
            rx = room.get('x', 0)
            ry = room.get('y', 0)
            rw = room.get('w', 10)
            rh = room.get('h', 10)
            
            # 방 내의 walkable 타일 수집 (이미 할당된 타일 제외)
            tiles = set()
            for y in range(ry, min(ry + rh, self.size)):
                for x in range(rx, min(rx + rw, self.size)):
                    if 0 <= y < self.size and 0 <= x < self.size:
                        if self.map[y, x] in self.WALKABLE:
                            if (y, x) not in assigned_tiles:
                                tiles.add((y, x))
            
            if len(tiles) < 4:
                continue
            
            # 할당된 타일로 마킹
            assigned_tiles.update(tiles)
            
            # 외곽선 추출
            contour = self._extract_contour(tiles)
            if len(contour) < 3:
                continue
            
            simplified = self._simplify_contour(contour)
            if len(simplified) < 3:
                simplified = contour
            
            # 폴리곤 생성
            points = []
            for ty, tx in simplified:
                wx = (tx - self.size/2) * self.scale
                wy = (ty - self.size/2) * self.scale
                points.append({'x': wx, 'y': wy, 'z': 0})
            
            xs = [p['x'] for p in points]
            ys = [p['y'] for p in points]
            
            # 방 타입에 따른 색상
            if 'site' in name.lower():
                color = 'hsla(45, 50%, 40%, 0.7)'
            elif 'spawn' in name.lower() or 'atk' in name.lower() or 'def' in name.lower():
                color = 'hsla(0, 40%, 35%, 0.7)' if 'atk' in name.lower() else 'hsla(160, 40%, 35%, 0.7)'
            else:
                color = 'hsla(200, 50%, 35%, 0.7)'
            
            self.objects.append({
                'id': self._get_id(),
                'type': 'polyfloor',
                'category': 'floors',
                'floor': 0,
                'color': color,
                'points': points,
                'x': min(xs),
                'y': min(ys),
                'width': max(xs) - min(xs),
                'height': max(ys) - min(ys),
                'floorHeight': 0,
                'closed': True,
                'label': name.replace('_', ' ')
            })
    
    def _add_corridor_polygons(self):
        """방에 속하지 않는 영역 = 통로"""
        # 방에 속한 WALKABLE 타일만 마킹 (겹침 방지)
        room_tiles = set()
        for name, room in self.rooms.items():
            rx = room.get('x', 0)
            ry = room.get('y', 0)
            rw = room.get('w', 10)
            rh = room.get('h', 10)
            
            for y in range(ry, min(ry + rh, self.size)):
                for x in range(rx, min(rx + rw, self.size)):
                    if 0 <= y < self.size and 0 <= x < self.size:
                        if self.map[y, x] in self.WALKABLE:
                            room_tiles.add((y, x))
        
        # 방에 속하지 않은 walkable 타일
        corridor_tiles = set()
        for y in range(self.size):
            for x in range(self.size):
                if (y, x) not in room_tiles and self.map[y, x] in self.WALKABLE:
                    corridor_tiles.add((y, x))
        
        if not corridor_tiles:
            return
        
        # 연결된 통로 영역 분리
        visited = set()
        corridor_id = 1
        
        for start in corridor_tiles:
            if start in visited:
                continue
            
            # BFS로 연결된 영역 찾기
            region = set()
            queue = deque([start])
            
            while queue:
                y, x = queue.popleft()
                if (y, x) in visited:
                    continue
                if (y, x) not in corridor_tiles:
                    continue
                
                visited.add((y, x))
                region.add((y, x))
                
                for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    ny, nx = y + dy, x + dx
                    if (ny, nx) in corridor_tiles and (ny, nx) not in visited:
                        queue.append((ny, nx))
            
            if len(region) < 4:
                continue
            
            # 통로가 너무 길면 분할 (25타일 = 25m = 5초)
            if len(region) > 60:  # 대략 25m 이상
                sub_regions = self._split_long_corridor(region)
            else:
                sub_regions = [region]
            
            for sub_region in sub_regions:
                if len(sub_region) < 4:
                    continue
                
                # 외곽선 추출
                contour = self._extract_contour(sub_region)
                if len(contour) < 3:
                    continue
                
                simplified = self._simplify_contour(contour)
                if len(simplified) < 3:
                    simplified = contour
                
                points = []
                for ty, tx in simplified:
                    wx = (tx - self.size/2) * self.scale
                    wy = (ty - self.size/2) * self.scale
                    points.append({'x': wx, 'y': wy, 'z': 0})
                
                xs = [p['x'] for p in points]
                ys = [p['y'] for p in points]
                
                self.objects.append({
                    'id': self._get_id(),
                    'type': 'polyfloor',
                    'category': 'floors',
                    'floor': 0,
                    'color': 'hsla(200, 40%, 30%, 0.7)',
                    'points': points,
                    'x': min(xs),
                    'y': min(ys),
                    'width': max(xs) - min(xs),
                    'height': max(ys) - min(ys),
                    'floorHeight': 0,
                    'closed': True,
                    'label': ''
                })
                corridor_id += 1
    
    def _split_long_corridor(self, tiles: Set[Tuple[int, int]]) -> List[Set[Tuple[int, int]]]:
        """긴 통로를 여러 개로 분할"""
        if len(tiles) <= 60:
            return [tiles]
        
        # 타일들의 바운딩 박스
        ys = [t[0] for t in tiles]
        xs = [t[1] for t in tiles]
        min_y, max_y = min(ys), max(ys)
        min_x, max_x = min(xs), max(xs)
        
        height = max_y - min_y
        width = max_x - min_x
        
        # 더 긴 축으로 분할
        if height > width:
            # 수직 분할
            mid_y = (min_y + max_y) // 2
            region1 = {t for t in tiles if t[0] <= mid_y}
            region2 = {t for t in tiles if t[0] > mid_y}
        else:
            # 수평 분할
            mid_x = (min_x + max_x) // 2
            region1 = {t for t in tiles if t[1] <= mid_x}
            region2 = {t for t in tiles if t[1] > mid_x}
        
        # 재귀적으로 더 분할
        result = []
        for r in [region1, region2]:
            if len(r) > 60:
                result.extend(self._split_long_corridor(r))
            elif len(r) >= 4:
                result.append(r)
        
        return result if result else [tiles]
    
    def _extract_contour(self, tiles: Set[Tuple[int, int]]) -> List[Tuple[int, int]]:
        """타일 집합의 외곽선 추출"""
        if not tiles:
            return []
        
        edge_map = {}
        
        for ty, tx in tiles:
            if (ty - 1, tx) not in tiles:
                p1, p2 = (ty, tx), (ty, tx + 1)
                if p1 not in edge_map: edge_map[p1] = []
                edge_map[p1].append(p2)
            
            if (ty, tx + 1) not in tiles:
                p1, p2 = (ty, tx + 1), (ty + 1, tx + 1)
                if p1 not in edge_map: edge_map[p1] = []
                edge_map[p1].append(p2)
            
            if (ty + 1, tx) not in tiles:
                p1, p2 = (ty + 1, tx + 1), (ty + 1, tx)
                if p1 not in edge_map: edge_map[p1] = []
                edge_map[p1].append(p2)
            
            if (ty, tx - 1) not in tiles:
                p1, p2 = (ty + 1, tx), (ty, tx)
                if p1 not in edge_map: edge_map[p1] = []
                edge_map[p1].append(p2)
        
        if not edge_map:
            return []
        
        start = min(edge_map.keys(), key=lambda p: (p[1], p[0]))
        contour = [start]
        current = start
        used_edges = set()
        
        for _ in range(len(tiles) * 4 + 100):
            if current not in edge_map:
                break
            
            found = False
            for next_pt in edge_map[current]:
                edge = (current, next_pt)
                if edge not in used_edges:
                    used_edges.add(edge)
                    current = next_pt
                    if current == start:
                        return contour
                    contour.append(current)
                    found = True
                    break
            
            if not found:
                break
        
        return contour
    
    def _simplify_contour(self, contour):
        if len(contour) <= 3:
            return contour
        
        simplified = [contour[0]]
        for i in range(1, len(contour) - 1):
            prev = contour[i - 1]
            curr = contour[i]
            next_pt = contour[i + 1]
            
            dy1, dx1 = curr[0] - prev[0], curr[1] - prev[1]
            dy2, dx2 = next_pt[0] - curr[0], next_pt[1] - curr[1]
            
            if (dy1, dx1) != (dy2, dx2):
                simplified.append(curr)
        
        simplified.append(contour[-1])
        if len(simplified) > 1 and simplified[0] == simplified[-1]:
            simplified = simplified[:-1]
        
        return simplified
    
    def _get_id(self):
        id = self.next_id
        self.next_id += 1
        return id


def generate_perimeter_walls_from_tilemap(tile_map, scale_factor: float, offset_x: float, offset_y: float, 
                                          wall_thickness: float = 32, wall_height: float = 128,
                                          covered_mask=None) -> list:
    """
    타일맵 기반으로 외곽 벽을 생성합니다.
    covered_mask가 제공되면 polyfloor가 실제로 덮는 영역을 기준으로 합니다.
    """
    import numpy as np
    from scipy import ndimage
    
    walls = []
    wall_id = 90000
    
    h, w = tile_map.shape
    tile_size = 32 * scale_factor  # 타일 크기 (픽셀)
    
    # 맵 중심 오프셋 계산
    map_center_x = w * tile_size / 2
    map_center_y = h * tile_size / 2
    
    # polyfloor가 덮는 영역 마스크 사용 (제공된 경우)
    if covered_mask is not None:
        floor_mask = covered_mask
        print(f"[DEBUG] Using polyfloor coverage mask for wall detection", flush=True)
    else:
        # 바닥 타일 마스크 생성 (비VOID = True)
        floor_mask = tile_map > 0
        print(f"[DEBUG] Using original tilemap for wall detection", flush=True)
    
    # 벽 오프셋 (void 쪽으로 이동해서 floor 침범 방지)
    wall_offset = wall_thickness / 2
    
    # 수평 엣지 수집 (위아래 타일 비교)
    h_edges = []
    for y in range(h + 1):
        for x in range(w):
            above = floor_mask[y - 1, x] if y > 0 else False
            below = floor_mask[y, x] if y < h else False
            
            # 하나는 바닥, 하나는 VOID -> 경계
            if above != below:
                px1 = x * tile_size - map_center_x + offset_x
                py = y * tile_size - map_center_y + offset_y
                px2 = (x + 1) * tile_size - map_center_x + offset_x
                
                # void 쪽으로 오프셋
                if above and not below:  # 위가 floor, 아래가 void
                    py += wall_offset
                else:  # 위가 void, 아래가 floor
                    py -= wall_offset
                
                h_edges.append((px1, py, px2, py))
    
    # 수직 엣지 수집 (좌우 타일 비교)
    v_edges = []
    for y in range(h):
        for x in range(w + 1):
            left = floor_mask[y, x - 1] if x > 0 else False
            right = floor_mask[y, x] if x < w else False
            
            if left != right:
                px = x * tile_size - map_center_x + offset_x
                py1 = y * tile_size - map_center_y + offset_y
                py2 = (y + 1) * tile_size - map_center_y + offset_y
                
                # void 쪽으로 오프셋
                if left and not right:  # 왼쪽이 floor, 오른쪽이 void
                    px += wall_offset
                else:  # 왼쪽이 void, 오른쪽이 floor
                    px -= wall_offset
                
                v_edges.append((px, py1, px, py2))
    
    # 연속된 엣지 병합 (개선된 버전)
    def merge_horizontal_edges(edges):
        """수평 엣지 병합: 같은 y좌표에서 연속된 x를 합침"""
        if not edges:
            return []
        
        # y좌표 기준으로 그룹화
        from collections import defaultdict
        by_y = defaultdict(list)
        for x1, y, x2, _ in edges:
            by_y[y].append((x1, x2))
        
        merged = []
        for y, segments in by_y.items():
            # x1 기준 정렬
            segments.sort()
            
            current_x1, current_x2 = segments[0]
            for x1, x2 in segments[1:]:
                # 연속되거나 겹침
                if x1 <= current_x2 + 1:
                    current_x2 = max(current_x2, x2)
                else:
                    merged.append((current_x1, y, current_x2, y))
                    current_x1, current_x2 = x1, x2
            merged.append((current_x1, y, current_x2, y))
        
        return merged
    
    def merge_vertical_edges(edges):
        """수직 엣지 병합: 같은 x좌표에서 연속된 y를 합침"""
        if not edges:
            return []
        
        from collections import defaultdict
        by_x = defaultdict(list)
        for x, y1, _, y2 in edges:
            by_x[x].append((y1, y2))
        
        merged = []
        for x, segments in by_x.items():
            # y1 기준 정렬
            segments.sort()
            
            current_y1, current_y2 = segments[0]
            for y1, y2 in segments[1:]:
                # 연속되거나 겹침
                if y1 <= current_y2 + 1:
                    current_y2 = max(current_y2, y2)
                else:
                    merged.append((x, current_y1, x, current_y2))
                    current_y1, current_y2 = y1, y2
            merged.append((x, current_y1, x, current_y2))
        
        return merged
    
    h_merged = merge_horizontal_edges(h_edges)
    v_merged = merge_vertical_edges(v_edges)
    
    all_edges = h_merged + v_merged
    
    # 벽 오브젝트 생성
    for x1, y1, x2, y2 in all_edges:
        length = ((x2 - x1)**2 + (y2 - y1)**2) ** 0.5
        if length < 10:
            continue
        
        walls.append({
            'id': wall_id,
            'type': 'polywall',
            'category': 'walls',
            'floor': 0,
            'color': '#2a3540',  # 어두운 회색
            'points': [
                {'x': x1, 'y': y1},
                {'x': x2, 'y': y2}
            ],
            'x': x1,
            'y': y1,
            'thickness': wall_thickness,
            'height': wall_height,
            'closed': False,
            'label': ''
        })
        wall_id += 1
    
    print(f"[DEBUG] Generated {len(walls)} perimeter walls from tilemap", flush=True)
    return walls


def fill_polyfloor_gaps(objects: list, tile_map, scale_factor: float, 
                        offset_x: float, offset_y: float,
                        wall_thickness: float = 32, wall_height: float = 128) -> list:
    """
    polyfloor들 사이의 틈(타일맵에서 walkable인데 polyfloor로 덮이지 않은 영역)을 
    polywall로 채웁니다.
    """
    import numpy as np
    from scipy import ndimage
    
    walls = []
    wall_id = 95000
    
    h, w = tile_map.shape
    tile_size = 32 * scale_factor
    
    map_center_x = w * tile_size / 2
    map_center_y = h * tile_size / 2
    
    # 타일맵에서 walkable 영역
    walkable_mask = tile_map > 0
    
    # polyfloor들이 덮는 영역을 래스터화
    covered = np.zeros((h, w), dtype=bool)
    
    for obj in objects:
        if obj.get('type') != 'polyfloor':
            continue
        
        points = obj.get('points', [])
        if len(points) < 3:
            continue
        
        # 폴리곤의 점들을 타일 좌표로 변환
        tile_points = []
        for p in points:
            tx = (p['x'] - offset_x + map_center_x) / tile_size
            ty = (p['y'] - offset_y + map_center_y) / tile_size
            tile_points.append((tx, ty))
        
        # 바운딩 박스
        xs = [p[0] for p in tile_points]
        ys = [p[1] for p in tile_points]
        min_x = max(0, int(min(xs)))
        max_x = min(w, int(max(xs)) + 1)
        min_y = max(0, int(min(ys)))
        max_y = min(h, int(max(ys)) + 1)
        
        # 바운딩 박스 내 타일 체크 (점-다각형 테스트)
        for ty in range(min_y, max_y):
            for tx in range(min_x, max_x):
                # 타일 중심이 폴리곤 내부에 있는지 체크
                if point_in_polygon(tx + 0.5, ty + 0.5, tile_points):
                    covered[ty, tx] = True
    
    # 틈 = walkable인데 polyfloor로 덮이지 않은 영역
    gaps = walkable_mask & ~covered
    
    # 외곽과 연결된 영역은 제외 (내부 틈만)
    void_mask = ~walkable_mask
    padded = np.pad(void_mask | ~gaps, 1, mode='constant', constant_values=True)
    labeled, _ = ndimage.label(~padded)
    exterior_label = labeled[0, 0]
    labeled_core = labeled[1:-1, 1:-1]
    
    # 내부 틈만 선택
    internal_gaps = gaps & (labeled_core != exterior_label)
    
    # 외곽과 연결되어도 walkable 영역 내부에 있으면 포함
    # -> gaps 전체 사용 (단, 크기가 작은 것만)
    
    gap_count = np.sum(gaps)
    if gap_count == 0:
        print(f"[DEBUG] No gaps found between polyfloors", flush=True)
        return walls
    
    print(f"[DEBUG] Found {gap_count} gap tiles between polyfloors", flush=True)
    
    # 그리디 메싱: 행 단위로 연속된 타일 병합 후, 수직으로도 병합
    rectangles = []  # (x_min, y_min, x_max, y_max)
    processed = np.zeros_like(gaps, dtype=bool)
    
    for y in range(h):
        x = 0
        while x < w:
            if gaps[y, x] and not processed[y, x]:
                # 수평으로 연속된 타일 찾기
                x_start = x
                while x < w and gaps[y, x] and not processed[y, x]:
                    x += 1
                x_end = x
                
                # 수직으로 확장 가능한지 확인
                y_end = y + 1
                can_expand = True
                while can_expand and y_end < h:
                    # 같은 x 범위가 모두 gap이고 미처리인지 확인
                    for tx in range(x_start, x_end):
                        if not gaps[y_end, tx] or processed[y_end, tx]:
                            can_expand = False
                            break
                    if can_expand:
                        y_end += 1
                
                # 사각형 영역 처리 완료 표시
                for ty in range(y, y_end):
                    for tx in range(x_start, x_end):
                        processed[ty, tx] = True
                
                rectangles.append((x_start, y, x_end, y_end))
            else:
                x += 1
    
    # 병합된 사각형들로 벽 생성 (polyfloor 사용 - 정확한 사각형)
    for x_min, y_min, x_max, y_max in rectangles:
        px1 = x_min * tile_size - map_center_x + offset_x
        py1 = y_min * tile_size - map_center_y + offset_y
        px2 = x_max * tile_size - map_center_x + offset_x
        py2 = y_max * tile_size - map_center_y + offset_y
        
        walls.append({
            'id': wall_id,
            'type': 'polyfloor',
            'category': 'floors',
            'floor': 0,
            'color': '#2a3540',
            'points': [
                {'x': px1, 'y': py1},
                {'x': px2, 'y': py1},
                {'x': px2, 'y': py2},
                {'x': px1, 'y': py2}
            ],
            'x': px1,
            'y': py1,
            'floorHeight': wall_height / 32,  # 4m 높이
            'label': ''
        })
        wall_id += 1
    
    print(f"[DEBUG] Generated {len(walls)} gap-fill walls (merged from {gap_count} tiles)", flush=True)
    return walls


def point_in_polygon(x: float, y: float, polygon: list) -> bool:
    """점이 다각형 내부에 있는지 확인 (ray casting)"""
    n = len(polygon)
    inside = False
    
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    
    return inside


def compute_polyfloor_coverage(objects: list, tile_map, scale_factor: float, 
                                offset_x: float, offset_y: float):
    """
    polyfloor들이 덮는 영역을 계산합니다.
    Returns: covered 마스크 (numpy array)
    """
    import numpy as np
    
    h, w = tile_map.shape
    tile_size = 32 * scale_factor
    
    map_center_x = w * tile_size / 2
    map_center_y = h * tile_size / 2
    
    covered = np.zeros((h, w), dtype=bool)
    
    for obj in objects:
        if obj.get('type') != 'polyfloor':
            continue
        
        points = obj.get('points', [])
        if len(points) < 3:
            continue
        
        # 폴리곤의 점들을 타일 좌표로 변환
        tile_points = []
        for p in points:
            tx = (p['x'] - offset_x + map_center_x) / tile_size
            ty = (p['y'] - offset_y + map_center_y) / tile_size
            tile_points.append((tx, ty))
        
        # 바운딩 박스
        xs = [p[0] for p in tile_points]
        ys = [p[1] for p in tile_points]
        min_x = max(0, int(min(xs)))
        max_x = min(w, int(max(xs)) + 1)
        min_y = max(0, int(min(ys)))
        max_y = min(h, int(max(ys)) + 1)
        
        # 바운딩 박스 내 타일 체크 (점-다각형 테스트)
        for ty in range(min_y, max_y):
            for tx in range(min_x, max_x):
                if point_in_polygon(tx + 0.5, ty + 0.5, tile_points):
                    covered[ty, tx] = True
    
    return covered


def generate_map(bounds: dict, options: dict) -> dict:
    seed = options.get('seed', random.randint(0, 999999))
    rules = options.get('rules', None)
    algorithm = options.get('algorithm', 'v2')  # v2 (그리드), v3 (유기적 타일), v4 (벡터)
    site_count = options.get('site_count', 2)  # 사이트 개수 (1, 2, 3)
    layout = options.get('layout', None)  # 프리뷰에서 설정한 노드 위치
    
    # 벽 생성 옵션 (기본 비활성화 - UI에서 수동 생성)
    walls_options = options.get('walls', {})
    enable_perimeter_walls = walls_options.get('perimeter', False)
    enable_gap_walls = walls_options.get('gaps', False)
    
    print(f"[DEBUG] rules received: {rules}", flush=True)
    print(f"[DEBUG] algorithm: {algorithm}, site_count: {site_count}", flush=True)
    print(f"[DEBUG] walls: perimeter={enable_perimeter_walls}, gaps={enable_gap_walls}", flush=True)
    if layout:
        print(f"[DEBUG] layout keys: {list(layout.keys())}", flush=True)
        for k, v in layout.items():
            print(f"  - {k}: x={v.get('x', '?'):.3f}, y={v.get('y', '?'):.3f}", flush=True)
    
    target_size = min(bounds.get('width', 4800), bounds.get('height', 4800))
    scale_factor = target_size / (150 * 32)
    
    # v4 벡터 기반은 별도 처리
    if algorithm == 'v4':
        objects = generate_vector_map(seed=seed, rules=rules)
        
        # 스케일 및 오프셋 적용
        offset_x = bounds.get('x', 0) + bounds.get('width', 4800) / 2
        offset_y = bounds.get('y', 0) + bounds.get('height', 4800) / 2
        
        for obj in objects:
            obj['x'] = obj['x'] * scale_factor + offset_x - 2400 * scale_factor
            obj['y'] = obj['y'] * scale_factor + offset_y - 2400 * scale_factor
            if 'width' in obj:
                obj['width'] *= scale_factor
            if 'height' in obj:
                obj['height'] *= scale_factor
            if 'points' in obj:
                for pt in obj['points']:
                    pt['x'] = pt['x'] * scale_factor + offset_x - 2400 * scale_factor
                    pt['y'] = pt['y'] * scale_factor + offset_y - 2400 * scale_factor
        
        return {'objects': objects, 'bounds': bounds, 'seed': seed, 'algorithm': 'v4'}
    
    # 알고리즘 선택 (타일 기반)
    if algorithm == 'v3':
        tile_map, rooms = ProceduralV3Template.generate(seed=seed, rules=rules)
    else:
        tile_map, rooms = ProceduralV2Template.generate(seed=seed, rules=rules, site_count=site_count, layout=layout)
    
    converter = TileMapConverter(tile_map, rooms, scale_factor)
    objects = converter.convert()
    
    offset_x = bounds.get('x', 0) + bounds.get('width', 4800) / 2
    offset_y = bounds.get('y', 0) + bounds.get('height', 4800) / 2
    
    for obj in objects:
        obj['x'] += offset_x
        obj['y'] += offset_y
        if 'points' in obj:
            for pt in obj['points']:
                pt['x'] += offset_x
                pt['y'] += offset_y
    
    # polyfloor가 실제로 덮는 영역 계산
    covered_mask = compute_polyfloor_coverage(objects, tile_map, scale_factor, offset_x, offset_y)
    covered_count = np.sum(covered_mask)
    floor_count = np.sum(tile_map > 0)
    print(f"[DEBUG] Coverage: {covered_count}/{floor_count} tiles covered by polyfloors", flush=True)
    
    # 외곽 벽 생성 (covered 영역 기준)
    if enable_perimeter_walls:
        walls = generate_perimeter_walls_from_tilemap(
            tile_map, scale_factor, offset_x, offset_y,
            wall_thickness=32 * scale_factor, wall_height=128 * scale_factor,
            covered_mask=covered_mask
        )
        objects.extend(walls)
    
    # polyfloor 사이의 틈에 벽 채우기
    if enable_gap_walls:
        gap_walls = fill_polyfloor_gaps(
            objects, tile_map, scale_factor, offset_x, offset_y,
            wall_thickness=32 * scale_factor, wall_height=128 * scale_factor
        )
        objects.extend(gap_walls)
    
    # 절벽은 post-process로 수동 생성하도록 변경 (generate_cliff_edges 제거)
    
    return {'objects': objects, 'bounds': bounds, 'seed': seed}


def generate_cliff_edges(covered_mask, scale_factor: float, offset_x: float, offset_y: float,
                         cliff_depth: float = -8.0, cliff_width: int = 8) -> list:
    """
    맵 외곽에 절벽(아래로 떨어지는 영역)을 생성합니다.
    """
    import numpy as np
    from scipy import ndimage
    
    cliffs = []
    cliff_id = 98000
    
    h, w = covered_mask.shape
    tile_size = 32 * scale_factor
    
    map_center_x = w * tile_size / 2
    map_center_y = h * tile_size / 2
    
    # 바닥 영역 확장 (dilation)으로 외곽 영역 찾기
    structure = np.ones((cliff_width * 2 + 1, cliff_width * 2 + 1))
    expanded = ndimage.binary_dilation(covered_mask, structure=structure, iterations=1)
    
    # 외곽 영역 = 확장된 영역 - 원본 영역
    edge_mask = expanded & ~covered_mask
    
    # 외곽 영역을 연결된 컴포넌트로 분리하지 않고, 전체 바운딩 박스로 처리
    # 4방향 (상, 하, 좌, 우)으로 분리해서 생성
    
    # 바닥 영역의 바운딩 박스 찾기
    rows = np.any(covered_mask, axis=1)
    cols = np.any(covered_mask, axis=0)
    y_indices = np.where(rows)[0]
    x_indices = np.where(cols)[0]
    
    if len(y_indices) == 0 or len(x_indices) == 0:
        return cliffs
    
    y_min, y_max = y_indices[0], y_indices[-1]
    x_min, x_max = x_indices[0], x_indices[-1]
    
    # 상단 절벽
    top_y1 = max(0, y_min - cliff_width)
    top_y2 = y_min
    if top_y2 > top_y1:
        px1 = (x_min - cliff_width) * tile_size - map_center_x + offset_x
        py1 = top_y1 * tile_size - map_center_y + offset_y
        px2 = (x_max + cliff_width + 1) * tile_size - map_center_x + offset_x
        py2 = top_y2 * tile_size - map_center_y + offset_y
        
        cliffs.append({
            'id': cliff_id,
            'type': 'polyfloor',
            'category': 'floors',
            'floor': 0,
            'color': '#1a1a2e',
            'points': [
                {'x': px1, 'y': py1},
                {'x': px2, 'y': py1},
                {'x': px2, 'y': py2},
                {'x': px1, 'y': py2}
            ],
            'x': px1,
            'y': py1,
            'floorHeight': cliff_depth,
            'label': ''
        })
        cliff_id += 1
    
    # 하단 절벽
    bot_y1 = y_max + 1
    bot_y2 = min(h, y_max + cliff_width + 1)
    if bot_y2 > bot_y1:
        px1 = (x_min - cliff_width) * tile_size - map_center_x + offset_x
        py1 = bot_y1 * tile_size - map_center_y + offset_y
        px2 = (x_max + cliff_width + 1) * tile_size - map_center_x + offset_x
        py2 = bot_y2 * tile_size - map_center_y + offset_y
        
        cliffs.append({
            'id': cliff_id,
            'type': 'polyfloor',
            'category': 'floors',
            'floor': 0,
            'color': '#1a1a2e',
            'points': [
                {'x': px1, 'y': py1},
                {'x': px2, 'y': py1},
                {'x': px2, 'y': py2},
                {'x': px1, 'y': py2}
            ],
            'x': px1,
            'y': py1,
            'floorHeight': cliff_depth,
            'label': ''
        })
        cliff_id += 1
    
    # 좌측 절벽
    left_x1 = max(0, x_min - cliff_width)
    left_x2 = x_min
    if left_x2 > left_x1:
        px1 = left_x1 * tile_size - map_center_x + offset_x
        py1 = y_min * tile_size - map_center_y + offset_y
        px2 = left_x2 * tile_size - map_center_x + offset_x
        py2 = (y_max + 1) * tile_size - map_center_y + offset_y
        
        cliffs.append({
            'id': cliff_id,
            'type': 'polyfloor',
            'category': 'floors',
            'floor': 0,
            'color': '#1a1a2e',
            'points': [
                {'x': px1, 'y': py1},
                {'x': px2, 'y': py1},
                {'x': px2, 'y': py2},
                {'x': px1, 'y': py2}
            ],
            'x': px1,
            'y': py1,
            'floorHeight': cliff_depth,
            'label': ''
        })
        cliff_id += 1
    
    # 우측 절벽
    right_x1 = x_max + 1
    right_x2 = min(w, x_max + cliff_width + 1)
    if right_x2 > right_x1:
        px1 = right_x1 * tile_size - map_center_x + offset_x
        py1 = y_min * tile_size - map_center_y + offset_y
        px2 = right_x2 * tile_size - map_center_x + offset_x
        py2 = (y_max + 1) * tile_size - map_center_y + offset_y
        
        cliffs.append({
            'id': cliff_id,
            'type': 'polyfloor',
            'category': 'floors',
            'floor': 0,
            'color': '#1a1a2e',
            'points': [
                {'x': px1, 'y': py1},
                {'x': px2, 'y': py1},
                {'x': px2, 'y': py2},
                {'x': px1, 'y': py2}
            ],
            'x': px1,
            'y': py1,
            'floorHeight': cliff_depth,
            'label': ''
        })
        cliff_id += 1
    
    print(f"[DEBUG] Generated {len(cliffs)} cliff edges", flush=True)
    return cliffs


def generate_cliffs_from_polygon_edges(objects, options):
    """그리드 기반 절벽 생성 - 외곽 및 높이 차이 있는 내부 경계"""
    default_depth = options.get('default_depth', 8.0)
    min_height_diff = options.get('min_height_diff', 0.1)
    
    grid_size = 32  # 1m = 32px
    METER = 32
    
    # 1. 모든 floor 영역 수집 (polyfloor + spawn + objective)
    floor_types = ['polyfloor', 'spawn-off', 'spawn-def', 'objective']
    polyfloors = [obj for obj in objects if obj.get('type') in floor_types]
    if not polyfloors:
        return jsonify({'cliffs': []})
    
    # 2. 전체 bounds 계산
    all_x = []
    all_y = []
    for obj in polyfloors:
        if obj.get('points'):
            for p in obj.get('points', []):
                all_x.append(p['x'])
                all_y.append(p['y'])
        else:
            # spawn/objective - x,y가 좌측상단
            x = obj.get('x', 0)
            y = obj.get('y', 0)
            w = obj.get('width', 64)
            h = obj.get('height', 64)
            all_x.extend([x, x + w])
            all_y.extend([y, y + h])
    
    min_x, max_x = min(all_x), max(all_x)
    min_y, max_y = min(all_y), max(all_y)
    
    grid_w = int((max_x - min_x) / grid_size) + 2
    grid_h = int((max_y - min_y) / grid_size) + 2
    
    # 3. 그리드 생성 (floor 높이 저장)
    # None = void, 숫자 = floor height
    height_grid = [[None] * grid_w for _ in range(grid_h)]
    
    def point_in_polygon(px, py, points):
        n = len(points)
        inside = False
        j = n - 1
        for i in range(n):
            xi, yi = points[i]['x'], points[i]['y']
            xj, yj = points[j]['x'], points[j]['y']
            if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi) + xi):
                inside = not inside
            j = i
        return inside
    
    # 각 그리드 셀 래스터화 (5개 포인트 체크)
    for gy in range(grid_h):
        for gx in range(grid_w):
            check_points = [
                (min_x + (gx + 0.5) * grid_size, min_y + (gy + 0.5) * grid_size),
                (min_x + gx * grid_size + 1, min_y + gy * grid_size + 1),
                (min_x + (gx + 1) * grid_size - 1, min_y + gy * grid_size + 1),
                (min_x + gx * grid_size + 1, min_y + (gy + 1) * grid_size - 1),
                (min_x + (gx + 1) * grid_size - 1, min_y + (gy + 1) * grid_size - 1),
            ]
            
            for cx, cy in check_points:
                for obj in polyfloors:
                    points = obj.get('points', [])
                    hit = False
                    if len(points) >= 3:
                        hit = point_in_polygon(cx, cy, points)
                    else:
                        # spawn/objective - 사각형 체크 (x,y가 좌측상단)
                        ox = obj.get('x', 0)
                        oy = obj.get('y', 0)
                        ow = obj.get('width', 64)
                        oh = obj.get('height', 64)
                        hit = (ox <= cx <= ox + ow) and (oy <= cy <= oy + oh)
                    
                    if hit:
                        h = obj.get('floorHeight', 0) or 0
                        if height_grid[gy][gx] is None or h < height_grid[gy][gx]:
                            height_grid[gy][gx] = h
                        break
                if height_grid[gy][gx] is not None:
                    break
    
    # 4. 외곽 edge 찾기 (floor vs void, floor vs floor with different height)
    edges = []  # [(x1, y1, x2, y2, from_height, depth), ...]
    
    for gy in range(grid_h):
        for gx in range(grid_w):
            h = height_grid[gy][gx]
            if h is None:
                continue  # void 셀은 스킵
            
            cell_x = min_x + gx * grid_size
            cell_y = min_y + gy * grid_size
            
            # 4방향 체크
            neighbors = [
                (gy - 1, gx, cell_x, cell_y, cell_x + grid_size, cell_y),  # 상
                (gy + 1, gx, cell_x, cell_y + grid_size, cell_x + grid_size, cell_y + grid_size),  # 하
                (gy, gx - 1, cell_x, cell_y, cell_x, cell_y + grid_size),  # 좌
                (gy, gx + 1, cell_x + grid_size, cell_y, cell_x + grid_size, cell_y + grid_size),  # 우
            ]
            
            for ny, nx, x1, y1, x2, y2 in neighbors:
                if ny < 0 or ny >= grid_h or nx < 0 or nx >= grid_w:
                    # 그리드 외곽 = void
                    edges.append((x1, y1, x2, y2, h, default_depth))
                else:
                    nh = height_grid[ny][nx]
                    if nh is None:
                        # void와의 경계
                        edges.append((x1, y1, x2, y2, h, default_depth))
                    elif abs(h - nh) >= min_height_diff:
                        # 높이가 다른 floor와의 경계 (높은 쪽에서만 생성)
                        if h > nh:
                            edges.append((x1, y1, x2, y2, h, h - nh))
    
    # 5. Edge 병합
    def merge_cliff_edges(edges):
        if not edges:
            return []
        
        h_edges = {}  # y -> [(x1, x2, from_h, depth), ...]
        v_edges = {}  # x -> [(y1, y2, from_h, depth), ...]
        
        for x1, y1, x2, y2, from_h, depth in edges:
            if y1 == y2:  # 수평
                if y1 not in h_edges:
                    h_edges[y1] = []
                h_edges[y1].append((min(x1, x2), max(x1, x2), from_h, depth))
            elif x1 == x2:  # 수직
                if x1 not in v_edges:
                    v_edges[x1] = []
                v_edges[x1].append((min(y1, y2), max(y1, y2), from_h, depth))
        
        merged = []
        
        for y, segs in h_edges.items():
            segs.sort()
            i = 0
            while i < len(segs):
                x1, x2, from_h, depth = segs[i]
                while i + 1 < len(segs) and segs[i+1][0] <= x2 and segs[i+1][2] == from_h and segs[i+1][3] == depth:
                    x2 = max(x2, segs[i+1][1])
                    i += 1
                merged.append((x1, y, x2, y, from_h, depth))
                i += 1
        
        for x, segs in v_edges.items():
            segs.sort()
            i = 0
            while i < len(segs):
                y1, y2, from_h, depth = segs[i]
                while i + 1 < len(segs) and segs[i+1][0] <= y2 and segs[i+1][2] == from_h and segs[i+1][3] == depth:
                    y2 = max(y2, segs[i+1][1])
                    i += 1
                merged.append((x, y1, x, y2, from_h, depth))
                i += 1
        
        return merged
    
    merged_edges = merge_cliff_edges(edges)
    
    # 6. Cliff 생성
    cliffs = []
    cliff_id = 95000
    
    for x1, y1, x2, y2, from_height, depth in merged_edges:
        cliffs.append({
            'id': cliff_id,
            'type': 'polycliff',
            'category': 'cliffs',
            'floor': 0,
            'color': '#1a2530',
            'points': [{'x': x1, 'y': y1}, {'x': x2, 'y': y2}],
            'depth': depth * METER,
            'fromHeight': from_height * METER,
            'label': ''
        })
        cliff_id += 1
    
    print(f"[DEBUG] Grid-based cliffs: {len(cliffs)} cliffs (merged from {len(edges)} edges)", flush=True)
    return jsonify({'cliffs': cliffs})


def generate_walls_from_polygon_edges(objects, options):
    """그리드 기반 벽 생성 - 모든 floor를 래스터화하고 외곽에만 벽 생성"""
    wall_height = options.get('wall_height', 4.0)
    wall_thickness = options.get('wall_thickness', 1.0)
    
    grid_size = 32  # 1m = 32px
    
    # 1. 모든 floor 영역 수집 (polyfloor + spawn + objective)
    floor_types = ['polyfloor', 'spawn-off', 'spawn-def', 'objective']
    polyfloors = [obj for obj in objects if obj.get('type') in floor_types]
    if not polyfloors:
        return jsonify({'walls': []})
    
    # 2. 전체 bounds 계산
    all_x = []
    all_y = []
    for obj in polyfloors:
        if obj.get('points'):
            for p in obj.get('points', []):
                all_x.append(p['x'])
                all_y.append(p['y'])
        else:
            # spawn/objective는 x, y, width, height 형식 (x,y가 좌측상단)
            x = obj.get('x', 0)
            y = obj.get('y', 0)
            w = obj.get('width', 64)
            h = obj.get('height', 64)
            all_x.extend([x, x + w])
            all_y.extend([y, y + h])
    
    min_x, max_x = min(all_x), max(all_x)
    min_y, max_y = min(all_y), max(all_y)
    
    # 그리드 크기
    grid_w = int((max_x - min_x) / grid_size) + 2
    grid_h = int((max_y - min_y) / grid_size) + 2
    
    # 3. 그리드 생성 (floor가 있는 셀 마킹)
    floor_grid = [[False] * grid_w for _ in range(grid_h)]
    height_grid = [[0] * grid_w for _ in range(grid_h)]
    
    def point_in_polygon(px, py, points):
        n = len(points)
        inside = False
        j = n - 1
        for i in range(n):
            xi, yi = points[i]['x'], points[i]['y']
            xj, yj = points[j]['x'], points[j]['y']
            if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi) + xi):
                inside = not inside
            j = i
        return inside
    
    # 각 그리드 셀의 4 코너 + 중심 체크 (하나라도 floor면 True)
    for gy in range(grid_h):
        for gx in range(grid_w):
            if floor_grid[gy][gx]:
                continue
            
            # 셀의 5개 포인트 체크
            check_points = [
                (min_x + (gx + 0.5) * grid_size, min_y + (gy + 0.5) * grid_size),  # 중심
                (min_x + gx * grid_size + 1, min_y + gy * grid_size + 1),  # 좌상
                (min_x + (gx + 1) * grid_size - 1, min_y + gy * grid_size + 1),  # 우상
                (min_x + gx * grid_size + 1, min_y + (gy + 1) * grid_size - 1),  # 좌하
                (min_x + (gx + 1) * grid_size - 1, min_y + (gy + 1) * grid_size - 1),  # 우하
            ]
            
            for cx, cy in check_points:
                found = False
                for obj in polyfloors:
                    points = obj.get('points', [])
                    if len(points) >= 3:
                        # polyfloor - 폴리곤 체크
                        if point_in_polygon(cx, cy, points):
                            floor_grid[gy][gx] = True
                            found = True
                            break
                    else:
                        # spawn/objective - 사각형 체크 (x,y가 좌측상단)
                        ox = obj.get('x', 0)
                        oy = obj.get('y', 0)
                        ow = obj.get('width', 64)
                        oh = obj.get('height', 64)
                        if (ox <= cx <= ox + ow) and (oy <= cy <= oy + oh):
                            floor_grid[gy][gx] = True
                            found = True
                            break
                if found:
                    break
    
    # 4. 외곽 edge 찾기 (floor 셀과 void 셀 경계)
    edges = []  # [(x1, y1, x2, y2, from_height), ...]
    
    for gy in range(grid_h):
        for gx in range(grid_w):
            if not floor_grid[gy][gx]:
                continue
            
            from_height = height_grid[gy][gx]
            cell_x = min_x + gx * grid_size
            cell_y = min_y + gy * grid_size
            
            # 상 (y-)
            if gy == 0 or not floor_grid[gy-1][gx]:
                edges.append((cell_x, cell_y, cell_x + grid_size, cell_y, from_height))
            # 하 (y+)
            if gy == grid_h-1 or not floor_grid[gy+1][gx]:
                edges.append((cell_x, cell_y + grid_size, cell_x + grid_size, cell_y + grid_size, from_height))
            # 좌 (x-)
            if gx == 0 or not floor_grid[gy][gx-1]:
                edges.append((cell_x, cell_y, cell_x, cell_y + grid_size, from_height))
            # 우 (x+)
            if gx == grid_w-1 or not floor_grid[gy][gx+1]:
                edges.append((cell_x + grid_size, cell_y, cell_x + grid_size, cell_y + grid_size, from_height))
    
    # 5. Edge 병합 (같은 선 위에 있는 연속된 edge)
    def merge_edges(edges):
        if not edges:
            return []
        
        # 수평/수직 분리
        h_edges = {}  # y -> [(x1, x2, height), ...]
        v_edges = {}  # x -> [(y1, y2, height), ...]
        
        for x1, y1, x2, y2, h in edges:
            if y1 == y2:  # 수평
                if y1 not in h_edges:
                    h_edges[y1] = []
                h_edges[y1].append((min(x1, x2), max(x1, x2), h))
            elif x1 == x2:  # 수직
                if x1 not in v_edges:
                    v_edges[x1] = []
                v_edges[x1].append((min(y1, y2), max(y1, y2), h))
        
        merged = []
        
        # 수평 병합
        for y, segs in h_edges.items():
            segs.sort()
            i = 0
            while i < len(segs):
                x1, x2, h = segs[i]
                while i + 1 < len(segs) and segs[i+1][0] <= x2 and segs[i+1][2] == h:
                    x2 = max(x2, segs[i+1][1])
                    i += 1
                merged.append((x1, y, x2, y, h))
                i += 1
        
        # 수직 병합
        for x, segs in v_edges.items():
            segs.sort()
            i = 0
            while i < len(segs):
                y1, y2, h = segs[i]
                while i + 1 < len(segs) and segs[i+1][0] <= y2 and segs[i+1][2] == h:
                    y2 = max(y2, segs[i+1][1])
                    i += 1
                merged.append((x, y1, x, y2, h))
                i += 1
        
        return merged
    
    merged_edges = merge_edges(edges)
    
    # 6. 벽 생성
    walls = []
    wall_id = 90000
    
    METER = 32  # 1m = 32px (고정)
    for x1, y1, x2, y2, from_height in merged_edges:
        # 벽은 항상 바닥(0)에서 시작 - 공중 벽 방지
        walls.append({
            'id': wall_id,
            'type': 'polywall',
            'category': 'walls',
            'floor': 0,
            'color': '#2a3540',
            'points': [{'x': x1, 'y': y1}, {'x': x2, 'y': y2}],
            'thickness': wall_thickness * METER,  # 1m 기준
            'height': wall_height * METER,  # 1m 기준
            'fromHeight': 0,  # 항상 0에서 시작
            'label': ''
        })
        wall_id += 1
    
    print(f"[DEBUG] Grid-based walls: {len(walls)} walls (merged from {len(edges)} edges)", flush=True)
    return jsonify({'walls': walls})


@app.route('/post-process/walls', methods=['POST'])
def post_process_walls():
    """기존 레벨에 외곽 벽 생성 (floor 높이 고려, polygon edge 기반)"""
    data = request.json
    objects = data.get('objects', [])
    options = data.get('options', {})
    use_polygon_edges = options.get('use_polygon_edges', True)  # 기본: polygon edge 기반
    
    if use_polygon_edges:
        return generate_walls_from_polygon_edges(objects, options)
    
    # 기존 grid 기반 방식 (fallback)
    
    wall_height = options.get('wall_height', 4.0)
    wall_thickness = options.get('wall_thickness', 1.0)
    
    # polyfloor들의 바운딩 박스 계산
    all_points = []
    for obj in objects:
        if obj.get('type') == 'polyfloor':
            points = obj.get('points', [])
            for p in points:
                all_points.append((p['x'], p['y']))
    
    if not all_points:
        return jsonify({'walls': [], 'error': 'No polyfloors found'})
    
    xs = [p[0] for p in all_points]
    ys = [p[1] for p in all_points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    
    # polyfloor 래스터화를 위한 그리드 생성
    grid_size = 32  # 1m = 32 픽셀
    grid_w = int((max_x - min_x) / grid_size) + 2
    grid_h = int((max_y - min_y) / grid_size) + 2
    
    # 높이 맵 (nan = 비어있음)
    height_map = np.full((grid_h, grid_w), np.nan)
    
    for obj in objects:
        if obj.get('type') != 'polyfloor':
            continue
        points = obj.get('points', [])
        if len(points) < 3:
            continue
        
        floor_height = obj.get('floorHeight', 0) or 0
        
        # 타일 좌표로 변환
        tile_points = []
        for p in points:
            tx = (p['x'] - min_x) / grid_size
            ty = (p['y'] - min_y) / grid_size
            tile_points.append((tx, ty))
        
        # 바운딩 박스 내 체크
        pxs = [p[0] for p in tile_points]
        pys = [p[1] for p in tile_points]
        px_min = max(0, int(min(pxs)))
        px_max = min(grid_w, int(max(pxs)) + 1)
        py_min = max(0, int(min(pys)))
        py_max = min(grid_h, int(max(pys)) + 1)
        
        for ty in range(py_min, py_max):
            for tx in range(px_min, px_max):
                if point_in_polygon(tx + 0.5, ty + 0.5, tile_points):
                    # 더 높은 floor가 우선
                    if np.isnan(height_map[ty, tx]) or floor_height > height_map[ty, tx]:
                        height_map[ty, tx] = floor_height
    
    # 벽 생성
    walls = []
    wall_id = 90000
    
    half_t = wall_thickness * grid_size / 2
    
    # 수평 엣지
    for y in range(grid_h + 1):
        for x in range(grid_w):
            h_above = height_map[y - 1, x] if y > 0 else np.nan
            h_below = height_map[y, x] if y < grid_h else np.nan
            
            above_valid = not np.isnan(h_above)
            below_valid = not np.isnan(h_below)
            
            if above_valid != below_valid:
                px1 = x * grid_size + min_x
                py = y * grid_size + min_y
                px2 = (x + 1) * grid_size + min_x
                
                # floor 높이 결정
                from_height = h_above if above_valid else h_below
                
                # void 쪽으로 오프셋
                if above_valid and not below_valid:
                    py += half_t
                else:
                    py -= half_t
                
                walls.append({
                    'type': 'polywall',
                    'category': 'walls',
                    'floor': 0,
                    'color': '#2a3540',
                    'points': [{'x': px1, 'y': py}, {'x': px2, 'y': py}],
                    'thickness': wall_thickness * grid_size,
                    'height': wall_height * grid_size,
                    'fromHeight': from_height * grid_size,  # floor 높이에서 시작
                    'label': ''
                })
    
    # 수직 엣지
    for y in range(grid_h):
        for x in range(grid_w + 1):
            h_left = height_map[y, x - 1] if x > 0 else np.nan
            h_right = height_map[y, x] if x < grid_w else np.nan
            
            left_valid = not np.isnan(h_left)
            right_valid = not np.isnan(h_right)
            
            if left_valid != right_valid:
                px = x * grid_size + min_x
                py1 = y * grid_size + min_y
                py2 = (y + 1) * grid_size + min_y
                
                from_height = h_left if left_valid else h_right
                
                if left_valid and not right_valid:
                    px += half_t
                else:
                    px -= half_t
                
                walls.append({
                    'type': 'polywall',
                    'category': 'walls',
                    'floor': 0,
                    'color': '#2a3540',
                    'points': [{'x': px, 'y': py1}, {'x': px, 'y': py2}],
                    'thickness': wall_thickness * grid_size,
                    'height': wall_height * grid_size,
                    'fromHeight': from_height * grid_size,
                    'label': ''
                })
    
    print(f"[DEBUG] Post-process walls: generated {len(walls)} walls", flush=True)
    return jsonify({'walls': walls})


@app.route('/post-process/cliff', methods=['POST'])
def post_process_cliff():
    """기존 레벨에 절벽 생성 (polygon edge 기반)"""
    data = request.json
    objects = data.get('objects', [])
    options = data.get('options', {})
    use_polygon_edges = options.get('use_polygon_edges', True)
    
    if use_polygon_edges:
        return generate_cliffs_from_polygon_edges(objects, options)
    
    # 기존 grid 기반 방식 (fallback)
    min_height_diff = options.get('min_height_diff', 0.1)
    default_depth = options.get('default_depth', 8.0)
    
    # polyfloor들의 바운딩 박스 계산
    all_points = []
    for obj in objects:
        if obj.get('type') == 'polyfloor':
            points = obj.get('points', [])
            for p in points:
                all_points.append((p['x'], p['y']))
    
    if not all_points:
        return jsonify({'cliffs': [], 'error': 'No polyfloors found'})
    
    xs = [p[0] for p in all_points]
    ys = [p[1] for p in all_points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    
    # polyfloor 래스터화 (높이 정보 포함)
    grid_size = 32
    grid_w = int((max_x - min_x) / grid_size) + 2
    grid_h = int((max_y - min_y) / grid_size) + 2
    
    # 각 타일의 높이 저장 (nan = 비어있음)
    height_map = np.full((grid_h, grid_w), np.nan)
    
    for obj in objects:
        if obj.get('type') != 'polyfloor':
            continue
        points = obj.get('points', [])
        if len(points) < 3:
            continue
        
        floor_height = obj.get('floorHeight', 0)
        if floor_height is None:
            floor_height = 0
        print(f"[DEBUG] polyfloor id={obj.get('id')}, floorHeight={floor_height}", flush=True)
        
        tile_points = []
        for p in points:
            tx = (p['x'] - min_x) / grid_size
            ty = (p['y'] - min_y) / grid_size
            tile_points.append((tx, ty))
        
        pxs = [p[0] for p in tile_points]
        pys = [p[1] for p in tile_points]
        px_min = max(0, int(min(pxs)))
        px_max = min(grid_w, int(max(pxs)) + 1)
        py_min = max(0, int(min(pys)))
        py_max = min(grid_h, int(max(pys)) + 1)
        
        for ty in range(py_min, py_max):
            for tx in range(px_min, px_max):
                if point_in_polygon(tx + 0.5, ty + 0.5, tile_points):
                    # 더 높은 floor가 우선
                    if np.isnan(height_map[ty, tx]) or floor_height > height_map[ty, tx]:
                        height_map[ty, tx] = floor_height
    
    # 절벽 엣지 수집 (병합을 위해)
    h_edges = {}  # key: (y, from_height, depth), value: list of (x_start, x_end)
    v_edges = {}  # key: (x, from_height, depth), value: list of (y_start, y_end)
    
    # 수평 엣지 수집
    for y in range(grid_h + 1):
        for x in range(grid_w):
            h_above = height_map[y - 1, x] if y > 0 else np.nan
            h_below = height_map[y, x] if y < grid_h else np.nan
            
            above_valid = not np.isnan(h_above)
            below_valid = not np.isnan(h_below)
            
            if above_valid and below_valid:
                height_diff = h_above - h_below
                if abs(height_diff) < min_height_diff:
                    continue
                from_height = max(h_above, h_below)
                cliff_depth = abs(height_diff)
            elif above_valid != below_valid:
                from_height = h_above if above_valid else h_below
                cliff_depth = default_depth
            else:
                continue
            
            key = (y, round(from_height, 2), round(cliff_depth, 2))
            if key not in h_edges:
                h_edges[key] = []
            h_edges[key].append(x)
    
    # 수직 엣지 수집
    for y in range(grid_h):
        for x in range(grid_w + 1):
            h_left = height_map[y, x - 1] if x > 0 else np.nan
            h_right = height_map[y, x] if x < grid_w else np.nan
            
            left_valid = not np.isnan(h_left)
            right_valid = not np.isnan(h_right)
            
            if left_valid and right_valid:
                height_diff = h_left - h_right
                if abs(height_diff) < min_height_diff:
                    continue
                from_height = max(h_left, h_right)
                cliff_depth = abs(height_diff)
            elif left_valid != right_valid:
                from_height = h_left if left_valid else h_right
                cliff_depth = default_depth
            else:
                continue
            
            key = (x, round(from_height, 2), round(cliff_depth, 2))
            if key not in v_edges:
                v_edges[key] = []
            v_edges[key].append(y)
    
    # 연속된 엣지 병합
    def merge_segments(indices):
        """연속된 인덱스들을 병합하여 (start, end) 리스트 반환"""
        if not indices:
            return []
        indices = sorted(set(indices))
        segments = []
        start = indices[0]
        end = indices[0]
        for i in indices[1:]:
            if i == end + 1:
                end = i
            else:
                segments.append((start, end + 1))
                start = i
                end = i
        segments.append((start, end + 1))
        return segments
    
    cliffs = []
    
    # 수평 엣지 병합 및 생성
    for (y, from_height, cliff_depth), x_list in h_edges.items():
        for x_start, x_end in merge_segments(x_list):
            px1 = x_start * grid_size + min_x
            px2 = x_end * grid_size + min_x
            py = y * grid_size + min_y
            
            cliffs.append({
                'type': 'polycliff',
                'category': 'cliffs',
                'floor': 0,
                'color': '#1a2530',
                'points': [{'x': px1, 'y': py}, {'x': px2, 'y': py}],
                'depth': cliff_depth * grid_size,
                'fromHeight': from_height * grid_size,
                'label': ''
            })
    
    # 수직 엣지 병합 및 생성
    for (x, from_height, cliff_depth), y_list in v_edges.items():
        for y_start, y_end in merge_segments(y_list):
            px = x * grid_size + min_x
            py1 = y_start * grid_size + min_y
            py2 = y_end * grid_size + min_y
            
            cliffs.append({
                'type': 'polycliff',
                'category': 'cliffs',
                'floor': 0,
                'color': '#1a2530',
                'points': [{'x': px, 'y': py1}, {'x': px, 'y': py2}],
                'depth': cliff_depth * grid_size,
                'fromHeight': from_height * grid_size,
                'label': ''
            })
    
    print(f"[DEBUG] Post-process cliff: generated {len(cliffs)} cliff segments", flush=True)
    return jsonify({'cliffs': cliffs})


@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'version': 'rooms_and_corridors'})


@app.route('/rules')
def get_rules():
    """사용 가능한 규칙 스키마 반환"""
    return jsonify({
        'schema': ProceduralV2Template.get_rules_schema(),
        'example': {
            'timing': {
                'atk_to_site': [50, 80],
                'def_to_site': [30, 60],
                'rotation': [40, 70]
            },
            'entries': {
                'per_site': [2, 3],
                'chokes_per_site': [1, 2]
            },
            'sightlines': {
                'max_length': 40,
                'to_site': [15, 30]
            },
            'cover': {
                'spacing': [6, 12],
                'exposed_max': 10
            },
            'corridors': {
                'max_straight': 20,
                'width': [4, 6]
            },
            'angles': {
                'per_site': [2, 4]
            }
        }
    })


@app.route('/generate', methods=['GET', 'POST'])
def generate():
    if request.method == 'POST':
        data = request.get_json() or {}
        bounds = data.get('bounds', {'x': 0, 'y': 0, 'width': 4800, 'height': 4800})
        options = data.get('options', {})
    else:
        bounds = {
            'x': int(request.args.get('x', 0)),
            'y': int(request.args.get('y', 0)),
            'width': int(request.args.get('width', 4800)),
            'height': int(request.args.get('height', 4800))
        }
        options = {'seed': int(request.args.get('seed', random.randint(0, 999999)))}
    
    try:
        result = generate_map(bounds, options)
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/connect', methods=['POST', 'OPTIONS'])
def connect_points():
    """두 점 사이에 프로시저럴 경로 생성"""
    if request.method == 'OPTIONS':
        return '', 200
    data = request.get_json() or {}
    
    start = data.get('start', {'x': 0, 'y': 0})
    end = data.get('end', {'x': 100, 'y': 100})
    options = data.get('options', {})
    
    corridor_width = options.get('width', 5)
    procedural = options.get('procedural', True)
    existing_objects = options.get('existing_objects', [])
    
    try:
        objects = generate_procedural_path(start, end, corridor_width, existing_objects)
        return jsonify({'objects': objects, 'start': start, 'end': end})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


def generate_procedural_path(start: dict, end: dict, width: float = 5, 
                             existing_objects: list = None) -> list:
    """두 점 사이에 프로시저럴 경로 생성 (직교 + 중간 방)"""
    import math
    
    x1, y1 = start['x'], start['y']
    x2, y2 = end['x'], end['y']
    
    objects = []
    scale = 32  # 1m = 32px
    width_px = width * scale
    
    dx = x2 - x1
    dy = y2 - y1
    dist = math.sqrt(dx**2 + dy**2)
    
    if dist < 50:
        return objects
    
    # 직교 경로 생성 (L자 또는 ㄱ자)
    # 긴 축 먼저 이동
    if abs(dx) > abs(dy):
        # 가로 → 세로
        mid = (x2, y1)
    else:
        # 세로 → 가로
        mid = (x1, y2)
    
    # 첫 번째 구간 통로
    corridor1 = create_rect_corridor(x1, y1, mid[0], mid[1], width_px)
    if corridor1:
        objects.append(corridor1)
    
    # 중간 연결 방 (junction)
    junction = create_junction_room(mid[0], mid[1], width_px * 1.5)
    if junction:
        objects.append(junction)
    
    # 두 번째 구간 통로
    corridor2 = create_rect_corridor(mid[0], mid[1], x2, y2, width_px)
    if corridor2:
        objects.append(corridor2)
    
    return objects


def create_rect_corridor(x1: float, y1: float, x2: float, y2: float, width: float) -> dict:
    """직교 통로 (가로 또는 세로)"""
    half_w = width / 2
    
    # 가로 또는 세로 판단
    if abs(x2 - x1) > abs(y2 - y1):
        # 가로 통로
        min_x = min(x1, x2) - half_w
        max_x = max(x1, x2) + half_w
        min_y = y1 - half_w
        max_y = y1 + half_w
    else:
        # 세로 통로
        min_x = x1 - half_w
        max_x = x1 + half_w
        min_y = min(y1, y2) - half_w
        max_y = max(y1, y2) + half_w
    
    w = max_x - min_x
    h = max_y - min_y
    
    if w < 10 and h < 10:
        return None
    
    return {
        'type': 'polyfloor',
        'x': min_x + w / 2,
        'y': min_y + h / 2,
        'width': w,
        'height': h,
        'points': [
            {'x': min_x, 'y': min_y},
            {'x': max_x, 'y': min_y},
            {'x': max_x, 'y': max_y},
            {'x': min_x, 'y': max_y}
        ],
        'floorHeight': 0,
        'closed': True,
        'label': ''
    }


def create_junction_room(cx: float, cy: float, size: float) -> dict:
    """연결점에 작은 방 생성 (직사각형)"""
    half = size / 2
    
    # 직사각형 방 (약간 랜덤 크기)
    w = size * (0.9 + random.random() * 0.3)
    h = size * (0.9 + random.random() * 0.3)
    
    min_x = cx - w / 2
    min_y = cy - h / 2
    
    return {
        'type': 'polyfloor',
        'x': cx,
        'y': cy,
        'points': [
            {'x': min_x, 'y': min_y},
            {'x': min_x + w, 'y': min_y},
            {'x': min_x + w, 'y': min_y + h},
            {'x': min_x, 'y': min_y + h}
        ],
        'width': w,
        'height': h,
        'floorHeight': 0,
        'closed': True,
        'label': ''
    }


def kill_existing_processes(port=3003):
    """기존 포트 사용 프로세스 종료"""
    import subprocess
    import os
    import signal
    
    current_pid = os.getpid()
    
    try:
        # Windows: netstat로 포트 사용 프로세스 찾기
        result = subprocess.run(
            f'netstat -ano | findstr :{port} | findstr LISTENING',
            shell=True, capture_output=True, text=True
        )
        
        pids_to_kill = set()
        for line in result.stdout.strip().split('\n'):
            if line.strip():
                parts = line.split()
                if len(parts) >= 5:
                    pid = int(parts[-1])
                    if pid != current_pid:
                        pids_to_kill.add(pid)
        
        if pids_to_kill:
            print(f"기존 프로세스 종료 중: {pids_to_kill}")
            for pid in pids_to_kill:
                try:
                    subprocess.run(f'taskkill /F /PID {pid}', shell=True, 
                                   capture_output=True, timeout=5)
                except:
                    pass
            
            import time
            time.sleep(1)
            print("완료!")
    except Exception as e:
        print(f"프로세스 정리 중 오류 (무시됨): {e}")


if __name__ == '__main__':
    print("=" * 50)
    print("Map API - Rooms & Corridors")
    print("  http://localhost:3003")
    print("=" * 50)
    
                                                                                                                                                        # 기존 프로세스 자동 종료
    kill_existing_processes(3003)
    
    app.run(host='0.0.0.0', port=3003, debug=False, threaded=True)
