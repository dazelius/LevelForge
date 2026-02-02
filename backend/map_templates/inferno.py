"""
인페르노 (Inferno) - Counter-Strike
Banana, Apps, 좁은 통로가 특징
"""

import numpy as np
from typing import Tuple, Dict
from .base import MapTemplate, Tile


class InfernoTemplate(MapTemplate):
    name = "Inferno"
    game = "Counter-Strike"
    size = 150
    
    @classmethod
    def generate(cls, seed=None) -> Tuple[np.ndarray, Dict]:
        if seed is not None:
            np.random.seed(seed)
        
        s = cls.size
        m = np.full((s, s), Tile.VOID, dtype=np.int32)
        rooms = {}
        
        # T Spawn (좌측 하단)
        cls.create_room(m, rooms, "T_SPAWN", 10, s - 28, 25, 20, Tile.SPAWN_ATK)
        
        # CT Spawn
        cls.create_room(m, rooms, "CT_SPAWN", s//2 - 10, 5, 20, 15, Tile.SPAWN_DEF)
        
        # A Site (상단 우측)
        cls.create_room(m, rooms, "A_SITE", s - 38, 15, 30, 28, Tile.SITE_A)
        cls.create_room(m, rooms, "APPS", s - 30, 45, 18, 25, None)
        cls.create_room(m, rooms, "BALCONY", s - 25, 35, 12, 15, None)
        cls.create_room(m, rooms, "PIT", s - 20, 10, 15, 12, None)
        cls.create_room(m, rooms, "LIBRARY", s - 40, 8, 15, 12, None)
        cls.create_room(m, rooms, "ARCH", s - 45, 30, 15, 20, None)
        
        # B Site (상단 좌측)
        cls.create_room(m, rooms, "B_SITE", 8, 10, 28, 28, Tile.SITE_B)
        cls.create_room(m, rooms, "BANANA", 15, 40, 12, 45, None)
        cls.create_room(m, rooms, "CAR", 25, 35, 12, 15, None)
        cls.create_room(m, rooms, "COFFIN", 10, 35, 10, 12, None)
        cls.create_room(m, rooms, "SPOOLS", 8, 25, 12, 12, None)
        cls.create_room(m, rooms, "CT_B", 35, 15, 15, 18, None)
        
        # Mid
        cls.create_room(m, rooms, "MID", s//2 - 8, s//2 - 10, 16, 30, None)
        cls.create_room(m, rooms, "TOP_MID", s//2 - 6, 30, 12, 15, None)
        cls.create_room(m, rooms, "ALT_MID", s//2 + 8, s//2, 12, 18, None)
        
        # T 영역
        cls.create_room(m, rooms, "T_RAMP", 30, s - 45, 15, 20, None)
        cls.create_room(m, rooms, "SECOND_MID", s//2 - 10, s - 50, 20, 18, None)
        cls.create_room(m, rooms, "MEXICO", 8, s//2 + 20, 15, 20, None)
        
        connections = [
            ("T_SPAWN", "T_RAMP", 5),
            ("T_SPAWN", "MEXICO", 4),
            ("T_RAMP", "SECOND_MID", 4),
            ("SECOND_MID", "MID", 4),
            ("MID", "TOP_MID", 4),
            ("TOP_MID", "ARCH", 4),
            ("ARCH", "A_SITE", 5),
            ("APPS", "A_SITE", 5),
            ("BALCONY", "A_SITE", 4),
            ("PIT", "A_SITE", 4),
            ("CT_SPAWN", "LIBRARY", 4),
            ("LIBRARY", "A_SITE", 4),
            ("MID", "ALT_MID", 3),
            ("ALT_MID", "APPS", 3),
            ("MEXICO", "BANANA", 4),
            ("BANANA", "CAR", 4),
            ("CAR", "B_SITE", 5),
            ("COFFIN", "B_SITE", 4),
            ("CT_SPAWN", "CT_B", 4),
            ("CT_B", "B_SITE", 5),
        ]
        
        for r1, r2, w in connections:
            cls.connect_rooms(m, rooms, r1, r2, w)
        
        cls.add_random_covers(m, rooms)
        cls.generate_walls(m)
        
        return m, rooms
