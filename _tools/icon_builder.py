"""Generate commercial brand icons (SVG, multi-size Windows .ico, PNGs) and compile native AnThinh Studio.exe launcher."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

TOOLS_DIR = Path(__file__).resolve().parent
ROOT_DIR = TOOLS_DIR.parent
STATIC_DIR = TOOLS_DIR / "server" / "static"


SVG_ICON = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F172A"/>
      <stop offset="50%" stop-color="#090D16"/>
      <stop offset="100%" stop-color="#05070B"/>
    </linearGradient>
    <linearGradient id="cyanBlue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#22D3EE"/>
      <stop offset="50%" stop-color="#0EA5E9"/>
      <stop offset="100%" stop-color="#2563EB"/>
    </linearGradient>
    <linearGradient id="amberAccent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FACC15"/>
      <stop offset="100%" stop-color="#F97316"/>
    </linearGradient>
  </defs>
  <!-- Rounded Squircle Studio Tile -->
  <rect x="10" y="10" width="236" height="236" rx="54" fill="url(#bgGrad)" stroke="#1E293B" stroke-width="6"/>
  <rect x="20" y="20" width="216" height="216" rx="46" fill="none" stroke="#38BDF8" stroke-opacity="0.22" stroke-width="2"/>

  <!-- Film / NLE Track Notches Left & Right -->
  <g fill="#38BDF8" opacity="0.35">
    <rect x="30" y="58" width="12" height="22" rx="4"/>
    <rect x="30" y="96" width="12" height="22" rx="4"/>
    <rect x="30" y="134" width="12" height="22" rx="4"/>
    <rect x="214" y="58" width="12" height="22" rx="4"/>
    <rect x="214" y="96" width="12" height="22" rx="4"/>
    <rect x="214" y="134" width="12" height="22" rx="4"/>
  </g>

  <!-- Central Play / Prism Badge -->
  <rect x="62" y="46" width="132" height="124" rx="26" fill="url(#cyanBlue)"/>
  <polygon points="112,82 112,134 156,108" fill="#09090B"/>

  <!-- Bottom NLE Timeline Tracks -->
  <rect x="44" y="186" width="108" height="14" rx="7" fill="url(#cyanBlue)"/>
  <rect x="160" y="186" width="52" height="14" rx="7" fill="url(#amberAccent)"/>
  <rect x="68" y="208" width="120" height="10" rx="5" fill="#334155"/>
  <!-- Playhead Needle -->
  <rect x="148" y="176" width="4" height="48" rx="2" fill="#FACC15"/>
</svg>
"""


def draw_master_icon(size: int = 512) -> Image.Image:
    """Render a high-resolution studio icon using Pillow (supersampled)."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad = int(size * 0.04)
    rad = int(size * 0.22)
    # Outer dark slate squircle
    draw.rounded_rectangle(
        [pad, pad, size - pad, size - pad],
        radius=rad,
        fill=(11, 15, 25, 255),
        outline=(38, 52, 74, 255),
        width=max(2, size // 64),
    )

    # Inner subtle cyan rim
    in_pad = int(size * 0.075)
    draw.rounded_rectangle(
        [in_pad, in_pad, size - in_pad, size - in_pad],
        radius=int(size * 0.19),
        fill=None,
        outline=(34, 211, 238, 65),
        width=max(1, size // 128),
    )

    # Central NLE Stage Screen (Cyan -> Blue gradient approximation)
    bx0, by0 = int(size * 0.22), int(size * 0.17)
    bx1, by1 = int(size * 0.78), int(size * 0.65)
    draw.rounded_rectangle(
        [bx0, by0, bx1, by1],
        radius=int(size * 0.10),
        fill=(14, 165, 233, 255),
        outline=(56, 189, 248, 255),
        width=max(2, size // 96),
    )

    # Play Triangle inside Stage
    tx0 = int(size * 0.43)
    ty0 = int(size * 0.31)
    ty1 = int(size * 0.51)
    tx1 = int(size * 0.61)
    tym = (ty0 + ty1) // 2
    draw.polygon([(tx0, ty0), (tx0, ty1), (tx1, tym)], fill=(9, 9, 11, 255))

    # Timeline Tracks at bottom
    t1_y0, t1_y1 = int(size * 0.73), int(size * 0.79)
    draw.rounded_rectangle(
        [int(size * 0.17), t1_y0, int(size * 0.58), t1_y1],
        radius=int(size * 0.03),
        fill=(34, 211, 238, 255),
    )
    draw.rounded_rectangle(
        [int(size * 0.62), t1_y0, int(size * 0.83), t1_y1],
        radius=int(size * 0.03),
        fill=(250, 204, 21, 255),
    )

    t2_y0, t2_y1 = int(size * 0.82), int(size * 0.865)
    draw.rounded_rectangle(
        [int(size * 0.25), t2_y0, int(size * 0.75), t2_y1],
        radius=int(size * 0.02),
        fill=(71, 85, 105, 255),
    )

    # Playhead vertical bar
    px = int(size * 0.595)
    draw.rounded_rectangle(
        [px - max(2, size // 128), int(size * 0.69), px + max(2, size // 128), int(size * 0.89)],
        radius=max(1, size // 200),
        fill=(250, 204, 21, 255),
    )
    return img


def build_all_icons_and_launcher() -> dict[str, str]:
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    svg_path = STATIC_DIR / "favicon.svg"
    ico_path = STATIC_DIR / "favicon.ico"
    png_512 = STATIC_DIR / "icon-512.png"
    png_apple = STATIC_DIR / "apple-touch-icon.png"
    root_ico = ROOT_DIR / "_tools" / "anthinh_studio.ico"

    svg_path.write_text(SVG_ICON, encoding="utf-8")

    master = draw_master_icon(512)
    master.save(png_512, format="PNG")
    master.resize((180, 180), Image.Resampling.LANCZOS).save(png_apple, format="PNG")

    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    master.save(ico_path, format="ICO", sizes=ico_sizes)
    master.save(root_ico, format="ICO", sizes=ico_sizes)

    mac_res_dir = ROOT_DIR / "AnThinh Studio.app" / "Contents" / "Resources"
    mac_icns = mac_res_dir / "AnThinhStudio.icns"
    if (ROOT_DIR / "AnThinh Studio.app" / "Contents").exists():
        mac_res_dir.mkdir(parents=True, exist_ok=True)
        master.save(mac_icns, format="ICNS")

    exe_path = ROOT_DIR / "AnThinh Studio.exe"
    lnk_path = ROOT_DIR / "AnThinh Studio.lnk"

    if os.name == "nt":
        # 1. Compile native Windows GUI launcher AnThinh Studio.exe with embedded .ico
        csc = Path(r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe")
        cs_file = TOOLS_DIR / "_launcher.cs"
        cs_code = r"""
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;

