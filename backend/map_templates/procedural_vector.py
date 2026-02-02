"""
Procedural Map Generator - Vector/Polygon Based (벡터 기반)

타일 변환 없이 직접 폴리곤 좌표 생성
- 진짜 대각선
- 유기적 형태
- Voronoi + 노이즈
"""

import numpy as np
import math
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field


@dataclass
class Room:
    """방 정보"""
    name: str
    center: Tuple[float, float]
    vertices: List[Tuple[float, float]] = field(default_factory=list)
    room_type: str = 'room'  # spawn-off, spawn-def, objective, room
    color: Optional[str] = None
    

@dataclass
class Corridor:
    """통로 정보"""
    vertices: List[Tuple[float, float]]
    width: float = 4.0
    

class VectorMapGenerator:
    """
    벡터 기반 프로시저럴 맵 생성
    
    타일 그리드 없이 직접 폴리곤 좌표 생성
    """
    
    DEFAULT_RULES = {
        'map_size': 150,  # 미터 단위
        'site_size': (25, 35),
        'spawn_size': (20, 28),
        'room_size': (12, 25),
        'corridor_width': (4, 7),
        
        # 유기적 형태
        'organic_level': 0.6,
        'vertex_noise': 8,  # 버텍스 노이즈 범위
        'min_vertices': 5,
        'max_vertices': 8,
        
        # 대각선
        'diagonal_probability': 0.4,
        'angle_variation': 15,  # 각도 변화 (도)
    }
    
    def __init__(self, seed: int = None, rules: dict = None):
        if seed is not None:
            np.random.seed(seed)
        
        self.rules = self.DEFAULT_RULES.copy()
        if rules:
            self._merge_rules(rules)
        
        self.rooms: Dict[str, Room] = {}
        self.corridors: List[Corridor] = []
        self.scale = 32  # 1미터 = 32픽셀
    
    def _merge_rules(self, override: dict):
        """규칙 병합"""
        for key, value in override.items():
            if isinstance(value, dict):
                for k, v in value.items():
                    flat_key = f"{key}_{k}"
                    if flat_key in self.rules:
                        self.rules[flat_key] = v
            elif key in self.rules:
                self.rules[key] = value
    
    def generate(self) -> List[dict]:
        """맵 생성 → LevelForge 오브젝트 리스트 반환"""
        
        size = self.rules['map_size']
        
        # 1. 핵심 지점 배치
        self._place_key_points(size)
        
        # 2. 각 방을 유기적 폴리곤으로 생성
        self._create_organic_rooms()
        
        # 3. 통로 연결 (대각선 포함)
        self._connect_rooms()
        
        # 4. LevelForge 포맷으로 변환
        return self._to_levelforge_objects()
    
    def _place_key_points(self, size: float):
        """핵심 지점 배치"""
        margin = 20
        
        # 기본 레이아웃
        key_points = {
            # 스폰
            'ATK_SPAWN': (size - margin - 15, size / 2, 'spawn-off'),
            'DEF_SPAWN': (margin + 15, size / 2, 'spawn-def'),
            
            # 사이트
            'A_SITE': (margin + 30, size - margin - 35, 'objective'),
            'B_SITE': (margin + 30, margin + 35, 'objective'),
            
            # MID
            'MID': (size / 2, size / 2, 'room'),
            'MID_TOP': (size / 3, size / 2, 'room'),
            'MID_BOTTOM': (size * 2 / 3, size / 2, 'room'),
            
            # A 라인
            'A_LOBBY': (size - margin - 40, size - margin - 40, 'room'),
            'A_MAIN': (size / 2 + 10, size - margin - 35, 'room'),
            'A_CONNECTOR': (size / 3, size - margin - 45, 'room'),
            
            # B 라인
            'B_LOBBY': (size - margin - 40, margin + 40, 'room'),
            'B_MAIN': (size / 2 + 10, margin + 35, 'room'),
            'B_CONNECTOR': (size / 3, margin + 45, 'room'),
        }
        
        for name, (y, x, room_type) in key_points.items():
            # 약간의 랜덤 오프셋
            noise = self.rules['vertex_noise'] * 0.5
            y += np.random.uniform(-noise, noise)
            x += np.random.uniform(-noise, noise)
            
            self.rooms[name] = Room(
                name=name,
                center=(y, x),
                room_type=room_type
            )
    
    def _create_organic_rooms(self):
        """유기적 폴리곤 방 생성"""
        
        for name, room in self.rooms.items():
            # 방 크기 결정
            if 'SITE' in name:
                size_range = self.rules['site_size']
            elif 'SPAWN' in name:
                size_range = self.rules['spawn_size']
            else:
                size_range = self.rules['room_size']
            
            base_size = np.random.uniform(size_range[0], size_range[1])
            
            # 유기적 폴리곤 생성
            vertices = self._create_organic_polygon(
                room.center, 
                base_size,
                room.room_type
            )
            
            room.vertices = vertices
    
    def _create_organic_polygon(self, center: Tuple[float, float], 
                                 size: float, room_type: str) -> List[Tuple[float, float]]:
        """유기적 다각형 생성"""
        cy, cx = center
        
        # 버텍스 수 결정
        if room_type in ['spawn-off', 'spawn-def']:
            # 스폰은 좀 더 규칙적
            num_vertices = np.random.randint(4, 6)
        elif room_type == 'objective':
            # 사이트는 중간
            num_vertices = np.random.randint(5, 8)
        else:
            # 일반 방은 다양하게
            num_vertices = np.random.randint(
                self.rules['min_vertices'],
                self.rules['max_vertices'] + 1
            )
        
        vertices = []
        organic_level = self.rules['organic_level']
        vertex_noise = self.rules['vertex_noise']
        
        for i in range(num_vertices):
            # 기본 각도 (균등 분포)
            base_angle = (2 * math.pi * i) / num_vertices
            
            # 각도에 노이즈 추가
            angle_noise = np.random.uniform(-0.3, 0.3) * organic_level
            angle = base_angle + angle_noise
            
            # 반지름에 노이즈 추가 (유기적 형태)
            base_radius = size / 2
            radius_noise = np.random.uniform(-vertex_noise, vertex_noise) * organic_level
            radius = base_radius + radius_noise
            
            # 좌표 계산
            vy = cy + radius * math.cos(angle)
            vx = cx + radius * math.sin(angle)
            
            vertices.append((vy, vx))
        
        return vertices
    
    def _connect_rooms(self):
        """방들을 통로로 연결"""
        
        connections = [
            # ATK → 주요 지점
            ('ATK_SPAWN', 'A_LOBBY'),
            ('ATK_SPAWN', 'B_LOBBY'),
            ('ATK_SPAWN', 'MID_BOTTOM'),
            
            # MID 연결
            ('MID_BOTTOM', 'MID'),
            ('MID', 'MID_TOP'),
            
            # A 라인
            ('A_LOBBY', 'A_MAIN'),
            ('A_MAIN', 'A_SITE'),
            ('MID', 'A_CONNECTOR'),
            ('A_CONNECTOR', 'A_SITE'),
            
            # B 라인
            ('B_LOBBY', 'B_MAIN'),
            ('B_MAIN', 'B_SITE'),
            ('MID', 'B_CONNECTOR'),
            ('B_CONNECTOR', 'B_SITE'),
            
            # DEF → 사이트
            ('DEF_SPAWN', 'MID_TOP'),
            ('MID_TOP', 'A_SITE'),
            ('MID_TOP', 'B_SITE'),
        ]
        
        diagonal_prob = self.rules['diagonal_probability']
        
        for room1_name, room2_name in connections:
            if room1_name not in self.rooms or room2_name not in self.rooms:
                continue
            
            room1 = self.rooms[room1_name]
            room2 = self.rooms[room2_name]
            
            corridor = self._create_corridor(room1.center, room2.center, diagonal_prob)
            self.corridors.append(corridor)
    
    def _create_corridor(self, start: Tuple[float, float], 
                          end: Tuple[float, float],
                          diagonal_prob: float) -> Corridor:
        """통로 생성 (대각선 가능)"""
        
        y1, x1 = start
        y2, x2 = end
        
        width = np.random.uniform(
            self.rules['corridor_width'][0],
            self.rules['corridor_width'][1]
        )
        
        use_diagonal = np.random.random() < diagonal_prob
        
        if use_diagonal:
            # 대각선 통로 (직선)
            vertices = self._create_diagonal_corridor(y1, x1, y2, x2, width)
        else:
            # L자형 또는 굴곡 통로
            vertices = self._create_bent_corridor(y1, x1, y2, x2, width)
        
        return Corridor(vertices=vertices, width=width)
    
    def _create_diagonal_corridor(self, y1: float, x1: float, 
                                   y2: float, x2: float, 
                                   width: float) -> List[Tuple[float, float]]:
        """대각선 통로 폴리곤 생성"""
        
        # 방향 벡터
        dy = y2 - y1
        dx = x2 - x1
        length = math.sqrt(dy**2 + dx**2)
        
        if length == 0:
            return []
        
        # 단위 벡터
        uy = dy / length
        ux = dx / length
        
        # 수직 벡터 (통로 너비용)
        py = -ux
        px = uy
        
        half_width = width / 2
        
        # 4개 버텍스 (직사각형 통로)
        vertices = [
            (y1 + py * half_width, x1 + px * half_width),
            (y1 - py * half_width, x1 - px * half_width),
            (y2 - py * half_width, x2 - px * half_width),
            (y2 + py * half_width, x2 + px * half_width),
        ]
        
        return vertices
    
    def _create_bent_corridor(self, y1: float, x1: float,
                               y2: float, x2: float,
                               width: float) -> List[Tuple[float, float]]:
        """굴곡 통로 (L자형 또는 Z자형)"""
        
        # 중간점 계산
        if np.random.random() < 0.5:
            mid_y, mid_x = y1, x2
        else:
            mid_y, mid_x = y2, x1
        
        # 노이즈 추가
        noise = self.rules['vertex_noise']
        mid_y += np.random.uniform(-noise, noise)
        mid_x += np.random.uniform(-noise, noise)
        
        half_width = width / 2
        
        # 굴곡점을 포함한 폴리곤
        # 외곽선을 따라 버텍스 생성
        vertices = []
        
        # 시작점 좌우
        vertices.append((y1 - half_width, x1 - half_width))
        vertices.append((y1 + half_width, x1 - half_width))
        
        # 중간점 (굴곡)
        vertices.append((mid_y + half_width, mid_x - half_width))
        vertices.append((mid_y + half_width, mid_x + half_width))
        
        # 끝점
        vertices.append((y2 + half_width, x2 + half_width))
        vertices.append((y2 - half_width, x2 + half_width))
        
        # 중간점 반대편
        vertices.append((mid_y - half_width, mid_x + half_width))
        vertices.append((mid_y - half_width, mid_x - half_width))
        
        return vertices
    
    def _to_levelforge_objects(self) -> List[dict]:
        """LevelForge 포맷으로 변환"""
        objects = []
        
        # 마커 (스폰, 사이트)
        for name, room in self.rooms.items():
            if room.room_type in ['spawn-off', 'spawn-def', 'objective']:
                cy, cx = room.center
                
                marker = {
                    'type': room.room_type,
                    'x': cx * self.scale,
                    'y': cy * self.scale,
                    'width': 20 * self.scale if room.room_type != 'objective' else 10 * self.scale,
                    'height': 20 * self.scale if room.room_type != 'objective' else 10 * self.scale,
                }
                
                if room.room_type == 'spawn-off':
                    marker['label'] = 'OFFENCE'
                elif room.room_type == 'spawn-def':
                    marker['label'] = 'DEFENCE'
                elif room.room_type == 'objective':
                    marker['label'] = name.replace('_', ' ')
                    marker['minSize'] = 64
                
                objects.append(marker)
        
        # 방 폴리곤
        for name, room in self.rooms.items():
            if not room.vertices:
                continue
            
            points = [
                {'x': vx * self.scale, 'y': vy * self.scale}
                for vy, vx in room.vertices
            ]
            
            polyfloor = {
                'type': 'polyfloor',
                'x': room.center[1] * self.scale,
                'y': room.center[0] * self.scale,
                'points': points,
                'width': max(p['x'] for p in points) - min(p['x'] for p in points),
                'height': max(p['y'] for p in points) - min(p['y'] for p in points),
                'floorHeight': 0,
                'closed': True,
                'label': name.replace('_', ' ')
            }
            
            objects.append(polyfloor)
        
        # 통로 폴리곤
        for i, corridor in enumerate(self.corridors):
            if not corridor.vertices:
                continue
            
            points = [
                {'x': vx * self.scale, 'y': vy * self.scale}
                for vy, vx in corridor.vertices
            ]
            
            xs = [p['x'] for p in points]
            ys = [p['y'] for p in points]
            
            polyfloor = {
                'type': 'polyfloor',
                'x': sum(xs) / len(xs),
                'y': sum(ys) / len(ys),
                'points': points,
                'width': max(xs) - min(xs),
                'height': max(ys) - min(ys),
                'floorHeight': 0,
                'closed': True,
                'label': ''  # 통로는 레이블 없음
            }
            
            objects.append(polyfloor)
        
        return objects


def generate_vector_map(seed: int = None, rules: dict = None) -> List[dict]:
    """벡터 맵 생성 헬퍼 함수"""
    generator = VectorMapGenerator(seed=seed, rules=rules)
    return generator.generate()
