import asyncio
import base64
import io
import os
import sys
import traceback
import json
from dotenv import load_dotenv
import cv2
import pyaudio
import PIL.Image
import mss
import argparse
import math
import struct
import time
import datetime

from google import genai
from google.genai import types

if sys.version_info < (3, 11, 0):
    import taskgroup, exceptiongroup
    asyncio.TaskGroup = taskgroup.TaskGroup
    asyncio.ExceptionGroup = exceptiongroup.ExceptionGroup

from tools import function_declarations

FORMAT = pyaudio.paInt16
CHANNELS = 1
SEND_SAMPLE_RATE = 16000
RECEIVE_SAMPLE_RATE = 24000
CHUNK_SIZE = 1024

MODEL = "models/gemini-2.5-flash-native-audio-preview-12-2025"
DEFAULT_MODE = "camera"

load_dotenv()

_client = None
_client_api_key = None

SUPPORTED_VOICE_NAMES = {
    "Kore",
    "Orus",
    "Fenrir",
    "Charon",
    "Puck",
    "Aoede",
}


def _get_api_key_from_settings():
    settings_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "settings.json")
    if not os.path.exists(settings_path):
        return None

    try:
        with open(settings_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        key = str(data.get("gemini_api_key", "") or "").strip()
        return key or None
    except Exception:
        return None


def resolve_api_key():
    env_key = str(os.getenv("GEMINI_API_KEY", "") or "").strip()
    if env_key:
        return env_key
    return _get_api_key_from_settings()


def _get_voice_name_from_settings():
    settings_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "settings.json")
    if not os.path.exists(settings_path):
        return None

    try:
        with open(settings_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        name = str(data.get("voice_name", "") or "").strip()
        return name or None
    except Exception:
        return None


def resolve_voice_name():
    env_name = str(os.getenv("ADA_VOICE_NAME", "") or "").strip()
    if env_name in SUPPORTED_VOICE_NAMES:
        return env_name

    settings_name = _get_voice_name_from_settings()
    if settings_name in SUPPORTED_VOICE_NAMES:
        return settings_name

    return "Kore"


def resolve_default_route_origin():
    settings_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "settings.json")
    if not os.path.exists(settings_path):
        return "Berlin,DE"

    try:
        with open(settings_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        value = str(data.get("default_weather_location", "") or "").strip()
        return value or "Berlin,DE"
    except Exception:
        return "Berlin,DE"


def _read_settings_json():
    settings_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "settings.json")
    if not os.path.exists(settings_path):
        return {}

    try:
        with open(settings_path, "r", encoding="utf-8") as f:
            return json.load(f) or {}
    except Exception:
        return {}


def resolve_long_term_memory_enabled():
    data = _read_settings_json()
    return bool(data.get("long_term_memory_enabled", True))


def resolve_memory_locked():
    data = _read_settings_json()
    return bool(data.get("memory_locked", False))


def get_genai_client():
    global _client, _client_api_key

    api_key = resolve_api_key()
    if not api_key:
        raise ValueError("Missing Gemini API key. Set it in Settings or .env as GEMINI_API_KEY.")

    if _client is None or _client_api_key != api_key:
        _client = genai.Client(http_options={"api_version": "v1beta"}, api_key=api_key)
        _client_api_key = api_key

    return _client

tools = [{'google_search': {}}, {"function_declarations": function_declarations}]
SUPPORTED_TOOL_NAMES = {decl["name"] for decl in function_declarations}

def _build_live_config(voice_name: str):
    selected_voice = voice_name if voice_name in SUPPORTED_VOICE_NAMES else "Kore"
    return types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        # We switch these from [] to {} to enable them with default settings
        output_audio_transcription={},
        input_audio_transcription={},
        system_instruction="Your name is Ada, you are a state-of-the-art AI assistant designed to help with a wide range of tasks. Your main goal is to satisfy the user's requests as efficiently and accurately as possible. "
            "You should be witty and light-humored when appropriate, while staying respectful and focused. "
            "Always be cooperative, obedient to user intent, and solution-oriented. "
            "Do not be defiant, snobbish, argumentative, or dismissive. "
            "Do not complain about user requests; help proactively and execute requested tasks whenever possible. "
            "Always be fully honest and truthful. Never fabricate facts, never lie, and never pretend certainty when unsure. "
            "If information is uncertain or unavailable, say so clearly and provide the best possible next step. "
            "If the user asks to remember/save a fact, call save_to_memory. "
            "If the user asks for long-term memory state/status, call memory_status. "
            "When answering, respond using complete and concise sentences to keep a quick pacing and keep the conversation flowing.",
        tools=tools,
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name=selected_voice
                )
            )
        )
    )


config = _build_live_config(resolve_voice_name())


def update_voice_name(voice_name: str):
    global config
    name = str(voice_name or "").strip()
    config = _build_live_config(name)

pya = pyaudio.PyAudio()

from cad_agent import CadAgent
from web_agent import WebAgent
from kasa_agent import KasaAgent
from printer_agent import PrinterAgent
from google_calendar_integration import GoogleCalendarIntegration
from google_gmail_integration import GoogleGmailIntegration
from weather_agent import WeatherAgent
from route_agent import RouteAgent
from finnhub_agent import FinnhubAgent
try:
    from memory_agent import MemoryAgent
    _MEMORY_AVAILABLE = True
except ImportError:
    _MEMORY_AVAILABLE = False
    print("[ADA] ChromaDB not installed – long-term memory disabled. Run: pip install chromadb")

GOOGLE_TOKEN_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "google_token.json")
SETTINGS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "settings.json")

