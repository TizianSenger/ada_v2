import os
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly"
CALENDAR_WRITE_SCOPE = "https://www.googleapis.com/auth/calendar.events"
GMAIL_READ_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"
GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"
GMAIL_MODIFY_SCOPE = "https://www.googleapis.com/auth/gmail.modify"
DEFAULT_SCOPES = [
    CALENDAR_SCOPE,
    CALENDAR_WRITE_SCOPE,
    GMAIL_READ_SCOPE,
    GMAIL_SEND_SCOPE,
    GMAIL_MODIFY_SCOPE,
]


def _format_google_api_error(error: Exception, api_name: str, enable_url: str) -> str:
    if isinstance(error, HttpError):
        status = getattr(error.resp, "status", "unknown")
        body = ""
        try:
            body = error.content.decode("utf-8", errors="ignore") if error.content else ""
        except Exception:
            body = str(error)

        body_lower = body.lower()
        if "has not been used" in body_lower or "is not enabled" in body_lower or "accessnotconfigured" in body_lower:
            return (
                f"{api_name} API ist im Google Cloud Projekt noch nicht aktiviert. "
                f"Bitte aktiviere sie hier: {enable_url}"
            )

        if "insufficient authentication scopes" in body_lower or "insufficientpermissions" in body_lower:
            return (
                f"{api_name} hat nicht genug OAuth-Scopes. "
                "Bitte connect_google_workspace mit force_reauth=true ausfuehren und erneut zustimmen."
            )

        if status == 403:
            return (
                f"{api_name} API Zugriff verweigert (403). "
                f"Pruefe OAuth Consent Screen, Test User und API-Aktivierung: {enable_url}"
            )

        return f"{api_name} API Fehler ({status}): {body or str(error)}"

    return f"{api_name} API Fehler: {str(error)}"


