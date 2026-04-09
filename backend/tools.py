"""Tool declarations for Gemini function calling in ADA."""

# CAD and Web
_generate_cad_tool = {
    "name": "generate_cad",
    "description": "Generate a 3D CAD prototype from a user prompt.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "prompt": {
                "type": "STRING",
                "description": "Description of the object to generate."
            }
        },
        "required": ["prompt"]
    }
}

_iterate_cad_tool = {
    "name": "iterate_cad",
    "description": "Refine or modify the current CAD model with an iteration prompt.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "prompt": {
                "type": "STRING",
                "description": "How to change the current CAD model."
            }
        },
        "required": ["prompt"]
    }
}

_run_web_agent_tool = {
    "name": "run_web_agent",
    "description": "Run autonomous browser automation for a user task.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "prompt": {
                "type": "STRING",
                "description": "Detailed browser task to execute."
            }
        },
        "required": ["prompt"]
    }
}

# File system and project management
_write_file_tool = {
    "name": "write_file",
    "description": "Write text content to a file path.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "path": {
                "type": "STRING",
                "description": "Target file path."
            },
            "content": {
                "type": "STRING",
                "description": "Text content to write."
            }
        },
        "required": ["path", "content"]
    }
}

_read_directory_tool = {
    "name": "read_directory",
    "description": "List files and folders in a directory path.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "path": {
                "type": "STRING",
                "description": "Directory path to inspect."
            }
        },
        "required": ["path"]
    }
}

_read_file_tool = {
    "name": "read_file",
    "description": "Read and return text content from a file path.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "path": {
                "type": "STRING",
                "description": "File path to read."
            }
        },
        "required": ["path"]
    }
}

_create_project_tool = {
    "name": "create_project",
    "description": "Create a new ADA project.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "name": {
                "type": "STRING",
                "description": "New project name."
            }
        },
        "required": ["name"]
    }
}

_switch_project_tool = {
    "name": "switch_project",
    "description": "Switch ADA to an existing project.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "name": {
                "type": "STRING",
                "description": "Existing project name."
            }
        },
        "required": ["name"]
    }
}

_list_projects_tool = {
    "name": "list_projects",
    "description": "List all available ADA projects.",
    "parameters": {
        "type": "OBJECT",
        "properties": {}
    }
}

# Smart home
_list_smart_devices_tool = {
    "name": "list_smart_devices",
    "description": "List discovered smart home devices from local cache.",
    "parameters": {
        "type": "OBJECT",
        "properties": {}
    }
}

_control_light_tool = {
    "name": "control_light",
    "description": "Control a smart light or smart plug by target name/IP.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "target": {
                "type": "STRING",
                "description": "Target device alias or IP address."
            },
            "action": {
                "type": "STRING",
                "description": "Action: turn_on, turn_off, or set."
            },
            "brightness": {
                "type": "NUMBER",
                "description": "Optional brightness from 0 to 100."
            },
            "color": {
                "type": "STRING",
                "description": "Optional color name like red, blue, warm, cool."
            }
        },
        "required": ["target", "action"]
    }
}

# Printer
_discover_printers_tool = {
    "name": "discover_printers",
    "description": "Discover network 3D printers.",
    "parameters": {
        "type": "OBJECT",
        "properties": {}
    }
}

_print_stl_tool = {
    "name": "print_stl",
    "description": "Slice and submit an STL file to a selected printer.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "stl_path": {
                "type": "STRING",
                "description": "Path to STL file or current for current project output."
            },
            "printer": {
                "type": "STRING",
                "description": "Printer name or identifier."
            },
            "profile": {
                "type": "STRING",
                "description": "Optional slicing profile name."
            }
        },
        "required": ["stl_path", "printer"]
    }
}

_get_print_status_tool = {
    "name": "get_print_status",
    "description": "Get current status for a selected printer.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "printer": {
                "type": "STRING",
                "description": "Printer name or identifier."
            }
        },
        "required": ["printer"]
    }
}

# Google integrations
_connect_google_tool = {
    "name": "connect_google_workspace",
    "description": "Start OAuth flow for Google Calendar and Gmail access. Use this before calendar or mail commands.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "force_reauth": {
                "type": "BOOLEAN",
                "description": "If true, forces OAuth consent and refreshes saved token."
            }
        }
    }
}

_get_current_datetime_tool = {
    "name": "get_current_datetime",
    "description": "Get the current local system date and time including timezone information.",
    "parameters": {
        "type": "OBJECT",
        "properties": {}
    }
}

