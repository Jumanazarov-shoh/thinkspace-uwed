"""
Pydantic v1 and v2 compatibility layer.
Ensures schemas run seamlessly on both Pydantic v1 (pure Python) and Pydantic v2 environments.
"""
from typing import Any
import pydantic

class CompatBaseModel(pydantic.BaseModel):
    class Config:
        orm_mode = True
        from_attributes = True

    @classmethod
    def model_validate(cls, obj: Any):
        if hasattr(super(CompatBaseModel, cls), "model_validate"):
            return getattr(super(CompatBaseModel, cls), "model_validate")(obj)
        return cls.from_orm(obj)

    def model_dump(self, *args, **kwargs):
        if hasattr(super(), "model_dump"):
            return getattr(super(), "model_dump")(*args, **kwargs)
        return self.dict(*args, **kwargs)
