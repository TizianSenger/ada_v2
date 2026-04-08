import base64
from email.mime.text import MIMEText
from typing import List, Dict, Any, Optional

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from google_calendar_integration import GoogleCalendarIntegration, DEFAULT_SCOPES, _format_google_api_error


class GoogleGmailIntegration:
    def __init__(self, credentials_path: str = None, token_path: str = None):
        self._oauth = GoogleCalendarIntegration(
            credentials_path=credentials_path,
            token_path=token_path,
        )

    def connect(self, force_reauth: bool = False) -> str:
        creds = self._oauth.get_credentials(scopes=DEFAULT_SCOPES, force_reauth=force_reauth)
        try:
            service = build("gmail", "v1", credentials=creds)
            service.users().getProfile(userId="me").execute()
        except Exception as e:
            raise RuntimeError(
                _format_google_api_error(
                    e,
                    "Gmail",
                    "https://console.cloud.google.com/apis/library/gmail.googleapis.com",
                )
            )

        return "Google Gmail OAuth und API-Check erfolgreich."

    def list_messages(self, max_results: int = 5, query: Optional[str] = None) -> List[Dict[str, Any]]:
        max_results = max(1, min(int(max_results), 20))
        creds = self._oauth.get_credentials(scopes=DEFAULT_SCOPES)
        service = build("gmail", "v1", credentials=creds)

        request = service.users().messages().list(
            userId="me",
            maxResults=max_results,
            q=query or None,
        )
        data = request.execute()
        messages = data.get("messages", [])

        results: List[Dict[str, Any]] = []
        for item in messages:
            message_id = item.get("id")
            if not message_id:
                continue

            detail = service.users().messages().get(
                userId="me",
                id=message_id,
                format="metadata",
                metadataHeaders=["From", "Subject", "Date"],
            ).execute()

            headers = detail.get("payload", {}).get("headers", [])
            header_map = {h.get("name"): h.get("value") for h in headers}

            results.append(
                {
                    "id": message_id,
                    "from": header_map.get("From", "Unknown sender"),
                    "subject": header_map.get("Subject", "(No subject)"),
                    "date": header_map.get("Date", "Unknown date"),
                    "snippet": detail.get("snippet", ""),
                }
            )

        return results

    def list_labels(self) -> List[Dict[str, Any]]:
        creds = self._oauth.get_credentials(scopes=DEFAULT_SCOPES)
        service = build("gmail", "v1", credentials=creds)

        data = service.users().labels().list(userId="me").execute()
        labels = data.get("labels", [])

        return [
            {
                "id": label.get("id"),
                "name": label.get("name"),
                "type": label.get("type"),
            }
            for label in labels
        ]

    def update_message_labels(
        self,
        message_id: str = "",
        query: Optional[str] = None,
        add_labels: Optional[List[str]] = None,
        remove_labels: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        creds = self._oauth.get_credentials(scopes=DEFAULT_SCOPES)
        service = build("gmail", "v1", credentials=creds)

        add_labels = add_labels or []
        remove_labels = remove_labels or []

        labels_data = service.users().labels().list(userId="me").execute()
        labels = labels_data.get("labels", [])
        by_name = {str(label.get("name", "")).lower(): label.get("id") for label in labels}

        def to_label_id(label_name: str) -> Optional[str]:
            key = str(label_name or "").strip().lower()
            return by_name.get(key)

        add_ids = [to_label_id(name) for name in add_labels]
        remove_ids = [to_label_id(name) for name in remove_labels]

        missing_add = [name for name, lid in zip(add_labels, add_ids) if not lid]
        missing_remove = [name for name, lid in zip(remove_labels, remove_ids) if not lid]

        if missing_add or missing_remove:
            missing = []
            if missing_add:
                missing.append(f"add: {', '.join(missing_add)}")
            if missing_remove:
                missing.append(f"remove: {', '.join(missing_remove)}")
            raise RuntimeError(f"Unbekannte Labels: {' | '.join(missing)}")

        resolved_message_id = str(message_id or "").strip()
        if not resolved_message_id:
            lookup = service.users().messages().list(
                userId="me",
                maxResults=1,
                q=(query or "").strip() or None,
            ).execute()
            items = lookup.get("messages", [])
            if not items:
                raise RuntimeError(
                    "Keine passende Nachricht gefunden. Bitte message_id angeben oder eine praezisere query nutzen."
                )
            resolved_message_id = str(items[0].get("id") or "").strip()
            if not resolved_message_id:
                raise RuntimeError("Nachrichten-ID konnte nicht aufgeloest werden.")

        body = {
            "addLabelIds": [lid for lid in add_ids if lid],
            "removeLabelIds": [lid for lid in remove_ids if lid],
        }

        try:
            modified = service.users().messages().modify(
                userId="me",
                id=resolved_message_id,
                body=body,
            ).execute()
        except Exception as e:
            raise RuntimeError(
                _format_google_api_error(
                    e,
                    "Gmail",
                    "https://console.cloud.google.com/apis/library/gmail.googleapis.com",
                )
            )

        return {
            "id": modified.get("id", resolved_message_id),
            "labelIds": modified.get("labelIds", []),
        }

    def send_message(self, to: str, subject: str, body: str) -> Dict[str, Any]:
        creds = self._oauth.get_credentials(scopes=DEFAULT_SCOPES)
        service = build("gmail", "v1", credentials=creds)

        mime_msg = MIMEText(body, "plain", "utf-8")
        mime_msg["to"] = to
        mime_msg["subject"] = subject

        raw = base64.urlsafe_b64encode(mime_msg.as_bytes()).decode("utf-8")
        sent = service.users().messages().send(userId="me", body={"raw": raw}).execute()

        return {
            "id": sent.get("id"),
            "threadId": sent.get("threadId"),
            "labelIds": sent.get("labelIds", []),
        }