[assembly: AssemblyTitle("anthinh Studio Pro")]
[assembly: AssemblyDescription("Commercial NLE & AI Video Suite")]
[assembly: AssemblyCompany("anthinh Studio")]
[assembly: AssemblyProduct("anthinh Studio Pro")]
[assembly: AssemblyVersion("2.0.0.0")]

class Program {
    [STAThread]
    static void Main(string[] args) {
        string rootDir = AppDomain.CurrentDomain.BaseDirectory;
        string pyw = Path.Combine(rootDir, "_tools", ".venv", "Scripts", "pythonw.exe");
        string py = Path.Combine(rootDir, "_tools", ".venv", "Scripts", "python.exe");
        string script = Path.Combine(rootDir, "_tools", "desktop_app.py");
        string exeToRun = File.Exists(pyw) ? pyw : (File.Exists(py) ? py : "python");

        ProcessStartInfo psi = new ProcessStartInfo();
        psi.FileName = exeToRun;
        psi.Arguments = "\"" + script + "\"";
        psi.WorkingDirectory = rootDir;
        psi.UseShellExecute = false;
        psi.CreateNoWindow = true;
        try {
            Process.Start(psi);
        } catch (Exception) {
            string bat = Path.Combine(rootDir, "start_server.bat");
            if (File.Exists(bat)) {
                Process.Start(new ProcessStartInfo(bat) { WorkingDirectory = rootDir });
            }
        }
    }
}
"""
        if csc.exists():
            try:
                cs_file.write_text(cs_code.strip(), encoding="utf-8")
                subprocess.run(
                    [
                        str(csc),
                        "/nologo",
                        "/target:winexe",
                        f"/out:{exe_path}",
                        f"/win32icon:{root_ico}",
                        str(cs_file),
                    ],
                    check=True,
                    capture_output=True,
                )
            finally:
                if cs_file.exists():
                    cs_file.unlink(missing_ok=True)

        # 2. Also create a Windows .lnk shortcut with the custom .ico for start_server.bat / .vbs
        ps_cmd = (
            "$ws = New-Object -ComObject WScript.Shell; "
            f"$s = $ws.CreateShortcut('{lnk_path}'); "
            f"$s.TargetPath = 'wscript.exe'; "
            f"$s.Arguments = '\"{ROOT_DIR / 'AnThinh Studio.vbs'}\"'; "
            f"$s.WorkingDirectory = '{ROOT_DIR}'; "
            f"$s.IconLocation = '{root_ico},0'; "
            "$s.Description = 'Mở phần mềm anthinh Studio Pro'; "
            "$s.Save()"
        )
        subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True)

    return {
        "svg": str(svg_path),
        "ico": str(ico_path),
        "icns": str(mac_icns) if mac_icns.exists() else "",
        "exe": str(exe_path) if exe_path.exists() else "",
        "lnk": str(lnk_path) if lnk_path.exists() else "",
    }


if __name__ == "__main__":
    print(build_all_icons_and_launcher())
