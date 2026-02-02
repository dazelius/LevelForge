"""
누크 (Nuke) - Counter-Strike
수직 구조 (위/아래 사이트)
실내 맵, 좁은 통로 많음
"""

import numpy as np
from typing import Tuple, Dict
from .base import MapTemplate, Tile


class NukeTemplate(MapTemplate):
    name = "Nuke"
    game = "Counter-Strike"
    size = 150
    
    @classmethod
    def generate(cls, seed=None) -> Tuple[np.ndarray, Dict]:
        if seed is not None:
            np.random.seed(seed)
        
        s = cls.size
        m = np.full((s, s), Tile.VOID, dtype=np.int32)
        rooms = {}
        
        # === T Spawn (하단) ===
        cls.create_room(m, rooms, "T_SPAWN", s//2 - 15, s - 30, 30, 22, Tile.SPAWN_ATK)
        
        # === CT Spawn (상단) ===
        cls.create_room(m, rooms, "CT_SPAWN", s//2 - 12, 5, 24, 16, Tile.SPAWN_DEF)
        
        # === A Site (상단 - Outside) ===
        cls.create_room(m, rooms, "A_SITE", s//2 - 18, 25, 36, 30, Tile.SITE_A)
        cls.create_room(m, rooms, "LOBBY", s//2 - 10, s//2, 20, 20, None)
        cls.create_room(m, rooms, "HUTS", s//2 - 25, 35, 15, 18, None)
        cls.create_room(m, rooms, "MAIN", s//2 + 10, 40, 18, 20, None)
        cls.create_room(m, rooms, "SQUEAKY", s//2 - 20, 50, 12, 15, None)
        cls.create_room(m, rooms, "HEAVEN", s//2 - 8, 18, 16, 12, None)
        cls.create_room(m, rooms, "HELL", s//2 + 5, 20, 12, 12, None)
        
        # === B Site (하단 - Ramp) ===
        cls.create_room(m, rooms, "B_SITE", 15, s//2, 30, 28, Tile.SITE_B)
        cls.create_room(m, rooms, "RAMP", 35, s//2 + 25, 18, 30, None)
        cls.create_room(m, rooms, "SECRET", 10, s//2 - 20, 15, 20, None)
        cls.create_room(m, rooms, "VENTS", s//2 - 8, s//2 + 10, 12, 18, None)
        cls.create_room(m, rooms, "DECON", 40, s//2 - 5, 15, 18, None)
        cls.create_room(m, rooms, "CONTROL", 20, s//2 + 25, 15, 15, None)
        
        # === Outside ===
        cls.create_room(m, rooms, "OUTSIDE", s - 40, s//2 - 10, 25, 35, None)
        cls.create_room(m, rooms, "SILO", s - 35, 25, 18, 18, None)
        cls.create_room(m, rooms, "GARAGE", s - 30, s//2 + 20, 18, 20, None)
        cls.create_room(m, rooms, "T_ROOF", s - 25, s - 45, 15, 18, None)
        
        # 연결
        connections = [
            # T 스폰
            ("T_SPAWN", "LOBBY", 5),
            ("T_SPAWN", "T_ROOF", 4),
            ("T_SPAWN", "RAMP", 4),
            
            # A 사이트
            ("LOBBY", "SQUEAKY", 4),
            ("LOBBY", "MAIN", 4),
            ("SQUEAKY", "HUTS", 3),
            ("HUTS", "A_SITE", 5),
            ("MAIN", "A_SITE", 5),
            ("CT_SPAWN", "HEAVEN", 4),
            ("HEAVEN", "A_SITE", 4),
            ("HELL", "A_SITE", 3),
            
            # Outside
            ("T_ROOF", "OUTSIDE", 4),
            ("OUTSIDE", "SILO", 4),
            ("SILO", "A_SITE", 4),
            ("OUTSIDE", "GARAGE", 4),
            
            # B 사이트
            ("RAMP", "CONTROL", 4),
            ("CONTROL", "B_SITE", 5),
            ("LOBBY", "VENTS", 3),
            ("VENTS", "B_SITE", 4),
            ("SECRET", "B_SITE", 4),
            ("DECON", "B_SITE", 4),
            ("CT_SPAWN", "SECRET", 4),
            
            # 로테이션
            ("HEAVEN", "HELL", 3),
            ("GARAGE", "RAMP", 3),
        ]
        
        for r1, r2, w in connections:
            cls.connect_rooms(m, rooms, r1, r2, w)
        
        cls.add_random_covers(m, rooms)
        cls.generate_walls(m)
        
        return m, rooms
