import json
from urllib.parse import quote_plus
from urllib.request import Request, urlopen


class RouteAgent:
    OSRM_BASE = "https://router.project-osrm.org"
    NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search"

    def _fetch_json(self, url: str):
        request = Request(
            url,
            headers={
                "User-Agent": "ADA-V2/1.0 (route-agent)",
                "Accept": "application/json",
            },
        )
        with urlopen(request, timeout=15) as response:
            raw = response.read().decode("utf-8")
        return json.loads(raw)

    def _geocode(self, place: str):
        query = str(place or "").strip()
        if not query:
            raise RuntimeError("Missing location query.")

        url = (
            f"{self.NOMINATIM_BASE}?q={quote_plus(query)}"
            "&format=jsonv2&limit=1"
        )
        data = self._fetch_json(url)
        if not data:
            raise RuntimeError(f"Location not found: {query}")

        item = data[0]
        return {
            "label": item.get("display_name", query),
            "lat": float(item["lat"]),
            "lon": float(item["lon"]),
        }

    def _mode_to_profile(self, mode: str):
        # Free routing in ADA is intentionally constrained to car mode.
        return "driving", "fossgis_osrm_car", "driving"

    def plan_route(self, origin: str, destination: str, mode: str = "driving", alternatives: bool = False):
        start = self._geocode(origin)
        end = self._geocode(destination)

        osrm_profile, osm_engine, normalized_mode = self._mode_to_profile(mode)
        alternatives_flag = "true" if alternatives else "false"

        route_url = (
            f"{self.OSRM_BASE}/route/v1/{osrm_profile}/"
            f"{start['lon']},{start['lat']};{end['lon']},{end['lat']}"
            f"?overview=full&geometries=geojson&steps=true&alternatives={alternatives_flag}"
        )

        data = self._fetch_json(route_url)
        if data.get("code") != "Ok":
            raise RuntimeError(f"Routing failed: {data.get('code', 'unknown')}")

        routes = data.get("routes", []) or []
        if not routes:
            raise RuntimeError("No route found.")

        primary = routes[0]
        total_seconds = float(primary.get("duration", 0.0) or 0.0)
        distance_km = round(float(primary.get("distance", 0.0)) / 1000.0, 2)
        duration_min = round(total_seconds / 60.0, 1)

        total_minutes_int = int(round(total_seconds / 60.0))
        hours = total_minutes_int // 60
        minutes = total_minutes_int % 60
        if hours > 0:
            duration_human = f"{hours} Std {minutes} Min"
        else:
            duration_human = f"{minutes} Min"

        geometry_coords = []
        for point in ((primary.get("geometry", {}) or {}).get("coordinates", []) or []):
            if isinstance(point, list) and len(point) >= 2:
                geometry_coords.append([float(point[1]), float(point[0])])

        steps = []
        legs = primary.get("legs", []) or []
        if legs:
            for step in (legs[0].get("steps", []) or [])[:12]:
                maneuver = step.get("maneuver", {}) or {}
                step_name = str(step.get("name", "") or "").strip()
                move_type = str(maneuver.get("type", "continue") or "continue")
                modifier = str(maneuver.get("modifier", "") or "").strip()
                step_distance = round(float(step.get("distance", 0.0)) / 1000.0, 2)

                text = move_type
                if modifier:
                    text += f" {modifier}"
                if step_name:
                    text += f" onto {step_name}"

                steps.append({
                    "instruction": text,
                    "distance_km": step_distance,
                })

        directions_url = (
            "https://www.openstreetmap.org/directions"
            f"?engine={osm_engine}"
            f"&route={start['lat']}%2C{start['lon']}%3B{end['lat']}%2C{end['lon']}"
        )

        return {
            "origin": start,
            "destination": end,
            "mode": normalized_mode,
            "distance_km": distance_km,
            "duration_min": duration_min,
            "duration_human": duration_human,
            "has_live_traffic": False,
            "traffic_note": "Live traffic data is not included in this free routing mode.",
            "alternative_routes": max(0, len(routes) - 1),
            "steps": steps,
            "geometry": geometry_coords,
            "osm_directions_url": directions_url,
        }
