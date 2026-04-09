import asyncio
from kasa import Discover


class KasaAgent:
    """Kasa/Tapo smart-home bridge.

    Supports TP-Link Kasa and Tapo devices via python-kasa.
    """

    def __init__(self, known_devices=None, tapo_username=None, tapo_password=None):
        self.devices = {}
        self.known_devices_config = known_devices or []
        self.tapo_username = str(tapo_username or "").strip()
        self.tapo_password = str(tapo_password or "").strip()

    def set_tapo_credentials(self, username, password):
        self.tapo_username = str(username or "").strip()
        self.tapo_password = str(password or "").strip()

    def _discover_auth_kwargs(self):
        if self.tapo_username and self.tapo_password:
            return {
                "username": self.tapo_username,
                "password": self.tapo_password,
            }
        return {}

    async def initialize(self):
        if self.known_devices_config:
            print(f"[KasaAgent] Initializing {len(self.known_devices_config)} known devices...")
            tasks = []
            for d in self.known_devices_config:
                if not d:
                    continue
                provider = str(d.get("provider", "kasa")).strip().lower()
                if provider != "kasa":
                    continue
                ip = d.get("ip")
                alias = d.get("alias")
                if ip:
                    tasks.append(self._add_known_device(ip, alias, d))

            if tasks:
                await asyncio.gather(*tasks)

    async def apply_known_devices_config(self, known_devices):
        self.known_devices_config = known_devices or []
        await self.initialize()

    async def _add_known_device(self, ip, alias, info):
        try:
            dev = await Discover.discover_single(ip, **self._discover_auth_kwargs())
            if dev:
                old_dev = self.devices.get(ip)
                if old_dev is not None and old_dev is not dev:
                    await self._disconnect_device(old_dev)
                await dev.update()
                self.devices[ip] = dev
                print(f"[KasaAgent] Loaded known device: {dev.alias} ({ip})")
            else:
                print(f"[KasaAgent] Could not connect to known device at {ip}")
        except Exception as e:
            print(f"[KasaAgent] Error loading known device {ip}: {e}")

    async def discover_devices(self):
        print("Discovering Kasa/Tapo devices (Broadcast)...")
        found_devices = await Discover.discover(
            target="255.255.255.255",
            timeout=5,
            **self._discover_auth_kwargs(),
        )
        print(f"[KasaAgent] Raw discovery found {len(found_devices)} devices.")

        for ip, dev in found_devices.items():
            old_dev = self.devices.get(ip)
            if old_dev is not None and old_dev is not dev:
                await self._disconnect_device(old_dev)
            await dev.update()
            self.devices[ip] = dev

        device_list = self.get_devices_list()
        print(f"Total Kasa/Tapo devices (found + cached): {len(device_list)}")
        return device_list

    def get_devices_list(self):
        device_list = []

        for ip, dev in self.devices.items():
            dev_type = "unknown"
            if dev.is_bulb:
                dev_type = "bulb"
            elif dev.is_plug:
                dev_type = "plug"
            elif dev.is_strip:
                dev_type = "strip"
            elif dev.is_dimmer:
                dev_type = "dimmer"

            device_list.append({
                "ip": ip,
                "alias": dev.alias,
                "model": dev.model,
                "type": dev_type,
                "provider": "kasa",
                "is_on": dev.is_on,
                "brightness": dev.brightness if dev.is_bulb or dev.is_dimmer else None,
                "hsv": dev.hsv if dev.is_bulb and dev.is_color else None,
                "has_color": dev.is_color if dev.is_bulb else False,
                "has_brightness": dev.is_dimmable if dev.is_bulb or dev.is_dimmer else False,
                "controllable": True,
            })

        return device_list

    def get_device_by_alias(self, alias):
        for _ip, dev in self.devices.items():
            if dev.alias.lower() == str(alias).lower():
                return dev
        return None

    def _resolve_device(self, target):
        if target in self.devices:
            return self.devices[target]
        return self.get_device_by_alias(target)

    def name_to_hsv(self, color_name):
        color_name = color_name.lower().strip()
        colors = {
            "red": (0, 100, 100),
            "orange": (30, 100, 100),
            "yellow": (60, 100, 100),
            "green": (120, 100, 100),
            "cyan": (180, 100, 100),
            "blue": (240, 100, 100),
            "purple": (300, 100, 100),
            "pink": (300, 50, 100),
            "white": (0, 0, 100),
            "warm": (30, 20, 100),
            "cool": (200, 10, 100),
            "daylight": (0, 0, 100),
        }
        return colors.get(color_name, None)

    async def turn_on(self, target):
        dev = self._resolve_device(target)
        if dev:
            try:
                await dev.turn_on()
                await dev.update()
                return True
            except Exception as e:
                print(f"Error turning on {target}: {e}")
                return False

        if str(target).count(".") == 3:
            try:
                dev = await Discover.discover_single(target, **self._discover_auth_kwargs())
                if dev:
                    self.devices[target] = dev
                    await dev.turn_on()
                    await dev.update()
                    return True
            except Exception:
                pass

        return False

    async def turn_off(self, target):
        dev = self._resolve_device(target)
        if dev:
            try:
                await dev.turn_off()
                await dev.update()
                return True
            except Exception as e:
                print(f"Error turning off {target}: {e}")
                return False

        if str(target).count(".") == 3:
            try:
                dev = await Discover.discover_single(target, **self._discover_auth_kwargs())
                if dev:
                    self.devices[target] = dev
                    await dev.turn_off()
                    await dev.update()
                    return True
            except Exception:
                pass

        return False

    async def set_brightness(self, target, brightness):
        dev = self._resolve_device(target)
        if dev and (dev.is_dimmable or dev.is_bulb):
            try:
                await dev.set_brightness(int(brightness))
                await dev.update()
                return True
            except Exception as e:
                print(f"Error setting brightness for {target}: {e}")
        return False

    async def set_color(self, target, color_input):
        hsv = None
        if isinstance(color_input, str):
            hsv = self.name_to_hsv(color_input)
        elif isinstance(color_input, (tuple, list)) and len(color_input) == 3:
            hsv = color_input

        dev = self._resolve_device(target)
        if dev and dev.is_color and hsv:
            try:
                await dev.set_hsv(int(hsv[0]), int(hsv[1]), int(hsv[2]))
                await dev.update()
                return True
            except Exception as e:
                print(f"Error setting color for {target}: {e}")

        return False

    async def _disconnect_device(self, dev):
        if dev is None:
            return
        try:
            disconnect_fn = getattr(dev, "disconnect", None)
            if callable(disconnect_fn):
                result = disconnect_fn()
                if asyncio.iscoroutine(result):
                    await result
                return
        except Exception as e:
            print(f"[KasaAgent] Disconnect warning: {e}")

        # Fallback for older internals if disconnect() is not exposed.
        try:
            protocol = getattr(dev, "protocol", None)
            close_fn = getattr(protocol, "close", None) if protocol is not None else None
            if callable(close_fn):
                result = close_fn()
                if asyncio.iscoroutine(result):
                    await result
        except Exception as e:
            print(f"[KasaAgent] Protocol close warning: {e}")

    async def close(self):
        for ip, dev in list(self.devices.items()):
            try:
                await self._disconnect_device(dev)
            except Exception as e:
                print(f"[KasaAgent] Error closing device {ip}: {e}")
        self.devices.clear()


if __name__ == "__main__":
    async def main():
        agent = KasaAgent()
        devices = await agent.discover_devices()
        print("Devices:", devices)

    asyncio.run(main())