_get_weather_tool = {
    "name": "get_weather",
    "description": "Get current weather data for a location using OpenWeatherMap. If location is omitted, uses default weather location from settings.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "location": {
                "type": "STRING",
                "description": "City/location query, e.g. Berlin,DE or Munich. Optional."
            },
            "units": {
                "type": "STRING",
                "description": "metric, imperial, or standard. Optional, defaults to metric."
            }
        }
    }
}

_get_weather_forecast_tool = {
    "name": "get_weather_forecast",
    "description": "Get short-term weather forecast. Supports hints like morgen/tomorrow and wochenende/weekend.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "location": {
                "type": "STRING",
                "description": "City/location query, e.g. Berlin,DE or Munich. Optional."
            },
            "units": {
                "type": "STRING",
                "description": "metric, imperial, or standard. Optional, defaults to metric."
            },
            "date_hint": {
                "type": "STRING",
                "description": "Optional hint like morgen, tomorrow, wochenende, weekend."
            },
            "days": {
                "type": "NUMBER",
                "description": "Number of forecast days to summarize (1-5). Optional, defaults to 3."
            }
        }
    }
}

_get_weather_full_report_tool = {
    "name": "get_weather_full_report",
    "description": "Get a comprehensive weather report (current + forecast data fields available in OpenWeather free plan endpoints).",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "location": {
                "type": "STRING",
                "description": "City/location query, e.g. Berlin,DE or Munich. Optional."
            },
            "units": {
                "type": "STRING",
                "description": "metric, imperial, or standard. Optional, defaults to metric."
            },
            "date_hint": {
                "type": "STRING",
                "description": "Optional hint like morgen, tomorrow, wochenende, weekend."
            },
            "days": {
                "type": "NUMBER",
                "description": "Number of forecast days to summarize (1-5). Optional, defaults to 3."
            },
            "include_raw": {
                "type": "BOOLEAN",
                "description": "If true, include raw API payload sections."
            }
        }
    }
}

_search_stock_symbol_tool = {
    "name": "search_stock_symbol",
    "description": "Search stock symbols and company names via Finnhub.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "query": {
                "type": "STRING",
                "description": "Company or symbol query, e.g. Apple, Tesla, MSFT."
            },
            "limit": {
                "type": "NUMBER",
                "description": "Max results (1-20). Optional, defaults to 6."
            }
        },
        "required": ["query"]
    }
}

_get_stock_quote_tool = {
    "name": "get_stock_quote",
    "description": "Get latest stock quote and company profile for a ticker symbol via Finnhub.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "symbol": {
                "type": "STRING",
                "description": "Ticker symbol, e.g. AAPL, TSLA, NVDA, MSFT."
            }
        },
        "required": ["symbol"]
    }
}

_get_stock_news_tool = {
    "name": "get_stock_news",
    "description": "Get recent stock-related news via Finnhub. If symbol is omitted, returns general market news.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "symbol": {
                "type": "STRING",
                "description": "Optional ticker symbol for company-specific news."
            },
            "days": {
                "type": "NUMBER",
                "description": "For company news, lookback window in days (1-30). Optional, default 7."
            },
            "limit": {
                "type": "NUMBER",
                "description": "Max news items (1-30). Optional, default 12."
            }
        }
    }
}

_route_plan_tool = {
    "name": "route_plan",
    "description": "Plan a route for driving by car using free OpenStreetMap services (Nominatim + OSRM) and return data for detail view map display.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "origin": {
                "type": "STRING",
                "description": "Optional start location. If omitted, uses Destination from settings as default origin."
            },
            "destination": {
                "type": "STRING",
                "description": "Destination location, e.g. Munich or Berlin,DE."
            },
            "alternatives": {
                "type": "BOOLEAN",
                "description": "If true, request alternative routes."
            }
        },
        "required": ["destination"]
    }
}

_clear_detail_view_tool = {
    "name": "clear_detail_view",
    "description": "Clear the left detail view panel and return it to idle state.",
    "parameters": {
        "type": "OBJECT",
        "properties": {}
    }
}

_system_check_tool = {
    "name": "system_check",
    "description": "Run a full ADA system health check across key integrations and return a diagnostic report.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "include_network_checks": {
                "type": "BOOLEAN",
                "description": "If true, include online checks like weather, route, Google, and discovery probes. Defaults to true."
            }
        }
    }
}

