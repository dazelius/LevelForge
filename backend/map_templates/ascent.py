"""
어센트 (Ascent) - Valorant
중앙 Mid가 핵심, 문(Door) 메카닉이 특징
A/B 사이트 모두 접근성 좋음
"""

import numpy as np
from typing import Tuple, Dict
from .base import MapTemplate, Tile


class AscentTemplate(MapTemplate):
    name = "Ascent"
    game = "Valorant"
    size = 150
    
    @classmethod
    def generate(cls, seed=None) -> Tuple[np.ndarray, Dict]:
        if seed is not None:
            np.random.seed(seed)
        
        s = cls.size
        m = np.full((s, s), Tile.VOID, dtype=np.int32)
        rooms = {}
        
        # === Attack Spawn (우측) ===
        cls.create_room(m, rooms, "ATK_SPAWN", s - 30, s//2 - 10, 22, 20, Tile.SPAWN_ATK)
        
        # === Defender Spawn (좌측) ===
        cls.create_room(m, rooms, "DEF_SPAWN", 8, s//2 - 12, 20, 24, Tile.SPAWN_DEF)
        
        # === A Site (상단 좌측) ===
        cls.create_room(m, rooms, "A_SITE", 25, 12, 30, 28, Tile.SITE_A)
        cls.create_room(m, rooms, "A_MAIN", s - 45, 15, 20, 22, None)
        cls.create_room(m, rooms, "SCAFFOLDING", 20, 8, 12, 15, None)
        cls.create_room(m, rooms, "TREE", 50, 25, 12, 15, None)
        cls.create_room(m, rooms, "BALCONY", 35, 35, 15, 12, None)
        cls.create_room(m, rooms, "GARDEN", 15, 40, 18, 18, None)
        
        # === B Site (하단 좌측) ===
        cls.create_room(m, rooms, "B_SITE", 20, s - 45, 28, 28, Tile.SITE_B)
        cls.create_room(m, rooms, "B_MAIN", s//2 - 5, s - 40, 18, 22, None)
        cls.create_room(m, rooms, "SWITCH", 15, s - 60, 15, 15, None)
        cls.create_room(m, rooms, "BOATHOUSE", 18, s - 25, 18, 15, None)
        cls.create_room(m, rooms, "SHOP", s//2 + 15, s - 50, 18, 18, None)
        
        # === Mid (중앙 - Ascent 핵심) ===
        cls.create_room(m, rooms, "MID", s//2 - 12, s//2 - 20, 24, 40, None)
        cls.create_room(m, rooms, "CATWALK", s//2 - 8, 35, 16, 20, None)
        cls.create_room(m, rooms, "WELL", s//2 + 5, s//2, 12, 12, None)
        cls.create_room(m, rooms, "BELL_TOWER", s//2 - 5, s//2 + 15, 15, 15, None)
        
        # === 기타 영역 ===
        cls.create_room(m, rooms, "LION", s - 40, 35, 15, 15, None)
        cls.create_room(m, rooms, "BOOKS", s//2 + 20, 40, 12, 15, None)
        cls.create_room(m, rooms, "FOUNTAIN", s - 35, s//2 + 5, 18, 15, None)
        cls.create_room(m, rooms, "COURTYARD", 30, s//2 - 5, 18, 18, None)
        cls.create_room(m, rooms, "BENCH", s//2 - 15, s//2 - 8, 12, 12, None)
        cls.create_room(m, rooms, "GELATO", 35, s//2 - 12, 12, 12, None)
        cls.create_room(m, rooms, "BOILER", s//2 + 5, 45, 12, 12, None)
        cls.create_room(m, rooms, "ANCHOR", 5, s//2 - 5, 12, 25, None)
        
        # 연결
        connections = [
            # 공격 스폰에서
            ("ATK_SPAWN", "FOUNTAIN", 5),
            ("ATK_SPAWN", "A_MAIN", 5),
            ("ATK_SPAWN", "SHOP", 5),
            ("FOUNTAIN", "MID", 4),
            ("FOUNTAIN", "LION", 4),
            
            # A 사이트로
            ("A_MAIN", "LION", 4),
            ("A_MAIN", "TREE", 4),
            ("TREE", "A_SITE", 5),
            ("LION", "BOOKS", 3),
            ("BOOKS", "CATWALK", 3),
            ("CATWALK", "A_SITE", 4),
            ("SCAFFOLDING", "A_SITE", 4),
            ("BALCONY", "A_SITE", 4),
            ("GARDEN", "A_SITE", 4),
            ("DEF_SPAWN", "GARDEN", 4),
            
            # Mid
            ("MID", "CATWALK", 4),
            ("MID", "WELL", 4),
            ("MID", "BELL_TOWER", 4),
            ("WELL", "COURTYARD", 3),
            ("COURTYARD", "BENCH", 3),
            ("BENCH", "GELATO", 3),
            ("BOILER", "CATWALK", 3),
            
            # B 사이트로
            ("SHOP", "B_MAIN", 4),
            ("B_MAIN", "B_SITE", 5),
            ("BELL_TOWER", "B_MAIN", 4),
            ("SWITCH", "B_SITE", 4),
            ("BOATHOUSE", "B_SITE", 4),
            ("DEF_SPAWN", "ANCHOR", 4),
            ("ANCHOR", "B_SITE", 4),
            ("DEF_SPAWN", "COURTYARD", 4),
            ("COURTYARD", "SWITCH", 3),
        ]
        
        for r1, r2, w in connections:
            cls.connect_rooms(m, rooms, r1, r2, w)
        
        cls.add_random_covers(m, rooms)
        cls.generate_walls(m)
        
        return m, rooms
