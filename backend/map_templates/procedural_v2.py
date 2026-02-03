"""
Procedural Map Generator v2 - 정교한 규칙

추가된 디자인 원칙:
1. 시야선 기반 배치 (긴 시야선, 교차 사격)
2. 시간 기반 밸런스 (로테이션, 리테이크)
3. 초크포인트 품질 (돌파 지점, 스모크 너비)
4. 커버 투 커버 (안전한 이동 경로)
5. 앵글 다양성 (피커스 어드밴티지, 오프앵글)
6. 수직 구조 (Heaven/Hell)
7. 정보 지점 (소리, 시야 정보)
"""

import numpy as np
from typing import Tuple, Dict, List, Set
from .base import MapTemplate, Tile
from collections import deque


class ProceduralV2Template(MapTemplate):
    """
    정교한 규칙 기반 맵 생성
    """
    name = "ProceduralV2"
    game = "Generated"
    size = 150
    
    # ========================================
    # 디자인 규칙
    # ========================================
    DESIGN_RULES = {
        # 기본 크기
        'site_size': (24, 32),
        'spawn_size': (20, 28),
        'room_size': (12, 22),
        'corridor_width': (4, 7),
        
        # 시간 밸런스 (타일 = 미터, 이동속도 약 5m/s 가정)
        'atk_to_site_time': (60, 90),      # 공격 스폰→사이트: 12~18초
        'def_to_site_time': (40, 70),      # 수비 스폰→사이트: 8~14초  
        'rotation_time': (50, 80),          # 사이트간 로테이션: 10~16초
        
        # 시야선
        'max_sightline': 50,                # 최대 시야선 50m (스나이퍼 제한)
        'min_sightline': 8,                 # 최소 시야선 8m
        'sightline_to_site': (15, 35),      # 사이트 진입 시야선
        
        # 초크포인트
        'choke_width': (3, 6),              # 스모크로 막을 수 있는 너비
        'chokes_per_site': (1, 2),          # 사이트당 초크포인트
        
        # 커버
        'cover_spacing': (8, 15),           # 커버 간 거리
        'exposed_max': 12,                  # 최대 노출 거리
        
        # 앵글
        'angles_per_site': (3, 5),          # 사이트당 앵글 수
        
        # 지루함 방지
        'max_straight_corridor': 15,        # 3초 직선 통로 제한 (15m)
        'corridor_turn_interval': (8, 15),  # 8~15m마다 방향 전환 필요
        
        # 통로 너비 제한
        'corridor_min_width': 4,            # 최소 4m (2명 통과 가능)
        'corridor_max_width': 8,            # 최대 8m (너무 넓으면 엄폐 불가)
    }
    
    # 활성 규칙 (generate 시 설정됨)
    _active_rules = None
    
    @classmethod
    def _merge_rules(cls, base: dict, override: dict):
        """사용자 규칙을 기본 규칙에 병합"""
        mapping = {
            # timing
            ('timing', 'atk_to_site'): 'atk_to_site_time',
            ('timing', 'def_to_site'): 'def_to_site_time',
            ('timing', 'rotation'): 'rotation_time',
            # entries
            ('entries', 'per_site'): 'chokes_per_site',  # 진입로 ≈ 초크
            ('entries', 'chokes_per_site'): 'chokes_per_site',
            # sightlines
            ('sightlines', 'max_length'): 'max_sightline',
            ('sightlines', 'to_site'): 'sightline_to_site',
            # cover
            ('cover', 'spacing'): 'cover_spacing',
            ('cover', 'exposed_max'): 'exposed_max',
            # corridors
            ('corridors', 'max_straight'): 'max_straight_corridor',
            ('corridors', 'width'): 'corridor_width',
            ('corridors', 'min_width'): 'corridor_min_width',
            ('corridors', 'max_width'): 'corridor_max_width',
            # angles
            ('angles', 'per_site'): 'angles_per_site',
            # sizes
            ('sizes', 'site'): 'site_size',
            ('sizes', 'spawn'): 'spawn_size',
            ('sizes', 'room'): 'room_size',
        }
        
        for (category, key), target in mapping.items():
            if category in override and key in override[category]:
                value = override[category][key]
                # 리스트를 튜플로 변환 (min, max+1 for randint)
                if isinstance(value, list) and len(value) == 2:
                    # randint(low, high)에서 high는 exclusive이므로 +1
                    value = (value[0], value[1] + 1)
                base[target] = value
                print(f"[Rule Override] {target} = {value}", flush=True)
    
    @classmethod
    def get_rules_schema(cls) -> dict:
        """프론트엔드용 규칙 스키마 반환"""
        return {
            'timing': {
                'label': '타이밍 밸런스',
                'params': {
                    'atk_to_site': {'label': '공격→사이트 시간', 'type': 'range', 'default': [60, 90], 'unit': 'tiles'},
                    'def_to_site': {'label': '수비→사이트 시간', 'type': 'range', 'default': [40, 70], 'unit': 'tiles'},
                    'rotation': {'label': '로테이션 시간', 'type': 'range', 'default': [50, 80], 'unit': 'tiles'},
                }
            },
            'entries': {
                'label': '진입로',
                'params': {
                    'per_site': {'label': '사이트당 진입로', 'type': 'range', 'default': [1, 2], 'unit': '개'},
                    'chokes_per_site': {'label': '사이트당 초크', 'type': 'range', 'default': [1, 2], 'unit': '개'},
                }
            },
            'sightlines': {
                'label': '시야선',
                'params': {
                    'max_length': {'label': '최대 시야선', 'type': 'number', 'default': 50, 'unit': 'm'},
                    'to_site': {'label': '사이트 진입 시야선', 'type': 'range', 'default': [15, 35], 'unit': 'm'},
                }
            },
            'cover': {
                'label': '엄폐물',
                'params': {
                    'spacing': {'label': '커버 간격', 'type': 'range', 'default': [8, 15], 'unit': 'm'},
                    'exposed_max': {'label': '최대 노출 거리', 'type': 'number', 'default': 12, 'unit': 'm'},
                }
            },
            'corridors': {
                'label': '통로',
                'params': {
                    'max_straight': {'label': '최대 직선 길이', 'type': 'number', 'default': 25, 'unit': 'm'},
                    'width': {'label': '통로 너비', 'type': 'range', 'default': [4, 7], 'unit': 'm'},
                }
            },
            'angles': {
                'label': '앵글',
                'params': {
                    'per_site': {'label': '사이트당 앵글', 'type': 'range', 'default': [3, 5], 'unit': '개'},
                }
            }
        }
    
    @classmethod
    def generate(cls, seed=None, rules=None, site_count=2, layout=None) -> Tuple[np.ndarray, Dict]:
        """
        맵 생성
        
        Args:
            seed: 랜덤 시드
            rules: 디자인 규칙 오버라이드 (dict)
            site_count: 사이트 개수 (1, 2, 3)
            layout: 프리뷰에서 설정한 노드 위치 (정규화된 0~1 좌표)
                - atk: {x, y} 공격 스폰
                - def: {x, y} 수비 스폰
                - mid: {x, y} 미드
                - siteA/B/C: {x, y} 사이트들
        """
        if seed is not None:
            np.random.seed(seed)
        
        # 규칙 병합
        active_rules = cls.DESIGN_RULES.copy()
        if rules:
            cls._merge_rules(active_rules, rules)
        
        s = cls.size
        m = np.full((s, s), Tile.VOID, dtype=np.int32)
        rooms = {}
        
        # 활성 규칙 저장 (다른 메서드에서 사용)
        cls._active_rules = active_rules
        cls._site_count = site_count
        cls._user_layout = layout  # 사용자 지정 레이아웃 저장
        
        # 1. 레이아웃 스켈레톤 결정 (사용자 레이아웃 우선)
        if layout:
            map_layout = cls._layout_from_user(s, layout, site_count)
        else:
            map_layout = cls._decide_layout(s)
        
        # 2. 핵심 지점 배치 (시간 밸런스 고려)
        cls._place_key_points(m, rooms, s, map_layout)
        
        # 3. 초크포인트 설계
        cls._design_chokepoints(m, rooms, s, map_layout)
        
        # 4. 시야선 기반 방 배치
        cls._place_sightline_rooms(m, rooms, s, map_layout)
        
        # 5. 연결 구조 (커버 투 커버)
        cls._connect_with_cover(m, rooms, s)
        
        # 6. 앵글 포지션 추가
        cls._add_angle_positions(m, rooms, s)
        
        # 7. 수직 구조 (Heaven)
        cls._add_vertical_positions(m, rooms, s)
        
        # 8. 검증 및 수정
        cls._validate_and_fix(m, rooms, s)
        
        # 9. 고립된 영역 제거 (벽 생성 전에!)
        cls.remove_isolated_areas(m, rooms)
        
        # 10. 벽 생성
        cls.generate_walls(m)
        
        return m, rooms
    
    @classmethod
    def _decide_layout(cls, s) -> Dict:
        """레이아웃 기본 구조 결정"""
        # A 사이트 위치: 좌상단 or 우상단
        a_side = np.random.choice(['left', 'right'])
        
        # Mid 타입
        mid_type = np.random.choice([
            'wide',      # 넓은 Mid (Ascent 스타일)
            'narrow',    # 좁은 Mid (Split 스타일)
            'split',     # 분할된 Mid (여러 경로)
        ])
        
        # 비대칭 정도 (0 = 완전 대칭, 1 = 강한 비대칭)
        asymmetry = np.random.uniform(0.1, 0.4)
        
        return {
            'a_side': a_side,
            'mid_type': mid_type,
            'asymmetry': asymmetry,
            'size': s,
        }
    
    @classmethod
    def _layout_from_user(cls, s, user_layout, site_count):
        """사용자 지정 레이아웃을 맵 좌표로 변환"""
        margin = 15  # 맵 가장자리 마진
        
        # 정규화된 좌표(0~1)를 맵 좌표로 변환
        def to_map_coord(norm_x, norm_y):
            x = int(norm_x * (s - 2 * margin) + margin)
            y = int(norm_y * (s - 2 * margin) + margin)
            return np.clip(x, margin, s - margin), np.clip(y, margin, s - margin)
        
        # 안전하게 좌표 가져오기 (없으면 기본값 사용)
        def safe_coord(key, default_x, default_y):
            if key in user_layout:
                return to_map_coord(user_layout[key]['x'], user_layout[key]['y'])
            return to_map_coord(default_x, default_y)
        
        # 각 노드의 맵 좌표 (필수 노드는 기본 위치 제공)
        atk_pos = safe_coord('atk', 0.5, 0.1)      # 상단 중앙
        def_pos = safe_coord('def', 0.5, 0.9)      # 하단 중앙
        mid_pos = safe_coord('mid', 0.5, 0.5)      # 중앙
        
        # 사이트 위치 (site_count에 따라 기본 위치 결정)
        if 'siteA' in user_layout:
            site_a_pos = to_map_coord(user_layout['siteA']['x'], user_layout['siteA']['y'])
        elif site_count >= 1:
            site_a_pos = to_map_coord(0.25, 0.7)   # 기본: 좌하단
        else:
            site_a_pos = None
            
        if 'siteB' in user_layout and site_count >= 2:
            site_b_pos = to_map_coord(user_layout['siteB']['x'], user_layout['siteB']['y'])
        elif site_count >= 2:
            site_b_pos = to_map_coord(0.75, 0.7)   # 기본: 우하단
        else:
            site_b_pos = None
            
        site_c_pos = to_map_coord(user_layout['siteC']['x'], user_layout['siteC']['y']) if 'siteC' in user_layout and site_count >= 3 else None
        
        # 랑데뷰 포인트 (SIDE, LOBBY) - 선택적
        side_a_pos = to_map_coord(user_layout['sideA']['x'], user_layout['sideA']['y']) if 'sideA' in user_layout else None
        side_b_pos = to_map_coord(user_layout['sideB']['x'], user_layout['sideB']['y']) if 'sideB' in user_layout and site_count >= 2 else None
        lobby_a_pos = to_map_coord(user_layout['lobbyA']['x'], user_layout['lobbyA']['y']) if 'lobbyA' in user_layout else None
        lobby_b_pos = to_map_coord(user_layout['lobbyB']['x'], user_layout['lobbyB']['y']) if 'lobbyB' in user_layout and site_count >= 2 else None
        
        # 추가 노드들 (MAIN, CHOKE, HEAVEN, MID 관련)
        main_a_pos = to_map_coord(user_layout['mainA']['x'], user_layout['mainA']['y']) if 'mainA' in user_layout else None
        main_b_pos = to_map_coord(user_layout['mainB']['x'], user_layout['mainB']['y']) if 'mainB' in user_layout and site_count >= 2 else None
        choke_a_pos = to_map_coord(user_layout['chokeA']['x'], user_layout['chokeA']['y']) if 'chokeA' in user_layout else None
        choke_b_pos = to_map_coord(user_layout['chokeB']['x'], user_layout['chokeB']['y']) if 'chokeB' in user_layout and site_count >= 2 else None
        heaven_a_pos = to_map_coord(user_layout['heavenA']['x'], user_layout['heavenA']['y']) if 'heavenA' in user_layout else None
        heaven_b_pos = to_map_coord(user_layout['heavenB']['x'], user_layout['heavenB']['y']) if 'heavenB' in user_layout and site_count >= 2 else None
        mid_top_pos = to_map_coord(user_layout['midTop']['x'], user_layout['midTop']['y']) if 'midTop' in user_layout else None
        mid_entrance_pos = to_map_coord(user_layout['midEntrance']['x'], user_layout['midEntrance']['y']) if 'midEntrance' in user_layout else None
        
        # A 사이트가 왼쪽인지 오른쪽인지 판단 (siteA가 있을 때만)
        if site_a_pos:
            a_side = 'left' if site_a_pos[0] < s // 2 else 'right'
        else:
            a_side = 'left'  # 기본값
        
        return {
            'a_side': a_side,
            'mid_type': 'wide',  # 기본값
            'asymmetry': 0.2,
            'size': s,
            # 사용자 지정 위치
            'user_positions': {
                'atk': atk_pos,
                'def': def_pos,
                'mid': mid_pos,
                'siteA': site_a_pos,
                'siteB': site_b_pos,
                'siteC': site_c_pos,
                # 랑데뷰 포인트
                'sideA': side_a_pos,
                'sideB': side_b_pos,
                'lobbyA': lobby_a_pos,
                'lobbyB': lobby_b_pos,
                # 추가 노드
                'mainA': main_a_pos,
                'mainB': main_b_pos,
                'chokeA': choke_a_pos,
                'chokeB': choke_b_pos,
                'heavenA': heaven_a_pos,
                'heavenB': heaven_b_pos,
                'midTop': mid_top_pos,
                'midEntrance': mid_entrance_pos,
            }
        }
    
    @classmethod
    def _place_key_points(cls, m, rooms, s, layout):
        """핵심 지점 배치 (시간 밸런스 기반)"""
        r = cls._active_rules  # 오버라이드된 규칙 사용
        site_count = getattr(cls, '_site_count', 2)
        user_pos = layout.get('user_positions', None)
        
        # 크기 결정
        atk_w, atk_h = np.random.randint(*r['spawn_size']), np.random.randint(18, 24)
        def_w, def_h = np.random.randint(*r['spawn_size']), np.random.randint(16, 22)
        
        # 사용자 지정 위치가 있으면 사용
        if user_pos:
            # 공격 스폰
            atk_x = user_pos['atk'][0] - atk_w // 2
            atk_y = user_pos['atk'][1] - atk_h // 2
            cls.create_room(m, rooms, "ATK_SPAWN", atk_x, atk_y, atk_w, atk_h, Tile.SPAWN_ATK)
            
            # 수비 스폰
            def_x = user_pos['def'][0] - def_w // 2
            def_y = user_pos['def'][1] - def_h // 2
            cls.create_room(m, rooms, "DEF_SPAWN", def_x, def_y, def_w, def_h, Tile.SPAWN_DEF)
            
            # 사이트들
            if user_pos['siteA']:
                a_w, a_h = np.random.randint(*r['site_size']), np.random.randint(*r['site_size'])
                a_x = user_pos['siteA'][0] - a_w // 2
                a_y = user_pos['siteA'][1] - a_h // 2
                cls.create_room(m, rooms, "A_SITE", a_x, a_y, a_w, a_h, Tile.SITE_A)
            
            if site_count >= 2 and user_pos.get('siteB'):
                b_w, b_h = np.random.randint(*r['site_size']), np.random.randint(*r['site_size'])
                b_x = user_pos['siteB'][0] - b_w // 2
                b_y = user_pos['siteB'][1] - b_h // 2
                cls.create_room(m, rooms, "B_SITE", b_x, b_y, b_w, b_h, Tile.SITE_B)
            
            if site_count >= 3 and user_pos.get('siteC'):
                c_w, c_h = np.random.randint(*r['site_size']), np.random.randint(*r['site_size'])
                c_x = user_pos['siteC'][0] - c_w // 2
                c_y = user_pos['siteC'][1] - c_h // 2
                cls.create_room(m, rooms, "C_SITE", c_x, c_y, c_w, c_h, Tile.SITE_A)  # C도 일단 SITE_A 타일
            
            # MID (room_size 파라미터 사용)
            room_min, room_max = r['room_size']
            print(f"[DEBUG MID] room_size from rules: {r['room_size']}, min={room_min}, max={room_max}", flush=True)
            mid_w, mid_h = np.random.randint(room_min, room_max), np.random.randint(room_min, room_max)
            print(f"[DEBUG MID] created size: w={mid_w}, h={mid_h}", flush=True)
            mid_x = user_pos['mid'][0] - mid_w // 2
            mid_y = user_pos['mid'][1] - mid_h // 2
            cls.create_room(m, rooms, "MID", mid_x, mid_y, mid_w, mid_h, None)
            
            # 랑데뷰 포인트: SIDE (플랭크) - 약간 작게
            side_min, side_max = max(8, room_min - 4), max(12, room_max - 4)
            side_w, side_h = np.random.randint(side_min, side_max), np.random.randint(side_min, side_max)
            if user_pos.get('sideA'):
                side_x = user_pos['sideA'][0] - side_w // 2
                side_y = user_pos['sideA'][1] - side_h // 2
                cls.create_room(m, rooms, "A_SIDE", side_x, side_y, side_w, side_h, None)
            
            if site_count >= 2 and user_pos.get('sideB'):
                side_x = user_pos['sideB'][0] - side_w // 2
                side_y = user_pos['sideB'][1] - side_h // 2
                cls.create_room(m, rooms, "B_SIDE", side_x, side_y, side_w, side_h, None)
            
            # 랑데뷰 포인트: LOBBY (진입 대기)
            lobby_w, lobby_h = np.random.randint(room_min, room_max), np.random.randint(room_min, room_max)
            if user_pos.get('lobbyA'):
                lobby_x = user_pos['lobbyA'][0] - lobby_w // 2
                lobby_y = user_pos['lobbyA'][1] - lobby_h // 2
                cls.create_room(m, rooms, "A_LOBBY", lobby_x, lobby_y, lobby_w, lobby_h, None)
            
            if site_count >= 2 and user_pos.get('lobbyB'):
                lobby_x = user_pos['lobbyB'][0] - lobby_w // 2
                lobby_y = user_pos['lobbyB'][1] - lobby_h // 2
                cls.create_room(m, rooms, "B_LOBBY", lobby_x, lobby_y, lobby_w, lobby_h, None)
            
            # MAIN 통로
            main_w, main_h = np.random.randint(room_min, room_max), np.random.randint(room_min - 2, room_max - 2)
            if user_pos.get('mainA'):
                main_x = user_pos['mainA'][0] - main_w // 2
                main_y = user_pos['mainA'][1] - main_h // 2
                cls.create_room(m, rooms, "A_MAIN", main_x, main_y, main_w, main_h, None)
            
            if site_count >= 2 and user_pos.get('mainB'):
                main_x = user_pos['mainB'][0] - main_w // 2
                main_y = user_pos['mainB'][1] - main_h // 2
                cls.create_room(m, rooms, "B_MAIN", main_x, main_y, main_w, main_h, None)
            
            # CHOKE 포인트
            choke_w, choke_h = np.random.randint(8, 14), np.random.randint(8, 14)
            if user_pos.get('chokeA'):
                choke_x = user_pos['chokeA'][0] - choke_w // 2
                choke_y = user_pos['chokeA'][1] - choke_h // 2
                cls.create_room(m, rooms, "A_CHOKE", choke_x, choke_y, choke_w, choke_h, None)
            
            if site_count >= 2 and user_pos.get('chokeB'):
                choke_x = user_pos['chokeB'][0] - choke_w // 2
                choke_y = user_pos['chokeB'][1] - choke_h // 2
                cls.create_room(m, rooms, "B_CHOKE", choke_x, choke_y, choke_w, choke_h, None)
            
            # HEAVEN (고지대)
            heaven_w, heaven_h = np.random.randint(10, 16), np.random.randint(8, 12)
            if user_pos.get('heavenA'):
                heaven_x = user_pos['heavenA'][0] - heaven_w // 2
                heaven_y = user_pos['heavenA'][1] - heaven_h // 2
                cls.create_room(m, rooms, "A_HEAVEN", heaven_x, heaven_y, heaven_w, heaven_h, None)
            
            if site_count >= 2 and user_pos.get('heavenB'):
                heaven_x = user_pos['heavenB'][0] - heaven_w // 2
                heaven_y = user_pos['heavenB'][1] - heaven_h // 2
                cls.create_room(m, rooms, "B_HEAVEN", heaven_x, heaven_y, heaven_w, heaven_h, None)
            
            # MID 관련 (MID TOP, MID ENTRANCE)
            mid_sub_w, mid_sub_h = np.random.randint(room_min - 2, room_max - 2), np.random.randint(room_min - 4, room_max - 4)
            if user_pos.get('midTop'):
                mid_sub_x = user_pos['midTop'][0] - mid_sub_w // 2
                mid_sub_y = user_pos['midTop'][1] - mid_sub_h // 2
                cls.create_room(m, rooms, "MID_TOP", mid_sub_x, mid_sub_y, mid_sub_w, mid_sub_h, None)
            
            if user_pos.get('midEntrance'):
                mid_sub_x = user_pos['midEntrance'][0] - mid_sub_w // 2
                mid_sub_y = user_pos['midEntrance'][1] - mid_sub_h // 2
                cls.create_room(m, rooms, "MID_ENTRANCE", mid_sub_x, mid_sub_y, mid_sub_w, mid_sub_h, None)
            
            return
        
        # === 기존 자동 배치 로직 ===
        # 공격 스폰: 하단 중앙
        atk_x = s//2 - atk_w//2 + np.random.randint(-10, 11)
        atk_y = s - atk_h - np.random.randint(8, 15)
        cls.create_room(m, rooms, "ATK_SPAWN", atk_x, atk_y, atk_w, atk_h, Tile.SPAWN_ATK)
        
        # 수비 스폰: 상단 중앙 (사이트 사이)
        def_x = s//2 - def_w//2 + np.random.randint(-8, 9)
        def_y = np.random.randint(6, 15)
        cls.create_room(m, rooms, "DEF_SPAWN", def_x, def_y, def_w, def_h, Tile.SPAWN_DEF)
        
        # === 사이트 개수에 따른 배치 ===
        if site_count == 1:
            # 1개 사이트: 중앙 상단
            a_w, a_h = np.random.randint(*r['site_size']), np.random.randint(*r['site_size'])
            a_x = s//2 - a_w//2 + np.random.randint(-15, 16)
            a_y = np.random.randint(20, 40)
            cls.create_room(m, rooms, "A_SITE", a_x, a_y, a_w, a_h, Tile.SITE_A)
            
        elif site_count == 3:
            # 3개 사이트: A(좌), B(우), C(중앙)
            # A 사이트
            a_w, a_h = np.random.randint(*r['site_size']), np.random.randint(*r['site_size'])
            a_x = np.random.randint(10, 25)
            a_y = np.random.randint(18, 35)
            cls.create_room(m, rooms, "A_SITE", a_x, a_y, a_w, a_h, Tile.SITE_A)
            
            # B 사이트
            b_w, b_h = np.random.randint(*r['site_size']), np.random.randint(*r['site_size'])
            b_x = s - b_w - np.random.randint(10, 25)
            b_y = np.random.randint(18, 35)
            cls.create_room(m, rooms, "B_SITE", b_x, b_y, b_w, b_h, Tile.SITE_B)
            
            # C 사이트 (중앙)
            c_w, c_h = np.random.randint(*r['site_size']), np.random.randint(*r['site_size'])
            c_x = s//2 - c_w//2 + np.random.randint(-10, 11)
            c_y = np.random.randint(30, 50)
            cls.create_room(m, rooms, "C_SITE", c_x, c_y, c_w, c_h, Tile.SITE_A)  # SITE_C 타일이 없으면 A 사용
            
        else:
            # 2개 사이트 (기본)
            # A 사이트
            a_w, a_h = np.random.randint(*r['site_size']), np.random.randint(*r['site_size'])
            if layout['a_side'] == 'left':
                a_x = np.random.randint(10, 30)
            else:
                a_x = s - a_w - np.random.randint(10, 30)
            a_y = np.random.randint(18, 35)
            cls.create_room(m, rooms, "A_SITE", a_x, a_y, a_w, a_h, Tile.SITE_A)
            
            # B 사이트
            b_w, b_h = np.random.randint(*r['site_size']), np.random.randint(*r['site_size'])
            if layout['a_side'] == 'left':
                b_x = s - b_w - np.random.randint(10, 30)
            else:
                b_x = np.random.randint(10, 30)
            asymmetry_offset = int(layout['asymmetry'] * 15)
            b_y = np.random.randint(20, 40) + np.random.randint(-asymmetry_offset, asymmetry_offset + 1)
            b_y = np.clip(b_y, 15, 50)
            cls.create_room(m, rooms, "B_SITE", b_x, b_y, b_w, b_h, Tile.SITE_B)
    
    @classmethod
    def _design_chokepoints(cls, m, rooms, s, layout):
        """초크포인트 설계 (진입로) - 이미 user_layout에서 생성된 방은 건너뜀"""
        r = cls._active_rules  # 오버라이드된 규칙 사용
        site_count = getattr(cls, '_site_count', 2)
        
        a_site = rooms.get('A_SITE')
        b_site = rooms.get('B_SITE')
        c_site = rooms.get('C_SITE')
        atk = rooms['ATK_SPAWN']
        
        # A 사이트 관련 방들 (항상 존재)
        if a_site:
            # A 사이트 초크포인트
            if 'A_CHOKE' not in rooms:
                a_choke_w = np.random.randint(*r['choke_width'])
                a_choke_h = np.random.randint(10, 18)
                a_choke_x = a_site['x'] + a_site['w']//2 - a_choke_w//2
                a_choke_y = a_site['y'] + a_site['h'] + np.random.randint(8, 18)
                cls.create_room(m, rooms, "A_CHOKE", a_choke_x, a_choke_y, a_choke_w + 8, a_choke_h, None)
            
            # A Main (room_size 사용)
            if 'A_MAIN' not in rooms:
                a_main_w = np.random.randint(*r['room_size'])
                a_main_h = np.random.randint(*r['room_size'])
                a_main_x = a_site['x'] + np.random.randint(-5, 10)
                a_main_y = s//2 + np.random.randint(-5, 15)
                cls.create_room(m, rooms, "A_MAIN", a_main_x, a_main_y, a_main_w, a_main_h, None)
            
            # A Lobby (room_size 사용)
            if 'A_LOBBY' not in rooms:
                a_lobby_w = np.random.randint(*r['room_size'])
                a_lobby_h = np.random.randint(*r['room_size'])
                a_lobby_x = (a_site['x'] + atk['x'])//2 - a_lobby_w//2 + np.random.randint(-8, 9)
                a_lobby_y = s - 52 + np.random.randint(-5, 10)
                a_lobby_x = np.clip(a_lobby_x, 5, s - a_lobby_w - 5)
                cls.create_room(m, rooms, "A_LOBBY", a_lobby_x, a_lobby_y, a_lobby_w, a_lobby_h, None)
        
        # B 사이트 관련 방들 (2개 이상일 때)
        if b_site and site_count >= 2:
            if 'B_CHOKE' not in rooms:
                b_choke_w = np.random.randint(*r['choke_width'])
                b_choke_h = np.random.randint(10, 18)
                b_choke_x = b_site['x'] + b_site['w']//2 - b_choke_w//2
                b_choke_y = b_site['y'] + b_site['h'] + np.random.randint(8, 18)
                cls.create_room(m, rooms, "B_CHOKE", b_choke_x, b_choke_y, b_choke_w + 8, b_choke_h, None)
            
            # B Main (room_size 사용)
            if 'B_MAIN' not in rooms:
                b_main_w = np.random.randint(*r['room_size'])
                b_main_h = np.random.randint(*r['room_size'])
                b_main_x = b_site['x'] + np.random.randint(-5, 10)
                b_main_y = s//2 + np.random.randint(-5, 15)
                cls.create_room(m, rooms, "B_MAIN", b_main_x, b_main_y, b_main_w, b_main_h, None)
            
            # B Lobby (room_size 사용)
            if 'B_LOBBY' not in rooms:
                b_lobby_w = np.random.randint(*r['room_size'])
                b_lobby_h = np.random.randint(*r['room_size'])
                b_lobby_x = (b_site['x'] + atk['x'])//2 - b_lobby_w//2 + np.random.randint(-8, 9)
                b_lobby_y = s - 52 + np.random.randint(-5, 10)
                b_lobby_x = np.clip(b_lobby_x, 5, s - b_lobby_w - 5)
                cls.create_room(m, rooms, "B_LOBBY", b_lobby_x, b_lobby_y, b_lobby_w, b_lobby_h, None)
        
        # C 사이트 관련 방들 (3개일 때)
        if c_site and site_count >= 3:
            if 'C_CHOKE' not in rooms:
                c_choke_w = np.random.randint(*r['choke_width'])
                c_choke_h = np.random.randint(10, 18)
                c_choke_x = c_site['x'] + c_site['w']//2 - c_choke_w//2
                c_choke_y = c_site['y'] + c_site['h'] + np.random.randint(8, 18)
                cls.create_room(m, rooms, "C_CHOKE", c_choke_x, c_choke_y, c_choke_w + 8, c_choke_h, None)
            
            # C Main (room_size 사용)
            if 'C_MAIN' not in rooms:
                c_main_w = np.random.randint(*r['room_size'])
                c_main_h = np.random.randint(*r['room_size'])
                c_main_x = c_site['x'] + np.random.randint(-5, 10)
                c_main_y = s//2 + np.random.randint(10, 25)
                cls.create_room(m, rooms, "C_MAIN", c_main_x, c_main_y, c_main_w, c_main_h, None)
        
        # Mid 설계
        cls._design_mid(m, rooms, s, layout)
    
    @classmethod
    def _design_mid(cls, m, rooms, s, layout):
        """Mid 영역 설계 - 이미 user_layout에서 생성된 방은 건너뜀"""
        mid_type = layout['mid_type']
        r = cls._active_rules
        room_min, room_max = r['room_size']
        
        # MID가 이미 있으면 건너뜀 (user_layout에서 생성됨)
        if 'MID' not in rooms:
            mid_w = np.random.randint(room_min, room_max)
            mid_h = np.random.randint(room_min, room_max)
            mid_x = s//2 - mid_w//2 + np.random.randint(-8, 9)
            mid_y = s//2 - mid_h//2 + np.random.randint(-8, 5)
            cls.create_room(m, rooms, "MID", mid_x, mid_y, mid_w, mid_h, None)
        
        # Mid Top (수비 연결) - 이미 있으면 건너뜀
        if 'MID_TOP' not in rooms:
            top_w = np.random.randint(room_min, room_max)
            top_h = np.random.randint(max(8, room_min - 4), max(12, room_max - 6))
            top_x = s//2 - top_w//2 + np.random.randint(-5, 6)
            top_y = np.random.randint(28, 40)
            cls.create_room(m, rooms, "MID_TOP", top_x, top_y, top_w, top_h, None)
        
        # Mid Entrance (공격 진입) - 이미 있으면 건너뜀
        if 'MID_ENTRANCE' not in rooms:
            ent_w = np.random.randint(room_min, room_max)
            ent_h = np.random.randint(max(8, room_min - 4), max(12, room_max - 6))
            ent_x = s//2 - ent_w//2 + np.random.randint(-8, 9)
            ent_y = s - 55 + np.random.randint(-5, 10)
            cls.create_room(m, rooms, "MID_ENTRANCE", ent_x, ent_y, ent_w, ent_h, None)
        
        # Split Mid인 경우 추가 경로
        if mid_type == 'split':
            conn_w = np.random.randint(max(8, room_min - 4), max(12, room_max - 6))
            conn_h = np.random.randint(max(8, room_min - 4), max(12, room_max - 6))
            conn_x = s//2 - conn_w//2 + np.random.randint(-15, 16)
            conn_y = s//2 + np.random.randint(5, 15)
            cls.create_room(m, rooms, "MID_CONNECTOR", conn_x, conn_y, conn_w, conn_h, None)
    
    @classmethod
    def _place_sightline_rooms(cls, m, rooms, s, layout):
        """시야선 기반 방 배치 - SIDE를 플랭크 경로로 (이미 존재하면 건너뜀)"""
        r = cls._active_rules  # 오버라이드된 규칙 사용
        
        # 각 사이트 주변에 SIDE 배치 (MAIN과 SITE 사이, 플랭크용)
        for site_name in ['A_SITE', 'B_SITE', 'C_SITE']:
            if site_name not in rooms:
                continue
            
            site = rooms[site_name]
            prefix = site_name[0]  # 'A', 'B', or 'C'
            side_name = f"{prefix}_SIDE"
            
            # 이미 존재하면 건너뜀 (user_layout에서 생성됨)
            if side_name in rooms:
                continue
            
            main_name = f"{prefix}_MAIN"
            choke_name = f"{prefix}_CHOKE"
            
            # MAIN 또는 CHOKE 기준으로 SIDE 위치 결정
            ref_room = rooms.get(main_name) or rooms.get(choke_name)
            if not ref_room:
                continue
            
            side_w = np.random.randint(12, 18)
            side_h = np.random.randint(14, 20)
            
            # SITE와 MAIN/CHOKE 사이, 옆쪽에 배치
            mid_y = (site['y'] + ref_room['y']) // 2
            
            # 좌우 방향 결정 (맵 중앙 기준 반대편)
            if site['x'] < s // 2:
                # 사이트가 좌측이면 SIDE는 우측에
                side_x = site['x'] + site['w'] + np.random.randint(5, 15)
            else:
                # 사이트가 우측이면 SIDE는 좌측에
                side_x = site['x'] - side_w - np.random.randint(5, 15)
            
            side_y = mid_y + np.random.randint(-10, 10)
            side_x = np.clip(side_x, 10, s - side_w - 10)
            side_y = np.clip(side_y, 10, s - side_h - 10)
            
            # 겹침 체크
            if not cls._overlaps_existing(rooms, side_x, side_y, side_w, side_h):
                cls.create_room(m, rooms, f"{prefix}_SIDE", side_x, side_y, side_w, side_h, None)
    
    @classmethod
    def _connect_with_cover(cls, m, rooms, s):
        """커버 투 커버 연결 (통로 너비 4~8m 제한)"""
        r = cls._active_rules  # 오버라이드된 규칙 사용
        min_w = r['corridor_min_width']  # 4m
        max_w = r['corridor_max_width']  # 8m
        site_count = getattr(cls, '_site_count', 2)
        
        if site_count == 1:
            # 1개 사이트: 3방향 진입로 (좌, 중앙, 우)
            essential = [
                # 메인 경로 (중앙)
                ("ATK_SPAWN", "MID_ENTRANCE", 5),
                ("MID_ENTRANCE", "MID", 5),
                ("MID", "MID_TOP", 5),
                ("MID_TOP", "A_CHOKE", 5),
                ("A_CHOKE", "A_SITE", 6),
                
                # 좌측 경로
                ("ATK_SPAWN", "A_LOBBY", 5),
                ("A_LOBBY", "A_MAIN", 5),
                ("A_MAIN", "A_CHOKE", 5),
                
                # 수비 연결
                ("DEF_SPAWN", "A_SITE", 5),
                ("DEF_SPAWN", "MID_TOP", 5),
            ]
            
            # 추가 우회로 (2차 경로)
            secondary = [
                ("MID", "A_MAIN", 4),      # MID에서 A_MAIN으로 우회
                ("A_LOBBY", "MID_ENTRANCE", 4),  # 좌측에서 중앙으로 연결
            ]
            
        elif site_count == 3:
            # 3개 사이트
            essential = [
                ("ATK_SPAWN", "A_LOBBY", 6),
                ("ATK_SPAWN", "B_LOBBY", 6),
                ("ATK_SPAWN", "MID_ENTRANCE", 5),
                ("A_LOBBY", "A_MAIN", 5),
                ("A_MAIN", "A_CHOKE", 5),
                ("A_CHOKE", "A_SITE", 6),
                ("B_LOBBY", "B_MAIN", 5),
                ("B_MAIN", "B_CHOKE", 5),
                ("B_CHOKE", "B_SITE", 6),
                ("MID_ENTRANCE", "MID", 5),
                ("MID", "C_MAIN", 5),
                ("C_MAIN", "C_CHOKE", 5),
                ("C_CHOKE", "C_SITE", 6),
                ("MID", "MID_TOP", 5),
                ("MID_TOP", "DEF_SPAWN", 5),
            ]
            
            secondary = [
                ("MID", "A_CHOKE", 4),
                ("MID", "B_CHOKE", 4),
                ("MID_TOP", "A_SITE", 4),
                ("MID_TOP", "B_SITE", 4),
                ("MID_TOP", "C_SITE", 4),
                ("DEF_SPAWN", "A_SITE", 5),
                ("DEF_SPAWN", "B_SITE", 5),
                ("DEF_SPAWN", "C_SITE", 5),
            ]
            
        else:
            # 2개 사이트 (기본)
            essential = [
                ("ATK_SPAWN", "A_LOBBY", 6),
                ("ATK_SPAWN", "B_LOBBY", 6),
                ("ATK_SPAWN", "MID_ENTRANCE", 5),
                ("A_LOBBY", "A_MAIN", 5),
                ("A_MAIN", "A_CHOKE", 5),
                ("A_CHOKE", "A_SITE", 6),
                ("B_LOBBY", "B_MAIN", 5),
                ("B_MAIN", "B_CHOKE", 5),
                ("B_CHOKE", "B_SITE", 6),
                ("MID_ENTRANCE", "MID", 5),
                ("MID", "MID_TOP", 5),
                ("MID_TOP", "DEF_SPAWN", 5),
            ]
            
            secondary = [
                ("MID", "A_CHOKE", 4),
                ("MID", "B_CHOKE", 4),
                ("MID_TOP", "A_SITE", 4),
                ("MID_TOP", "B_SITE", 4),
                ("DEF_SPAWN", "A_SITE", 5),
                ("DEF_SPAWN", "B_SITE", 5),
            ]
        
        # 최대 직선 길이 (규칙에서 가져오기)
        max_straight = r.get('max_straight_corridor', 20)
        
        for r1, r2, w in essential + secondary:
            if r1 in rooms and r2 in rooms:
                clamped_w = max(min_w, min(max_w, w))
                cls.connect_rooms(m, rooms, r1, r2, clamped_w, max_straight=max_straight)
        
        # Side 방 연결 (플랭크 경로로 활용)
        for name in rooms:
            if "_SIDE" in name:
                prefix = name[0]
                site_name = f"{prefix}_SITE"
                main_name = f"{prefix}_MAIN"
                choke_name = f"{prefix}_CHOKE"
                lobby_name = f"{prefix}_LOBBY"
                
                # SIDE ↔ SITE 연결
                if site_name in rooms:
                    cls.connect_rooms(m, rooms, name, site_name, 5, max_straight=max_straight)
                
                # SIDE ↔ MAIN 연결 (메인 플랭크)
                if main_name in rooms:
                    cls.connect_rooms(m, rooms, main_name, name, 5, max_straight=max_straight)
                
                # SIDE ↔ CHOKE 연결 (우회 진입)
                if choke_name in rooms:
                    cls.connect_rooms(m, rooms, choke_name, name, 4, max_straight=max_straight)
                
                # MID에서 SIDE 연결 (중앙 우회)
                if "MID" in rooms:
                    cls.connect_rooms(m, rooms, "MID", name, 4, max_straight=max_straight)
    
    @classmethod
    def _add_angle_positions(cls, m, rooms, s):
        """앵글 포지션 추가 (교전 위치)"""
        # 각 사이트 주변에 앵글 포지션 추가
        for site_name in ['A_SITE', 'B_SITE']:
            if site_name not in rooms:
                continue
            
            site = rooms[site_name]
            prefix = site_name[0]
            
            # 2-3개 앵글 포지션
            num_angles = np.random.randint(2, 4)
            
            for i in range(num_angles):
                ang_w = np.random.randint(8, 14)
                ang_h = np.random.randint(8, 14)
                
                # 사이트 주변 랜덤 위치
                angle = np.random.uniform(0, 2 * np.pi)
                dist = np.random.randint(15, 30)
                
                ang_x = int(site['x'] + site['w']//2 + dist * np.cos(angle) - ang_w//2)
                ang_y = int(site['y'] + site['h']//2 + dist * np.sin(angle) - ang_h//2)
                
                ang_x = np.clip(ang_x, 5, s - ang_w - 5)
                ang_y = np.clip(ang_y, 5, s - ang_h - 5)
                
                if not cls._overlaps_existing(rooms, ang_x, ang_y, ang_w, ang_h):
                    cls.create_room(m, rooms, f"{prefix}_ANGLE_{i}", ang_x, ang_y, ang_w, ang_h, None)
                    # 사이트와 연결
                    cls.connect_rooms(m, rooms, f"{prefix}_ANGLE_{i}", site_name, 3)
    
    @classmethod
    def _add_vertical_positions(cls, m, rooms, s):
        """수직 구조 (Heaven) 추가"""
        for site_name in ['A_SITE', 'B_SITE']:
            if site_name not in rooms:
                continue
            
            site = rooms[site_name]
            prefix = site_name[0]
            
            # Heaven: 사이트 위쪽 (수비 유리)
            h_w = np.random.randint(14, 20)
            h_h = np.random.randint(10, 16)
            h_x = site['x'] + np.random.randint(0, max(1, site['w'] - h_w))
            h_y = site['y'] - h_h - np.random.randint(3, 10)
            
            if h_y > 5:
                if not cls._overlaps_existing(rooms, h_x, h_y, h_w, h_h):
                    cls.create_room(m, rooms, f"{prefix}_HEAVEN", h_x, h_y, h_w, h_h, None)
                    cls.connect_rooms(m, rooms, f"{prefix}_HEAVEN", site_name, 4)
                    cls.connect_rooms(m, rooms, f"{prefix}_HEAVEN", "DEF_SPAWN", 3)
    
    @classmethod
    def _validate_and_fix(cls, m, rooms, s):
        """검증 및 수정"""
        # 모든 주요 지점 연결 확인
        required_connections = [
            ("ATK_SPAWN", "A_SITE"),
            ("ATK_SPAWN", "B_SITE"),
            ("DEF_SPAWN", "A_SITE"),
            ("DEF_SPAWN", "B_SITE"),
        ]
        
        walkable = {Tile.FLOOR, Tile.SITE_A, Tile.SITE_B, Tile.SPAWN_ATK, Tile.SPAWN_DEF}
        
        for start_name, end_name in required_connections:
            if start_name not in rooms or end_name not in rooms:
                continue
            
            # BFS로 연결 확인
            start_room = rooms[start_name]
            end_room = rooms[end_name]
            
            start = (start_room['y'] + start_room['h']//2, start_room['x'] + start_room['w']//2)
            end = (end_room['y'] + end_room['h']//2, end_room['x'] + end_room['w']//2)
            
            visited = {start}
            queue = deque([start])
            found = False
            
            while queue and not found:
                cy, cx = queue.popleft()
                if abs(cy - end[0]) <= 8 and abs(cx - end[1]) <= 8:
                    found = True
                    break
                
                for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    ny, nx = cy + dy, cx + dx
                    if (ny, nx) not in visited and 0 <= ny < s and 0 <= nx < s:
                        if m[ny, nx] in walkable:
                            visited.add((ny, nx))
                            queue.append((ny, nx))
            
            # 연결 안 되면 강제 연결
            if not found:
                cls.connect_rooms(m, rooms, start_name, end_name, 5)
    
    @classmethod
    def _overlaps_existing(cls, rooms, x, y, w, h, margin=3) -> bool:
        """기존 방과 겹치는지 확인"""
        for name, room in rooms.items():
            if (x < room['x'] + room['w'] + margin and 
                x + w + margin > room['x'] and
                y < room['y'] + room['h'] + margin and 
                y + h + margin > room['y']):
                return True
        return False
