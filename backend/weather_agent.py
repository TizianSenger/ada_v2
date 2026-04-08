import json
import os
from datetime import datetime
from urllib.parse import quote_plus
from urllib.request import urlopen


class WeatherAgent:
    def __init__(self, settings_path: str):
        self.settings_path = settings_path

    def _resolve_api_key(self):
        env_key = str(os.getenv("OPENWEATHER_API_KEY", "") or "").strip()
        if env_key:
            return env_key

        if os.path.exists(self.settings_path):
            try:
                with open(self.settings_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                key = str(data.get("openweather_api_key", "") or "").strip()
                if key:
                    return key
            except Exception:
                pass

        return ""

    def _resolve_default_location(self):
        if os.path.exists(self.settings_path):
            try:
                with open(self.settings_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                location = str(data.get("default_weather_location", "") or "").strip()
                if location:
                    return location
            except Exception:
                pass
        return "Berlin,DE"

    def _fetch_json(self, url: str, error_prefix: str):
        try:
            with urlopen(url, timeout=10) as response:
                raw = response.read().decode("utf-8")
            return json.loads(raw)
        except Exception as e:
            raise RuntimeError(f"{error_prefix}: {str(e)}")

    def get_current_weather(self, location: str = "", units: str = "metric", lang: str = "de"):
        api_key = self._resolve_api_key()
        if not api_key:
            raise RuntimeError("OPENWEATHER_API_KEY fehlt. Bitte in .env setzen.")

        final_location = str(location or "").strip() or self._resolve_default_location()
        final_units = str(units or "metric").strip().lower()
        if final_units not in {"metric", "imperial", "standard"}:
            final_units = "metric"

        url = (
            "https://api.openweathermap.org/data/2.5/weather"
            f"?q={quote_plus(final_location)}"
            f"&appid={quote_plus(api_key)}"
            f"&units={quote_plus(final_units)}"
            f"&lang={quote_plus(lang)}"
        )

        data = self._fetch_json(url, "OpenWeather Anfrage fehlgeschlagen")

        if str(data.get("cod", "")) not in {"200", ""} and data.get("cod") != 200:
            raise RuntimeError(f"OpenWeather Fehler: {data.get('message', 'unknown error')}")

        main = data.get("main", {}) or {}
        weather_items = data.get("weather", []) or []
        wind = data.get("wind", {}) or {}
        clouds = data.get("clouds", {}) or {}
        sys_data = data.get("sys", {}) or {}
        coord = data.get("coord", {}) or {}
        rain = data.get("rain", {}) or {}
        snow = data.get("snow", {}) or {}

        weather_desc = ""
        if weather_items:
            weather_desc = str(weather_items[0].get("description", "") or "")

        return {
            "location": f"{data.get('name', final_location)}",
            "country": sys_data.get("country", ""),
            "description": weather_desc,
            "temperature": main.get("temp"),
            "feels_like": main.get("feels_like"),
            "temp_min": main.get("temp_min"),
            "temp_max": main.get("temp_max"),
            "humidity": main.get("humidity"),
            "pressure": main.get("pressure"),
            "pressure_sea_level": main.get("sea_level"),
            "pressure_ground_level": main.get("grnd_level"),
            "wind_speed": wind.get("speed"),
            "wind_deg": wind.get("deg"),
            "wind_gust": wind.get("gust"),
            "clouds_percent": clouds.get("all"),
            "visibility_m": data.get("visibility"),
            "sunrise_unix": sys_data.get("sunrise"),
            "sunset_unix": sys_data.get("sunset"),
            "timezone_offset_s": data.get("timezone"),
            "coord": {"lat": coord.get("lat"), "lon": coord.get("lon")},
            "rain_1h": rain.get("1h"),
            "rain_3h": rain.get("3h"),
            "snow_1h": snow.get("1h"),
            "snow_3h": snow.get("3h"),
            "units": final_units,
            "requested_location": final_location,
            "raw": data,
        }

    def get_forecast(
        self,
        location: str = "",
        units: str = "metric",
        lang: str = "de",
        date_hint: str = "",
        days: int = 3,
    ):
        api_key = self._resolve_api_key()
        if not api_key:
            raise RuntimeError("OPENWEATHER_API_KEY fehlt. Bitte in .env setzen.")

        final_location = str(location or "").strip() or self._resolve_default_location()
        final_units = str(units or "metric").strip().lower()
        if final_units not in {"metric", "imperial", "standard"}:
            final_units = "metric"

        url = (
            "https://api.openweathermap.org/data/2.5/forecast"
            f"?q={quote_plus(final_location)}"
            f"&appid={quote_plus(api_key)}"
            f"&units={quote_plus(final_units)}"
            f"&lang={quote_plus(lang)}"
        )

        data = self._fetch_json(url, "OpenWeather Forecast Anfrage fehlgeschlagen")

        if str(data.get("cod", "")) not in {"200", ""} and data.get("cod") != "200":
            raise RuntimeError(f"OpenWeather Forecast Fehler: {data.get('message', 'unknown error')}")

        hint = str(date_hint or "").strip().lower()
        target_days = max(1, min(int(days or 3), 5))

        grouped = {}
        for item in data.get("list", []) or []:
            dt_txt = str(item.get("dt_txt", "") or "")
            if not dt_txt:
                continue
            dt = datetime.strptime(dt_txt, "%Y-%m-%d %H:%M:%S")
            key = dt.strftime("%Y-%m-%d")
            grouped.setdefault(key, []).append(item)

        day_keys = sorted(grouped.keys())
        if not day_keys:
            raise RuntimeError("Keine Forecast-Daten verfuegbar.")

        if "morgen" in hint or "tomorrow" in hint:
            selected_keys = day_keys[1:2] if len(day_keys) > 1 else day_keys[:1]
        elif "wochenende" in hint or "weekend" in hint:
            weekend_keys = []
            for key in day_keys:
                wd = datetime.strptime(key, "%Y-%m-%d").weekday()  # 5=Sat,6=Sun
                if wd in (5, 6):
                    weekend_keys.append(key)
            selected_keys = weekend_keys[:2] if weekend_keys else day_keys[:2]
        else:
            selected_keys = day_keys[:target_days]

        summary_days = []
        slots = []

        for item in data.get("list", []) or []:
            main = item.get("main", {}) or {}
            weather_items = item.get("weather", []) or []
            wind = item.get("wind", {}) or {}
            rain = item.get("rain", {}) or {}
            snow = item.get("snow", {}) or {}
            clouds = item.get("clouds", {}) or {}
            desc = str((weather_items[0].get("description") if weather_items else "") or "")

            slots.append(
                {
                    "datetime": item.get("dt_txt"),
                    "temperature": main.get("temp"),
                    "feels_like": main.get("feels_like"),
                    "temp_min": main.get("temp_min"),
                    "temp_max": main.get("temp_max"),
                    "humidity": main.get("humidity"),
                    "pressure": main.get("pressure"),
                    "description": desc,
                    "clouds_percent": clouds.get("all"),
                    "wind_speed": wind.get("speed"),
                    "wind_deg": wind.get("deg"),
                    "wind_gust": wind.get("gust"),
                    "pop": item.get("pop"),
                    "rain_3h": rain.get("3h"),
                    "snow_3h": snow.get("3h"),
                }
            )

        for key in selected_keys:
            entries = grouped.get(key, [])
            if not entries:
                continue

            temps = [float((e.get("main", {}) or {}).get("temp", 0.0)) for e in entries]
            feels = [float((e.get("main", {}) or {}).get("feels_like", 0.0)) for e in entries]
            hums = [float((e.get("main", {}) or {}).get("humidity", 0.0)) for e in entries]
            winds = [float((e.get("wind", {}) or {}).get("speed", 0.0)) for e in entries]
            pops = [float(e.get("pop", 0.0) or 0.0) for e in entries]
            clouds_vals = [float((e.get("clouds", {}) or {}).get("all", 0.0) or 0.0) for e in entries]
            rain_total = sum(float(((e.get("rain", {}) or {}).get("3h", 0.0) or 0.0)) for e in entries)
            snow_total = sum(float(((e.get("snow", {}) or {}).get("3h", 0.0) or 0.0)) for e in entries)

            # Prefer midday slot for description if available.
            representative = entries[len(entries) // 2]
            for e in entries:
                dt_txt = str(e.get("dt_txt", "") or "")
                if "12:00:00" in dt_txt:
                    representative = e
                    break

            weather_desc = ""
            weather_items = representative.get("weather", []) or []
            if weather_items:
                weather_desc = str(weather_items[0].get("description", "") or "")

            summary_days.append(
                {
                    "date": key,
                    "description": weather_desc,
                    "temp_min": round(min(temps), 1),
                    "temp_max": round(max(temps), 1),
                    "feels_like_min": round(min(feels), 1),
                    "feels_like_max": round(max(feels), 1),
                    "humidity_avg": round(sum(hums) / len(hums), 1),
                    "wind_avg": round(sum(winds) / len(winds), 1),
                    "clouds_avg": round(sum(clouds_vals) / len(clouds_vals), 1),
                    "pop_max": round(max(pops), 2),
                    "rain_total_mm": round(rain_total, 2),
                    "snow_total_mm": round(snow_total, 2),
                }
            )

        city = data.get("city", {}) or {}
        return {
            "location": city.get("name") or final_location,
            "country": city.get("country", ""),
            "coord": {"lat": city.get("coord", {}).get("lat"), "lon": city.get("coord", {}).get("lon")},
            "units": final_units,
            "date_hint": hint,
            "days": summary_days,
            "slots": slots,
            "raw": data,
        }

    def get_full_weather_report(
        self,
        location: str = "",
        units: str = "metric",
        lang: str = "de",
        date_hint: str = "",
        days: int = 3,
        include_raw: bool = False,
    ):
        current = self.get_current_weather(location=location, units=units, lang=lang)
        forecast = self.get_forecast(
            location=location,
            units=units,
            lang=lang,
            date_hint=date_hint,
            days=days,
        )

        unit_labels = {
            "metric": {"temperature": "C", "wind_speed": "m/s"},
            "imperial": {"temperature": "F", "wind_speed": "mph"},
            "standard": {"temperature": "K", "wind_speed": "m/s"},
        }

        report = {
            "meta": {
                "provider": "OpenWeatherMap",
                "plan_scope": "current weather + 5 day / 3 hour forecast",
                "requested_location": location or self._resolve_default_location(),
                "units": units,
                "date_hint": date_hint,
                "days_requested": max(1, min(int(days or 3), 5)),
                "unit_labels": unit_labels.get(str(units or "metric").lower(), unit_labels["metric"]),
            },
            "current": current,
            "forecast": forecast,
        }

        if not include_raw:
            report["current"].pop("raw", None)
            report["forecast"].pop("raw", None)

        return report
