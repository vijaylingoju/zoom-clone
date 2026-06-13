"use client";

import { Check } from "lucide-react";
import { useEffect, useRef } from "react";

interface DeviceMenuProps {
  title: string;
  devices: MediaDeviceInfo[];
  currentId: string | null;
  onSelect: (deviceId: string) => void;
  onClose: () => void;
}

export function DeviceMenu({ title, devices, currentId, onSelect, onClose }: DeviceMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-16 left-0 z-50 w-64 rounded-xl border border-white/10 bg-[#1f1f1f] p-2 text-sm shadow-2xl"
    >
      <p className="px-2 py-1 text-xs font-semibold text-white/50">{title}</p>
      {devices.length === 0 && (
        <p className="px-2 py-2 text-xs text-white/40">No devices found</p>
      )}
      {devices.map((device, index) => {
        const selected = device.deviceId === currentId;
        return (
          <button
            key={device.deviceId || index}
            type="button"
            onClick={() => {
              onSelect(device.deviceId);
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-white transition hover:bg-white/10"
          >
            <span className="w-4 shrink-0">{selected && <Check size={14} />}</span>
            <span className="truncate">{device.label || `${title} ${index + 1}`}</span>
          </button>
        );
      })}
    </div>
  );
}
