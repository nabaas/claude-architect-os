-- Hammerspoon Configuration — Claude Architect OS
-- Deep macOS automation: hotkeys, window management, system triggers
-- Place at: ~/.hammerspoon/init.lua

local logger = hs.logger.new('CMNDCENTER', 'info')
local CMNDCENTER = os.getenv("HOME") .. "/CMNDCENTER"
local CAO = CMNDCENTER .. "/repos/claude-architect-os"

-- ─── Alert Style ──────────────────────────────────────────────────────────────
hs.alert.defaultStyle.fillColor = { white = 0, alpha = 0.85 }
hs.alert.defaultStyle.strokeColor = { white = 0.5, alpha = 1 }
hs.alert.defaultStyle.textColor = { white = 1, alpha = 1 }
hs.alert.defaultStyle.radius = 8

-- ─── Helper Functions ─────────────────────────────────────────────────────────

local function runScript(script, label)
  local task = hs.task.new("/bin/bash", function(exitCode, stdout, stderr)
    if exitCode == 0 then
      hs.alert.show("✅ " .. label)
      logger.i(label .. ": " .. (stdout or ""))
    else
      hs.alert.show("❌ " .. label .. " failed")
      logger.e(label .. " error: " .. (stderr or ""))
    end
  end, {"-c", script})
  task:start()
end

local function notify(title, body)
  hs.notify.new({ title = title, informativeText = body, soundName = "default" }):send()
end

-- ─── CMNDCENTER Hotkeys ────────────────────────────────────────────────────────

-- CMD+SHIFT+CTRL+L → Trigger Loki Mode (opens terminal prompt)
hs.hotkey.bind({"cmd", "shift", "ctrl"}, "L", function()
  local input = hs.dialog.textInput("Loki Mode", "Enter build requirement:", "")
  if input and input ~= "" then
    runScript('bash "' .. CMNDCENTER .. '/loki/loki.sh" "' .. input .. '"', "Loki Build: " .. input)
    hs.alert.show("🔱 Loki Mode: " .. input)
  end
end)

-- CMD+SHIFT+CTRL+O → Opportunity scan
hs.hotkey.bind({"cmd", "shift", "ctrl"}, "O", function()
  runScript(
    'bash "' .. CAO .. '/scripts/upgrade.sh" --quick 2>&1 | tail -5 > /tmp/cao-quick.log',
    "Opportunity Scan"
  )
  hs.alert.show("📡 Scanning opportunities...")
end)

-- CMD+SHIFT+CTRL+U → Quick upgrade
hs.hotkey.bind({"cmd", "shift", "ctrl"}, "U", function()
  runScript('bash "' .. CAO .. '/scripts/upgrade.sh"', "System Upgrade")
  hs.alert.show("⚡ Upgrading CMNDCENTER...")
end)

-- CMD+SHIFT+CTRL+S → System status (opens dashboard)
hs.hotkey.bind({"cmd", "shift", "ctrl"}, "S", function()
  hs.urlevent.openURL("http://localhost:3002")  -- dashboard
  hs.alert.show("📊 Opening Dashboard")
end)

-- CMD+SHIFT+CTRL+T → IntelliTradeX status
hs.hotkey.bind({"cmd", "shift", "ctrl"}, "T", function()
  runScript(
    'ls "' .. CMNDCENTER .. '/intellitradeX/signals/" | tail -3',
    "Trade Status"
  )
  hs.alert.show("📈 IntelliTradeX Status")
end)

-- CMD+SHIFT+CTRL+M → Memory sync
hs.hotkey.bind({"cmd", "shift", "ctrl"}, "M", function()
  runScript(
    'python3 "' .. CAO .. '/integrations/llamaindex/rag-engine.py" 2>&1',
    "Memory Sync"
  )
  hs.alert.show("🧠 Syncing memory...")
end)

-- CMD+SHIFT+CTRL+W → WAND pipeline status
hs.hotkey.bind({"cmd", "shift", "ctrl"}, "W", function()
  hs.urlevent.openURL("http://localhost:5678")  -- n8n
  hs.alert.show("🎬 Opening WAND / n8n")
end)

-- CMD+SHIFT+CTRL+A → Open AnythingLLM (local RAG chat)
hs.hotkey.bind({"cmd", "shift", "ctrl"}, "A", function()
  hs.urlevent.openURL("http://localhost:3001")
  hs.alert.show("🤖 Opening AnythingLLM")
end)

-- ─── System Watchers ──────────────────────────────────────────────────────────

-- Watch for new opportunity files in linear-queue
local queueWatcher = hs.pathwatcher.new(
  os.getenv("HOME") .. "/.amsa/linear-queue/",
  function(files)
    for _, file in ipairs(files) do
      if file:match("opportunity%-.*%.json$") then
        notify("💰 New Opportunity", "Check ~/.amsa/linear-queue/ for high-ROI signals")
        logger.i("New opportunity file: " .. file)
      end
    end
  end
)
queueWatcher:start()

-- Watch for upgrade log (3am completion)
local upgradeWatcher = hs.pathwatcher.new(
  os.getenv("HOME") .. "/.amsa/memory/",
  function(files)
    for _, file in ipairs(files) do
      if file:match("upgrade%-log%.json$") then
        notify("⚡ CMNDCENTER Upgraded", "Nightly upgrade complete. System improved.")
      end
    end
  end
)
upgradeWatcher:start()

-- ─── App Launch Shortcuts ─────────────────────────────────────────────────────

-- F13 → Open VS Code Insiders to CMNDCENTER
hs.hotkey.bind({}, "f13", function()
  hs.task.new("/usr/bin/open", nil, {"-a", "Visual Studio Code - Insiders", CMNDCENTER}):start()
end)

-- F14 → Open Warp terminal
hs.hotkey.bind({}, "f14", function()
  hs.task.new("/usr/bin/open", nil, {"-a", "Warp"}):start()
end)

-- ─── Startup ──────────────────────────────────────────────────────────────────

hs.alert.show("⚡ CMNDCENTER Hammerspoon loaded", 2)
logger.i("Hammerspoon CMNDCENTER config loaded")

-- Auto-check services on wake
hs.caffeinate.watcher.new(function(event)
  if event == hs.caffeinate.watcher.systemDidWake then
    hs.timer.doAfter(30, function()
      runScript(
        'docker compose -f "' .. CAO .. '/infrastructure/docker-compose.yml" ps --format json | python3 -c "import sys,json; services=json.loads(sys.stdin.read()); down=[s[\'Name\'] for s in services if s[\'State\'] != \'running\']; print(\'Down: \' + \', \'.join(down) if down else \'All services up\')"',
        "Wake Health Check"
      )
    end)
  end
end):start()
