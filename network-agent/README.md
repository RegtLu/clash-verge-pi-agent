# Pi network assistant

This local prototype adds an AI Network Assistant page to Clash Verge Rev. It uses
the official Pi agent runtime (`@earendil-works/pi-agent-core` 1.0.4) and Pi's
DeepSeek adapter. The default model is `deepseek-flash`, with thinking disabled.

React sends requests through Tauri IPC. Rust supplies a small settings snapshot
and launches the bundled Node.js worker over stdin/stdout. Pi calls bounded
diagnostic tools, streams its progress back to the page, and produces a summary.
The API key is read inside the worker; it is never supplied to the webview.

The tools inspect OS proxy settings, DNS, default routes, proxy environment
variables and the local proxy listener, and compare direct and proxy HTTPS HEAD
requests. Controller secrets, subscription URLs and node passwords are excluded
from the settings snapshot. Diagnostic evidence, including network addresses, is
sent to DeepSeek when the assistant is used.

## Run

Use Rust 1.99, pnpm 12.8.1 and a supported Node release (22.23+ or 24.18+).

```sh
pnpm install --frozen-lockfile
pnpm agent:setup
pnpm prebuild
cp .env.example .env
# Fill in DEEPSEEK_API_KEY in .env, then:
bash scripts/run-network-assistant.sh
```

Open **AI Network Assistant** in the sidebar. Choose **Diagnose network**, or
describe the failing application/hostname in the composer. Expand **Diagnostic
evidence** to inspect the actual tool results. **Stop** cancels the worker.

The launcher limits debug-build disk usage. Exit any other Clash Verge client
before starting this prototype if you want to apply settings: upstream refuses
a second Mihomo core while another core is running. The initial native IPC run
verified chat, previews, cancellation, stale/invalid input rejection and recovery
after that refusal. Successful live setting changes still need a run with only
this client active.

The launcher reads `.env` in this checkout, falling back to `.env` in its parent
directory. Without the launcher, the development worker defaults to the parent
directory. A file containing just a `sk-...` key is supported, as is standard
dotenv format:

```dotenv
DEEPSEEK_API_KEY=your-key
DEEPSEEK_MODEL=deepseek-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

To use another location, set `NETWORK_AGENT_ENV_FILE`. Packaged apps default to
`network-agent.env` in the app data directory. Node.js must be installed on the
machine; use `NETWORK_AGENT_NODE` with an absolute executable path if the GUI
does not inherit Node's PATH. The installer does not bundle Node.js yet.

```sh
NETWORK_AGENT_ENV_FILE=/path/to/.env pnpm dev:sidecar
```

The worker also runs independently against the installed app's saved settings:

```sh
npm start --prefix network-agent -- 'Check why Chrome cannot access Google.'
```

Set `NETWORK_AGENT_CONFIG_DIR` to inspect a different saved app configuration.
Saved settings are not proof of the live core state; the listener and OS tools
provide additional evidence. CLI changes are previews only.

## Setting changes

Pi's `propose_change` tool generates previews for proxy mode, system proxy, TUN
and IPv6. It has no configuration-writing or shell-execution tool. The app applies
each preview only when **Apply this change** is clicked, using the existing Clash
Verge configuration commands. A stale preview is rejected. The inverse is saved
before applying the change, and **Undo latest change** restores the most recent
setting when a newer change has not superseded it.

This first version does not edit subscription profiles, routing rules, DNS
resolvers, browser extensions, VPN settings or proxy-node selections. It runs on
request rather than as a scheduled background monitor. Conversations live in the
page's memory. Leaving the page cancels an active diagnostic.

The sidecar is generated with `pnpm agent:build`, and the Tauri development/build
hooks rebuild it. `npm test --prefix network-agent` covers credential exclusion,
preview-only behavior and unsafe diagnostic arguments.

Upstream references: [Pi agent runtime](https://github.com/earendil-works/pi/tree/main/packages/agent),
[DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/).
