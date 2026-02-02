"""
더스트2 (Dust2) - Counter-Strike
클래식 맵, Long A와 B Tunnels가 특징
"""

import numpy as np
from typing import Tuple, Dict
from .base import MapTemplate, Tile


class Dust2Template(MapTemplate):
    name = "Dust2"
    game = "Counter-Strike"
    size = 150
    
    @classmethod
    def generate(cls, seed=None) -> Tuple[np.ndarray, Dict]:
        if seed is not None:
            np.random.seed(seed)
        
        s = cls.size
        m = np.full((s, s), Tile.VOID, dtype=np.int32)
        rooms = {}
        
        # === T Spawn (하단 중앙) ===
        cls.create_room(m, rooms, "T_SPAWN", s//2 - 15, s - 28, 30, 22, Tile.SPAWN_ATK)
        
        # === CT Spawn (상단 중앙) ===
        cls.create_room(m, rooms, "CT_SPAWN", s//2 - 12, 8, 24, 18, Tile.SPAWN_DEF)
        
        # === A Site (우측 상단) ===
        cls.create_room(m, rooms, "A_SITE", s - 38, 15, 30, 30, Tile.SITE_A)
        cls.create_room(m, rooms, "A_RAMP", s - 30, 45, 15, 20, None)
        cls.create_room(m, rooms, "A_PLAT", s - 35, 8, 20, 12, None)
        
        # === Long A ===
        cls.create_room(m, rooms, "LONG_A", s - 25, s//2 - 5, 18, 50, None)
        cls.create_room(m, rooms, "PIT", s - 20, s//2 + 35, 12, 15, None)
        cls.create_room(m, rooms, "LONG_DOORS", s - 30, s//2 + 10, 12, 20, None)
        cls.create_room(m, rooms, "BLUE", s - 35, s//2 + 5, 10, 15, None)
        
        # === B Site (좌측 상단) ===
        cls.create_room(m, rooms, "B_SITE", 8, 12, 28, 28, Tile.SITE_B)
        cls.create_room(m, rooms, "B_PLAT", 8, 8, 18, 10, None)
        cls.create_room(m, rooms, "B_DOORS", 30, 25, 12, 18, None)
        
        # === B Tunnels ===
        cls.create_room(m, rooms, "UPPER_B", 15, s//2 - 15, 15, 30, None)
        cls.create_room(m, rooms, "LOWER_B", 8, s//2 + 10, 12, 25, None)
        cls.create_room(m, rooms, "B_TUNNEL_ENT", 5, s - 50, 15, 20, None)
        
        # === Mid ===
        cls.create_room(m, rooms, "MID", s//2 - 12, s//2 - 25, 24, 50, None)
        cls.create_room(m, rooms, "TOP_MID", s//2 - 8, s//2 - 10, 16, 20, None)
        cls.create_room(m, rooms, "CT_MID", s//2 - 10, 28, 20, 20, None)
        cls.create_room(m, rooms, "XBOX", s//2 - 5, s//2 + 5, 10, 12, None)
        
        # === Catwalk (Short A) ===
        cls.create_room(m, rooms, "CATWALK", s//2 + 10, s//2 - 20, 12, 35, None)
        cls.create_room(m, rooms, "SHORT_A", s//2 + 15, 30, 15, 20, None)
        
        # === Suicide ===
        cls.create_room(m, rooms, "SUICIDE", s//2 - 8, s - 55, 16, 25, None)
        
        # 연결
        connections = [
            ("T_SPAWN", "SUICIDE", 5),
            ("T_SPAWN", "B_TUNNEL_ENT", 5),
            ("T_SPAWN", "LONG_DOORS", 5),
            ("SUICIDE", "MID", 4),
            ("MID", "TOP_MID", 5),
            ("TOP_MID", "CT_MID", 4),
            ("CT_MID", "CT_SPAWN", 4),
            ("MID", "XBOX", 4),
            ("XBOX", "CATWALK", 3),
            ("CATWALK", "SHORT_A", 4),
            ("SHORT_A", "A_SITE", 5),
            ("LONG_DOORS", "LONG_A", 5),
            ("LONG_A", "PIT", 4),
            ("PIT", "A_SITE", 5),
            ("A_RAMP", "A_SITE", 4),
            ("CT_SPAWN", "A_PLAT", 4),
            ("A_PLAT", "A_SITE", 4),
            ("B_TUNNEL_ENT", "LOWER_B", 4),
            ("LOWER_B", "UPPER_B", 4),
            ("UPPER_B", "B_DOORS", 4),
            ("B_DOORS", "B_SITE", 5),
            ("CT_SPAWN", "B_DOORS", 4),
            ("CT_MID", "B_DOORS", 3),
        ]
        
        for r1, r2, w in connections:
            cls.connect_rooms(m, rooms, r1, r2, w)
        
        cls.add_random_covers(m, rooms)
        cls.generate_walls(m)
        
        return m, rooms
