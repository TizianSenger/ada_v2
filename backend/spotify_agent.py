import json
import os
import time
from urllib.parse import parse_qs, urlparse

import spotipy
from spotipy.oauth2 import SpotifyClientCredentials, SpotifyOAuth


class SpotifyAgent:
    DEFAULT_REDIRECT_URI = "http://127.0.0.1:8000/spotify/callback"
    DEFAULT_SCOPES = " ".join([
        "user-read-playback-state",
        "user-modify-playback-state",
        "user-read-currently-playing",
        "user-library-read",
        "user-library-modify",
        "playlist-read-private",
        "playlist-read-collaborative",
        "playlist-modify-private",
        "playlist-modify-public",
    ])

    def __init__(self, settings_path: str):
        self.settings_path = settings_path

    def _read_settings(self):
        if not os.path.exists(self.settings_path):
            return {}

        try:
            with open(self.settings_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    def _write_settings(self, updates: dict):
        data = self._read_settings()
        data.update(updates or {})
        os.makedirs(os.path.dirname(self.settings_path), exist_ok=True)
        with open(self.settings_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)

    def _resolve_client_id(self):
        env_val = str(os.getenv("SPOTIFY_CLIENT_ID", "") or "").strip()
        if env_val:
            return env_val
        return str(self._read_settings().get("spotify_client_id", "") or "").strip()

    def _resolve_client_secret(self):
        env_val = str(os.getenv("SPOTIFY_CLIENT_SECRET", "") or "").strip()
        if env_val:
            return env_val
        return str(self._read_settings().get("spotify_client_secret", "") or "").strip()

    def _resolve_redirect_uri(self):
        env_val = str(os.getenv("SPOTIFY_REDIRECT_URI", "") or "").strip()
        if env_val:
            return env_val

        value = str(self._read_settings().get("spotify_redirect_uri", "") or "").strip()
        return value or self.DEFAULT_REDIRECT_URI

    def _resolve_scopes(self):
        env_scopes = str(os.getenv("SPOTIFY_SCOPES", "") or "").strip()
        if env_scopes:
            return env_scopes

        value = str(self._read_settings().get("spotify_scopes", "") or "").strip()
        return value or self.DEFAULT_SCOPES

    def _require_client_credentials(self):
        client_id = self._resolve_client_id()
        client_secret = self._resolve_client_secret()
        if not client_id or not client_secret:
            raise RuntimeError(
                "Spotify Credentials fehlen. Bitte SPOTIFY_CLIENT_ID und SPOTIFY_CLIENT_SECRET in .env oder settings.json setzen."
            )
        return client_id, client_secret

    def _get_oauth_manager(self):
        client_id, client_secret = self._require_client_credentials()
        return SpotifyOAuth(
            client_id=client_id,
            client_secret=client_secret,
            redirect_uri=self._resolve_redirect_uri(),
            scope=self._resolve_scopes(),
            open_browser=False,
        )

    def _get_app_client(self):
        client_id, client_secret = self._require_client_credentials()
        auth_manager = SpotifyClientCredentials(client_id=client_id, client_secret=client_secret)
        return spotipy.Spotify(
            auth_manager=auth_manager,
            requests_timeout=12,
            retries=2,
            status_retries=2,
            backoff_factor=0.2,
        )

    def _extract_code(self, code_or_redirect_url: str):
        raw = str(code_or_redirect_url or "").strip()
        if not raw:
            return ""

        if "code=" in raw and (raw.startswith("http://") or raw.startswith("https://")):
            parsed = urlparse(raw)
            code_values = parse_qs(parsed.query).get("code", [])
            if code_values:
                return str(code_values[0] or "").strip()

        return raw

    def _get_stored_token_info(self):
        data = self._read_settings()
        access_token = str(data.get("spotify_user_access_token", "") or "").strip()
        refresh_token = str(data.get("spotify_refresh_token", "") or "").strip()
        expires_at = int(data.get("spotify_user_token_expires_at", 0) or 0)

        if not access_token and not refresh_token:
            return {}

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_at": expires_at,
        }

    def _store_token_info(self, token_info: dict, connected_user: dict | None = None):
        token_info = token_info or {}
        updates = {
            "spotify_user_access_token": str(token_info.get("access_token", "") or "").strip(),
            "spotify_refresh_token": str(token_info.get("refresh_token", "") or "").strip(),
            "spotify_user_token_expires_at": int(token_info.get("expires_at", 0) or 0),
        }
        if connected_user is not None:
            updates["spotify_connected_user"] = connected_user
        self._write_settings(updates)

    def _store_last_device_id(self, device_id: str):
        if not str(device_id or "").strip():
            return
        self._write_settings({"spotify_last_device_id": str(device_id).strip()})

    def _resolve_last_device_id(self):
        return str(self._read_settings().get("spotify_last_device_id", "") or "").strip()

    def _get_valid_user_access_token(self):
        token_info = self._get_stored_token_info()
        access_token = str(token_info.get("access_token", "") or "").strip()
        refresh_token = str(token_info.get("refresh_token", "") or "").strip()
        expires_at = int(token_info.get("expires_at", 0) or 0)
        now_ts = int(time.time())

        if access_token and expires_at > (now_ts + 45):
            return access_token

        if refresh_token:
            oauth = self._get_oauth_manager()
            refreshed = oauth.refresh_access_token(refresh_token)
            if not isinstance(refreshed, dict):
                raise RuntimeError("Spotify Token Refresh fehlgeschlagen: keine gueltige Antwort.")

            if not refreshed.get("refresh_token"):
                refreshed["refresh_token"] = refresh_token

            self._store_token_info(refreshed)
            new_access = str(refreshed.get("access_token", "") or "").strip()
            if not new_access:
                raise RuntimeError("Spotify Token Refresh fehlgeschlagen: access_token fehlt.")
            return new_access

        raise RuntimeError(
            "Spotify Konto ist nicht verbunden. Nutze zuerst spotify_get_auth_url und danach spotify_connect_account mit dem Code."
        )

    def _get_user_client(self):
        token = self._get_valid_user_access_token()
        return spotipy.Spotify(
            auth=token,
            requests_timeout=12,
            retries=2,
            status_retries=2,
            backoff_factor=0.2,
        )

    @staticmethod
    def _normalize_limit(value, default_value, min_value=1, max_value=50):
        try:
            number = int(value)
        except Exception:
            number = int(default_value)
        return max(min_value, min(max_value, number))

    def get_auth_url(self, state: str = ""):
        oauth = self._get_oauth_manager()
        final_state = str(state or "").strip() or None
        url = oauth.get_authorize_url(state=final_state)
        return {
            "auth_url": url,
            "redirect_uri": self._resolve_redirect_uri(),
            "scope": self._resolve_scopes(),
        }

    def connect_account(self, code_or_redirect_url: str):
        code = self._extract_code(code_or_redirect_url)
        if not code:
            raise RuntimeError("Kein Spotify OAuth Code gefunden. Uebergib den Code oder die komplette Redirect-URL.")

        oauth = self._get_oauth_manager()
        token_info = oauth.get_access_token(code=code, as_dict=True, check_cache=False)
        if not isinstance(token_info, dict) or not token_info.get("access_token"):
            raise RuntimeError("Spotify OAuth fehlgeschlagen. Kein access_token in der Antwort.")

        sp = spotipy.Spotify(auth=token_info.get("access_token"), requests_timeout=12)
        me = sp.current_user() or {}
        connected_user = {
            "id": str(me.get("id", "") or ""),
            "display_name": str(me.get("display_name", "") or ""),
        }

        self._store_token_info(token_info, connected_user=connected_user)

        return {
            "connected": True,
            "user": connected_user,
            "scope": token_info.get("scope", ""),
            "expires_at": int(token_info.get("expires_at", 0) or 0),
        }

    def search_tracks(self, query: str, limit: int = 8):
        final_query = str(query or "").strip()
        if not final_query:
            raise RuntimeError("Suchbegriff fehlt.")

        final_limit = self._normalize_limit(limit, 8, 1, 20)
        sp = self._get_app_client()
        data = sp.search(q=final_query, type="track", limit=final_limit, market="from_token")

        items = []
        for item in (data.get("tracks", {}) or {}).get("items", []) or []:
            artists = [str(a.get("name", "") or "").strip() for a in item.get("artists", []) or []]
            items.append(
                {
                    "id": item.get("id"),
                    "uri": item.get("uri"),
                    "name": item.get("name"),
                    "artists": [a for a in artists if a],
                    "album": (item.get("album") or {}).get("name"),
                    "duration_ms": item.get("duration_ms"),
                    "explicit": bool(item.get("explicit", False)),
                    "popularity": item.get("popularity"),
                }
            )

        return {
            "query": final_query,
            "count": len(items),
            "tracks": items,
        }

    def _resolve_device_id(self, sp, device: str = ""):
        payload = sp.devices() or {}
        devices = payload.get("devices", []) or []
        if not devices:
            raise RuntimeError("Kein aktives Spotify Device gefunden. Oeffne Spotify auf einem Geraet.")

        target = str(device or "").strip().lower()
        if target:
            for d in devices:
                if str(d.get("id", "") or "").strip().lower() == target:
                    self._store_last_device_id(d.get("id"))
                    return d.get("id")
                if str(d.get("name", "") or "").strip().lower() == target:
                    self._store_last_device_id(d.get("id"))
                    return d.get("id")

        active = next((d for d in devices if bool(d.get("is_active", False))), None)
        if active:
            self._store_last_device_id(active.get("id"))
            return active.get("id")

        last_device_id = self._resolve_last_device_id().lower()
        if last_device_id:
            for d in devices:
                if str(d.get("id", "") or "").strip().lower() == last_device_id:
                    self._store_last_device_id(d.get("id"))
                    return d.get("id")

        first = devices[0]
        self._store_last_device_id(first.get("id"))
        return first.get("id")

    def _current_playback_for_device(self, sp, device_id: str | None = None):
        playback = sp.current_playback() or {}
        if not isinstance(playback, dict) or not playback:
            return {}

        if not device_id:
            return playback

        current_device = (playback.get("device") or {}).get("id")
        if str(current_device or "").strip() == str(device_id or "").strip():
            return playback

        return {}

    def _extract_track_id(self, playback: dict):
        if not isinstance(playback, dict):
            return ""
        item = playback.get("item") or {}
        return str(item.get("id", "") or "").strip()

    def _extract_track_name(self, playback: dict):
        if not isinstance(playback, dict):
            return ""
        item = playback.get("item") or {}
        return str(item.get("name", "") or "").strip()

    def _verify_playback(self, sp, verifier, timeout_seconds: float = 2.8, interval_seconds: float = 0.35, device_id: str | None = None):
        deadline = time.time() + max(0.5, float(timeout_seconds))
        last_playback = {}

        while time.time() < deadline:
            last_playback = self._current_playback_for_device(sp, device_id)
            ok, reason = verifier(last_playback)
            if ok:
                return last_playback
            time.sleep(max(0.1, float(interval_seconds)))

        _, reason = verifier(last_playback)
        reason_text = str(reason or "Spotify bestaetigt die Aktion nicht.")
        raise RuntimeError(
            reason_text
            + " Bitte pruefe, ob ein aktives Spotify-Device geoeffnet ist und die Wiedergabe verfuegbar ist."
        )

    def get_playback_status(self):
        sp = self._get_user_client()
        playback = sp.current_playback() or {}

        item = playback.get("item") or {}
        device = playback.get("device") or {}
        artists = [str(a.get("name", "") or "") for a in item.get("artists", []) or []]

        return {
            "is_playing": bool(playback.get("is_playing", False)),
            "progress_ms": playback.get("progress_ms"),
            "repeat_state": playback.get("repeat_state"),
            "shuffle_state": playback.get("shuffle_state"),
            "device": {
                "id": device.get("id"),
                "name": device.get("name"),
                "type": device.get("type"),
                "volume_percent": device.get("volume_percent"),
                "is_active": bool(device.get("is_active", False)),
            },
            "track": {
                "id": item.get("id"),
                "uri": item.get("uri"),
                "name": item.get("name"),
                "artists": [a for a in artists if a],
                "album": (item.get("album") or {}).get("name"),
                "duration_ms": item.get("duration_ms"),
            },
        }

    def list_playlists(self, limit: int = 20):
        final_limit = self._normalize_limit(limit, 20, 1, 50)
        sp = self._get_user_client()
        data = sp.current_user_playlists(limit=final_limit)

        playlists = []
        for item in data.get("items", []) or []:
            owner = item.get("owner") or {}
            tracks_obj = item.get("tracks") or {}
            playlists.append(
                {
                    "id": item.get("id"),
                    "uri": item.get("uri"),
                    "name": item.get("name"),
                    "owner": owner.get("display_name") or owner.get("id"),
                    "tracks_total": tracks_obj.get("total", 0),
                    "public": item.get("public"),
                }
            )

        return {
            "count": len(playlists),
            "playlists": playlists,
        }

    def get_favorites(self, limit: int = 20):
        final_limit = self._normalize_limit(limit, 20, 1, 50)
        sp = self._get_user_client()
        data = sp.current_user_saved_tracks(limit=final_limit)

        tracks = []
        for wrapper in data.get("items", []) or []:
            track = wrapper.get("track") or {}
            artists = [str(a.get("name", "") or "") for a in track.get("artists", []) or []]
            tracks.append(
                {
                    "id": track.get("id"),
                    "uri": track.get("uri"),
                    "name": track.get("name"),
                    "artists": [a for a in artists if a],
                    "album": (track.get("album") or {}).get("name"),
                    "added_at": wrapper.get("added_at"),
                }
            )

        return {
            "count": len(tracks),
            "tracks": tracks,
        }

    def get_daylist(self, limit: int = 30):
        final_limit = self._normalize_limit(limit, 30, 1, 50)
        sp = self._get_user_client()
        data = sp.current_user_playlists(limit=50)

        daylist_playlist = None
        for item in data.get("items", []) or []:
            name = str(item.get("name", "") or "").strip().lower()
            if "daylist" in name:
                daylist_playlist = item
                break

        if not daylist_playlist:
            return {
                "found": False,
                "message": "Keine Daylist Playlist im Account gefunden.",
                "tracks": [],
            }

        playlist_id = daylist_playlist.get("id")
        tracks_payload = sp.playlist_items(playlist_id, limit=final_limit)
        tracks = []
        for row in tracks_payload.get("items", []) or []:
            track = row.get("track") or {}
            artists = [str(a.get("name", "") or "") for a in track.get("artists", []) or []]
            tracks.append(
                {
                    "id": track.get("id"),
                    "uri": track.get("uri"),
                    "name": track.get("name"),
                    "artists": [a for a in artists if a],
                    "album": (track.get("album") or {}).get("name"),
                }
            )

        return {
            "found": True,
            "playlist": {
                "id": daylist_playlist.get("id"),
                "uri": daylist_playlist.get("uri"),
                "name": daylist_playlist.get("name"),
            },
            "tracks": tracks,
        }

    def _search_first_track_uri(self, sp, query: str):
        raw = str(query or "").strip()
        if not raw:
            raise RuntimeError("Track query fehlt.")

        if raw.startswith("spotify:track:"):
            return raw

        if "open.spotify.com/track/" in raw:
            parts = raw.split("/track/")
            track_id = parts[-1].split("?")[0].strip()
            if track_id:
                return f"spotify:track:{track_id}"

        search = sp.search(q=raw, type="track", limit=1)
        items = (search.get("tracks", {}) or {}).get("items", []) or []
        if not items:
            raise RuntimeError(f"Kein Track fuer '{raw}' gefunden.")

        return items[0].get("uri")

    @staticmethod
    def _track_id_from_uri(uri: str):
        raw = str(uri or "").strip()
        if raw.startswith("spotify:track:"):
            return raw.split(":")[-1]
        if "open.spotify.com/track/" in raw:
            return raw.split("/track/")[-1].split("?")[0].strip()
        return raw

    def _resolve_playlist_id(self, sp, playlist: str):
        value = str(playlist or "").strip()
        if not value:
            raise RuntimeError("Playlist fehlt.")

        if value.startswith("spotify:playlist:"):
            return value.split(":")[-1]

        if "open.spotify.com/playlist/" in value:
            return value.split("/playlist/")[-1].split("?")[0].strip()

        # Assume direct playlist id if it has no spaces and looks like an id.
        if " " not in value and len(value) >= 20:
            return value

        payload = sp.current_user_playlists(limit=50)
        target = value.lower()
        for item in payload.get("items", []) or []:
            name = str(item.get("name", "") or "").strip().lower()
            if name == target:
                return item.get("id")

        for item in payload.get("items", []) or []:
            name = str(item.get("name", "") or "").strip().lower()
            if target in name:
                return item.get("id")

        raise RuntimeError(f"Playlist '{playlist}' wurde nicht gefunden.")

    def add_to_playlist(self, track_query: str, playlist: str):
        sp = self._get_user_client()
        track_uri = self._search_first_track_uri(sp, track_query)
        playlist_id = self._resolve_playlist_id(sp, playlist)
        sp.playlist_add_items(playlist_id, [track_uri])

        return {
            "ok": True,
            "playlist_id": playlist_id,
            "track_uri": track_uri,
        }

    def add_to_favorites(self, track_query: str):
        sp = self._get_user_client()
        track_uri = self._search_first_track_uri(sp, track_query)
        track_id = self._track_id_from_uri(track_uri)
        if not track_id:
            raise RuntimeError("Track-ID konnte nicht ermittelt werden.")

        sp.current_user_saved_tracks_add([track_id])
        return {
            "ok": True,
            "track_id": track_id,
            "track_uri": track_uri,
        }

    def play(self, query: str = "", device: str = ""):
        sp = self._get_user_client()
        device_id = self._resolve_device_id(sp, device)
        before = self._current_playback_for_device(sp, device_id)
        before_track_id = self._extract_track_id(before)

        search_query = str(query or "").strip()
        if search_query:
            track_uri = self._search_first_track_uri(sp, search_query)
            expected_track_id = self._track_id_from_uri(track_uri)
            sp.start_playback(device_id=device_id, uris=[track_uri])
            verified = self._verify_playback(
                sp,
                lambda pb: (
                    bool(pb)
                    and bool(pb.get("is_playing", False))
                    and self._extract_track_id(pb) == expected_track_id,
                    "Spotify hat den gewuenschten Track nicht gestartet.",
                ),
                device_id=device_id,
            )
            return {
                "ok": True,
                "action": "play_track",
                "device_id": device_id,
                "track_uri": track_uri,
                "verified": True,
                "track_name": self._extract_track_name(verified),
            }

        sp.start_playback(device_id=device_id)
        verified = self._verify_playback(
            sp,
            lambda pb: (
                bool(pb)
                and bool(pb.get("is_playing", False))
                and (
                    self._extract_track_id(pb) != before_track_id
                    or bool(self._extract_track_id(pb))
                    or bool(before_track_id)
                ),
                "Spotify hat die Wiedergabe nicht gestartet.",
            ),
            device_id=device_id,
        )
        return {
            "ok": True,
            "action": "resume_or_start",
            "device_id": device_id,
            "verified": True,
            "track_name": self._extract_track_name(verified),
        }

    def pause(self, device: str = ""):
        sp = self._get_user_client()
        device_id = self._resolve_device_id(sp, device)
        sp.pause_playback(device_id=device_id)
        self._verify_playback(
            sp,
            lambda pb: (
                bool(pb)
                and not bool(pb.get("is_playing", False)),
                "Spotify hat die Wiedergabe nicht pausiert.",
            ),
            device_id=device_id,
        )
        return {"ok": True, "device_id": device_id, "verified": True}

    def resume(self, device: str = ""):
        sp = self._get_user_client()
        device_id = self._resolve_device_id(sp, device)
        sp.start_playback(device_id=device_id)
        verified = self._verify_playback(
            sp,
            lambda pb: (
                bool(pb)
                and bool(pb.get("is_playing", False)),
                "Spotify hat die Wiedergabe nicht fortgesetzt.",
            ),
            device_id=device_id,
        )
        return {
            "ok": True,
            "device_id": device_id,
            "verified": True,
            "track_name": self._extract_track_name(verified),
        }

    def next_track(self, device: str = ""):
        sp = self._get_user_client()
        device_id = self._resolve_device_id(sp, device)
        before = self._current_playback_for_device(sp, device_id)
        before_track_id = self._extract_track_id(before)
        sp.next_track(device_id=device_id)
        verified = self._verify_playback(
            sp,
            lambda pb: (
                bool(pb)
                and bool(self._extract_track_id(pb))
                and self._extract_track_id(pb) != before_track_id,
                "Spotify hat nicht auf den naechsten Titel gewechselt.",
            ),
            device_id=device_id,
        )
        return {
            "ok": True,
            "device_id": device_id,
            "verified": True,
            "track_name": self._extract_track_name(verified),
        }

    def previous_track(self, device: str = ""):
        sp = self._get_user_client()
        device_id = self._resolve_device_id(sp, device)
        before = self._current_playback_for_device(sp, device_id)
        before_track_id = self._extract_track_id(before)
        sp.previous_track(device_id=device_id)
        verified = self._verify_playback(
            sp,
            lambda pb: (
                bool(pb)
                and bool(self._extract_track_id(pb))
                and self._extract_track_id(pb) != before_track_id,
                "Spotify hat nicht auf den vorherigen Titel gewechselt.",
            ),
            device_id=device_id,
        )
        return {
            "ok": True,
            "device_id": device_id,
            "verified": True,
            "track_name": self._extract_track_name(verified),
        }

    def set_playback_mode(self, shuffle=None, repeat: str = "", device: str = ""):
        sp = self._get_user_client()
        device_id = self._resolve_device_id(sp, device)

        updates = {}

        if shuffle is not None:
            shuffle_bool = bool(shuffle)
            sp.shuffle(shuffle_bool, device_id=device_id)
            updates["shuffle"] = shuffle_bool

        repeat_value = str(repeat or "").strip().lower()
        if repeat_value:
            if repeat_value not in {"off", "track", "context"}:
                raise RuntimeError("repeat muss einer der Werte off, track oder context sein.")
            sp.repeat(repeat_value, device_id=device_id)
            updates["repeat"] = repeat_value

        if not updates:
            raise RuntimeError("Keine Playback-Einstellung uebergeben. Nutze shuffle und/oder repeat.")

        self._verify_playback(
            sp,
            lambda pb: (
                bool(pb)
                and (
                    ("shuffle" not in updates or bool(pb.get("shuffle_state", False)) == bool(updates.get("shuffle")))
                    and ("repeat" not in updates or str(pb.get("repeat_state", "") or "").lower() == str(updates.get("repeat", "") or "").lower())
                ),
                "Spotify hat die Playback-Einstellungen nicht uebernommen.",
            ),
            device_id=device_id,
        )

        updates["device_id"] = device_id
        updates["ok"] = True
        updates["verified"] = True
        return updates
