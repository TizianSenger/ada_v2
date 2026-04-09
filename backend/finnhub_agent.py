import json
import os
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError
from urllib.parse import quote_plus
from urllib.request import urlopen


class FinnhubAgent:
    def __init__(self, settings_path: str):
        self.settings_path = settings_path

    def _resolve_api_key(self):
        env_key = str(os.getenv("FINNHUB_API_KEY", "") or "").strip()
        if env_key:
            return env_key

        if os.path.exists(self.settings_path):
            try:
                with open(self.settings_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                key = str(data.get("finnhub_api_key", "") or "").strip()
                if key:
                    return key
            except Exception:
                pass

        return ""

    def _resolve_provider(self):
        env_provider = str(os.getenv("STOCK_API_PROVIDER", "") or "").strip().lower()
        if env_provider in {"finnhub", "massive"}:
            return env_provider

        if os.path.exists(self.settings_path):
            try:
                with open(self.settings_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                settings_provider = str(data.get("stock_api_provider", "") or "").strip().lower()
                if settings_provider in {"finnhub", "massive"}:
                    return settings_provider
            except Exception:
                pass

        return "finnhub"

    def _fetch_json(self, url: str, error_prefix: str):
        try:
            with urlopen(url, timeout=12) as response:
                raw = response.read().decode("utf-8")
            return json.loads(raw)
        except HTTPError as e:
            body = ""
            try:
                body = e.read().decode("utf-8", errors="ignore")
            except Exception:
                body = ""
            raise RuntimeError(f"{error_prefix}: HTTP {e.code}. {body}")
        except Exception as e:
            raise RuntimeError(f"{error_prefix}: {str(e)}")

    def _require_key(self):
        api_key = self._resolve_api_key()
        if not api_key:
            raise RuntimeError("FINNHUB_API_KEY fehlt. Bitte in Settings oder .env setzen.")
        return api_key

    @staticmethod
    def _is_auth_error(error: Exception):
        text = str(error or "")
        return "HTTP 401" in text or "UNAUTHORIZED" in text.upper() or "AUTH" in text.upper()

    def _get_chart_points_finnhub(self, ticker: str, api_key: str):
        now_unix = int(datetime.now(tz=timezone.utc).timestamp())
        from_unix = now_unix - (60 * 60 * 24 * 3)  # ~3 days
        url = (
            "https://finnhub.io/api/v1/stock/candle"
            f"?symbol={quote_plus(ticker)}"
            "&resolution=15"
            f"&from={from_unix}"
            f"&to={now_unix}"
            f"&token={quote_plus(api_key)}"
        )

        data = self._fetch_json(url, "Finnhub candle fehlgeschlagen")
        status = str(data.get("s", "") or "").lower()
        if status not in {"ok", "no_data"}:
            raise RuntimeError(f"Finnhub candle status invalid: {status or 'unknown'}")

        closes = data.get("c", []) or []
        times = data.get("t", []) or []
        points = []
        for t_val, c_val in zip(times, closes):
            if isinstance(t_val, (int, float)) and isinstance(c_val, (int, float)):
                points.append({
                    "ts_unix": int(t_val),
                    "price": float(c_val),
                })

        return {
            "provider": "finnhub",
            "range": "3d",
            "resolution": "15m",
            "points": points[-96:],  # keep chart compact for frontend
        }

    def _get_chart_points_massive(self, ticker: str, api_key: str):
        now_date = datetime.now(tz=timezone.utc).date()
        from_date = now_date - timedelta(days=5)
        url = (
            "https://api.massive.com/v2/aggs/ticker/"
            f"{quote_plus(ticker)}"
            "/range/15/minute/"
            f"{from_date.isoformat()}/{now_date.isoformat()}"
            "?adjusted=true&sort=asc&limit=120"
            f"&apiKey={quote_plus(api_key)}"
        )

        data = self._fetch_json(url, "Massive chart aggregate fehlgeschlagen")
        rows = data.get("results", []) or []

        points = []
        for row in rows:
            t_ms = row.get("t")
            close = row.get("c")
            if isinstance(t_ms, (int, float)) and isinstance(close, (int, float)):
                points.append({
                    "ts_unix": int(float(t_ms) / 1000.0),
                    "price": float(close),
                })

        return {
            "provider": "massive",
            "range": "5d",
            "resolution": "15m",
            "points": points[-96:],
        }

    def _search_symbol_finnhub(self, query: str, limit: int, api_key: str):
        url = (
            "https://finnhub.io/api/v1/search"
            f"?q={quote_plus(query)}"
            f"&token={quote_plus(api_key)}"
        )
        data = self._fetch_json(url, "Finnhub symbol search fehlgeschlagen")
        results = data.get("result", []) or []

        cleaned = []
        for item in results[:limit]:
            cleaned.append(
                {
                    "symbol": item.get("symbol"),
                    "description": item.get("description"),
                    "displaySymbol": item.get("displaySymbol"),
                    "type": item.get("type"),
                }
            )

        return {
            "query": query,
            "count": len(cleaned),
            "results": cleaned,
        }

    def _search_symbol_massive(self, query: str, limit: int, api_key: str):
        url = (
            "https://api.massive.com/v3/reference/tickers"
            f"?search={quote_plus(query)}"
            "&active=true"
            f"&limit={int(limit)}"
            f"&apiKey={quote_plus(api_key)}"
        )
        data = self._fetch_json(url, "Massive ticker search fehlgeschlagen")
        results = data.get("results", []) or []

        cleaned = []
        for item in results[:limit]:
            cleaned.append(
                {
                    "symbol": item.get("ticker"),
                    "description": item.get("name"),
                    "displaySymbol": item.get("ticker"),
                    "type": item.get("type"),
                }
            )

        return {
            "query": query,
            "count": len(cleaned),
            "results": cleaned,
        }

    def _get_stock_quote_finnhub(self, ticker: str, api_key: str):
        quote_url = (
            "https://finnhub.io/api/v1/quote"
            f"?symbol={quote_plus(ticker)}"
            f"&token={quote_plus(api_key)}"
        )
        profile_url = (
            "https://finnhub.io/api/v1/stock/profile2"
            f"?symbol={quote_plus(ticker)}"
            f"&token={quote_plus(api_key)}"
        )

        quote = self._fetch_json(quote_url, "Finnhub quote fehlgeschlagen")
        profile = self._fetch_json(profile_url, "Finnhub profile fehlgeschlagen")

        current_price = quote.get("c")
        previous_close = quote.get("pc")
        if current_price in (None, 0) and previous_close in (None, 0):
            raise RuntimeError(f"Keine Kursdaten fuer {ticker} gefunden.")

        ts = quote.get("t")
        ts_iso = None
        if isinstance(ts, (int, float)) and ts > 0:
            ts_iso = datetime.fromtimestamp(float(ts), tz=timezone.utc).isoformat()

        try:
            chart = self._get_chart_points_finnhub(ticker, api_key)
        except Exception:
            chart = {"provider": "finnhub", "range": "3d", "resolution": "15m", "points": []}

        return {
            "symbol": ticker,
            "name": profile.get("name") or ticker,
            "exchange": profile.get("exchange") or "",
            "currency": profile.get("currency") or "USD",
            "industry": profile.get("finnhubIndustry") or "",
            "country": profile.get("country") or "",
            "ipo": profile.get("ipo") or "",
            "weburl": profile.get("weburl") or "",
            "logo": profile.get("logo") or "",
            "quote": {
                "current": current_price,
                "change": quote.get("d"),
                "percent_change": quote.get("dp"),
                "high": quote.get("h"),
                "low": quote.get("l"),
                "open": quote.get("o"),
                "previous_close": previous_close,
                "timestamp_unix": ts,
                "timestamp_iso": ts_iso,
            },
            "chart": chart,
        }

    def _get_stock_quote_massive(self, ticker: str, api_key: str):
        profile_url = (
            "https://api.massive.com/v3/reference/tickers/"
            f"{quote_plus(ticker)}"
            f"?apiKey={quote_plus(api_key)}"
        )
        prev_agg_url = (
            "https://api.massive.com/v2/aggs/ticker/"
            f"{quote_plus(ticker)}"
            "/prev"
            "?adjusted=true"
            f"&apiKey={quote_plus(api_key)}"
        )

        profile_data = self._fetch_json(profile_url, "Massive profile fehlgeschlagen")
        agg_data = self._fetch_json(prev_agg_url, "Massive aggregate quote fehlgeschlagen")

        profile = profile_data.get("results", {}) or {}
        rows = agg_data.get("results", []) or []
        row = rows[0] if rows else {}

        close_price = row.get("c")
        open_price = row.get("o")
        high_price = row.get("h")
        low_price = row.get("l")
        ts_ms = row.get("t")

        if close_price in (None, 0) and open_price in (None, 0):
            raise RuntimeError(f"Keine Kursdaten fuer {ticker} gefunden.")

        change = None
        percent_change = None
        if isinstance(close_price, (int, float)) and isinstance(open_price, (int, float)) and open_price not in (0, 0.0):
            change = float(close_price) - float(open_price)
            percent_change = (change / float(open_price)) * 100.0

        ts_iso = None
        if isinstance(ts_ms, (int, float)) and ts_ms > 0:
            ts_iso = datetime.fromtimestamp(float(ts_ms) / 1000.0, tz=timezone.utc).isoformat()

        try:
            chart = self._get_chart_points_massive(ticker, api_key)
        except Exception:
            chart = {"provider": "massive", "range": "5d", "resolution": "15m", "points": []}

        return {
            "symbol": ticker,
            "name": profile.get("name") or ticker,
            "exchange": profile.get("primary_exchange") or "",
            "currency": profile.get("currency_name") or "USD",
            "industry": profile.get("sic_description") or "",
            "country": profile.get("locale") or "",
            "ipo": profile.get("list_date") or "",
            "weburl": profile.get("homepage_url") or "",
            "logo": profile.get("branding", {}).get("icon_url") or "",
            "quote": {
                "current": close_price,
                "change": change,
                "percent_change": percent_change,
                "high": high_price,
                "low": low_price,
                "open": open_price,
                "previous_close": open_price,
                "timestamp_unix": int(ts_ms / 1000.0) if isinstance(ts_ms, (int, float)) and ts_ms > 0 else None,
                "timestamp_iso": ts_iso,
            },
            "chart": chart,
        }

    def _get_stock_news_finnhub(self, ticker: str, days: int, limit: int, api_key: str):
        if ticker:
            to_date = datetime.now(tz=timezone.utc).date()
            from_date = to_date - timedelta(days=max(1, min(int(days or 7), 30)))
            url = (
                "https://finnhub.io/api/v1/company-news"
                f"?symbol={quote_plus(ticker)}"
                f"&from={from_date.isoformat()}"
                f"&to={to_date.isoformat()}"
                f"&token={quote_plus(api_key)}"
            )
            data = self._fetch_json(url, "Finnhub company-news fehlgeschlagen")
            source_label = ticker
        else:
            url = (
                "https://finnhub.io/api/v1/news"
                "?category=general"
                f"&token={quote_plus(api_key)}"
            )
            data = self._fetch_json(url, "Finnhub market news fehlgeschlagen")
            source_label = "market"

        if not isinstance(data, list):
            raise RuntimeError("Unerwartetes News-Format von Finnhub.")

        sorted_items = sorted(
            data,
            key=lambda item: float(item.get("datetime") or 0),
            reverse=True,
        )

        news = []
        for item in sorted_items[:limit]:
            dt_val = item.get("datetime")
            dt_iso = None
            if isinstance(dt_val, (int, float)) and dt_val > 0:
                dt_iso = datetime.fromtimestamp(float(dt_val), tz=timezone.utc).isoformat()

            news.append(
                {
                    "headline": item.get("headline") or "",
                    "summary": item.get("summary") or "",
                    "source": item.get("source") or "",
                    "url": item.get("url") or "",
                    "image": item.get("image") or "",
                    "related": item.get("related") or "",
                    "datetime_unix": dt_val,
                    "datetime_iso": dt_iso,
                }
            )

        return {
            "symbol": ticker,
            "scope": source_label,
            "count": len(news),
            "news": news,
        }

    def _get_stock_news_massive(self, ticker: str, limit: int, api_key: str):
        url = (
            "https://api.massive.com/v2/reference/news"
            f"?limit={int(limit)}"
            f"&apiKey={quote_plus(api_key)}"
        )
        if ticker:
            url += f"&ticker={quote_plus(ticker)}"

        data = self._fetch_json(url, "Massive news fehlgeschlagen")
        items = data.get("results", []) or []

        news = []
        for item in items[:limit]:
            # Massive returns RFC3339 strings; keep both iso + unix where possible.
            published_utc = str(item.get("published_utc", "") or "").strip()
            dt_iso = published_utc or None
            dt_unix = None
            if published_utc:
                try:
                    normalized = published_utc.replace("Z", "+00:00")
                    dt_unix = int(datetime.fromisoformat(normalized).timestamp())
                except Exception:
                    dt_unix = None

            news.append(
                {
                    "headline": item.get("title") or "",
                    "summary": item.get("description") or "",
                    "source": item.get("publisher", {}).get("name") or "",
                    "url": item.get("article_url") or "",
                    "image": item.get("image_url") or "",
                    "related": item.get("tickers", []) or [],
                    "datetime_unix": dt_unix,
                    "datetime_iso": dt_iso,
                }
            )

        scope = ticker if ticker else "market"
        return {
            "symbol": ticker,
            "scope": scope,
            "count": len(news),
            "news": news,
        }

    def search_symbol(self, query: str, limit: int = 6):
        api_key = self._require_key()
        q = str(query or "").strip()
        if not q:
            raise RuntimeError("Suchbegriff fehlt.")

        final_limit = max(1, min(int(limit or 6), 20))
        provider = self._resolve_provider()

        if provider == "massive":
            return self._search_symbol_massive(q, final_limit, api_key)

        try:
            return self._search_symbol_finnhub(q, final_limit, api_key)
        except Exception as e:
            if self._is_auth_error(e):
                # Auto-fallback: many users paste a Massive key into FINNHUB_API_KEY.
                return self._search_symbol_massive(q, final_limit, api_key)
            raise

    def get_stock_quote(self, symbol: str):
        api_key = self._require_key()
        ticker = str(symbol or "").strip().upper()
        if not ticker:
            raise RuntimeError("Symbol fehlt (z.B. AAPL, MSFT, TSLA).")
        provider = self._resolve_provider()

        if provider == "massive":
            return self._get_stock_quote_massive(ticker, api_key)

        try:
            return self._get_stock_quote_finnhub(ticker, api_key)
        except Exception as e:
            if self._is_auth_error(e):
                return self._get_stock_quote_massive(ticker, api_key)
            raise

    def get_stock_news(self, symbol: str = "", days: int = 7, limit: int = 12):
        api_key = self._require_key()
        final_limit = max(1, min(int(limit or 12), 30))

        ticker = str(symbol or "").strip().upper()
        provider = self._resolve_provider()

        if provider == "massive":
            return self._get_stock_news_massive(ticker, final_limit, api_key)

        try:
            return self._get_stock_news_finnhub(ticker, days, final_limit, api_key)
        except Exception as e:
            if self._is_auth_error(e):
                return self._get_stock_news_massive(ticker, final_limit, api_key)
            raise
