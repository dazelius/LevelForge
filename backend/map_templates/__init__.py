"""
맵 템플릿 자동 로더

새 템플릿 추가 방법:
1. map_templates 폴더에 새 파일 생성 (예: ascent.py)
2. MapTemplate을 상속받아 구현
3. 자동으로 로드됨!

예시:
```python
from .base import MapTemplate, Tile

class AscentTemplate(MapTemplate):
    name = "Ascent"
    game = "Valorant"
    size = 150
    
    @classmethod
    def generate(cls, seed=None):
        # 맵 생성 로직
        ...
```
"""

import os
import importlib
import inspect
from typing import List, Type, Dict
from .base import MapTemplate, Tile, TILE_COLORS


def get_all_templates() -> List[Type[MapTemplate]]:
    """
    map_templates 폴더의 모든 템플릿을 자동으로 로드
    
    Returns:
        List of MapTemplate subclasses
    """
    templates = []
    current_dir = os.path.dirname(__file__)
    
    # .py 파일들 스캔
    for filename in os.listdir(current_dir):
        if filename.endswith('.py') and not filename.startswith('_'):
            module_name = filename[:-3]  # .py 제거
            
            try:
                module = importlib.import_module(f'.{module_name}', package='map_templates')
                
                # 모듈에서 MapTemplate 서브클래스 찾기
                for name, obj in inspect.getmembers(module):
                    if (inspect.isclass(obj) and 
                        issubclass(obj, MapTemplate) and 
                        obj is not MapTemplate and
                        hasattr(obj, 'name') and 
                        obj.name != "Base"):
                        templates.append(obj)
            except Exception as e:
                print(f"Warning: Failed to load {filename}: {e}")
    
    return templates


def get_template_by_name(name: str) -> Type[MapTemplate]:
    """
    이름으로 템플릿 찾기
    
    Args:
        name: 템플릿 이름 (예: "Dust2", "Breeze")
    
    Returns:
        MapTemplate class or None
    """
    for template in get_all_templates():
        if template.name.lower() == name.lower():
            return template
    return None


def list_templates() -> Dict[str, str]:
    """
    모든 템플릿 목록 출력
    
    Returns:
        Dict of {name: game}
    """
    result = {}
    for template in get_all_templates():
        result[template.name] = template.game
    return result


# 편의를 위해 내보내기
__all__ = [
    'MapTemplate',
    'Tile', 
    'TILE_COLORS',
    'get_all_templates',
    'get_template_by_name',
    'list_templates',
]
