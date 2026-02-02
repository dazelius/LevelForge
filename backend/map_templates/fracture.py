"""
프랙처 (Fracture) - Valorant
H자 구조, 공격팀이 양쪽에서 시작
수비가 가운데서 방어
"""

import numpy as np
from typing import Tuple, Dict
from .base import MapTemplate, Tile


class FractureTemplate(MapTemplate):
    name = "Fracture"
    game = "Valorant"
    size = 150
    
    @classmethod
    def generate(cls, seed=None) -> Tuple[np.ndarray, Dict]:
        if seed is not None:
            np.random.seed(seed)
        
        s = cls.size
        m = np.full((s, s), Tile.VOID, dtype=np.int32)
        rooms = {}
        
        # === Attack Spawn (양쪽! - Fracture 특징) ===
        cls.create_room(m, rooms, "ATK_SPAWN", s//2 - 15, s - 25, 30, 18, Tile.SPAWN_ATK)
        cls.create_room(m, rooms, "ATK_SPAWN_2", s//2 - 15, 8, 30, 18, Tile.SPAWN_ATK)  # 위쪽도
        
        # === Defender Spawn (중앙) ===
        cls.create_room(m, rooms, "DEF_SPAWN", s//2 - 12, s//2 - 10, 24, 20, Tile.SPAWN_DEF)
        
        # === A Site (좌측) ===
        cls.create_room(m, rooms, "A_SITE", 12, s//2 - 15, 28, 30, Tile.SITE_A)
        cls.create_room(m, rooms, "A_MAIN", 15, s - 45, 18, 25, None)
        cls.create_room(m, rooms, "A_DOOR", 35, s//2, 15, 18, None)
        cls.create_room(m, rooms, "A_HALL", 8, 30, 15, 25, None)
        cls.create_room(m, rooms, "A_DROP", 25, 25, 12, 15, None)
        cls.create_room(m, rooms, "A_ROPE", 10, s//2 + 20, 12, 18, None)
        cls.create_room(m, rooms, "A_DISH", 20, 15, 15, 12, None)
        
        # === B Site (우측) ===
        cls.create_room(m, rooms, "B_SITE", s - 40, s//2 - 15, 28, 30, Tile.SITE_B)
        cls.create_room(m, rooms, "B_MAIN", s - 35, s - 45, 18, 25, None)
        cls.create_room(m, rooms, "B_ARCADE", s - 45, s//2 + 5, 18, 18, None)
        cls.create_room(m, rooms, "B_TOWER", s - 30, 30, 15, 20, None)
        cls.create_room(m, rooms, "B_TREE", s - 25, s//2 - 5, 12, 15, None)
        cls.create_room(m, rooms, "B_CANTEEN", s - 40, 20, 18, 15, None)
        cls.create_room(m, rooms, "B_LINK", s - 35, 15, 15, 12, None)
        
        # === 중앙 연결 (H자 구조) ===
        cls.create_room(m, rooms, "BRIDGE", s//2 - 10, s//2 - 5, 20, 10, None)
        cls.create_room(m, rooms, "TUNNEL", s//2 - 8, 25, 16, 15, None)
        cls.create_room(m, rooms, "UNDER", s//2 - 8, s - 40, 16, 15, None)
        
        connections = [
            # 하단 공격 스폰
            ("ATK_SPAWN", "A_MAIN", 4),
            ("ATK_SPAWN", "UNDER", 4),
            ("ATK_SPAWN", "B_MAIN", 4),
            
            # 상단 공격 스폰
            ("ATK_SPAWN_2", "A_DISH", 4),
            ("ATK_SPAWN_2", "TUNNEL", 4),
            ("ATK_SPAWN_2", "B_LINK", 4),
            
            # A 사이트
            ("A_MAIN", "A_ROPE", 4),
            ("A_ROPE", "A_SITE", 4),
            ("A_HALL", "A_DROP", 3),
            ("A_DROP", "A_SITE", 4),
            ("A_DISH", "A_HALL", 4),
            ("A_DOOR", "A_SITE", 4),
            ("DEF_SPAWN", "A_DOOR", 4),
            
            # B 사이트
            ("B_MAIN", "B_ARCADE", 4),
            ("B_ARCADE", "B_SITE", 4),
            ("B_TOWER", "B_SITE", 4),
            ("B_TREE", "B_SITE", 3),
            ("B_CANTEEN", "B_TOWER", 4),
            ("B_LINK", "B_CANTEEN", 4),
            ("DEF_SPAWN", "B_ARCADE", 4),
            
            # 중앙 연결
            ("DEF_SPAWN", "BRIDGE", 4),
            ("BRIDGE", "A_DOOR", 3),
            ("BRIDGE", "B_TREE", 3),
            ("TUNNEL", "A_DROP", 3),
            ("TUNNEL", "B_CANTEEN", 3),
            ("UNDER", "A_ROPE", 3),
            ("UNDER", "B_ARCADE", 3),
        ]
        
        for r1, r2, w in connections:
            cls.connect_rooms(m, rooms, r1, r2, w)
        
        cls.add_random_covers(m, rooms)
        cls.generate_walls(m)
        
        return m, rooms