class GoogleCalendarIntegration:
    def __init__(self, credentials_path: str = None, token_path: str = None):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        self.credentials_path = credentials_path or os.path.join(base_dir, "google_credentials.json")
        self.token_path = token_path or os.path.join(base_dir, "google_token.json")

    def _save_credentials(self, creds: Credentials) -> None:
        with open(self.token_path, "w", encoding="utf-8") as token_file:
            token_file.write(creds.to_json())

    def get_credentials(self, scopes: List[str] = None, force_reauth: bool = False) -> Credentials:
        scopes = scopes or DEFAULT_SCOPES

        creds = None
        if os.path.exists(self.token_path) and not force_reauth:
            creds = Credentials.from_authorized_user_file(self.token_path, scopes=scopes)

        # If token exists but misses newly required scopes (e.g. write/modify), force a new OAuth flow.
        if creds and hasattr(creds, "has_scopes") and not creds.has_scopes(scopes):
            creds = None

        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            self._save_credentials(creds)
            if hasattr(creds, "has_scopes") and not creds.has_scopes(scopes):
                creds = None
            else:
                return creds

        if creds and creds.valid:
            return creds

        if not os.path.exists(self.credentials_path):
            raise FileNotFoundError(
                "google_credentials.json not found in backend/. "
                "Create an OAuth Desktop Client in Google Cloud and place the JSON here."
            )

        flow = InstalledAppFlow.from_client_secrets_file(self.credentials_path, scopes)
        creds = flow.run_local_server(port=0)
        self._save_credentials(creds)
        return creds

    def connect(self, force_reauth: bool = False) -> str:
        creds = self.get_credentials(scopes=DEFAULT_SCOPES, force_reauth=force_reauth)

        try:
            service = build("calendar", "v3", credentials=creds)
            now = datetime.now(timezone.utc).isoformat()
            service.events().list(
                calendarId="primary",
                timeMin=now,
                maxResults=1,
                singleEvents=True,
                orderBy="startTime",
            ).execute()
        except Exception as e:
            raise RuntimeError(
                _format_google_api_error(
                    e,
                    "Google Calendar",
                    "https://console.cloud.google.com/apis/library/calendar-json.googleapis.com",
                )
            )

        return "Google Calendar OAuth und API-Check erfolgreich."

    def list_upcoming_events(self, max_results: int = 5) -> List[Dict[str, Any]]:
        max_results = max(1, min(int(max_results), 20))
        creds = self.get_credentials(scopes=DEFAULT_SCOPES)

        service = build("calendar", "v3", credentials=creds)
        now = datetime.now(timezone.utc).isoformat()

        events_result = (
            service.events()
            .list(
                calendarId="primary",
                timeMin=now,
                maxResults=max_results,
                singleEvents=True,
                orderBy="startTime",
            )
            .execute()
        )

        events = events_result.get("items", [])
        normalized = []

        for event in events:
            start = event.get("start", {}).get("dateTime") or event.get("start", {}).get("date")
            normalized.append(
                {
                    "summary": event.get("summary", "(No title)"),
                    "start": start,
                    "location": event.get("location"),
                    "id": event.get("id"),
                }
            )

        return normalized

    def list_events_range(self, days: int = 1, max_results: int = 30) -> List[Dict[str, Any]]:
        days = max(1, min(int(days), 7))
        max_results = max(1, min(int(max_results), 100))

        creds = self.get_credentials(scopes=DEFAULT_SCOPES)
        service = build("calendar", "v3", credentials=creds)

        start_dt = datetime.now(timezone.utc)
        end_dt = start_dt + timedelta(days=days)

        events_result = (
            service.events()
            .list(
                calendarId="primary",
                timeMin=start_dt.isoformat(),
                timeMax=end_dt.isoformat(),
                maxResults=max_results,
                singleEvents=True,
                orderBy="startTime",
            )
            .execute()
        )

        events = events_result.get("items", [])
        normalized = []
        for event in events:
            start = event.get("start", {}).get("dateTime") or event.get("start", {}).get("date")
            end = event.get("end", {}).get("dateTime") or event.get("end", {}).get("date")
            normalized.append(
                {
                    "summary": event.get("summary", "(No title)"),
                    "start": start,
                    "end": end,
                    "location": event.get("location"),
                    "id": event.get("id"),
                }
            )

        return normalized

    def _find_candidate_events(
        self,
        query: str = "",
        title: str = "",
        start: str = "",
        max_results: int = 20,
    ) -> List[Dict[str, Any]]:
        max_results = max(1, min(int(max_results), 50))
        creds = self.get_credentials(scopes=DEFAULT_SCOPES)
        service = build("calendar", "v3", credentials=creds)

        # Include historical range so users can reference recent events while still prioritizing current usage.
        time_min = (datetime.now(timezone.utc) - timedelta(days=365)).isoformat()
        q = str(query or "").strip() or None
        wanted_title = str(title or "").strip().lower()
        wanted_start = str(start or "").strip()

        events_result = (
            service.events()
            .list(
                calendarId="primary",
                timeMin=time_min,
                q=q,
                maxResults=max_results,
                singleEvents=True,
                orderBy="startTime",
            )
            .execute()
        )

        candidates: List[Dict[str, Any]] = []
        for event in events_result.get("items", []):
            event_title = str(event.get("summary", "") or "")
            event_start = event.get("start", {}).get("dateTime") or event.get("start", {}).get("date") or ""

            if wanted_title and wanted_title not in event_title.lower():
                continue
            if wanted_start and not str(event_start).startswith(wanted_start):
                continue

            candidates.append(
                {
                    "id": event.get("id"),
                    "summary": event.get("summary", "(No title)"),
                    "start": event_start,
                }
            )

        return candidates

    def _resolve_single_event(
        self,
        event_id: str = "",
        query: str = "",
        title: str = "",
        start: str = "",
    ) -> Dict[str, Any]:
        resolved_event_id = str(event_id or "").strip()
        if resolved_event_id:
            return {"id": resolved_event_id, "summary": "", "start": ""}

        candidates = self._find_candidate_events(query=query, title=title, start=start, max_results=20)
        if not candidates:
            raise RuntimeError(
                "Kein passender Termin gefunden. Bitte event_id angeben oder query/title/start praezisieren."
            )
        if len(candidates) > 1:
            lines = [
                f"{c.get('id')} | {c.get('summary')} | {c.get('start')}"
                for c in candidates[:5]
            ]
            raise RuntimeError(
                "Mehrere passende Termine gefunden. Bitte event_id nutzen oder genauer filtern. Kandidaten: "
                + " ; ".join(lines)
            )

        return {
            "id": str(candidates[0].get("id") or "").strip(),
            "summary": str(candidates[0].get("summary") or ""),
            "start": str(candidates[0].get("start") or ""),
        }

    def create_event(
        self,
        title: str,
        start: str,
        end: str,
        description: str = "",
        location: str = "",
        timezone_name: str = "",
    ) -> Dict[str, Any]:
        creds = self.get_credentials(scopes=DEFAULT_SCOPES)
        service = build("calendar", "v3", credentials=creds)

        event = {
            "summary": title,
            "start": {"dateTime": start},
            "end": {"dateTime": end},
        }

        if description:
            event["description"] = description
        if location:
            event["location"] = location
        if timezone_name:
            event["start"]["timeZone"] = timezone_name
            event["end"]["timeZone"] = timezone_name

        try:
            created = service.events().insert(calendarId="primary", body=event).execute()
            return {
                "id": created.get("id"),
                "summary": created.get("summary", title),
                "start": created.get("start", {}).get("dateTime") or created.get("start", {}).get("date"),
                "end": created.get("end", {}).get("dateTime") or created.get("end", {}).get("date"),
                "htmlLink": created.get("htmlLink"),
            }
        except Exception as e:
            raise RuntimeError(
                _format_google_api_error(
                    e,
                    "Google Calendar",
                    "https://console.cloud.google.com/apis/library/calendar-json.googleapis.com",
                )
            )

    def update_event(
        self,
        event_id: str = "",
        query: str = "",
        match_title: str = "",
        match_start: str = "",
        title: str = "",
        start: str = "",
        end: str = "",
        description: str = "",
        location: str = "",
        timezone_name: str = "",
    ) -> Dict[str, Any]:
        creds = self.get_credentials(scopes=DEFAULT_SCOPES)
        service = build("calendar", "v3", credentials=creds)

        resolved = self._resolve_single_event(
            event_id=event_id,
            query=query,
            title=match_title,
            start=match_start,
        )
        resolved_event_id = resolved.get("id", "")
        if not resolved_event_id:
            raise RuntimeError("event_id konnte nicht aufgeloest werden.")

        try:
            event = service.events().get(calendarId="primary", eventId=resolved_event_id).execute()

            if title:
                event["summary"] = title
            if description:
                event["description"] = description
            if location:
                event["location"] = location

            if start:
                if "T" in start:
                    event["start"] = {"dateTime": start}
                else:
                    event["start"] = {"date": start}
            if end:
                if "T" in end:
                    event["end"] = {"dateTime": end}
                else:
                    event["end"] = {"date": end}

            if timezone_name:
                if "dateTime" in event.get("start", {}):
                    event["start"]["timeZone"] = timezone_name
                if "dateTime" in event.get("end", {}):
                    event["end"]["timeZone"] = timezone_name

            updated = service.events().update(
                calendarId="primary",
                eventId=resolved_event_id,
                body=event,
            ).execute()

            return {
                "id": updated.get("id", resolved_event_id),
                "summary": updated.get("summary", "(No title)"),
                "start": updated.get("start", {}).get("dateTime") or updated.get("start", {}).get("date"),
                "end": updated.get("end", {}).get("dateTime") or updated.get("end", {}).get("date"),
                "htmlLink": updated.get("htmlLink"),
            }
        except Exception as e:
            raise RuntimeError(
                _format_google_api_error(
                    e,
                    "Google Calendar",
                    "https://console.cloud.google.com/apis/library/calendar-json.googleapis.com",
                )
            )

    def delete_event(
        self,
        event_id: str = "",
        query: str = "",
        title: str = "",
        start: str = "",
    ) -> Dict[str, Any]:
        creds = self.get_credentials(scopes=DEFAULT_SCOPES)
        service = build("calendar", "v3", credentials=creds)

        resolved = self._resolve_single_event(event_id=event_id, query=query, title=title, start=start)
        resolved_event_id = str(resolved.get("id") or "").strip()
        resolved_summary = str(resolved.get("summary") or "")
        resolved_start = str(resolved.get("start") or "")

        if not resolved_event_id:
            raise RuntimeError("event_id konnte nicht aufgeloest werden.")

        try:
            service.events().delete(calendarId="primary", eventId=resolved_event_id).execute()
            return {
                "id": resolved_event_id,
                "summary": resolved_summary,
                "start": resolved_start,
                "deleted": True,
            }
        except Exception as e:
            raise RuntimeError(
                _format_google_api_error(
                    e,
                    "Google Calendar",
                    "https://console.cloud.google.com/apis/library/calendar-json.googleapis.com",
                )
            )

    def list_invitations(self, max_results: int = 10) -> List[Dict[str, Any]]:
        max_results = max(1, min(int(max_results), 50))
        creds = self.get_credentials(scopes=DEFAULT_SCOPES)
        service = build("calendar", "v3", credentials=creds)

        primary = service.calendarList().get(calendarId="primary").execute()
        primary_email = str(primary.get("id", "") or "").lower()
        now = datetime.now(timezone.utc).isoformat()

        events_result = (
            service.events()
            .list(
                calendarId="primary",
                timeMin=now,
                maxResults=max_results,
                singleEvents=True,
                orderBy="startTime",
            )
            .execute()
        )

        events = events_result.get("items", [])
        invitations: List[Dict[str, Any]] = []

        for event in events:
            organizer = event.get("organizer", {}) or {}
            attendees = event.get("attendees", []) or []

            self_attendee = None
            for attendee in attendees:
                if attendee.get("self") is True:
                    self_attendee = attendee
                    break
                attendee_email = str(attendee.get("email", "") or "").lower()
                if primary_email and attendee_email == primary_email:
                    self_attendee = attendee
                    break

            if not self_attendee:
                continue

            response_status = self_attendee.get("responseStatus", "needsAction")
            start = event.get("start", {}).get("dateTime") or event.get("start", {}).get("date")

            invitations.append(
                {
                    "id": event.get("id"),
                    "summary": event.get("summary", "(No title)"),
                    "start": start,
                    "organizer": organizer.get("email") or organizer.get("displayName") or "unknown",
                    "response_status": response_status,
                }
            )

        return invitations

    def respond_to_invitation(
        self,
        event_id: str = "",
        response: str = "",
        query: str = "",
        title: str = "",
        start: str = "",
    ) -> Dict[str, Any]:
        valid = {"accepted", "declined", "tentative", "needsAction"}
        response = str(response or "").strip()
        if response not in valid:
            raise RuntimeError("response muss accepted, declined, tentative oder needsAction sein.")

        creds = self.get_credentials(scopes=DEFAULT_SCOPES)
        service = build("calendar", "v3", credentials=creds)

        resolved = self._resolve_single_event(event_id=event_id, query=query, title=title, start=start)
        resolved_event_id = str(resolved.get("id") or "").strip()
        if not resolved_event_id:
            raise RuntimeError("event_id konnte nicht aufgeloest werden.")

        try:
            event = service.events().get(calendarId="primary", eventId=resolved_event_id).execute()
            attendees = event.get("attendees", []) or []

            if not attendees:
                raise RuntimeError("Dieser Termin hat keine Teilnehmerliste.")

            found = False
            for attendee in attendees:
                if attendee.get("self") is True:
                    attendee["responseStatus"] = response
                    found = True
                    break

            if not found:
                primary = service.calendarList().get(calendarId="primary").execute()
                primary_email = str(primary.get("id", "") or "").lower()
                for attendee in attendees:
                    if str(attendee.get("email", "") or "").lower() == primary_email:
                        attendee["responseStatus"] = response
                        found = True
                        break

            if not found:
                raise RuntimeError("Eigener Teilnehmer-Eintrag nicht gefunden.")

            event["attendees"] = attendees
            updated = service.events().patch(
                calendarId="primary",
                eventId=resolved_event_id,
                body={"attendees": attendees},
            ).execute()

            return {
                "id": updated.get("id", resolved_event_id),
                "summary": updated.get("summary", "(No title)"),
                "response_status": response,
            }
        except Exception as e:
            raise RuntimeError(
                _format_google_api_error(
                    e,
                    "Google Calendar",
                    "https://console.cloud.google.com/apis/library/calendar-json.googleapis.com",
                )
            )
