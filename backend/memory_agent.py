import os
import uuid
import datetime
from typing import List, Optional, Dict, Any

import chromadb


class MemoryAgent:
    """Persistent long-term memory backed by local ChromaDB."""

    def __init__(self, persist_dir: str, collection_name: str = "ada_long_term_memory"):
        self._persist_dir = os.path.abspath(persist_dir)
        os.makedirs(self._persist_dir, exist_ok=True)

        self._client = chromadb.PersistentClient(path=self._persist_dir)
        self._collection = self._client.get_or_create_collection(name=collection_name)

    def store(self, text: str, sender: str = "User", project: str = "default") -> str:
        payload = str(text or "").strip()
        if not payload:
            raise ValueError("text must not be empty")

        item_id = str(uuid.uuid4())
        metadata = {
            "sender": str(sender or "unknown"),
            "project": str(project or "default"),
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }

        self._collection.add(
            ids=[item_id],
            documents=[payload],
            metadatas=[metadata],
        )
        return item_id

    def retrieve(self, query: str, n_results: int = 5, project: Optional[str] = None) -> List[Dict[str, Any]]:
        q = str(query or "").strip()
        if not q:
            return []

        k = max(1, min(int(n_results or 5), 20))

        kwargs = {
            "query_texts": [q],
            "n_results": k,
            "include": ["documents", "metadatas", "distances"],
        }
        if project:
            kwargs["where"] = {"project": str(project)}

        result = self._collection.query(**kwargs)

        docs = (result.get("documents") or [[]])[0]
        metas = (result.get("metadatas") or [[]])[0]
        distances = (result.get("distances") or [[]])[0]

        items = []
        for idx, text in enumerate(docs):
            meta = metas[idx] if idx < len(metas) and isinstance(metas[idx], dict) else {}
            distance = distances[idx] if idx < len(distances) else None
            items.append(
                {
                    "text": text,
                    "metadata": meta,
                    "distance": distance,
                }
            )

        return items

    def count(self) -> int:
        return int(self._collection.count())

    def get_recent(self, n: int = 12, project: Optional[str] = None) -> List[Dict[str, Any]]:
        limit = max(1, min(int(n or 12), 100))

        kwargs = {
            "include": ["documents", "metadatas"],
            "limit": limit,
        }
        if project:
            kwargs["where"] = {"project": str(project)}

        result = self._collection.get(**kwargs)

        docs = result.get("documents") or []
        metas = result.get("metadatas") or []

        items = []
        for idx, text in enumerate(docs):
            meta = metas[idx] if idx < len(metas) and isinstance(metas[idx], dict) else {}
            items.append(
                {
                    "text": str(text or ""),
                    "metadata": meta,
                }
            )

        # Chroma get() order is insertion order by id, so reverse for newest-first display.
        items.reverse()
        return items