_search_memory_tool = {
    "name": "search_memory",
    "description": "Search relevant entries in long-term memory for conversation context.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "query": {
                "type": "STRING",
                "description": "What to look up in memory."
            },
            "n_results": {
                "type": "NUMBER",
                "description": "How many memory entries to return (1-10)."
            }
        },
        "required": ["query"]
    }
}

_save_to_memory_tool = {
    "name": "save_to_memory",
    "description": "Persist important user preferences or facts into long-term memory.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "text": {
                "type": "STRING",
                "description": "The memory text to save."
            }
        },
        "required": ["text"]
    }
}

_memory_status_tool = {
    "name": "memory_status",
    "description": "Get current long-term memory status including enabled/locked state and entry count.",
    "parameters": {
        "type": "OBJECT",
        "properties": {}
    }
}

_list_calendar_events_tool = {
    "name": "list_calendar_events",
    "description": "List upcoming events from the primary Google Calendar.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "max_results": {
                "type": "NUMBER",
                "description": "Maximum events to list (1-20)."
            }
        }
    }
}

_get_calendar_view_tool = {
    "name": "get_calendar_view",
    "description": "Get a calendar view for today or this week from Google Calendar.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "view": {
                "type": "STRING",
                "description": "Either 'today' or 'week'. Defaults to 'today'."
            },
            "max_results": {
                "type": "NUMBER",
                "description": "Maximum events to return (1-100)."
            }
        }
    }
}

_create_calendar_event_tool = {
    "name": "create_calendar_event",
    "description": "Create a new event in the primary Google Calendar.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "title": {
                "type": "STRING",
                "description": "Event title."
            },
            "start": {
                "type": "STRING",
                "description": "Start date/time in ISO-8601 format, e.g. 2026-04-10T14:00:00+02:00."
            },
            "end": {
                "type": "STRING",
                "description": "End date/time in ISO-8601 format, e.g. 2026-04-10T14:30:00+02:00."
            },
            "description": {
                "type": "STRING",
                "description": "Optional event description."
            },
            "location": {
                "type": "STRING",
                "description": "Optional event location."
            },
            "timezone": {
                "type": "STRING",
                "description": "Optional IANA timezone, e.g. Europe/Berlin."
            }
        },
        "required": ["title", "start", "end"]
    }
}

_update_calendar_event_tool = {
    "name": "update_calendar_event",
    "description": "Update an existing event in the primary Google Calendar.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "event_id": {
                "type": "STRING",
                "description": "Calendar event ID to update. Optional if query/title/start is provided."
            },
            "query": {
                "type": "STRING",
                "description": "Optional free-text Calendar search query to find an event when event_id is unknown."
            },
            "match_title": {
                "type": "STRING",
                "description": "Optional title filter used to resolve the target event."
            },
            "match_start": {
                "type": "STRING",
                "description": "Optional start filter (prefix match), e.g. 2026-04-10 or full ISO timestamp."
            },
            "title": {
                "type": "STRING",
                "description": "Optional new event title."
            },
            "start": {
                "type": "STRING",
                "description": "Optional new start date/time (ISO-8601)."
            },
            "end": {
                "type": "STRING",
                "description": "Optional new end date/time (ISO-8601)."
            },
            "description": {
                "type": "STRING",
                "description": "Optional new description."
            },
            "location": {
                "type": "STRING",
                "description": "Optional new location."
            },
            "timezone": {
                "type": "STRING",
                "description": "Optional IANA timezone, e.g. Europe/Berlin."
            }
        }
    }
}

_delete_calendar_event_tool = {
    "name": "delete_calendar_event",
    "description": "Delete an event from the primary Google Calendar.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "event_id": {
                "type": "STRING",
                "description": "Calendar event ID to delete. Optional if query/title/start is provided."
            },
            "query": {
                "type": "STRING",
                "description": "Optional free-text Calendar search query to find an event when event_id is unknown."
            },
            "title": {
                "type": "STRING",
                "description": "Optional title filter used to resolve a matching event."
            },
            "start": {
                "type": "STRING",
                "description": "Optional start filter (prefix match), e.g. 2026-04-10 or full ISO timestamp."
            }
        }
    }
}

_list_calendar_invitations_tool = {
    "name": "list_calendar_invitations",
    "description": "List upcoming invitations where the user is an attendee.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "max_results": {
                "type": "NUMBER",
                "description": "Maximum invitations to list (1-50)."
            }
        }
    }
}

