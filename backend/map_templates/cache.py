"""
캐시 (Cache) - Counter-Strike
균형 잡힌 3레인, 클래식 구조
Mid가 핵심
"""

import numpy as np
from typing import Tuple, Dict
from .base import MapTemplate, Tile


class CacheTemplate(MapTemplate):
    name = "Cache"
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
        
        # === A Site (좌측) ===
        cls.create_room(m, rooms, "A_SITE", 15, 15, 30, 28, Tile.SITE_A)
        cls.create_room(m, rooms, "A_MAIN", 12, s//2, 18, 30, None)
        cls.create_room(m, rooms, "SQUEAKY", 8, s - 45, 15, 18, None)
        cls.create_room(m, rooms, "TRUCK", 35, 25, 12, 15, None)
        cls.create_room(m, rooms, "QUAD", 10, 35, 15, 15, None)
        cls.create_room(m, rooms, "HIGHWAY", s//2 - 15, 25, 18, 15, None)
        cls.create_room(m, rooms, "FORKLIFT", 25, 40, 12, 12, None)
        cls.create_room(m, rooms, "NBK", 40, 15, 12, 12, None)
        
        # === B Site (우측) ===
        cls.create_room(m, rooms, "B_SITE", s - 45, 15, 30, 28, Tile.SITE_B)
        cls.create_room(m, rooms, "B_MAIN", s - 35, s//2 + 5, 20, 30, None)
        cls.create_room(m, rooms, "B_HALLS", s - 40, s - 45, 22, 18, None)
        cls.create_room(m, rooms, "CHECKERS", s - 30, 35, 15, 18, None)
        cls.create_room(m, rooms, "HEADSHOT", s - 25, 20, 12, 15, None)
        cls.create_room(m, rooms, "SUNROOM", s - 40, 40, 15, 15, None)
        cls.create_room(m, rooms, "HEAVEN", s - 35, 10, 15, 12, None)
        
        # === Mid ===
        cls.create_room(m, rooms, "MID", s//2 - 10, s//2 - 10, 20, 30, None)
        cls.create_room(m, rooms, "GARAGE", s//2 - 5, s - 48, 18, 18, None)
        cls.create_room(m, rooms, "BOOST", s//2 + 5, s//2, 12, 12, None)
        cls.create_room(m, rooms, "VENT", s//2 + 10, 35, 12, 15, None)
        cls.create_room(m, rooms, "WHITE_BOX", s//2 - 8, 30, 15, 12, None)
        
        connections = [
            ("T_SPAWN", "SQUEAKY", 4),
            ("T_SPAWN", "GARAGE", 5),
            ("T_SPAWN", "B_HALLS", 4),
            ("SQUEAKY", "A_MAIN", 4),
            ("A_MAIN", "QUAD", 4),
            ("A_MAIN", "FORKLIFT", 3),
            ("FORKLIFT", "A_SITE", 4),
            ("QUAD", "A_SITE", 5),
            ("TRUCK", "A_SITE", 4),
            ("CT_SPAWN", "HIGHWAY", 4),
            ("HIGHWAY", "A_SITE", 4),
            ("NBK", "A_SITE", 3),
            ("GARAGE", "MID", 4),
            ("MID", "BOOST", 3),
            ("BOOST", "VENT", 3),
            ("MID", "WHITE_BOX", 4),
            ("WHITE_BOX", "HIGHWAY", 3),
            ("VENT", "CHECKERS", 3),
            ("B_HALLS", "SUNROOM", 4),
            ("SUNROOM", "B_MAIN", 4),
            ("B_MAIN", "CHECKERS", 4),
            ("CHECKERS", "B_SITE", 5),
            ("HEADSHOT", "B_SITE", 4),
            ("CT_SPAWN", "HEAVEN", 4),
            ("HEAVEN", "B_SITE", 4),
        ]
        
        for r1, r2, w in connections:
            cls.connect_rooms(m, rooms, r1, r2, w)
        
        cls.add_random_covers(m, rooms)
        cls.generate_walls(m)
        
        return m, rooms
