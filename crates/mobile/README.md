# Running Caribe Trips on Android

The same React SPA is wrapped as an Android app by Tauri 2. This is what it actually takes to
get it onto an emulator, including the parts that fail silently.

## TL;DR

```sh
export JAVA_HOME=$HOME/android-dev/jdk-17.0.19+10
export ANDROID_HOME=$HOME/Android/Sdk
export NDK_HOME=$ANDROID_HOME/ndk/26.1.10909125
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
export DISPLAY=:0 XAUTHORITY=/run/user/$(id -u)/.mutter-Xwaylandauth.*   # Wayland only

emulator -avd caribe &                                        # leave running
echo 'VITE_API_BASE_URL=http://10.0.2.2:8088/api' > packages/web/.env
CORS_EXTRA_ORIGIN=http://tauri.localhost docker compose up -d --force-recreate api
just android-build
adb install -r crates/mobile/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
adb shell monkey -p com.caribetrips.app -c android.intent.category.LAUNCHER 1
```

## The four things that silently break it

Each of these produces either no error or a misleading one, so they are listed first.

### 1 · The build needs JDK 17 specifically

The Android Gradle plugin rejects newer JDKs. A system `java` of 21 or 25 fails the build with
a message about an unsupported class file version, which reads like a project problem and is
not. Point `JAVA_HOME` at a real JDK 17 and put its `bin` first on `PATH`.

### 2 · `localhost` inside the emulator is the phone, not your machine

The app runs in a WebView on the emulated device, so `http://localhost:8088` resolves to the
device itself and the API is simply not there. The emulator maps the host to **`10.0.2.2`**:

```sh
echo 'VITE_API_BASE_URL=http://10.0.2.2:8088/api' > packages/web/.env
```

This is baked in at build time by Vite, so changing it means rebuilding the APK. Use your
machine's LAN IP instead when running on a physical device.

### 3 · The API must allow the `tauri.localhost` origin

The Tauri WebView serves the app from `http://tauri.localhost`, which is not the web origin the
API allows by default, so every request fails CORS. Pass the extra origin:

```sh
CORS_EXTRA_ORIGIN=http://tauri.localhost docker compose up -d --force-recreate api
```

**This only works because `docker-compose.yml` declares the passthrough.** Compose only
interpolates variables the file actually references — if the `api` service does not mention
`CORS_EXTRA_ORIGIN`, setting it on the command line is silently dropped and you get CORS
failures with nothing in the logs explaining why. The line that makes it work:

```yaml
CORS_EXTRA_ORIGIN: "${CORS_EXTRA_ORIGIN:-}"
```

Verify it landed rather than assuming:

```sh
docker exec caribe-api printenv CORS_EXTRA_ORIGIN
```

### 4 · A stale APK looks like a working one

`adb install` succeeds on an old APK, and the app launches and shows a UI — just the wrong one.
The build output path never changes, so a stale artifact from a previous branch is easy to
install by accident. Check the timestamp before blaming the code:

```sh
stat -c '%y' crates/mobile/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

The debug universal APK is ~460 MB because it bundles every architecture unstripped. That is
expected; release builds are far smaller.

## Toolchain

Versions that are known to work together:

| Component | Version |
|---|---|
| JDK | 17 (`$HOME/android-dev/jdk-17.0.19+10`) |
| Android SDK platform | 34 |
| Build tools | 34.0.0 |
| NDK | 26.1.10909125 |
| Tauri CLI | 2.x (`cargo install tauri-cli --version "^2"`) |
| Rust targets | `aarch64-linux-android`, `armv7-linux-androideabi`, `i686-linux-android`, `x86_64-linux-android` |

`crates/mobile` is deliberately outside the workspace `default-members`, so a normal
`cargo build` never needs any of this.

## Creating the AVD

Only needed on a machine that has none (`emulator -list-avds` is empty):

```sh
sdkmanager "system-images;android-34;google_apis;x86_64"
avdmanager create avd -n caribe -k "system-images;android-34;google_apis;x86_64" -d pixel
```

Use a `google_apis` image rather than `google_apis_playstore` — the Play Store variant is not
rootable, which makes debugging harder for no benefit here.

## Running the emulator

```sh
emulator -avd caribe
```

Then wait for it to be genuinely ready. `adb devices` reports `offline` well before the device
is usable, so poll the boot flag instead:

```sh
adb wait-for-device
until [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do sleep 2; done
```

### One emulator per AVD

Starting a second instance of the same AVD fails with:

```
FATAL | Running multiple emulators with the same AVD is an experimental feature.
```

That means an instance is already running — often one started by a different terminal or by an
agent. Either use it, or take it over:

```sh
adb emu kill          # frees the AVD
```

### On Wayland: the emulator needs an X display

The bundled Qt has no Wayland platform plugin (`emulator -qt-platform` lists only `offscreen`,
`linuxfb`, `minimal`, `xcb`, `vnc`), so it must go through Xwayland. Without a reachable
display it aborts with:

```
Warning: could not connect to display (:0, )
Fatal: This application failed to start because no Qt platform plugin could be initialized.
```

The message also mentions `xcb-cursor0`, which is a **red herring** — on Fedora that library is
already present and installing it changes nothing. The real line is `could not connect to
display`. Export both variables, not just `DISPLAY`:

```sh
export DISPLAY=:0
export XAUTHORITY=/run/user/$(id -u)/.mutter-Xwaylandauth.XXXXXX   # exact name varies
ls /run/user/$(id -u)/.mutter-Xwaylandauth.*                       # find yours
```

The auth filename is regenerated when the session's Xwayland restarts, so a long-lived shell
can end up holding a path that no longer exists.

### Software rendering

`WARNING | Your GPU drivers may have a bug. Switching to software rendering.` is normal on this
setup and the emulator works fine, just slowly. To force it explicitly:

```sh
emulator -avd caribe -gpu swiftshader_indirect
```

## Debugging

```sh
adb logcat | grep -iE "caribetrips|tauri|chromium"   # app side
docker logs -f caribe-api                            # server side, incl. the JSONL events
adb exec-out screencap -p > screen.png               # what the device actually shows
```

`cr_VariationsUtils: Failed reading seed file` in logcat is routine Chromium WebView noise, not
an error.

To confirm the app is really talking to the API, do something that emits an event — create a
booking, or ask the concierge — and watch for it:

```sh
docker logs --since 2m caribe-api | grep '^{"evento"'
```

Loading the package list alone emits nothing, because only bookings, concierge queries and
failures are recorded. See [observability/README.md](../../observability/README.md).

## Live reload

`just android-dev` builds, installs and launches against a running emulator in one step, and
reloads on frontend changes. It needs the same environment as above.
