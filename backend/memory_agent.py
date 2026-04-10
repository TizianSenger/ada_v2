import os
import uuid
import datetime
import hashlib
from typing import List, Optional, Dict, Any

import chromadb


class MemoryAgent:
    """Persistent long-term memory backed by local ChromaDB."""

    def __init__(self, persist_dir: str, collection_name: str = "ada_long_term_memory"):
        self._persist_dir = os.path.abspath(persist_dir)
        os.makedirs(self._persist_dir, exist_ok=True)

        self._client = chromadb.PersistentClient(path=self._persist_dir)
        self._collection_name = str(collection_name)
        self._collection = self._client.get_or_create_collection(name=self._collection_name)

    def store(
        self,
        text: str,
        sender: str = "User",
        project: str = "default",
        wing: Optional[str] = None,
        room: str = "general",
        memory_type: str = "note",
        confidence: float = 0.7,
    ) -> str:
        payload = str(text or "").strip()
        if not payload:
            raise ValueError("text must not be empty")

        item_id = str(uuid.uuid4())
        metadata = {
            "sender": str(sender or "unknown"),
            "project": str(project or "default"),
            "wing": str(wing or "general"),
            "room": str(room or "general"),
            "memory_type": str(memory_type or "note"),
            "confidence": float(max(0.0, min(float(confidence), 1.0))),
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }

        self._collection.add(
            ids=[item_id],
            documents=[payload],
            metadatas=[metadata],
        )
        return item_id

    def _build_where(
        self,
        project: Optional[str] = None,
        wing: Optional[str] = None,
        room: Optional[str] = None,
        memory_type: Optional[str] = None,
        min_confidence: Optional[float] = None,
    ) -> Optional[Dict[str, Any]]:
        clauses: List[Dict[str, Any]] = []

        if project:
            clauses.append({"project": str(project)})
        if wing:
            clauses.append({"wing": str(wing)})
        if room:
            clauses.append({"room": str(room)})
        if memory_type:
            clauses.append({"memory_type": str(memory_type)})
        if min_confidence is not None:
            try:
                conf = float(min_confidence)
                conf = max(0.0, min(conf, 1.0))
                clauses.append({"confidence": {"$gte": conf}})
            except (TypeError, ValueError):
                pass

        if not clauses:
            return None
        if len(clauses) == 1:
            return clauses[0]
        return {"$and": clauses}

    def retrieve(
        self,
        query: str,
        n_results: int = 5,
        project: Optional[str] = None,
        wing: Optional[str] = None,
        room: Optional[str] = None,
        memory_type: Optional[str] = None,
        min_confidence: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        q = str(query or "").strip()
        if not q:
            return []

        k = max(1, min(int(n_results or 5), 20))

        kwargs = {
            "query_texts": [q],
            "n_results": k,
            "include": ["documents", "metadatas", "distances"],
        }
        where = self._build_where(
            project=project,
            wing=wing,
            room=room,
            memory_type=memory_type,
            min_confidence=min_confidence,
        )
        if where:
            kwargs["where"] = where

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

    def get_recent(
        self,
        n: int = 12,
        project: Optional[str] = None,
        wing: Optional[str] = None,
        room: Optional[str] = None,
        memory_type: Optional[str] = None,
        min_confidence: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        limit = max(1, min(int(n or 12), 100))

        kwargs = {
            "include": ["documents", "metadatas"],
            "limit": limit,
        }
        where = self._build_where(
            project=project,
            wing=wing,
            room=room,
            memory_type=memory_type,
            min_confidence=min_confidence,
        )
        if where:
            kwargs["where"] = where

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

    def clear_all(self) -> int:
        """Delete and recreate the memory collection. Returns removed entry count."""
        try:
            removed = int(self._collection.count())
        except Exception:
            removed = 0

        try:
            self._client.delete_collection(name=self._collection_name)
        except Exception:
            # If collection is already missing/corrupt, just recreate it below.
            pass

        self._collection = self._client.get_or_create_collection(name=self._collection_name)
        return removed

    def quality_report(
        self,
        project: Optional[str] = None,
        wing: Optional[str] = None,
        sample_limit: int = 1200,
    ) -> Dict[str, Any]:
        """Build a lightweight quality snapshot from memory metadata and sampled texts."""
        limit = max(50, min(int(sample_limit or 1200), 5000))
        where = self._build_where(project=project, wing=wing)

        kwargs: Dict[str, Any] = {
            "include": ["documents", "metadatas"],
            "limit": limit,
        }
        if where:
            kwargs["where"] = where

        result = self._collection.get(**kwargs)
        docs = result.get("documents") or []
        metas = result.get("metadatas") or []

        room_counts: Dict[str, int] = {}
        type_counts: Dict[str, int] = {}
        wing_counts: Dict[str, int] = {}
        confidence_sum = 0.0
        confidence_count = 0
        short_entries = 0
        long_entries = 0
        hashes: Dict[str, int] = {}

        for idx, raw_doc in enumerate(docs):
            text = str(raw_doc or "").strip()
            meta = metas[idx] if idx < len(metas) and isinstance(metas[idx], dict) else {}

            room = str(meta.get("room", "general") or "general")
            mtype = str(meta.get("memory_type", "note") or "note")
            mwing = str(meta.get("wing", "general") or "general")

            room_counts[room] = room_counts.get(room, 0) + 1
            type_counts[mtype] = type_counts.get(mtype, 0) + 1
            wing_counts[mwing] = wing_counts.get(mwing, 0) + 1

            conf = meta.get("confidence", None)
            if isinstance(conf, (int, float)):
                confidence_sum += float(conf)
                confidence_count += 1

            text_len = len(text)
            if text_len < 30:
                short_entries += 1
            if text_len >= 120:
                long_entries += 1

            normalized = " ".join(text.lower().split())
            if normalized:
                digest = hashlib.sha1(normalized.encode("utf-8")).hexdigest()
                hashes[digest] = hashes.get(digest, 0) + 1

        duplicate_candidates = sum(v - 1 for v in hashes.values() if v > 1)
        sampled = len(docs)

        room_top = sorted(room_counts.items(), key=lambda it: it[1], reverse=True)[:8]
        type_top = sorted(type_counts.items(), key=lambda it: it[1], reverse=True)[:8]
        wing_top = sorted(wing_counts.items(), key=lambda it: it[1], reverse=True)[:8]

        avg_conf = (confidence_sum / confidence_count) if confidence_count else 0.0
        noise_ratio = (short_entries / sampled) if sampled else 0.0
        duplicate_ratio = (duplicate_candidates / sampled) if sampled else 0.0

        return {
            "scope": {
                "project": project or "all",
                "wing": wing or "all",
            },
            "sampled_entries": sampled,
            "sample_limit": limit,
            "avg_confidence": round(avg_conf, 4),
            "short_entries": short_entries,
            "long_entries": long_entries,
            "noise_ratio": round(noise_ratio, 4),
            "duplicate_candidates": duplicate_candidates,
            "duplicate_ratio": round(duplicate_ratio, 4),
            "by_room": [{"name": k, "count": v} for k, v in room_top],
            "by_type": [{"name": k, "count": v} for k, v in type_top],
            "by_wing": [{"name": k, "count": v} for k, v in wing_top],
        }