class AudioLoop:
    def __init__(self, video_mode=DEFAULT_MODE, on_audio_data=None, on_video_frame=None, on_cad_data=None, on_web_data=None, on_transcription=None, on_tool_confirmation=None, on_cad_status=None, on_cad_thought=None, on_project_update=None, on_device_update=None, on_error=None, on_tool_view=None, on_status=None, input_device_index=None, input_device_name=None, output_device_index=None, kasa_agent=None):
        self.video_mode = video_mode
        self.on_audio_data = on_audio_data
        self.on_video_frame = on_video_frame
        self.on_cad_data = on_cad_data
        self.on_web_data = on_web_data
        self.on_transcription = on_transcription
        self.on_tool_confirmation = on_tool_confirmation 
        self.on_cad_status = on_cad_status
        self.on_cad_thought = on_cad_thought
        self.on_project_update = on_project_update
        self.on_device_update = on_device_update
        self.on_error = on_error
        self.on_tool_view = on_tool_view
        self.on_status = on_status
        self.input_device_index = input_device_index
        self.input_device_name = input_device_name
        self.output_device_index = output_device_index

        self.audio_in_queue = None
        self.out_queue = None
        self.paused = False

        self.chat_buffer = {"sender": None, "text": ""} # For aggregating chunks
        
        # Track last transcription text to calculate deltas (Gemini sends cumulative text)
        self._last_input_transcription = ""
        self._last_output_transcription = ""

        self.audio_in_queue = None
        self.out_queue = None
        self.paused = False

        self.session = None
        
        # Create CadAgent with thought callback
        def handle_cad_thought(thought_text):
            if self.on_cad_thought:
                self.on_cad_thought(thought_text)
        
        def handle_cad_status(status_info):
            if self.on_cad_status:
                self.on_cad_status(status_info)
        
        self.cad_agent = CadAgent(on_thought=handle_cad_thought, on_status=handle_cad_status)
        self.web_agent = WebAgent()
        self.kasa_agent = kasa_agent if kasa_agent else KasaAgent()
        self.printer_agent = PrinterAgent()
        self.google_calendar = GoogleCalendarIntegration(token_path=GOOGLE_TOKEN_FILE)
        self.google_gmail = GoogleGmailIntegration(token_path=GOOGLE_TOKEN_FILE)
        self.weather_agent = WeatherAgent(settings_path=SETTINGS_FILE)
        self.finnhub_agent = FinnhubAgent(settings_path=SETTINGS_FILE)
        self.route_agent = RouteAgent()

        self.send_text_task = None
        self.stop_event = asyncio.Event()
        
        self.permissions = {} # Default Empty (Will treat unset as True)
        self._pending_confirmations = {}

        # Video buffering state
        self._latest_image_payload = None
        # VAD State
        self._is_speaking = False
        self._silence_start_time = None
        
        # Initialize ProjectManager
        from project_manager import ProjectManager
        # Assuming we are running from backend/ or root? 
        # Using abspath of current file to find root
        current_dir = os.path.dirname(os.path.abspath(__file__))
        # If ada.py is in backend/, project root is one up
        project_root = os.path.dirname(current_dir)
        self.project_manager = ProjectManager(project_root)
        self._project_root = project_root

        # Long-term memory (ChromaDB)
        self.memory = None
        self._memory_init_error = None
        self.long_term_memory_enabled = resolve_long_term_memory_enabled()
        self.memory_locked = resolve_memory_locked()
        if self.long_term_memory_enabled:
            self._ensure_memory_agent()
        
        # Sync Initial Project State
        if self.on_project_update:
            # We need to defer this slightly or just call it. 
            # Since this is init, loop might not be running, but on_project_update in server.py uses asyncio.create_task which needs a loop.
            # We will handle this by calling it in run() or just print for now.
            pass

    def flush_chat(self):
        """Forces the current chat buffer to be written to log."""
        if self.chat_buffer["sender"] and self.chat_buffer["text"].strip():
            sender = self.chat_buffer["sender"]
            text = self.chat_buffer["text"]
            self.project_manager.log_chat(sender, text)
            if self.memory and self.long_term_memory_enabled and not self.memory_locked:
                try:
                    import threading
                    threading.Thread(
                        target=self.memory.store,
                        args=(text, sender, self.project_manager.current_project),
                        daemon=True,
                    ).start()
                except Exception as _me:
                    print(f"[MEMORY] store failed: {_me}")
            self.chat_buffer = {"sender": None, "text": ""}
        # Reset transcription tracking for new turn
        self._last_input_transcription = ""
        self._last_output_transcription = ""

    def update_permissions(self, new_perms):
        print(f"[ADA DEBUG] [CONFIG] Updating tool permissions: {new_perms}")
        self.permissions.update(new_perms)

    def _ensure_memory_agent(self):
        if not self.long_term_memory_enabled:
            return None

        if self.memory is not None:
            return self.memory

        if not _MEMORY_AVAILABLE:
            return None

        try:
            mem_dir = os.path.join(self._project_root, "memory", "chroma_db")
            self.memory = MemoryAgent(persist_dir=mem_dir)
            self._memory_init_error = None
        except Exception as mem_err:
            self._memory_init_error = str(mem_err)
            self.memory = None
            print(f"[ADA] Memory init failed: {mem_err}")

        return self.memory

    def set_long_term_memory_enabled(self, enabled):
        self.long_term_memory_enabled = bool(enabled)
        if self.long_term_memory_enabled:
            self._ensure_memory_agent()

    def set_memory_locked(self, locked):
        self.memory_locked = bool(locked)

    async def prepare_user_text_input(self, text):
        user_text = str(text or "").strip()
        if not user_text:
            return ""

        if not self.long_term_memory_enabled or self.memory_locked:
            return user_text

        memory_agent = self._ensure_memory_agent()
        if not memory_agent:
            return user_text

        try:
            memories = await asyncio.to_thread(
                memory_agent.retrieve,
                user_text,
                3,
                self.project_manager.current_project,
            )
        except Exception as e:
            print(f"[MEMORY] retrieval failed: {e}")
            return user_text

        if not memories:
            return user_text

        lines = []
        for m in memories:
            meta = m.get("metadata", {}) if isinstance(m, dict) else {}
            sender = str(meta.get("sender", "Unknown"))
            ts = str(meta.get("timestamp", ""))[:16]
            snippet = str(m.get("text", "")).strip().replace("\n", " ")
            if len(snippet) > 220:
                snippet = snippet[:217] + "..."
            lines.append(f"- [{ts}] {sender}: {snippet}")

        memory_context = "\n".join(lines)
        return (
            f"{user_text}\n\n"
            "[SYSTEM LONG-TERM MEMORY CONTEXT]\n"
            "Use this as supporting context only when relevant to the current user request.\n"
            f"{memory_context}\n"
            "[/SYSTEM LONG-TERM MEMORY CONTEXT]"
        )

    async def store_memory_entry(self, text, sender="User"):
        payload = str(text or "").strip()
        if not payload or not self.long_term_memory_enabled or self.memory_locked:
            return False

        memory_agent = self._ensure_memory_agent()
        if not memory_agent:
            return False

        try:
            await asyncio.to_thread(
                memory_agent.store,
                payload,
                sender,
                self.project_manager.current_project,
            )
            return True
        except Exception as e:
            print(f"[MEMORY] store failed: {e}")
            return False

    def set_paused(self, paused):
        self.paused = paused

    def stop(self):
        self.stop_event.set()
        
    def resolve_tool_confirmation(self, request_id, confirmed):
        print(f"[ADA DEBUG] [RESOLVE] resolve_tool_confirmation called. ID: {request_id}, Confirmed: {confirmed}")
        if request_id in self._pending_confirmations:
            future = self._pending_confirmations[request_id]
            if not future.done():
                print(f"[ADA DEBUG] [RESOLVE] Future found and pending. Setting result to: {confirmed}")
                future.set_result(confirmed)
            else:
                 print(f"[ADA DEBUG] [WARN] Request {request_id} future already done. Result: {future.result()}")
        else:
            print(f"[ADA DEBUG] [WARN] Confirmation Request {request_id} not found in pending dict. Keys: {list(self._pending_confirmations.keys())}")

    def clear_audio_queue(self):
        """Clears the queue of pending audio chunks to stop playback immediately."""
        try:
            count = 0
            while not self.audio_in_queue.empty():
                self.audio_in_queue.get_nowait()
                count += 1
            if count > 0:
                print(f"[ADA DEBUG] [AUDIO] Cleared {count} chunks from playback queue due to interruption.")
        except Exception as e:
            print(f"[ADA DEBUG] [ERR] Failed to clear audio queue: {e}")

    def emit_tool_view(self, payload):
        if not self.on_tool_view or not isinstance(payload, dict):
            return
        try:
            self.on_tool_view(payload)
        except Exception as e:
            print(f"[ADA DEBUG] [WARN] Failed to emit tool view: {e}")

    async def run_system_check(self, include_network_checks=True):
        started_ts = time.time()
        checks = []

        planned_checks = [
            "Model Session",
            "Project Storage",
            "Long-term Memory",
            "Smart Home Cache",
        ]
        if include_network_checks:
            planned_checks.extend([
                "Smart Home Discovery",
                "Printer Discovery",
                "Weather API",
                "Stock Market API",
                "Route Service",
                "Google Calendar",
                "Gmail",
            ])
        else:
            planned_checks.append("Network Checks")

        total_checks = len(planned_checks)

        def build_summary(running=True):
            passed = len([c for c in checks if c["status"] == "pass"])
            failed = len([c for c in checks if c["status"] == "fail"])
            warned = len([c for c in checks if c["status"] == "warn"])
            completed = len(checks)
            progress_percent = int((completed / total_checks) * 100) if total_checks else 0
            return {
                "passed": passed,
                "failed": failed,
                "warned": warned,
                "completed": completed,
                "total": total_checks,
                "duration_ms": int((time.time() - started_ts) * 1000),
                "timestamp": datetime.datetime.now().astimezone().isoformat(),
                "running": bool(running),
                "progress_percent": progress_percent,
            }

        def emit_progress(current_check=None, running=True):
            summary = build_summary(running=running)
            self.emit_tool_view({
                "type": "system_check",
                "title": "System Check Report" if not running else "System Check Running",
                "status": "completed" if not running else "running",
                "progress": {
                    "completed": summary.get("completed", 0),
                    "total": summary.get("total", 0),
                    "percent": summary.get("progress_percent", 0),
                    "current_check": str(current_check or ""),
                },
                "report": {
                    "summary": summary,
                    "checks": list(checks),
                },
            })

        def add_check(name, status, message, details=None, duration_ms=0):
            item = {
                "name": name,
                "status": status,
                "message": str(message),
                "duration_ms": int(duration_ms),
            }
            if details is not None:
                item["details"] = details
            checks.append(item)
            emit_progress(current_check=name, running=True)

        emit_progress(current_check="Initialisierung", running=True)

        # Core: session health
        t0 = time.time()
        if self.session:
            add_check("Model Session", "pass", "Live session active.", duration_ms=(time.time() - t0) * 1000)
        else:
            add_check("Model Session", "fail", "No active live session.", duration_ms=(time.time() - t0) * 1000)

        # Core: project path
        t0 = time.time()
        try:
            project_path = self.project_manager.get_current_project_path()
            exists = bool(project_path and os.path.exists(project_path))
            writable = bool(project_path and os.access(project_path, os.W_OK))
            if exists and writable:
                add_check(
                    "Project Storage",
                    "pass",
                    f"Project path ready: {project_path}",
                    {"path": str(project_path), "writable": True},
                    (time.time() - t0) * 1000,
                )
            elif exists:
                add_check(
                    "Project Storage",
                    "warn",
                    f"Project path exists but may be read-only: {project_path}",
                    {"path": str(project_path), "writable": False},
                    (time.time() - t0) * 1000,
                )
            else:
                add_check("Project Storage", "fail", "Project path missing.", duration_ms=(time.time() - t0) * 1000)
        except Exception as e:
            add_check("Project Storage", "fail", f"Project check failed: {e}", duration_ms=(time.time() - t0) * 1000)

        # Core: long-term memory
        t0 = time.time()
        try:
            if not self.long_term_memory_enabled:
                add_check(
                    "Long-term Memory",
                    "warn",
                    "Long-term memory is disabled in settings.",
                    {"enabled": False, "locked": self.memory_locked},
                    (time.time() - t0) * 1000,
                )
            elif not _MEMORY_AVAILABLE:
                add_check(
                    "Long-term Memory",
                    "warn",
                    "chromadb not installed. Run: pip install chromadb",
                    {"enabled": True, "locked": self.memory_locked},
                    duration_ms=(time.time() - t0) * 1000,
                )
            elif self.memory_locked:
                count = self.memory.count() if self.memory else 0
                add_check(
                    "Long-term Memory",
                    "warn",
                    "Long-term memory is enabled but currently locked.",
                    {"enabled": True, "locked": True, "entries": count},
                    duration_ms=(time.time() - t0) * 1000,
                )
            elif self.memory is None:
                if self._memory_init_error:
                    add_check(
                        "Long-term Memory",
                        "fail",
                        f"Memory initialization failed: {self._memory_init_error}",
                        {"enabled": True, "locked": False},
                        duration_ms=(time.time() - t0) * 1000,
                    )
                else:
                    add_check(
                        "Long-term Memory",
                        "warn",
                        "Memory not initialized yet.",
                        {"enabled": True, "locked": False},
                        duration_ms=(time.time() - t0) * 1000,
                    )
            else:
                count = self.memory.count()
                add_check(
                    "Long-term Memory",
                    "pass",
                    f"{count} entries stored in ChromaDB.",
                    {
                        "enabled": True,
                        "locked": False,
                        "entries": count,
                        "path": self.memory._persist_dir,
                    },
                    (time.time() - t0) * 1000,
                )
        except Exception as e:
            add_check("Long-term Memory", "fail", f"Memory check failed: {e}", duration_ms=(time.time() - t0) * 1000)

        # Core: smart home cache status
        t0 = time.time()
        try:
            cache_devices = self.kasa_agent.get_devices_list()
            if cache_devices:
                add_check(
                    "Smart Home Cache",
                    "pass",
                    f"{len(cache_devices)} cached smart devices.",
                    {"count": len(cache_devices)},
                    (time.time() - t0) * 1000,
                )
            else:
                add_check("Smart Home Cache", "warn", "No cached smart devices.", duration_ms=(time.time() - t0) * 1000)
        except Exception as e:
            add_check("Smart Home Cache", "fail", f"Smart device cache error: {e}", duration_ms=(time.time() - t0) * 1000)

        if include_network_checks:
            # Smart-home discovery probe
            t0 = time.time()
            try:
                devices = await self.kasa_agent.discover_devices()
                if devices:
                    add_check(
                        "Smart Home Discovery",
                        "pass",
                        f"Discovery found {len(devices)} device(s).",
                        {"count": len(devices)},
                        (time.time() - t0) * 1000,
                    )
                else:
                    add_check("Smart Home Discovery", "warn", "Discovery found no devices.", duration_ms=(time.time() - t0) * 1000)
            except Exception as e:
                add_check("Smart Home Discovery", "fail", f"Discovery failed: {e}", duration_ms=(time.time() - t0) * 1000)

            # Printer discovery/status probe
            t0 = time.time()
            try:
                printers = await self.printer_agent.discover_printers()
                if printers:
                    add_check(
                        "Printer Discovery",
                        "pass",
                        f"Found {len(printers)} printer(s).",
                        {"count": len(printers)},
                        (time.time() - t0) * 1000,
                    )
                else:
                    add_check("Printer Discovery", "warn", "No printers discovered.", duration_ms=(time.time() - t0) * 1000)
            except Exception as e:
                add_check("Printer Discovery", "fail", f"Printer check failed: {e}", duration_ms=(time.time() - t0) * 1000)

            # Weather API probe
            t0 = time.time()
            try:
                weather = await asyncio.to_thread(self.weather_agent.get_current_weather, "", "metric", "de")
                add_check(
                    "Weather API",
                    "pass",
                    f"Weather API ok for {weather.get('location', 'default')}.",
                    {"location": weather.get("location")},
                    (time.time() - t0) * 1000,
                )
            except Exception as e:
                add_check("Weather API", "fail", f"Weather check failed: {e}", duration_ms=(time.time() - t0) * 1000)

            # Stock market API probe (Finnhub/Massive)
            t0 = time.time()
            try:
                quote = await asyncio.to_thread(self.finnhub_agent.get_stock_quote, "AAPL")
                add_check(
                    "Stock Market API",
                    "pass",
                    f"Stock API ok for {quote.get('symbol', 'AAPL')}.",
                    {
                        "symbol": quote.get("symbol"),
                        "price": (quote.get("quote") or {}).get("current"),
                    },
                    (time.time() - t0) * 1000,
                )
            except Exception as e:
                msg = str(e)
                status = "warn" if "FINNHUB_API_KEY fehlt" in msg else "fail"
                add_check("Stock Market API", status, f"Stock API check failed: {msg}", duration_ms=(time.time() - t0) * 1000)

            # Route service probe
            t0 = time.time()
            try:
                origin = resolve_default_route_origin()
                route = await asyncio.to_thread(self.route_agent.plan_route, origin, "Berlin,DE", "driving", False)
                add_check(
                    "Route Service",
                    "pass",
                    f"Route API ok ({route.get('distance_km', 'n/a')} km test route).",
                    {"origin": origin, "destination": "Berlin,DE"},
                    (time.time() - t0) * 1000,
                )
            except Exception as e:
                add_check("Route Service", "fail", f"Route check failed: {e}", duration_ms=(time.time() - t0) * 1000)

            # Google Calendar probe
            t0 = time.time()
            try:
                events = await asyncio.to_thread(self.google_calendar.list_upcoming_events, 1)
                add_check(
                    "Google Calendar",
                    "pass",
                    f"Calendar API reachable ({len(events)} event sample).",
                    {"sample_count": len(events)},
                    (time.time() - t0) * 1000,
                )
            except Exception as e:
                add_check("Google Calendar", "warn", f"Calendar unavailable: {e}", duration_ms=(time.time() - t0) * 1000)

            # Gmail probe
            t0 = time.time()
            try:
                msgs = await asyncio.to_thread(self.google_gmail.list_messages, 1, None)
                add_check(
                    "Gmail",
                    "pass",
                    f"Gmail API reachable ({len(msgs)} message sample).",
                    {"sample_count": len(msgs)},
                    (time.time() - t0) * 1000,
                )
            except Exception as e:
                add_check("Gmail", "warn", f"Gmail unavailable: {e}", duration_ms=(time.time() - t0) * 1000)
        else:
            add_check("Network Checks", "warn", "Network checks skipped by request.", duration_ms=0)

        summary = build_summary(running=False)

        # Emit one final state so the frontend can switch from running -> completed.
        emit_progress(current_check="Abgeschlossen", running=False)

        return {
            "summary": summary,
            "checks": checks,
        }

    async def send_frame(self, frame_data):
        # Update the latest frame payload
        if isinstance(frame_data, bytes):
            b64_data = base64.b64encode(frame_data).decode('utf-8')
        else:
            b64_data = frame_data 

        # Store as the designated "next frame to send"
        self._latest_image_payload = {"mime_type": "image/jpeg", "data": b64_data}
        # No event signal needed - listen_audio pulls it

    async def send_realtime(self):
        while True:
            msg = await self.out_queue.get()
            await self.session.send(input=msg, end_of_turn=False)

    async def listen_audio(self):
        mic_info = pya.get_default_input_device_info()

        # Resolve Input Device by Name if provided
        resolved_input_device_index = None
        
        if self.input_device_name:
            print(f"[ADA] Attempting to find input device matching: '{self.input_device_name}'")
            count = pya.get_device_count()
            best_match = None
            
            for i in range(count):
                try:
                    info = pya.get_device_info_by_index(i)
                    if info['maxInputChannels'] > 0:
                        name = info.get('name', '')
                        # Simple case-insensitive check
                        if self.input_device_name.lower() in name.lower() or name.lower() in self.input_device_name.lower():
                             print(f"   Candidate {i}: {name}")
                             # Prioritize exact match or very close match if possible, but first match is okay for now
                             resolved_input_device_index = i
                             best_match = name
                             break
                except Exception:
                    continue
            
            if resolved_input_device_index is not None:
                print(f"[ADA] Resolved input device '{self.input_device_name}' to index {resolved_input_device_index} ({best_match})")
            else:
                print(f"[ADA] Could not find device matching '{self.input_device_name}'. Checking index...")

        # Fallback to index if Name lookup failed or wasn't provided
        if resolved_input_device_index is None and self.input_device_index is not None:
             try:
                 resolved_input_device_index = int(self.input_device_index)
                 print(f"[ADA] Requesting Input Device Index: {resolved_input_device_index}")
             except ValueError:
                 print(f"[ADA] Invalid device index '{self.input_device_index}', reverting to default.")
                 resolved_input_device_index = None

        if resolved_input_device_index is None:
             print("[ADA] Using Default Input Device")

        try:
            self.audio_stream = await asyncio.to_thread(
                pya.open,
                format=FORMAT,
                channels=CHANNELS,
                rate=SEND_SAMPLE_RATE,
                input=True,
                input_device_index=resolved_input_device_index if resolved_input_device_index is not None else mic_info["index"],
                frames_per_buffer=CHUNK_SIZE,
            )
        except OSError as e:
            print(f"[ADA] [ERR] Failed to open audio input stream: {e}")
            print("[ADA] [WARN] Audio features will be disabled. Please check microphone permissions.")
            return

        if __debug__:
            kwargs = {"exception_on_overflow": False}
        else:
            kwargs = {}
        
        # VAD Constants
        VAD_THRESHOLD = 800 # Adj based on mic sensitivity (800 is conservative for 16-bit)
        SILENCE_DURATION = 0.5 # Seconds of silence to consider "done speaking"
        
        while True:
            if self.paused:
                await asyncio.sleep(0.1)
                continue

            try:
                data = await asyncio.to_thread(self.audio_stream.read, CHUNK_SIZE, **kwargs)
                
                # 1. Send Audio
                if self.out_queue:
                    await self.out_queue.put({"data": data, "mime_type": "audio/pcm"})
                
                # 2. VAD Logic for Video
                # rms = audioop.rms(data, 2)
                # Replacement for audioop.rms(data, 2)
                count = len(data) // 2
                if count > 0:
                    shorts = struct.unpack(f"<{count}h", data)
                    sum_squares = sum(s**2 for s in shorts)
                    rms = int(math.sqrt(sum_squares / count))
                else:
                    rms = 0
                
                if rms > VAD_THRESHOLD:
                    # Speech Detected
                    self._silence_start_time = None
                    
                    if not self._is_speaking:
                        # NEW Speech Utterance Started
                        self._is_speaking = True
                        print(f"[ADA DEBUG] [VAD] Speech Detected (RMS: {rms}). Sending Video Frame.")
                        
                        # Send ONE frame
                        if self._latest_image_payload and self.out_queue:
                            await self.out_queue.put(self._latest_image_payload)
                        else:
                            print(f"[ADA DEBUG] [VAD] No video frame available to send.")
                            
                else:
                    # Silence
                    if self._is_speaking:
                        if self._silence_start_time is None:
                            self._silence_start_time = time.time()
                        
                        elif time.time() - self._silence_start_time > SILENCE_DURATION:
                            # Silence confirmed, reset state
                            print(f"[ADA DEBUG] [VAD] Silence detected. Resetting speech state.")
                            self._is_speaking = False
                            self._silence_start_time = None

            except Exception as e:
                print(f"Error reading audio: {e}")
                await asyncio.sleep(0.1)

    async def handle_cad_request(self, prompt):
        print(f"[ADA DEBUG] [CAD] Background Task Started: handle_cad_request('{prompt}')")
        if self.on_cad_status:
            self.on_cad_status("generating")
            
        # Auto-create project if stuck in temp
        if self.project_manager.current_project == "temp":
            import datetime
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            new_project_name = f"Project_{timestamp}"
            print(f"[ADA DEBUG] [CAD] Auto-creating project: {new_project_name}")
            
            success, msg = self.project_manager.create_project(new_project_name)
            if success:
                self.project_manager.switch_project(new_project_name)
                # Notify User (Optional, or rely on update)
                try:
                    await self.session.send(input=f"System Notification: Automatic Project Creation. Switched to new project '{new_project_name}'.", end_of_turn=False)
                    if self.on_project_update:
                         self.on_project_update(new_project_name)
                except Exception as e:
                    print(f"[ADA DEBUG] [ERR] Failed to notify auto-project: {e}")

        # Get project cad folder path
        cad_output_dir = str(self.project_manager.get_current_project_path() / "cad")
        
        # Call the secondary agent with project path
        cad_data = await self.cad_agent.generate_prototype(prompt, output_dir=cad_output_dir)
        
        if cad_data:
            print(f"[ADA DEBUG] [OK] CadAgent returned data successfully.")
            print(f"[ADA DEBUG] [INFO] Data Check: {len(cad_data.get('vertices', []))} vertices, {len(cad_data.get('edges', []))} edges.")
            
            if self.on_cad_data:
                print(f"[ADA DEBUG] [SEND] Dispatching data to frontend callback...")
                self.on_cad_data(cad_data)
                print(f"[ADA DEBUG] [SENT] Dispatch complete.")
            
            # Save to Project
            if 'file_path' in cad_data:
                self.project_manager.save_cad_artifact(cad_data['file_path'], prompt)
            else:
                 # Fallback (legacy support)
                 self.project_manager.save_cad_artifact("output.stl", prompt)

            # Notify the model that the task is done - this triggers speech about completion
            completion_msg = "System Notification: CAD generation is complete! The 3D model is now displayed for the user. Let them know it's ready."
            try:
                await self.session.send(input=completion_msg, end_of_turn=True)
                print(f"[ADA DEBUG] [NOTE] Sent completion notification to model.")
            except Exception as e:
                 print(f"[ADA DEBUG] [ERR] Failed to send completion notification: {e}")

        else:
            print(f"[ADA DEBUG] [ERR] CadAgent returned None.")
            # Optionally notify failure
            try:
                await self.session.send(input="System Notification: CAD generation failed.", end_of_turn=True)
            except Exception:
                pass



    async def handle_write_file(self, path, content):
        print(f"[ADA DEBUG] [FS] Writing file: '{path}'")
        
        # Auto-create project if stuck in temp
        if self.project_manager.current_project == "temp":
            import datetime
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            new_project_name = f"Project_{timestamp}"
            print(f"[ADA DEBUG] [FS] Auto-creating project: {new_project_name}")
            
            success, msg = self.project_manager.create_project(new_project_name)
            if success:
                self.project_manager.switch_project(new_project_name)
                # Notify User
                try:
                    await self.session.send(input=f"System Notification: Automatic Project Creation. Switched to new project '{new_project_name}'.", end_of_turn=False)
                    if self.on_project_update:
                         self.on_project_update(new_project_name)
                except Exception as e:
                    print(f"[ADA DEBUG] [ERR] Failed to notify auto-project: {e}")
        
        # Force path to be relative to current project
        # If absolute path is provided, we try to strip it or just ignore it and use basename
        filename = os.path.basename(path)
        
        # If path contained subdirectories (e.g. "backend/server.py"), preserving that structure might be desired IF it's within the project.
        # But for safety, and per user request to "always create the file in the project", 
        # we will root it in the current project path.
        
        current_project_path = self.project_manager.get_current_project_path()
        final_path = current_project_path / filename # Simple flat structure for now, or allow relative?
        
        # If the user specifically wanted a subfolder, they might have provided "sub/file.txt".
        # Let's support relative paths if they don't start with /
        if not os.path.isabs(path):
             final_path = current_project_path / path
        
        print(f"[ADA DEBUG] [FS] Resolved path: '{final_path}'")

        try:
            # Ensure parent exists
            os.makedirs(os.path.dirname(final_path), exist_ok=True)
            with open(final_path, 'w', encoding='utf-8') as f:
                f.write(content)
            result = f"File '{final_path.name}' written successfully to project '{self.project_manager.current_project}'."
        except Exception as e:
            result = f"Failed to write file '{path}': {str(e)}"

        print(f"[ADA DEBUG] [FS] Result: {result}")
        try:
             await self.session.send(input=f"System Notification: {result}", end_of_turn=True)
        except Exception as e:
             print(f"[ADA DEBUG] [ERR] Failed to send fs result: {e}")

    async def handle_read_directory(self, path):
        print(f"[ADA DEBUG] [FS] Reading directory: '{path}'")
        try:
            if not os.path.exists(path):
                result = f"Directory '{path}' does not exist."
            else:
                items = os.listdir(path)
                result = f"Contents of '{path}': {', '.join(items)}"
        except Exception as e:
            result = f"Failed to read directory '{path}': {str(e)}"

        print(f"[ADA DEBUG] [FS] Result: {result}")
        try:
             await self.session.send(input=f"System Notification: {result}", end_of_turn=True)
        except Exception as e:
             print(f"[ADA DEBUG] [ERR] Failed to send fs result: {e}")

    async def handle_read_file(self, path):
        print(f"[ADA DEBUG] [FS] Reading file: '{path}'")
        try:
            if not os.path.exists(path):
                result = f"File '{path}' does not exist."
            else:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                result = f"Content of '{path}':\n{content}"
        except Exception as e:
            result = f"Failed to read file '{path}': {str(e)}"

        print(f"[ADA DEBUG] [FS] Result: {result}")
        try:
             await self.session.send(input=f"System Notification: {result}", end_of_turn=True)
        except Exception as e:
             print(f"[ADA DEBUG] [ERR] Failed to send fs result: {e}")

    async def handle_web_agent_request(self, prompt):
        print(f"[ADA DEBUG] [WEB] Web Agent Task: '{prompt}'")
        
        async def update_frontend(image_b64, log_text):
            if self.on_web_data:
                 self.on_web_data({"image": image_b64, "log": log_text})
                 
        # Run the web agent and wait for it to return
        result = await self.web_agent.run_task(prompt, update_callback=update_frontend)
        print(f"[ADA DEBUG] [WEB] Web Agent Task Returned: {result}")
        
        # Send the final result back to the main model
        try:
             await self.session.send(input=f"System Notification: Web Agent has finished.\nResult: {result}", end_of_turn=True)
        except Exception as e:
             print(f"[ADA DEBUG] [ERR] Failed to send web agent result to model: {e}")

    async def receive_audio(self):
        "Background task to reads from the websocket and write pcm chunks to the output queue"
        try:
            while True:
                turn = self.session.receive()
                async for response in turn:
                    # 1. Handle Audio Data
                    if data := response.data:
                        self.audio_in_queue.put_nowait(data)
                        # NOTE: 'continue' removed here to allow processing transcription/tools in same packet

                    # 2. Handle Transcription (User & Model)
                    if response.server_content:
                        if response.server_content.input_transcription:
                            transcript = response.server_content.input_transcription.text
                            if transcript:
                                # Skip if this is an exact duplicate event
                                if transcript != self._last_input_transcription:
                                    # Calculate delta (Gemini may send cumulative or chunk-based text)
                                    delta = transcript
                                    if transcript.startswith(self._last_input_transcription):
                                        delta = transcript[len(self._last_input_transcription):]
                                    self._last_input_transcription = transcript
                                    
                                    # Only send if there's new text
                                    if delta:
                                        # User is speaking, so interrupt model playback!
                                        self.clear_audio_queue()

                                        # Send to frontend (Streaming)
                                        if self.on_transcription:
                                             self.on_transcription({"sender": "User", "text": delta})
                                        
                                        # Buffer for Logging
                                        if self.chat_buffer["sender"] != "User":
                                            # Flush previous if exists
                                            if self.chat_buffer["sender"] and self.chat_buffer["text"].strip():
                                                self.project_manager.log_chat(self.chat_buffer["sender"], self.chat_buffer["text"])
                                            # Start new
                                            self.chat_buffer = {"sender": "User", "text": delta}
                                        else:
                                            # Append
                                            self.chat_buffer["text"] += delta
                        
                        if response.server_content.output_transcription:
                            transcript = response.server_content.output_transcription.text
                            if transcript:
                                # Skip if this is an exact duplicate event
                                if transcript != self._last_output_transcription:
                                    # Calculate delta (Gemini may send cumulative or chunk-based text)
                                    delta = transcript
                                    if transcript.startswith(self._last_output_transcription):
                                        delta = transcript[len(self._last_output_transcription):]
                                    self._last_output_transcription = transcript
                                    
                                    # Only send if there's new text
                                    if delta:
                                        # Send to frontend (Streaming)
                                        if self.on_transcription:
                                             self.on_transcription({"sender": "ADA", "text": delta})
                                        
                                        # Buffer for Logging
                                        if self.chat_buffer["sender"] != "ADA":
                                            # Flush previous
                                            if self.chat_buffer["sender"] and self.chat_buffer["text"].strip():
                                                self.project_manager.log_chat(self.chat_buffer["sender"], self.chat_buffer["text"])
                                            # Start new
                                            self.chat_buffer = {"sender": "ADA", "text": delta}
                                        else:
                                            # Append
                                            self.chat_buffer["text"] += delta
                        
                        # Flush buffer on turn completion if needed, 
                        # but usually better to wait for sender switch or explicit end.
                        # We can also check turn_complete signal if available in response.server_content.model_turn etc

                    # 3. Handle Tool Calls
                    if response.tool_call:
                        print("The tool was called")
                        function_responses = []
                        for fc in response.tool_call.function_calls:
                            if fc.name in SUPPORTED_TOOL_NAMES:
                                prompt = fc.args.get("prompt", "") # Prompt is not present for all tools
                                
                                # Check Permissions (Default to True if not set)
                                confirmation_required = self.permissions.get(fc.name, True)
                                
                                if not confirmation_required:
                                    print(f"[ADA DEBUG] [TOOL] Permission check: '{fc.name}' -> AUTO-ALLOW")
                                    # Skip confirmation block and jump to execution
                                    pass
                                else:
                                    # Confirmation Logic
                                    if not self.on_tool_confirmation:
                                        print(
                                            f"[ADA DEBUG] [WARN] Confirmation required for '{fc.name}' "
                                            "but no confirmation callback is set. Denying tool call."
                                        )
                                        function_response = types.FunctionResponse(
                                            id=fc.id,
                                            name=fc.name,
                                            response={"result": "Tool call denied: confirmation UI unavailable."}
                                        )
                                        function_responses.append(function_response)
                                        continue

                                    import uuid
                                    request_id = str(uuid.uuid4())
                                    print(f"[ADA DEBUG] [STOP] Requesting confirmation for '{fc.name}' (ID: {request_id})")

                                    future = asyncio.get_running_loop().create_future()
                                    self._pending_confirmations[request_id] = future

                                    self.on_tool_confirmation({
                                        "id": request_id,
                                        "tool": fc.name,
                                        "args": fc.args
                                    })

                                    try:
                                        confirmed = await asyncio.wait_for(future, timeout=25.0)
                                    except asyncio.TimeoutError:
                                        confirmed = False
                                        print(
                                            f"[ADA DEBUG] [WARN] Confirmation timeout for '{fc.name}' "
                                            f"(ID: {request_id}). Denying by default."
                                        )
                                    finally:
                                        self._pending_confirmations.pop(request_id, None)

                                    print(f"[ADA DEBUG] [CONFIRM] Request {request_id} resolved. Confirmed: {confirmed}")

                                    if not confirmed:
                                        print(f"[ADA DEBUG] [DENY] Tool call '{fc.name}' denied by user.")
                                        function_response = types.FunctionResponse(
                                            id=fc.id,
                                            name=fc.name,
                                            response={
                                                "result": "User denied the request to use this tool.",
                                            }
                                        )
                                        function_responses.append(function_response)
                                        continue

                                # If confirmed (or no callback configured, or auto-allowed), proceed
                                if fc.name == "generate_cad":
                                    print(f"\n[ADA DEBUG] --------------------------------------------------")
                                    print(f"[ADA DEBUG] [TOOL] Tool Call Detected: 'generate_cad'")
                                    print(f"[ADA DEBUG] [IN] Arguments: prompt='{prompt}'")
                                    
                                    asyncio.create_task(self.handle_cad_request(prompt))
                                    # No function response needed - model already acknowledged when user asked
                                
                                elif fc.name == "run_web_agent":
                                    print(f"[ADA DEBUG] [TOOL] Tool Call: 'run_web_agent' with prompt='{prompt}'")
                                    asyncio.create_task(self.handle_web_agent_request(prompt))
                                    
                                    result_text = "Web Navigation started. Do not reply to this message."
                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={
                                            "result": result_text,
                                        }
                                    )
                                    print(f"[ADA DEBUG] [RESPONSE] Sending function response: {function_response}")
                                    function_responses.append(function_response)



                                elif fc.name == "write_file":
                                    path = fc.args["path"]
                                    content = fc.args["content"]
                                    print(f"[ADA DEBUG] [TOOL] Tool Call: 'write_file' path='{path}'")
                                    asyncio.create_task(self.handle_write_file(path, content))
                                    function_response = types.FunctionResponse(
                                        id=fc.id, name=fc.name, response={"result": "Writing file..."}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "read_directory":
                                    path = fc.args["path"]
                                    print(f"[ADA DEBUG] [TOOL] Tool Call: 'read_directory' path='{path}'")
                                    asyncio.create_task(self.handle_read_directory(path))
                                    function_response = types.FunctionResponse(
                                        id=fc.id, name=fc.name, response={"result": "Reading directory..."}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "read_file":
                                    path = fc.args["path"]
                                    print(f"[ADA DEBUG] [TOOL] Tool Call: 'read_file' path='{path}'")
                                    asyncio.create_task(self.handle_read_file(path))
                                    function_response = types.FunctionResponse(
                                        id=fc.id, name=fc.name, response={"result": "Reading file..."}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "create_project":
                                    name = fc.args["name"]
                                    print(f"[ADA DEBUG] [TOOL] Tool Call: 'create_project' name='{name}'")
                                    success, msg = self.project_manager.create_project(name)
                                    if success:
                                        # Auto-switch to the newly created project
                                        self.project_manager.switch_project(name)
                                        msg += f" Switched to '{name}'."
                                        if self.on_project_update:
                                            self.on_project_update(name)
                                    function_response = types.FunctionResponse(
                                        id=fc.id, name=fc.name, response={"result": msg}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "switch_project":
                                    name = fc.args["name"]
                                    print(f"[ADA DEBUG] [TOOL] Tool Call: 'switch_project' name='{name}'")
                                    success, msg = self.project_manager.switch_project(name)
                                    if success:
                                        if self.on_project_update:
                                            self.on_project_update(name)
                                        # Gather project context and send to AI (silently, no response expected)
                                        context = self.project_manager.get_project_context()
                                        print(f"[ADA DEBUG] [PROJECT] Sending project context to AI ({len(context)} chars)")
                                        try:
                                            await self.session.send(input=f"System Notification: {msg}\n\n{context}", end_of_turn=False)
                                        except Exception as e:
                                            print(f"[ADA DEBUG] [ERR] Failed to send project context: {e}")
                                    function_response = types.FunctionResponse(
                                        id=fc.id, name=fc.name, response={"result": msg}
                                    )
                                    function_responses.append(function_response)
                                
                                elif fc.name == "list_projects":
                                    print(f"[ADA DEBUG] [TOOL] Tool Call: 'list_projects'")
                                    projects = self.project_manager.list_projects()
                                    function_response = types.FunctionResponse(
                                        id=fc.id, name=fc.name, response={"result": f"Available projects: {', '.join(projects)}"}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "list_smart_devices":
                                    print(f"[ADA DEBUG] [TOOL] Tool Call: 'list_smart_devices'")
                                    frontend_list = self.kasa_agent.get_devices_list()
                                    dev_summaries = []
                                    for d in frontend_list:
                                        provider = d.get("provider", "kasa")
                                        info = f"{d.get('alias', 'Unknown')} (Target: {d.get('ip')}, Type: {d.get('type', 'unknown')}, Provider: {provider})"
                                        info += " [ON]" if d.get("is_on") else " [OFF]"
                                        if d.get("controllable") is False:
                                            info += " [DISCOVERED_ONLY]"
                                        dev_summaries.append(info)
                                    
                                    result_str = "No devices found in cache."
                                    if dev_summaries:
                                        result_str = "Found Devices (Cached):\n" + "\n".join(dev_summaries)
                                    
                                    # Trigger frontend update
                                    if self.on_device_update:
                                        self.on_device_update(frontend_list)

                                    function_response = types.FunctionResponse(
                                        id=fc.id, name=fc.name, response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "control_light":
                                    target = fc.args["target"]
                                    action = fc.args["action"]
                                    brightness = fc.args.get("brightness")
                                    color = fc.args.get("color")
                                    
                                    print(f"[ADA DEBUG] [TOOL] Tool Call: 'control_light' Target='{target}' Action='{action}'")
                                    
                                    result_msg = f"Action '{action}' on '{target}' failed."
                                    success = False
                                    
                                    if action == "turn_on":
                                        success = await self.kasa_agent.turn_on(target)
                                        if success:
                                            result_msg = f"Turned ON '{target}'."
                                    elif action == "turn_off":
                                        success = await self.kasa_agent.turn_off(target)
                                        if success:
                                            result_msg = f"Turned OFF '{target}'."
                                    elif action == "set":
                                        success = True
                                        result_msg = f"Updated '{target}':"
                                    
                                    # Apply extra attributes if 'set' or if we just turned it on and want to set them too
                                    if success or action == "set":
                                        if brightness is not None:
                                            sb = await self.kasa_agent.set_brightness(target, brightness)
                                            if sb:
                                                result_msg += f" Set brightness to {brightness}."
                                        if color is not None:
                                            sc = await self.kasa_agent.set_color(target, color)
                                            if sc:
                                                result_msg += f" Set color to {color}."

                                    # Notify Frontend of State Change
                                    if success:
                                        updated_list = self.kasa_agent.get_devices_list()
                                        if self.on_device_update:
                                            self.on_device_update(updated_list)
                                    else:
                                        # Report Error
                                        if self.on_error:
                                            self.on_error(result_msg)

                                    function_response = types.FunctionResponse(
                                        id=fc.id, name=fc.name, response={"result": result_msg}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "discover_printers":
                                    print(f"[ADA DEBUG] [TOOL] Tool Call: 'discover_printers'")
                                    printers = await self.printer_agent.discover_printers()
                                    # Format for model
                                    if printers:
                                        printer_list = []
                                        for p in printers:
                                            printer_list.append(f"{p['name']} ({p['host']}:{p['port']}, type: {p['printer_type']})")
                                        result_str = "Found Printers:\n" + "\n".join(printer_list)
                                    else:
                                        result_str = "No printers found on network. Ensure printers are on and running OctoPrint/Moonraker."
                                    
                                    function_response = types.FunctionResponse(
                                        id=fc.id, name=fc.name, response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "print_stl":
                                    stl_path = fc.args["stl_path"]
                                    printer = fc.args["printer"]
                                    profile = fc.args.get("profile")
                                    
                                    print(f"[ADA DEBUG] [TOOL] Tool Call: 'print_stl' STL='{stl_path}' Printer='{printer}'")
                                    
                                    # Resolve 'current' to project STL
                                    if stl_path.lower() == "current":
                                        stl_path = "output.stl" # Let printer agent resolve it in root_path

                                    # Get current project path
                                    project_path = str(self.project_manager.get_current_project_path())
                                    
                                    result = await self.printer_agent.print_stl(
                                        stl_path, 
                                        printer, 
                                        profile, 
                                        root_path=project_path
                                    )
                                    result_str = result.get("message", "Unknown result")
                                    
                                    function_response = types.FunctionResponse(
                                        id=fc.id, name=fc.name, response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "get_print_status":
                                    printer = fc.args["printer"]
                                    print(f"[ADA DEBUG] [TOOL] Tool Call: 'get_print_status' Printer='{printer}'")
                                    
                                    status = await self.printer_agent.get_print_status(printer)
                                    if status:
                                        result_str = f"Printer: {status.printer}\n"
                                        result_str += f"State: {status.state}\n"
                                        result_str += f"Progress: {status.progress_percent:.1f}%\n"
                                        if status.time_remaining:
                                            result_str += f"Time Remaining: {status.time_remaining}\n"
                                        if status.time_elapsed:
                                            result_str += f"Time Elapsed: {status.time_elapsed}\n"
                                        if status.filename:
                                            result_str += f"File: {status.filename}\n"
                                        if status.temperatures:
                                            temps = status.temperatures
                                            if "hotend" in temps:
                                                result_str += f"Hotend: {temps['hotend']['current']:.0f}°C / {temps['hotend']['target']:.0f}°C\n"
                                            if "bed" in temps:
                                                result_str += f"Bed: {temps['bed']['current']:.0f}°C / {temps['bed']['target']:.0f}°C"
                                    else:
                                        result_str = f"Could not get status for printer '{printer}'. Ensure it is discovered first."
                                    
                                    function_response = types.FunctionResponse(
                                        id=fc.id, name=fc.name, response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "iterate_cad":
                                    prompt = fc.args["prompt"]
                                    print(f"[ADA DEBUG] [TOOL] Tool Call: 'iterate_cad' Prompt='{prompt}'")
                                    
                                    # Emit status
                                    if self.on_cad_status:
                                        self.on_cad_status("generating")
                                    
                                    # Get project cad folder path
                                    cad_output_dir = str(self.project_manager.get_current_project_path() / "cad")
                                    
                                    # Call CadAgent to iterate on the design
                                    cad_data = await self.cad_agent.iterate_prototype(prompt, output_dir=cad_output_dir)
                                    
                                    if cad_data:
                                        print(f"[ADA DEBUG] [OK] CadAgent iteration returned data successfully.")
                                        
                                        # Dispatch to frontend
                                        if self.on_cad_data:
                                            print(f"[ADA DEBUG] [SEND] Dispatching iterated CAD data to frontend...")
                                            self.on_cad_data(cad_data)
                                            print(f"[ADA DEBUG] [SENT] Dispatch complete.")
                                        
                                        # Save to Project
                                        self.project_manager.save_cad_artifact("output.stl", f"Iteration: {prompt}")
                                        
                                        result_str = f"Successfully iterated design: {prompt}. The updated 3D model is now displayed."
                                    else:
                                        print(f"[ADA DEBUG] [ERR] CadAgent iteration returned None.")
                                        result_str = f"Failed to iterate design with prompt: {prompt}"
                                    
                                    function_response = types.FunctionResponse(
                                        id=fc.id, name=fc.name, response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "list_calendar_events":
                                    max_results = int(fc.args.get("max_results", 5) or 5)
                                    max_results = max(1, min(max_results, 20))
                                    print(f"[ADA DEBUG] [TOOL] Tool Call: 'list_calendar_events' max_results={max_results}")

                                    try:
                                        events = await asyncio.to_thread(self.google_calendar.list_upcoming_events, max_results)
                                        self.emit_tool_view({
                                            "type": "calendar",
                                            "view": "upcoming",
                                            "title": "Kalender - Kommende Termine",
                                            "events": events,
                                        })
                                        if not events:
                                            result_str = "No upcoming events found in your primary Google Calendar."
                                        else:
                                            lines = []
                                            for event in events:
                                                event_id = event.get("id") or "unknown"
                                                title = event.get("summary") or "(No title)"
                                                start = event.get("start") or "unknown time"
                                                location = event.get("location")
                                                line = f"- ID: {event_id} | {title} at {start}"
                                                if location:
                                                    line += f" ({location})"
                                                lines.append(line)
                                            result_str = "Upcoming Google Calendar events:\n" + "\n".join(lines)
                                    except Exception as e:
                                        result_str = (
                                            "Google Calendar is not connected or unavailable. "
                                            "Open Settings and connect your Google account first. "
                                            f"Details: {str(e)}"
                                        )

                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "get_calendar_view":
                                    view_mode = str(fc.args.get("view", "today") or "today").strip().lower()
                                    max_results = int(fc.args.get("max_results", 30) or 30)
                                    max_results = max(1, min(max_results, 100))
                                    days = 7 if view_mode == "week" else 1

                                    try:
                                        events = await asyncio.to_thread(
                                            self.google_calendar.list_events_range,
                                            days,
                                            max_results,
                                        )
                                        title = "Kalender - Diese Woche" if days == 7 else "Kalender - Heute"
                                        self.emit_tool_view({
                                            "type": "calendar",
                                            "view": "week" if days == 7 else "today",
                                            "title": title,
                                            "events": events,
                                        })

                                        if not events:
                                            result_str = f"Keine Kalendereintraege fuer {view_mode} gefunden."
                                        else:
                                            lines = []
                                            for event in events:
                                                lines.append(
                                                    f"- {event.get('summary', '(No title)')} | {event.get('start', 'unknown')}"
                                                )
                                            result_str = f"Kalenderansicht ({view_mode}):\n" + "\n".join(lines)
                                    except Exception as e:
                                        result_str = f"Kalenderansicht konnte nicht geladen werden. Details: {str(e)}"

                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "create_calendar_event":
                                    title = str(fc.args.get("title", "") or "").strip()
                                    start = str(fc.args.get("start", "") or "").strip()
                                    end = str(fc.args.get("end", "") or "").strip()
                                    description = str(fc.args.get("description", "") or "").strip()
                                    location = str(fc.args.get("location", "") or "").strip()
                                    timezone_name = str(fc.args.get("timezone", "") or "").strip()

                                    print(
                                        f"[ADA DEBUG] [TOOL] Tool Call: 'create_calendar_event' "
                                        f"title='{title}', start='{start}', end='{end}'"
                                    )

                                    if not title or not start or not end:
                                        result_str = "Missing required fields. Provide title, start, and end in ISO format."
                                    else:
                                        try:
                                            created = await asyncio.to_thread(
                                                self.google_calendar.create_event,
                                                title,
                                                start,
                                                end,
                                                description,
                                                location,
                                                timezone_name,
                                            )
                                            result_str = (
                                                f"Kalendertermin erstellt: {created.get('summary', title)} "
                                                f"von {created.get('start', start)} bis {created.get('end', end)}."
                                            )
                                        except Exception as e:
                                            result_str = (
                                                "Termin konnte nicht erstellt werden. "
                                                "Pruefe Datum/Uhrzeit-Format (ISO-8601) und Google-Verbindung. "
                                                f"Details: {str(e)}"
                                            )

                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "update_calendar_event":
                                    event_id = str(fc.args.get("event_id", "") or "").strip()
                                    query = str(fc.args.get("query", "") or "").strip()
                                    match_title = str(fc.args.get("match_title", "") or "").strip()
                                    match_start = str(fc.args.get("match_start", "") or "").strip()
                                    title = str(fc.args.get("title", "") or "").strip()
                                    start = str(fc.args.get("start", "") or "").strip()
                                    end = str(fc.args.get("end", "") or "").strip()
                                    description = str(fc.args.get("description", "") or "").strip()
                                    location = str(fc.args.get("location", "") or "").strip()
                                    timezone_name = str(fc.args.get("timezone", "") or "").strip()

                                    if not event_id and not query and not match_title and not match_start:
                                        result_str = "Missing identifier. Provide event_id or one of query/match_title/match_start."
                                    else:
                                        try:
                                            updated = await asyncio.to_thread(
                                                self.google_calendar.update_event,
                                                event_id,
                                                query,
                                                match_title,
                                                match_start,
                                                title,
                                                start,
                                                end,
                                                description,
                                                location,
                                                timezone_name,
                                            )
                                            result_str = (
                                                f"Termin aktualisiert: {updated.get('summary', '(No title)')} "
                                                f"({updated.get('start', '')} - {updated.get('end', '')})."
                                            )
                                        except Exception as e:
                                            result_str = f"Termin konnte nicht aktualisiert werden. Details: {str(e)}"

                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "delete_calendar_event":
                                    event_id = str(fc.args.get("event_id", "") or "").strip()
                                    query = str(fc.args.get("query", "") or "").strip()
                                    title = str(fc.args.get("title", "") or "").strip()
                                    start = str(fc.args.get("start", "") or "").strip()

                                    if not event_id and not query and not title and not start:
                                        result_str = "Missing identifier. Provide event_id or one of query/title/start."
                                    else:
                                        try:
                                            deleted = await asyncio.to_thread(
                                                self.google_calendar.delete_event,
                                                event_id,
                                                query,
                                                title,
                                                start,
                                            )
                                            d_id = deleted.get("id", event_id)
                                            d_title = deleted.get("summary")
                                            d_start = deleted.get("start")
                                            if d_title or d_start:
                                                result_str = f"Termin geloescht: {d_title or '(No title)'} ({d_start or 'unknown time'}) [ID: {d_id}]"
                                            else:
                                                result_str = f"Termin geloescht (ID: {d_id})."
                                        except Exception as e:
                                            result_str = f"Termin konnte nicht geloescht werden. Details: {str(e)}"

                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "list_calendar_invitations":
                                    max_results = int(fc.args.get("max_results", 10) or 10)
                                    max_results = max(1, min(max_results, 50))
                                    try:
                                        invitations = await asyncio.to_thread(
                                            self.google_calendar.list_invitations,
                                            max_results,
                                        )
                                        if not invitations:
                                            result_str = "Keine kommenden Einladungen gefunden."
                                        else:
                                            lines = []
                                            for inv in invitations:
                                                lines.append(
                                                    f"- ID: {inv.get('id')} | {inv.get('summary')} | Start: {inv.get('start')} | "
                                                    f"Organizer: {inv.get('organizer')} | Status: {inv.get('response_status')}"
                                                )
                                            result_str = "Kalender-Einladungen:\n" + "\n".join(lines)
                                    except Exception as e:
                                        result_str = f"Einladungen konnten nicht geladen werden. Details: {str(e)}"

                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "respond_calendar_invitation":
                                    event_id = str(fc.args.get("event_id", "") or "").strip()
                                    query = str(fc.args.get("query", "") or "").strip()
                                    title = str(fc.args.get("title", "") or "").strip()
                                    start = str(fc.args.get("start", "") or "").strip()
                                    response_value = str(fc.args.get("response", "") or "").strip()
                                    if not response_value:
                                        result_str = "Missing required field: response."
                                    elif not event_id and not query and not title and not start:
                                        result_str = "Missing identifier. Provide event_id or one of query/title/start."
                                    else:
                                        try:
                                            answered = await asyncio.to_thread(
                                                self.google_calendar.respond_to_invitation,
                                                event_id,
                                                response_value,
                                                query,
                                                title,
                                                start,
                                            )
                                            result_str = (
                                                f"Einladung beantwortet: {answered.get('summary', '(No title)')} -> "
                                                f"{answered.get('response_status', response_value)}"
                                            )
                                        except Exception as e:
                                            result_str = f"Antwort auf Einladung fehlgeschlagen. Details: {str(e)}"

                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "connect_google_workspace":
                                    force_reauth = bool(fc.args.get("force_reauth", False))
                                    print(f"[ADA DEBUG] [TOOL] Tool Call: 'connect_google_workspace' force_reauth={force_reauth}")

                                    try:
                                        await asyncio.to_thread(self.google_calendar.connect, force_reauth)
                                        await asyncio.to_thread(self.google_gmail.connect, force_reauth)
                                        result_str = (
                                            "Google Workspace connection successful. "
                                            "Calendar and Gmail are now authorized."
                                        )
                                    except Exception as e:
                                        result_str = (
                                            "Google OAuth failed. Ensure backend/google_credentials.json exists "
                                            f"and is a valid Desktop OAuth client. Details: {str(e)}"
                                        )

                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "get_current_datetime":
                                    now = datetime.datetime.now().astimezone()
                                    result_str = (
                                        f"Current local datetime: {now.isoformat()} "
                                        f"(timezone: {now.tzname() or 'local'})."
                                    )
                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "get_weather":
                                    location = str(fc.args.get("location", "") or "").strip()
                                    units = str(fc.args.get("units", "metric") or "metric").strip()

                                    try:
                                        weather = await asyncio.to_thread(
                                            self.weather_agent.get_current_weather,
                                            location,
                                            units,
                                            "de",
                                        )
                                        self.emit_tool_view({
                                            "type": "weather",
                                            "title": "Wetterkarte",
                                            "weather": weather,
                                        })
                                        place = weather.get("location", location or "default location")
                                        country = weather.get("country")
                                        label = f"{place}, {country}" if country else place
                                        result_str = (
                                            f"Wetter fuer {label}: {weather.get('description', 'n/a')}. "
                                            f"Temperatur {weather.get('temperature', 'n/a')}°, "
                                            f"gefuehlt {weather.get('feels_like', 'n/a')}°, "
                                            f"Luftfeuchtigkeit {weather.get('humidity', 'n/a')}%, "
                                            f"Wind {weather.get('wind_speed', 'n/a')} m/s."
                                        )
                                    except Exception as e:
                                        result_str = (
                                            "Wetterdaten konnten nicht abgerufen werden. "
                                            f"Details: {str(e)}"
                                        )

                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "get_weather_forecast":
                                    location = str(fc.args.get("location", "") or "").strip()
                                    units = str(fc.args.get("units", "metric") or "metric").strip()
                                    date_hint = str(fc.args.get("date_hint", "") or "").strip()
                                    days = int(fc.args.get("days", 3) or 3)

                                    try:
                                        forecast = await asyncio.to_thread(
                                            self.weather_agent.get_forecast,
                                            location,
                                            units,
                                            "de",
                                            date_hint,
                                            days,
                                        )
                                        self.emit_tool_view({
                                            "type": "weather",
                                            "title": "Wetterkarte & Forecast",
                                            "forecast": forecast,
                                        })
                                        place = forecast.get("location", location or "default location")
                                        country = forecast.get("country")
                                        label = f"{place}, {country}" if country else place

                                        lines = []
                                        for day in forecast.get("days", []) or []:
                                            lines.append(
                                                f"- {day.get('date')}: {day.get('description', 'n/a')}, "
                                                f"{day.get('temp_min', 'n/a')} bis {day.get('temp_max', 'n/a')}°, "
                                                f"Feuchte ~{day.get('humidity_avg', 'n/a')}%, "
                                                f"Wind ~{day.get('wind_avg', 'n/a')} m/s"
                                            )

                                        if not lines:
                                            result_str = f"Keine Forecast-Daten fuer {label} verfuegbar."
                                        else:
                                            result_str = f"Vorhersage fuer {label}:\n" + "\n".join(lines)
                                    except Exception as e:
                                        result_str = (
                                            "Forecast konnte nicht abgerufen werden. "
                                            f"Details: {str(e)}"
                                        )

                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "get_weather_full_report":
                                    location = str(fc.args.get("location", "") or "").strip()
                                    units = str(fc.args.get("units", "metric") or "metric").strip()
                                    date_hint = str(fc.args.get("date_hint", "") or "").strip()
                                    days = int(fc.args.get("days", 3) or 3)
                                    include_raw = bool(fc.args.get("include_raw", False))

                                    try:
                                        report = await asyncio.to_thread(
                                            self.weather_agent.get_full_weather_report,
                                            location,
                                            units,
                                            "de",
                                            date_hint,
                                            days,
                                            include_raw,
                                        )
                                        result_str = "Full weather report (OpenWeather free plan endpoints):\n"
                                        result_str += json.dumps(report, ensure_ascii=False, indent=2)
                                    except Exception as e:
                                        result_str = (
                                            "Full weather report konnte nicht abgerufen werden. "
                                            f"Details: {str(e)}"
                                        )

                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "search_stock_symbol":
                                    query = str(fc.args.get("query", "") or "").strip()
                                    limit = int(fc.args.get("limit", 6) or 6)

                                    try:
                                        result = await asyncio.to_thread(
                                            self.finnhub_agent.search_symbol,
                                            query,
                                            limit,
                                        )
                                        matches = result.get("results", []) or []
                                        if not matches:
                                            result_str = f"Keine passenden Symbole fuer '{query}' gefunden."
                                        else:
                                            lines = []
                                            for item in matches:
                                                lines.append(
                                                    f"- {item.get('symbol', '')}: {item.get('description', '')} ({item.get('type', '')})"
                                                )
                                            result_str = "Gefundene Symbole:\n" + "\n".join(lines)
                                    except Exception as e:
                                        result_str = f"Aktiensymbol-Suche fehlgeschlagen. Details: {str(e)}"

                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "get_stock_quote":
                                    symbol = str(fc.args.get("symbol", "") or "").strip().upper()

                                    try:
                                        stock = await asyncio.to_thread(
                                            self.finnhub_agent.get_stock_quote,
                                            symbol,
                                        )
                                        self.emit_tool_view({
                                            "type": "stock",
                                            "title": f"Stock: {stock.get('symbol', symbol)}",
                                            "stock": stock,
                                        })

                                        quote = stock.get("quote", {}) or {}
                                        company = stock.get("name") or stock.get("symbol") or symbol
                                        result_str = (
                                            f"{company} ({stock.get('symbol', symbol)}): "
                                            f"{quote.get('current', 'n/a')} {stock.get('currency', '')}. "
                                            f"Aenderung {quote.get('change', 'n/a')} "
                                            f"({quote.get('percent_change', 'n/a')}%). "
                                            f"Tageshoch {quote.get('high', 'n/a')}, Tagestief {quote.get('low', 'n/a')}."
                                        )
                                    except Exception as e:
                                        result_str = f"Aktienkurs konnte nicht geladen werden. Details: {str(e)}"

                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "get_stock_news":
                                    symbol = str(fc.args.get("symbol", "") or "").strip().upper()
                                    days = int(fc.args.get("days", 7) or 7)
                                    limit = int(fc.args.get("limit", 12) or 12)

                                    try:
                                        news_result = await asyncio.to_thread(
                                            self.finnhub_agent.get_stock_news,
                                            symbol,
                                            days,
                                            limit,
                                        )
                                        title_suffix = symbol if symbol else "Market"
                                        self.emit_tool_view({
                                            "type": "stock",
                                            "title": f"Stock News: {title_suffix}",
                                            "news": news_result,
                                        })

                                        news_items = news_result.get("news", []) or []
                                        if not news_items:
                                            result_str = "Keine relevanten News gefunden."
                                        else:
                                            lines = []
                                            for item in news_items[:8]:
                                                lines.append(
                                                    f"- {item.get('headline', 'Ohne Titel')} ({item.get('source', 'Quelle unbekannt')})"
                                                )
                                            scope = news_result.get("scope") or (symbol or "market")
                                            result_str = f"Aktuelle News ({scope}):\n" + "\n".join(lines)
                                    except Exception as e:
                                        result_str = f"Stock-News konnten nicht geladen werden. Details: {str(e)}"

                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "route_plan":
                                    origin = str(fc.args.get("origin", "") or "").strip()
                                    destination = str(fc.args.get("destination", "") or "").strip()
                                    mode = "driving"
                                    alternatives = bool(fc.args.get("alternatives", False))
                                    resolved_origin = origin or resolve_default_route_origin()

                                    if not destination:
                                        result_str = "Missing required field: destination."
                                    else:
                                        try:
                                            route = await asyncio.to_thread(
                                                self.route_agent.plan_route,
                                                resolved_origin,
                                                destination,
                                                mode,
                                                alternatives,
                                            )

                                            self.emit_tool_view({
                                                "type": "route",
                                                "title": "Route Plan (Free)",
                                                "route": route,
                                            })

                                            result_str = (
                                                f"Route geplant ({route.get('mode', mode)}): "
                                                f"{route.get('origin', {}).get('label', resolved_origin)} -> "
                                                f"{route.get('destination', {}).get('label', destination)}. "
                                                f"Distanz {route.get('distance_km', 'n/a')} km, "
                                                f"Dauer {route.get('duration_human', str(route.get('duration_min', 'n/a')) + ' min')}. "
                                                "Hinweis: Diese kostenlose Variante enthaelt keine Live-Verkehrsdaten."
                                            )
                                        except Exception as e:
                                            result_str = (
                                                "Route konnte nicht geplant werden. "
                                                f"Details: {str(e)}"
                                            )

                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "clear_detail_view":
                                    self.emit_tool_view({"type": "clear", "title": "Detail View"})
                                    result_str = "Detail view wurde geleert und auf Idle zurueckgesetzt."

                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "system_check":
                                    include_network_checks = bool(fc.args.get("include_network_checks", True))
                                    print(
                                        f"[ADA DEBUG] [TOOL] Tool Call: 'system_check' "
                                        f"include_network_checks={include_network_checks}"
                                    )

                                    report = await self.run_system_check(include_network_checks=include_network_checks)
                                    summary = report.get("summary", {})
                                    checks = report.get("checks", [])

                                    if self.on_device_update:
                                        self.on_device_update(self.kasa_agent.get_devices_list())

                                    fail_items = [c for c in checks if c.get("status") == "fail"]
                                    warn_items = [c for c in checks if c.get("status") == "warn"]

                                    lines = [
                                        "System Check abgeschlossen.",
                                        (
                                            f"Ergebnis: {summary.get('passed', 0)} OK, "
                                            f"{summary.get('warned', 0)} Warnungen, "
                                            f"{summary.get('failed', 0)} Fehler "
                                            f"({summary.get('duration_ms', 0)} ms)."
                                        ),
                                    ]

                                    if fail_items:
                                        lines.append("Fehler:")
                                        for item in fail_items[:6]:
                                            lines.append(f"- {item.get('name')}: {item.get('message')}")

                                    if warn_items:
                                        lines.append("Warnungen:")
                                        for item in warn_items[:6]:
                                            lines.append(f"- {item.get('name')}: {item.get('message')}")

                                    result_str = "\n".join(lines)

                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "list_gmail_messages":
                                    max_results = int(fc.args.get("max_results", 5) or 5)
                                    max_results = max(1, min(max_results, 20))
                                    query = str(fc.args.get("query", "") or "").strip()
                                    print(
                                        f"[ADA DEBUG] [TOOL] Tool Call: 'list_gmail_messages' "
                                        f"max_results={max_results}, query='{query}'"
                                    )

                                    try:
                                        msgs = await asyncio.to_thread(
                                            self.google_gmail.list_messages,
                                            max_results,
                                            query or None,
                                        )
                                        self.emit_tool_view({
                                            "type": "email_list",
                                            "title": "Gmail - Nachrichten",
                                            "messages": msgs,
                                        })
                                        if not msgs:
                                            result_str = "No Gmail messages found for the given query."
                                        else:
                                            lines = []
                                            for msg in msgs:
                                                message_id = msg.get("id", "")
                                                sender = msg.get("from", "Unknown sender")
                                                subject = msg.get("subject", "(No subject)")
                                                date = msg.get("date", "Unknown date")
                                                snippet = msg.get("snippet", "")
                                                lines.append(
                                                    f"- ID: {message_id} | From: {sender} | Subject: {subject} | Date: {date} | Snippet: {snippet}"
                                                )
                                            result_str = "Recent Gmail messages:\n" + "\n".join(lines)
                                    except Exception as e:
                                        result_str = (
                                            "Gmail is not connected or unavailable. "
                                            "Authorize Google Workspace first. "
                                            f"Details: {str(e)}"
                                        )

                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "get_gmail_message_detail":
                                    message_id = str(fc.args.get("message_id", "") or "").strip()
                                    query = str(fc.args.get("query", "") or "").strip()

                                    if not message_id and not query:
                                        result_str = "Missing identifier. Provide message_id or query."
                                    else:
                                        try:
                                            detail = await asyncio.to_thread(
                                                self.google_gmail.get_message_detail,
                                                message_id,
                                                query or None,
                                            )
                                            self.emit_tool_view({
                                                "type": "email",
                                                "title": "Gmail - E-Mail Detail",
                                                "email": detail,
                                            })
                                            body = str(detail.get("body", "") or "").strip()
                                            preview = body[:600] + ("..." if len(body) > 600 else "")
                                            result_str = (
                                                f"Email geladen: {detail.get('subject', '(No subject)')}\n"
                                                f"Von: {detail.get('from', 'Unknown sender')}\n"
                                                f"Datum: {detail.get('date', 'Unknown date')}\n"
                                                f"Inhalt:\n{preview}"
                                            )
                                        except Exception as e:
                                            result_str = (
                                                "Email-Detail konnte nicht geladen werden. "
                                                f"Details: {str(e)}"
                                            )

                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "list_gmail_labels":
                                    print("[ADA DEBUG] [TOOL] Tool Call: 'list_gmail_labels'")
                                    try:
                                        labels = await asyncio.to_thread(self.google_gmail.list_labels)
                                        if not labels:
                                            result_str = "Keine Gmail Labels gefunden."
                                        else:
                                            lines = []
                                            for label in labels:
                                                name = label.get("name", "Unknown")
                                                ltype = label.get("type", "unknown")
                                                lines.append(f"- {name} ({ltype})")
                                            result_str = "Verfuegbare Gmail Labels:\n" + "\n".join(lines)
                                    except Exception as e:
                                        result_str = (
                                            "Gmail Labels konnten nicht geladen werden. "
                                            f"Details: {str(e)}"
                                        )

                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "update_gmail_labels":
                                    message_id = str(fc.args.get("message_id", "") or "").strip()
                                    query = str(fc.args.get("query", "") or "").strip()
                                    add_labels = fc.args.get("add_labels") or []
                                    remove_labels = fc.args.get("remove_labels") or []
                                    print(
                                        f"[ADA DEBUG] [TOOL] Tool Call: 'update_gmail_labels' "
                                        f"message_id='{message_id}', query='{query}', add={add_labels}, remove={remove_labels}"
                                    )

                                    if not message_id and not query:
                                        result_str = "Missing identifier. Provide message_id or query."
                                    else:
                                        try:
                                            updated = await asyncio.to_thread(
                                                self.google_gmail.update_message_labels,
                                                message_id,
                                                query or None,
                                                add_labels,
                                                remove_labels,
                                            )
                                            result_str = (
                                                f"Labels fuer Nachricht {updated.get('id', message_id)} aktualisiert. "
                                                f"Aktuelle Label IDs: {updated.get('labelIds', [])}"
                                            )
                                        except Exception as e:
                                            result_str = (
                                                "Gmail Labels konnten nicht aktualisiert werden. "
                                                f"Details: {str(e)}"
                                            )

                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "send_gmail_message":
                                    to = str(fc.args.get("to", "") or "").strip()
                                    subject = str(fc.args.get("subject", "") or "").strip()
                                    body = str(fc.args.get("body", "") or "").strip()
                                    print(f"[ADA DEBUG] [TOOL] Tool Call: 'send_gmail_message' to='{to}', subject='{subject}'")

                                    if not to or not subject or not body:
                                        result_str = "Missing required fields. Provide to, subject, and body."
                                    else:
                                        try:
                                            sent = await asyncio.to_thread(
                                                self.google_gmail.send_message,
                                                to,
                                                subject,
                                                body,
                                            )
                                            result_str = (
                                                "Email sent successfully. "
                                                f"Message ID: {sent.get('id', 'unknown')}"
                                            )
                                        except Exception as e:
                                            result_str = (
                                                "Failed to send Gmail message. "
                                                "Authorize Google Workspace first and verify recipient details. "
                                                f"Details: {str(e)}"
                                            )

                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "search_memory":
                                    query = str(fc.args.get("query", "") or "").strip()
                                    n_results = int(fc.args.get("n_results", 5) or 5)
                                    n_results = max(1, min(n_results, 10))
                                    print(f"[ADA DEBUG] [TOOL] Tool Call: 'search_memory' query='{query}' n={n_results}")

                                    if not self.long_term_memory_enabled:
                                        result_str = "Long-term memory is disabled in settings."
                                        function_response = types.FunctionResponse(
                                            id=fc.id, name=fc.name, response={"result": result_str}
                                        )
                                        function_responses.append(function_response)
                                        continue

                                    if self.memory_locked:
                                        result_str = "Long-term memory access is currently locked by the user. Cannot search memory."
                                        function_response = types.FunctionResponse(
                                            id=fc.id, name=fc.name, response={"result": result_str}
                                        )
                                        function_responses.append(function_response)
                                        continue

                                    memory_agent = self._ensure_memory_agent()
                                    if not memory_agent:
                                        result_str = "Long-term memory is not available. Install chromadb to enable it."
                                    elif not query:
                                        result_str = "Missing required field: query."
                                    else:
                                        try:
                                            memories = await asyncio.to_thread(
                                                memory_agent.retrieve,
                                                query,
                                                n_results,
                                                self.project_manager.current_project,
                                            )
                                            if not memories:
                                                result_str = "No relevant memories found."
                                            else:
                                                lines = [f"Found {len(memories)} relevant memory entries:"]
                                                for m in memories:
                                                    meta = m.get("metadata", {})
                                                    sender = meta.get("sender", "?")
                                                    ts = meta.get("timestamp", "")[:16]
                                                    lines.append(f"  [{ts}] {sender}: {m['text']}")
                                                result_str = "\n".join(lines)
                                        except Exception as e:
                                            result_str = f"Memory search failed: {e}"

                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "save_to_memory":
                                    text = str(fc.args.get("text", "") or "").strip()
                                    print(f"[ADA DEBUG] [TOOL] Tool Call: 'save_to_memory' text='{text[:80]}'")

                                    if not self.long_term_memory_enabled:
                                        result_str = "Long-term memory is disabled in settings."
                                        function_response = types.FunctionResponse(
                                            id=fc.id, name=fc.name, response={"result": result_str}
                                        )
                                        function_responses.append(function_response)
                                        continue

                                    if self.memory_locked:
                                        result_str = "Long-term memory access is currently locked by the user. Cannot save to memory."
                                        function_response = types.FunctionResponse(
                                            id=fc.id, name=fc.name, response={"result": result_str}
                                        )
                                        function_responses.append(function_response)
                                        continue

                                    memory_agent = self._ensure_memory_agent()
                                    if not memory_agent:
                                        result_str = "Long-term memory is not available. Install chromadb to enable it."
                                    elif not text:
                                        result_str = "Missing required field: text."
                                    else:
                                        try:
                                            await asyncio.to_thread(
                                                memory_agent.store,
                                                text,
                                                "ADA",
                                                self.project_manager.current_project,
                                            )
                                            result_str = "Saved to long-term memory successfully."
                                        except Exception as e:
                                            result_str = f"Failed to save to memory: {e}"

                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)

                                elif fc.name == "memory_status":
                                    print("[ADA DEBUG] [TOOL] Tool Call: 'memory_status'")

                                    if not self.long_term_memory_enabled:
                                        result_str = "Long-term memory is currently disabled in settings."
                                    elif not _MEMORY_AVAILABLE:
                                        result_str = "Long-term memory backend is unavailable. Install chromadb to enable it."
                                    else:
                                        memory_agent = self._ensure_memory_agent()
                                        if not memory_agent:
                                            if self._memory_init_error:
                                                result_str = (
                                                    "Long-term memory could not be initialized. "
                                                    f"Details: {self._memory_init_error}"
                                                )
                                            else:
                                                result_str = "Long-term memory is enabled but not initialized yet."
                                        else:
                                            total = memory_agent.count()
                                            recent = memory_agent.get_recent(
                                                n=3,
                                                project=self.project_manager.current_project,
                                            )
                                            lines = [
                                                "Long-term memory status:",
                                                f"- enabled: {self.long_term_memory_enabled}",
                                                f"- locked: {self.memory_locked}",
                                                f"- entries (project): {len(recent)} recent shown",
                                                f"- entries (total): {total}",
                                                f"- storage: {memory_agent._persist_dir}",
                                            ]
                                            if recent:
                                                lines.append("Recent entries:")
                                                for m in recent:
                                                    meta = m.get("metadata", {})
                                                    sender = meta.get("sender", "?")
                                                    ts = str(meta.get("timestamp", ""))[:16]
                                                    preview = str(m.get("text", "")).strip().replace("\n", " ")
                                                    if len(preview) > 120:
                                                        preview = preview[:117] + "..."
                                                    lines.append(f"- [{ts}] {sender}: {preview}")
                                            result_str = "\n".join(lines)

                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": result_str}
                                    )
                                    function_responses.append(function_response)
                        if function_responses:
                            await self.session.send_tool_response(function_responses=function_responses)
                
                # Turn/Response Loop Finished
                self.flush_chat()

                while not self.audio_in_queue.empty():
                    self.audio_in_queue.get_nowait()
        except Exception as e:
            print(f"Error in receive_audio: {e}")
            traceback.print_exc()
            # CRITICAL: Re-raise to crash the TaskGroup and trigger outer loop reconnect
            raise e

    async def play_audio(self):
        stream = await asyncio.to_thread(
            pya.open,
            format=FORMAT,
            channels=CHANNELS,
            rate=RECEIVE_SAMPLE_RATE,
            output=True,
            output_device_index=self.output_device_index,
        )
        while True:
            bytestream = await self.audio_in_queue.get()
            if self.on_audio_data:
                self.on_audio_data(bytestream)
            await asyncio.to_thread(stream.write, bytestream)

    async def get_frames(self):
        cap = await asyncio.to_thread(cv2.VideoCapture, 0, cv2.CAP_AVFOUNDATION)
        while True:
            if self.paused:
                await asyncio.sleep(0.1)
                continue
            frame = await asyncio.to_thread(self._get_frame, cap)
            if frame is None:
                break
            await asyncio.sleep(1.0)
            if self.out_queue:
                await self.out_queue.put(frame)
        cap.release()

    def _get_frame(self, cap):
        ret, frame = cap.read()
        if not ret:
            return None
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        img = PIL.Image.fromarray(frame_rgb)
        img.thumbnail([1024, 1024])
        image_io = io.BytesIO()
        img.save(image_io, format="jpeg")
        image_io.seek(0)
        image_bytes = image_io.read()
        return {"mime_type": "image/jpeg", "data": base64.b64encode(image_bytes).decode()}

    async def _get_screen(self):
        pass 
    async def get_screen(self):
         pass

    def _flatten_exceptions(self, err):
        leaves = []
        stack = [err]
        while stack:
            current = stack.pop()
            nested = getattr(current, "exceptions", None)
            if nested:
                stack.extend(list(nested))
            else:
                leaves.append(current)
        return leaves

    def _describe_connection_error(self, err):
        leaves = self._flatten_exceptions(err)
        if not leaves:
            return str(err)

        parts = []
        for item in leaves[:3]:
            text = str(item).strip()
            if text:
                parts.append(f"{type(item).__name__}: {text}")

        return " | ".join(parts) if parts else str(err)

    def _is_transient_connection_error(self, details):
        text = str(details or "").lower()
        transient_markers = [
            "connection",
            "closed",
            "eof",
            "timed out",
            "timeout",
            "reset",
            "broken pipe",
            "cancelled",
            "websocket",
            "1006",
        ]
        return any(marker in text for marker in transient_markers)

    def _build_time_context_message(self):
        now = datetime.datetime.now().astimezone()
        return (
            "System Time Context: "
            f"local_datetime={now.isoformat()} | "
            f"date={now.date().isoformat()} | "
            f"time={now.strftime('%H:%M:%S')} | "
            f"timezone={now.tzname() or 'local'}"
        )

    async def run(self, start_message=None):
        retry_delay = 1
        is_reconnect = False
        
        while not self.stop_event.is_set():
            try:
                print(f"[ADA DEBUG] [CONNECT] Connecting to Gemini Live API...")
                live_client = get_genai_client()
                async with (
                    live_client.aio.live.connect(model=MODEL, config=config) as session,
                    asyncio.TaskGroup() as tg,
                ):
                    self.session = session
                    print("[ADA DEBUG] [CONNECT] Gemini session established.")

                    self.audio_in_queue = asyncio.Queue()
                    self.out_queue = asyncio.Queue(maxsize=10)

                    tg.create_task(self.send_realtime())
                    tg.create_task(self.listen_audio())
                    # tg.create_task(self._process_video_queue()) # Removed in favor of VAD

                    if self.video_mode == "camera":
                        tg.create_task(self.get_frames())
                    elif self.video_mode == "screen":
                        tg.create_task(self.get_screen())

                    tg.create_task(self.receive_audio())
                    tg.create_task(self.play_audio())

                    # Handle Startup vs Reconnect Logic
                    if not is_reconnect:
                        if start_message:
                            print(f"[ADA DEBUG] [INFO] Sending start message: {start_message}")
                            await self.session.send(input=start_message, end_of_turn=True)

                        # Provide current local time context for reliable scheduling and relative time interpretation.
                        await self.session.send(input=self._build_time_context_message(), end_of_turn=False)

                        # Inject relevant long-term memories for this session.
                        if self.memory and self.memory.count() > 0 and not self.memory_locked:
                            try:
                                recent = self.memory.get_recent(
                                    n=12,
                                    project=self.project_manager.current_project,
                                )
                                if recent:
                                    lines = ["System Notification: Long-term memory loaded. Relevant past context:"]
                                    for m in recent:
                                        meta = m.get("metadata", {})
                                        sender = meta.get("sender", "?")
                                        ts = meta.get("timestamp", "")[:16]
                                        lines.append(f"  [{ts}] {sender}: {m['text']}")
                                    mem_block = "\n".join(lines)
                                    print(f"[MEMORY] Injecting {len(recent)} memories into session context.")
                                    await self.session.send(input=mem_block, end_of_turn=True)
                            except Exception as _me:
                                print(f"[MEMORY] Context injection failed: {_me}")
                        
                        # Sync Project State
                        if self.on_project_update and self.project_manager:
                            self.on_project_update(self.project_manager.current_project)
                    
                    else:
                        print(f"[ADA DEBUG] [RECONNECT] Connection restored.")
                        # Restore Context
                        print(f"[ADA DEBUG] [RECONNECT] Fetching recent chat history to restore context...")
                        history = self.project_manager.get_recent_chat_history(limit=10)
                        
                        context_msg = "System Notification: Connection was lost and just re-established. Here is the recent chat history to help you resume seamlessly:\n\n"
                        for entry in history:
                            sender = entry.get('sender', 'Unknown')
                            text = entry.get('text', '')
                            context_msg += f"[{sender}]: {text}\n"
                        
                        context_msg += "\nPlease acknowledge the reconnection to the user (e.g. 'I lost connection for a moment, but I'm back...') and resume what you were doing."
                        context_msg += "\n\n" + self._build_time_context_message()
                        
                        print(f"[ADA DEBUG] [RECONNECT] Sending restoration context to model...")
                        await self.session.send(input=context_msg, end_of_turn=True)

                    # Reset retry delay on successful connection
                    retry_delay = 1
                    
                    # Wait until stop event, or until the session task group exits (which happens on error)
                    # Actually, the TaskGroup context manager will exit if any tasks fail/cancel.
                    # We need to keep this block alive.
                    # The original code just waited on stop_event, but that doesn't account for session death.
                    # We should rely on the TaskGroup raising an exception when subtasks fail (like receive_audio).
                    
                    # However, since receive_audio is a task in the group, if it crashes (connection closed), 
                    # the group will cancel others and exit. We catch that exit below.
                    
                    # We can await stop_event, but if the connection dies, receive_audio crashes -> group closes -> we exit `async with` -> restart loop.
                    # To ensure we don't block indefinitely if connection dies silently (unlikely with receive_audio), we just wait.
                    await self.stop_event.wait()

            except asyncio.CancelledError:
                print(f"[ADA DEBUG] [STOP] Main loop cancelled.")
                break
                
            except Exception as e:
                # This catches ExceptionGroup from TaskGroup and direct exceptions.
                details = self._describe_connection_error(e)
                print(f"[ADA DEBUG] [ERR] Connection Error: {details}")
                if self.on_error:
                    if self._is_transient_connection_error(details):
                        self.on_error("Gemini connection interrupted. Reconnecting...")
                    else:
                        self.on_error(f"Gemini connection error: {details}")
                
                if self.stop_event.is_set():
                    break
                
                print(f"[ADA DEBUG] [RETRY] Reconnecting in {retry_delay} seconds...")
                await asyncio.sleep(retry_delay)
                retry_delay = min(retry_delay * 2, 10) # Exponential backoff capped at 10s
                is_reconnect = True # Next loop will be a reconnect
                
            finally:
                # Cleanup before retry
                if hasattr(self, 'audio_stream') and self.audio_stream:
                    try:
                        self.audio_stream.close()
                    except: 
                        pass

def get_input_devices():
    p = pyaudio.PyAudio()
    info = p.get_host_api_info_by_index(0)
    numdevices = info.get('deviceCount')
    devices = []
    for i in range(0, numdevices):
        if (p.get_device_info_by_host_api_device_index(0, i).get('maxInputChannels')) > 0:
            devices.append((i, p.get_device_info_by_host_api_device_index(0, i).get('name')))
    p.terminate()
    return devices

def get_output_devices():
    p = pyaudio.PyAudio()
    info = p.get_host_api_info_by_index(0)
    numdevices = info.get('deviceCount')
    devices = []
    for i in range(0, numdevices):
        if (p.get_device_info_by_host_api_device_index(0, i).get('maxOutputChannels')) > 0:
            devices.append((i, p.get_device_info_by_host_api_device_index(0, i).get('name')))
    p.terminate()
    return devices

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--mode",
        type=str,
        default=DEFAULT_MODE,
        help="pixels to stream from",
        choices=["camera", "screen", "none"],
    )
    args = parser.parse_args()
    main = AudioLoop(video_mode=args.mode)
    asyncio.run(main.run())