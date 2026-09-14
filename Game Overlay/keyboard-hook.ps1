Add-Type -TypeDefinition @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public class KeyboardHook {
    private const int WH_KEYBOARD_LL = 13;
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_KEYUP = 0x0101;
    private const int WM_SYSKEYDOWN = 0x0104;
    private const int WM_SYSKEYUP = 0x0105;

    public delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);
    private static LowLevelKeyboardProc _proc = HookCallback;
    private static IntPtr _hookID = IntPtr.Zero;
    private static LowLevelKeyboardProc _mouseProc = MouseCallback;
    private static IntPtr _mouseHookID = IntPtr.Zero;

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string lpModuleName);

    public static void Main() {
        try {
            _hookID = SetHook(_proc);
            if (_hookID == IntPtr.Zero) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
            _mouseHookID = SetWindowsHookEx(14, _mouseProc, GetModuleHandle(null), 0);
            if (_mouseHookID == IntPtr.Zero) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
            Application.Run();
        } finally {
            if (_hookID != IntPtr.Zero) UnhookWindowsHookEx(_hookID);
            if (_mouseHookID != IntPtr.Zero) UnhookWindowsHookEx(_mouseHookID);
        }
    }

    private static IntPtr SetHook(LowLevelKeyboardProc proc) {
        using (Process curProcess = Process.GetCurrentProcess())
        using (ProcessModule curModule = curProcess.MainModule) {
            return SetWindowsHookEx(WH_KEYBOARD_LL, proc, GetModuleHandle(curModule.ModuleName), 0);
        }
    }

    private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0) {
            int vkCode = Marshal.ReadInt32(lParam);
            int msg = wParam.ToInt32();
            string state = "";

            if (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN) {
                state = "keydown";
            } else if (msg == WM_KEYUP || msg == WM_SYSKEYUP) {
                state = "keyup";
            }

            if (!string.IsNullOrEmpty(state)) {
                string json = "{\"device\":\"keyboard\",\"event\":\"" + state + "\",\"vk\":" + vkCode + "}";
                Console.Out.WriteLine(json);
                Console.Out.Flush();
            }
        }
        return CallNextHookEx(_hookID, nCode, wParam, lParam);
    }

    // Ignore movement and wheel rotation: the overlay displays button states.
    public static string DescribeMouseEvent(int message, uint mouseData) {
        string button;
        bool down;
        switch (message) {
            case 0x0201: button = "left"; down = true; break;
            case 0x0202: button = "left"; down = false; break;
            case 0x0204: button = "right"; down = true; break;
            case 0x0205: button = "right"; down = false; break;
            case 0x0207: button = "middle"; down = true; break;
            case 0x0208: button = "middle"; down = false; break;
            case 0x020B:
            case 0x020C:
                uint extra = (mouseData >> 16) & 0xffff;
                if (extra != 1 && extra != 2) return null;
                button = extra == 1 ? "side4" : "side5";
                down = message == 0x020B;
                break;
            default: return null;
        }
        return "{\"device\":\"mouse\",\"button\":\"" + button + "\",\"event\":\"" + (down ? "mousedown" : "mouseup") + "\"}";
    }

    private static IntPtr MouseCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0) {
            int message = wParam.ToInt32();
            // MSLLHOOKSTRUCT.mouseData follows POINT (two 32-bit coordinates).
            uint data = (message == 0x020B || message == 0x020C)
                ? unchecked((uint)Marshal.ReadInt32(lParam, 8)) : 0;
            string json = DescribeMouseEvent(message, data);
            if (json != null) {
                Console.Out.WriteLine(json);
                Console.Out.Flush();
            }
        }
        return CallNextHookEx(_mouseHookID, nCode, wParam, lParam);
    }
}
"@ -ReferencedAssemblies "System.Windows.Forms.dll"

[KeyboardHook]::Main()
