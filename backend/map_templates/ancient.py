"""
에인션트 (Ancient) - Counter-Strike
사원 테마, Mid가 중요
도넛 구조
"""

import numpy as np
from typing import Tuple, Dict
from .base import MapTemplate, Tile


class AncientTemplate(MapTemplate):
    name = "Ancient"
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
        cls.create_room(m, rooms, "T_SPAWN", s//2 - 15, s - 28, 30, 20, Tile.SPAWN_ATK)
        
        # === CT Spawn (상단) ===
        cls.create_room(m, rooms, "CT_SPAWN", s//2 - 12, 8, 24, 16, Tile.SPAWN_DEF)
        
        # === A Site (우측) ===
        cls.create_room(m, rooms, "A_SITE", s - 42, 20, 30, 28, Tile.SITE_A)
        cls.create_room(m, rooms, "A_MAIN", s - 35, s//2 + 5, 20, 28, None)
        cls.create_room(m, rooms, "A_ALLEY", s - 40, s - 45, 22, 18, None)
        cls.create_room(m, rooms, "A_RAMP", s - 45, 40, 18, 18, None)
        cls.create_room(m, rooms, "DONUT", s - 30, 35, 15, 15, None)
        cls.create_room(m, rooms, "CT_A", s - 25, 15, 12, 12, None)
        cls.create_room(m, rooms, "ELBOW", s - 48, s//2, 15, 18, None)
        
        # === B Site (좌측) ===
        cls.create_room(m, rooms, "B_SITE", 15, 20, 28, 28, Tile.SITE_B)
        cls.create_room(m, rooms, "B_MAIN", 12, s//2, 18, 30, None)
        cls.create_room(m, rooms, "B_RAMP", 8, s - 45, 20, 18, None)
        cls.create_room(m, rooms, "CAVE", 35, 35, 15, 18, None)
        cls.create_room(m, rooms, "CT_B", 25, 12, 15, 12, None)
        cls.create_room(m, rooms, "WATER", 10, 45, 12, 15, None)
        cls.create_room(m, rooms, "TUNNEL", 30, s//2 + 10, 12, 18, None)
        
        # === Mid ===
        cls.create_room(m, rooms, "MID", s//2 - 12, s//2 - 15, 24, 35, None)
        cls.create_room(m, rooms, "MID_TEMPLE", s//2 - 8, 28, 16, 18, None)
        cls.create_room(m, rooms, "MID_HOUSE", s//2 + 8, s//2 + 5, 15, 15, None)
        cls.create_room(m, rooms, "JAGUAR", s//2 - 15, s - 48, 20, 18, None)
        
        connections = [
            ("T_SPAWN", "B_RAMP", 4),
            ("T_SPAWN", "JAGUAR", 5),
            ("T_SPAWN", "A_ALLEY", 4),
            ("B_RAMP", "B_MAIN", 4),
            ("B_MAIN", "WATER", 4),
            ("WATER", "B_SITE", 4),
            ("B_MAIN", "TUNNEL", 3),
            ("TUNNEL", "CAVE", 3),
            ("CAVE", "B_SITE", 4),
            ("CT_SPAWN", "CT_B", 4),
            ("CT_B", "B_SITE", 4),
            ("JAGUAR", "MID", 4),
            ("MID", "MID_TEMPLE", 4),
            ("MID_TEMPLE", "CAVE", 3),
            ("MID", "MID_HOUSE", 4),
            ("MID_HOUSE", "ELBOW", 3),
            ("A_ALLEY", "A_MAIN", 4),
            ("A_MAIN", "A_RAMP", 4),
            ("A_RAMP", "DONUT", 4),
            ("DONUT", "A_SITE", 5),
            ("ELBOW", "A_RAMP", 4),
            ("CT_SPAWN", "CT_A", 4),
            ("CT_A", "A_SITE", 4),
        ]
        
        for r1, r2, w in connections:
            cls.connect_rooms(m, rooms, r1, r2, w)
        
        cls.add_random_covers(m, rooms)
        cls.generate_walls(m)
        
        return m, rooms
