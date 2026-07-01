# Backend Patch for Enhanced Search

This patch updates the `app.py` of the Contabo VPS `storage_manager` to support advanced search and filtering.

Replace the existing `list_library` endpoint with the following implementation.

```python
from fastapi import Query
from typing import List, Optional
import json
from datetime import datetime

# --- 1. LISTING (Cached & Advanced Search) ---
@app.get("/api/songs", response_model=List[MetaData])
async def list_library(
    type: Optional[str] = Query(None, description="Filter by type (e.g. song, pattern, bank, sample, shader)"),
    q: Optional[str] = Query(None, description="Free-text search on name, author, description, tags"),
    tags: Optional[str] = Query(None, description="Comma-separated list of tags to filter by"),
    max_rating: Optional[int] = Query(None, description="Maximum rating filter"),
    min_rating: Optional[int] = Query(None, description="Minimum rating filter"),
    played_after: Optional[str] = Query(None, description="Filter items played or updated after ISO date"),
    limit: Optional[int] = Query(50, description="Pagination limit"),
    offset: Optional[int] = Query(0, description="Pagination offset"),
    sort_by: Optional[str] = Query(None, description="Sort field (e.g., date, rating, name)")
):
    # Determine search types
    search_types = [type] if type else list(STORAGE_MAP.keys())
    # Remove 'default' if present unless specifically asked for
    if not type and "default" in search_types:
        search_types.remove("default")

    results = []

    # Fetch and combine all matching types
    for t in search_types:
        config = STORAGE_MAP.get(t)
        if not config:
            continue

        try:
            items = await run_io(_read_json_sync, config["index"])
            if isinstance(items, list):
                results.extend(items)
        except Exception as e:
            print(f"Error listing {t}: {e}")

    # In-memory filtering
    if q:
        q_lower = q.lower()
        results = [
            item for item in results
            if q_lower in item.get("name", "").lower() or
               q_lower in item.get("author", "").lower() or
               q_lower in item.get("description", "").lower() or
               (isinstance(item.get("tags"), list) and any(q_lower in str(tag).lower() for tag in item["tags"]))
        ]

    if tags:
        tag_list = [t.strip().lower() for t in tags.split(",")]
        results = [
            item for item in results
            if isinstance(item.get("tags"), list) and any(tag.lower() in [t.lower() for t in item["tags"]] for tag in tag_list)
        ]

    if max_rating is not None:
        results = [item for item in results if item.get("rating", 0) <= max_rating]

    if min_rating is not None:
        results = [item for item in results if item.get("rating", 0) >= min_rating]

    if played_after:
        try:
            after_date = datetime.fromisoformat(played_after)
            # Assuming 'date' field in items is ISO 8601 or YYYY-MM-DD
            def _is_after(item_date_str):
                if not item_date_str:
                    return False
                try:
                    item_date = datetime.fromisoformat(item_date_str)
                    return item_date >= after_date
                except ValueError:
                    return False

            results = [item for item in results if _is_after(item.get("date", ""))]
        except ValueError:
            pass # Ignore invalid played_after format

    # Sorting
    if sort_by:
        reverse = sort_by.startswith("-")
        sort_key = sort_by.lstrip("-")

        # Safe sort handling missing keys
        def _get_sort_val(item):
            val = item.get(sort_key)
            # Handle mixed types (e.g., rating missing vs rating 5)
            if val is None:
                return "" if isinstance(item.get("name", ""), str) else 0
            return val

        results.sort(key=_get_sort_val, reverse=reverse)

    # Pagination
    total_count = len(results)
    paginated_results = results[offset : offset + limit]

    # Optional: You could return a wrapper object like { "total": count, "items": paginated_results }
    # but to maintain backwards compatibility with existing frontend, we'll return the list directly.
    # Note: For true pagination, the frontend needs the total count. Consider returning a header or wrapped response in a v2 API.
    return paginated_results
```