_respond_calendar_invitation_tool = {
    "name": "respond_calendar_invitation",
    "description": "Respond to a calendar invitation as accepted, declined, tentative, or needsAction.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "event_id": {
                "type": "STRING",
                "description": "Calendar event ID of the invitation. Optional if query/title/start is provided."
            },
            "query": {
                "type": "STRING",
                "description": "Optional free-text Calendar search query to find the invitation when event_id is unknown."
            },
            "title": {
                "type": "STRING",
                "description": "Optional title filter to resolve the invitation event."
            },
            "start": {
                "type": "STRING",
                "description": "Optional start filter (prefix match), e.g. 2026-04-10 or full ISO timestamp."
            },
            "response": {
                "type": "STRING",
                "description": "One of: accepted, declined, tentative, needsAction."
            }
        },
        "required": ["response"]
    }
}

_list_gmail_messages_tool = {
    "name": "list_gmail_messages",
    "description": "List recent Gmail messages with optional Gmail search query.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "max_results": {
                "type": "NUMBER",
                "description": "Maximum messages to list (1-20)."
            },
            "query": {
                "type": "STRING",
                "description": "Optional Gmail search query, e.g. is:unread newer_than:7d."
            }
        }
    }
}

_get_gmail_message_detail_tool = {
    "name": "get_gmail_message_detail",
    "description": "Get full details and body text for one Gmail message.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "message_id": {
                "type": "STRING",
                "description": "Gmail message ID. Optional if query is provided."
            },
            "query": {
                "type": "STRING",
                "description": "Optional Gmail search query used to find the newest matching email if message_id is omitted."
            }
        }
    }
}

_list_gmail_labels_tool = {
    "name": "list_gmail_labels",
    "description": "List available Gmail labels including custom labels.",
    "parameters": {
        "type": "OBJECT",
        "properties": {}
    }
}

_update_gmail_labels_tool = {
    "name": "update_gmail_labels",
    "description": "Add or remove Gmail labels on a specific message.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "message_id": {
                "type": "STRING",
                "description": "Gmail message ID to modify. Optional if query is provided."
            },
            "query": {
                "type": "STRING",
                "description": "Optional Gmail search query used to auto-pick the newest matching message when message_id is missing."
            },
            "add_labels": {
                "type": "ARRAY",
                "items": {"type": "STRING"},
                "description": "Label names to add, e.g. [\"Important\", \"Work\"]."
            },
            "remove_labels": {
                "type": "ARRAY",
                "items": {"type": "STRING"},
                "description": "Label names to remove."
            }
        }
    }
}

_send_gmail_message_tool = {
    "name": "send_gmail_message",
    "description": "Send an email via Gmail.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "to": {
                "type": "STRING",
                "description": "Recipient email address."
            },
            "subject": {
                "type": "STRING",
                "description": "Email subject line."
            },
            "body": {
                "type": "STRING",
                "description": "Email plain text body."
            }
        },
        "required": ["to", "subject", "body"]
    }
}

function_declarations = [
    _generate_cad_tool,
    _iterate_cad_tool,
    _run_web_agent_tool,
    _write_file_tool,
    _read_directory_tool,
    _read_file_tool,
    _create_project_tool,
    _switch_project_tool,
    _list_projects_tool,
    _list_smart_devices_tool,
    _control_light_tool,
    _discover_printers_tool,
    _print_stl_tool,
    _get_print_status_tool,
    _connect_google_tool,
    _get_current_datetime_tool,
    _get_weather_tool,
    _get_weather_forecast_tool,
    _get_weather_full_report_tool,
    _search_stock_symbol_tool,
    _get_stock_quote_tool,
    _get_stock_news_tool,
    _route_plan_tool,
    _clear_detail_view_tool,
    _system_check_tool,
    _search_memory_tool,
    _save_to_memory_tool,
    _memory_status_tool,
    _list_calendar_events_tool,
    _get_calendar_view_tool,
    _create_calendar_event_tool,
    _update_calendar_event_tool,
    _delete_calendar_event_tool,
    _list_calendar_invitations_tool,
    _respond_calendar_invitation_tool,
    _list_gmail_messages_tool,
    _get_gmail_message_detail_tool,
    _list_gmail_labels_tool,
    _update_gmail_labels_tool,
    _send_gmail_message_tool,
]

# Backward compatibility for older imports in local experiments.
tools_list = [{"function_declarations": function_declarations}]
