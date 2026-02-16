---
description: How to run the app on multiple Android devices simultaneously
---

## Prerequisites
- Android SDK Platform-Tools (adb) installed and in your PATH.
- Two Android devices.
- USB Cabes.

## Steps

1. **Connect Device 1** via USB.
2. Ensure it is authorized (accept "Allow USB Debugging" on phone).
3. Set it to listen on TCP/IP:
   ```powershell
   adb tcpip 5555
   ```
4. Find its IP address:
   ```powershell
   adb shell ip route
   ```
   (Look for the IP in the output, usually something like `192.168.x.x`).
5. **Disconnect Device 1** from USB.
6. Connect to it wirelessly:
   ```powershell
   adb connect <PHONE_IP_ADDRESS>:5555
   ```
7. **Connect Device 2** via USB.
8. Verify both are visible:
   ```powershell
   adb devices
   ```
   You should see one IP address (Device 1) and one Serial ID (Device 2).

## Running the App

The most reliable way to run on both is to use the **interactive menu** in two separate terminals.

**Terminal 1:**
1. Run:
   ```powershell
   $env:Path = "C:\Users\PC USER\AppData\Local\Android\Sdk\platform-tools;" + $env:Path
   npx expo run:android
   ```
2. When asked which device to use, select **Device 1**.

**Terminal 2:**
1. Run:
   ```powershell
   $env:Path = "C:\Users\PC USER\AppData\Local\Android\Sdk\platform-tools;" + $env:Path
   npx expo run:android
   ```
2. When asked which device to use, select **Device 2**.

