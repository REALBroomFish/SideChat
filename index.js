// SideChat — tabs (fixed labels) + relaxed chat regex; /scx command harness intact
ChatLib.chat("&d[SideChat] tabs fixed — /scx help ; click tabs while chat is open.")

// ---- command aliases (unchanged) ----
const CMD_ALIASES = ["scx","sidechatx","gpd"]
const ALIASES_RE  = new RegExp("^\\/(?:" + CMD_ALIASES.map(s => s.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\$&")).join("|") + ")(?:\\s|$)", "i")

// ---- utils ----
const FMT  = /§[0-9A-FK-OR]/gi
const strip = s => (s || "").replace(FMT, "")
const pad2  = n => n.toString().padStart(2,"0")
const now   = () => { const d = new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}` }

// robustly pull the fully-colored chat line from an event
function getColoredFromEvent(event, fallback){
  try { const s = ChatLib.getChatMessage(event); if (s) return String(s) } catch(_){}
  try { if (event && event.message && event.message.getFormattedText) return String(event.message.getFormattedText()) } catch(_){}
  try { if (event && event.getMessage && event.getMessage().getFormattedText) return String(event.getMessage().getFormattedText()) } catch(_){}
  return String(fallback || "")
}

// colored<->plain helpers (single definitions)
function decolorMap(colored){
  let plain="", map=[]
  for (let i=0;i<colored.length;i++){
    if (colored[i]==="§" && i+1<colored.length){ i++; continue }
    map[plain.length]=i; plain+=colored[i]
  }
  return {plain,map}
}
function sliceColoredByPlain(colored,map,startPlain,endPlain){
  const si = map[startPlain] ?? colored.length
  const ei = endPlain==null ? colored.length : (map[endPlain] ?? colored.length)
  return colored.substring(si, ei)
}
function firstColorCode(colored, fallback="f"){
  for (let i=0;i<colored.length-1;i++){
    if (colored[i]==="§"){
      const c = colored[i+1].toLowerCase()
      if (/[0-9a-f]/.test(c)) return c
      if (c==="r") return "f"
      i++
    }
  }
  return fallback
}
function endColorCode(colored, fallback="f"){
  let code=fallback
  for (let i=0;i<colored.length-1;i++){
    if (colored[i]==="§"){
      const c=colored[i+1].toLowerCase()
      if (/[0-9a-f]/.test(c)) code=c
      else if (c==="r") code="f"
      i++
    }
  }
  return code
}
function ensureLeadingColor(colored, colorCode){
  if (!colored) return ""
  if (colored[0]==="§" && colored[1] && colored[1].toLowerCase()===colorCode) return colored
  return `§${colorCode}` + colored
}

// word-wrap that preserves colors across lines
function wrapColored(str, maxWidth){
  // guard
  if (!str) return [""]
  const limit = Math.max(20, maxWidth|0)
  const out = []
  let line = ""

  const pushLine = () => {
    out.push(line)
    const carry = endColorCode(line, "f")
    line = `§${carry}`
  }

  // tokenise by spaces (keep the spaces in the array)
  const parts = str.split(/(\s+)/)
  for (let p of parts){
    if (p === "") continue
    // hard-wrap very long tokens
    if (Renderer.getStringWidth(p) > limit){
      for (let i=0;i<p.length;i++){
        const next = line + p[i]
        if (Renderer.getStringWidth(next) > limit && line!=="") pushLine()
        line += p[i]
      }
      continue
    }
    const test = line + p
    if (Renderer.getStringWidth(test) <= limit || line===""){
      line = test
    } else {
      pushLine()
      // avoid starting with a giant run of spaces
      line += p.replace(/^\s+/,"")
    }
  }
  if (line !== "") out.push(line)
  return out.length ? out : [str]
}

// ---- config + storage ----
let cfg = { enabled:true, x:8, y:110, width:560, gutter:8, maxLines:10, lineSpacing:12, view:"all", hideMatched:true } // all|guild|party|dm
try { const raw = FileLib.read("SideChat","config.json"); if (raw) cfg = Object.assign(cfg, JSON.parse(raw)) } catch(_){}
const saveCfg = () => FileLib.write("SideChat","config.json", JSON.stringify(cfg,null,2))

const store = { guild:[], party:[], dm:[] }
const feed  = []
function pushBoth(cat, raw){
  if (!raw) return
  const line = `§7[${now()}]§r ` + raw
  const arr = store[cat]; if (arr){ arr.push(line); while(arr.length>300) arr.shift() }
  feed.push(line); while(feed.length>900) feed.shift()
}

// ---- render (wrapped) ----
const TAB_KEYS   = ["all","guild","party","dm"]
const TAB_LABELS = {all:"All",guild:"Guild",party:"Party",dm:"DMs"}
let tabRects = {}

register("renderOverlay",()=>{
  if(!cfg.enabled) return
  const toolbarH = 12, tabH = 14, pad = 6
  const totalH   = toolbarH + tabH + (cfg.maxLines*cfg.lineSpacing) + pad*2
  const innerX   = cfg.x + 4
  const innerW   = cfg.width - 8  // text width budget

  Renderer.drawRect(Renderer.color(0,0,0,130), cfg.x, cfg.y, cfg.width, totalH)
  Renderer.drawRect(Renderer.color(30,30,30,160), cfg.x, cfg.y, cfg.width, toolbarH)
  Renderer.drawString("§8(Click tabs • /"+CMD_ALIASES[0]+" help)", cfg.x+4, cfg.y+2)

  const tabY = cfg.y+toolbarH
  tabRects = {}
  let tx = cfg.x+4
  for (var i=0;i<TAB_KEYS.length;i++){
    var k=TAB_KEYS[i], label=TAB_LABELS[k]
    var w=Renderer.getStringWidth(label)+14
    var active=(cfg.view===k)
    Renderer.drawRect(active?Renderer.color(90,140,220,180):Renderer.color(55,55,55,160), tx, tabY, w, tabH)
    Renderer.drawStringWithShadow((active?"§f":"§7")+label, tx+6, tabY+3)
    tabRects[k]={x:tx,y:tabY,w:w,h:tabH}
    tx += w + 6
  }

  const listY = tabY+tabH+4
  Renderer.drawRect(Renderer.color(0,0,0,60), cfg.x, listY-2, cfg.width, 1)

  // wrap all lines, then show the last N wrapped lines
  const src = (cfg.view==="all") ? feed : (store[cfg.view]||[])
  const wrapped = []
  for (let i=Math.max(0, src.length-200); i<src.length; i++){
    wrapped.push.apply(wrapped, wrapColored(src[i], innerW))
  }
  const startWrapped = Math.max(0, wrapped.length - cfg.maxLines)

  let yy = listY
  for (let i=startWrapped; i<wrapped.length; i++){
    Renderer.drawStringWithShadow(wrapped[i], innerX, yy)
    yy += cfg.lineSpacing
  }
})

// click tabs (works even with chat open)
const inside=(mx,my,r)=>mx>=r.x&&mx<=r.x+r.w&&my>=r.y&&my<=r.y+r.h
register("guiMouseClick",(mx,my,btn)=>{
  if(btn!==0) return
  for (var i=0;i<TAB_KEYS.length;i++){
    var k=TAB_KEYS[i], r=tabRects[k]
    if(r && inside(mx,my,r)){ cfg.view=k; saveCfg(); ChatLib.chat(`&6[SideChat]&r view: &e${k.toUpperCase()}`); return }
  }
})

/* =================== GUILD / PARTY CAPTURE (rank tag color = name color) =================== */

// Split plain nameAndTags into rank-before | name | rank-after bounds
function plainNameBounds(plain){
  let i = 0
  while (plain[i] === "["){ const j = plain.indexOf("]", i); if (j<0) break; i = j+1; while(plain[i]===" ") i++ }
  const nameStart = i
  const m = plain.slice(i).match(/^([^\s\[]+)/)
  const nameEnd = i + (m ? m[1].length : (plain.length-i))
  i = nameEnd; while (plain[i] === " ") i++
  let j = i
  while (plain[j] === "["){ const k = plain.indexOf("]", j); if (k<0) break; j = k+1; while (plain[j]===" ") j++ }
  return { nameStart, nameEnd, afterAll:j }
}

// Pull colored pieces and recolor the **start of the rank tag** to the player's base color
function extractPiecesAndFix(event, plainNameAndTags){
  const full = getColoredFromEvent(event)
  if (!full) return null
  const {plain, map} = decolorMap(full)

  const head = plain.match(/^(Guild|Party)\s*(?:[>»›▸➜➔➤▶▷])\s*/i)
  if (!head) return null
  const channel = head[1].toLowerCase()
  const headLen = head[0].length

  const colonAt = plain.indexOf(": ", headLen)
  if (colonAt === -1) return null

  const coloredNameAll = sliceColoredByPlain(full, map, headLen, colonAt)
  const coloredColon   = sliceColoredByPlain(full, map, colonAt, colonAt+2)
  const coloredMsg     = sliceColoredByPlain(full, map, colonAt+2, null)

  const {map: nm} = decolorMap(coloredNameAll)
  const b = plainNameBounds(plainNameAndTags)

  let coloredRanksBefore = sliceColoredByPlain(coloredNameAll, nm, 0, b.nameStart)
  const coloredPlayerName = sliceColoredByPlain(coloredNameAll, nm, b.nameStart, b.nameEnd)
  const coloredRanksAfter = sliceColoredByPlain(coloredNameAll, nm, b.nameEnd, b.afterAll)

  // >>> make the opening [ of the player rank tag use the same base color as the player's name
  const base = firstColorCode(coloredPlayerName, "f")
  coloredRanksBefore = ensureLeadingColor(coloredRanksBefore, base)

  return { channel, coloredRanksBefore, coloredPlayerName, coloredRanksAfter, coloredColon, coloredMsg }
}

function emitFromEvent(event, forcedChannel, plainNameAndTags){
  const p = extractPiecesAndFix(event, plainNameAndTags)
  if (!p) return false
  const chan = forcedChannel || p.channel
  const chanTag = (chan === "guild") ? "§2[G]§r " : "§9[P]§r "
  const line =
    chanTag + p.coloredRanksBefore + p.coloredPlayerName + p.coloredRanksAfter +
    p.coloredColon + p.coloredMsg
  pushBoth(chan, line)
  return true
}

// Criteria — plain '>' arrow
register("chat", (nameAndTags, message, event) => {
  if (emitFromEvent(event, "guild", nameAndTags) && cfg.hideMatched) cancel(event)
}).setChatCriteria("Guild > ${nameAndTags}: ${message}")

register("chat", (nameAndTags, message, event) => {
  if (emitFromEvent(event, "party", nameAndTags) && cfg.hideMatched) cancel(event)
}).setChatCriteria("Party > ${nameAndTags}: ${message}")

// Criteria — fancy '»' arrow
register("chat", (nameAndTags, message, event) => {
  if (emitFromEvent(event, "guild", nameAndTags) && cfg.hideMatched) cancel(event)
}).setChatCriteria("Guild » ${nameAndTags}: ${message}")

register("chat", (nameAndTags, message, event) => {
  if (emitFromEvent(event, "party", nameAndTags) && cfg.hideMatched) cancel(event)
}).setChatCriteria("Party » ${nameAndTags}: ${message}")

/* =================== END CAPTURE =================== */


// ---- commands (same working harness) ----
function help(){
  ChatLib.chat("&6[SideChat]&r commands:");
  ChatLib.chat("&e/"+CMD_ALIASES[0]+" view <all|guild|party|dm>&7 – switch tab");
  ChatLib.chat("&e/"+CMD_ALIASES[0]+" next&7 – cycle tabs");
  ChatLib.chat("&e/"+CMD_ALIASES[0]+" on|off&7 – toggle overlay");
  ChatLib.chat("&e/"+CMD_ALIASES[0]+" move <x> <y>&7 – set position");
  ChatLib.chat("&e/"+CMD_ALIASES[0]+" size <width> <lines>&7 – set width & lines");
  ChatLib.chat("&e/"+CMD_ALIASES[0]+" clear [all|guild|party|dm]&7 – clear feed(s)");
  ChatLib.chat("&e/"+CMD_ALIASES[0]+" test&7 – add local sample lines");
  ChatLib.chat("&e/"+CMD_ALIASES[0]+" test send&7 – send real /gc and /pc so criteria triggers fire");
}

const order=["all","guild","party","dm"]
function handleCmd(args,via){
  const a=(args[0]||"").toLowerCase()
  if(!a||a==="help"){ help(); ChatLib.chat("&8(via: "+via+")"); return }
  if(a==="view"){ const v=(args[1]||"").toLowerCase(); if(order.includes(v)){ cfg.view=v; saveCfg(); ChatLib.chat(`&6[SideChat]&r view: &e${v.toUpperCase()}`)} else ChatLib.chat("&cUse: view all|guild|party|dm"); return }
  if(a==="next"){ const i=(order.indexOf(cfg.view)+1)%order.length; cfg.view=order[i]; saveCfg(); ChatLib.chat(`&6[SideChat]&r view: &e${cfg.view.toUpperCase()}`); return }
  if(a==="on"||a==="off"){ cfg.enabled=(a==="on"); saveCfg(); ChatLib.chat(`&6[SideChat]&r ${cfg.enabled?"enabled":"disabled"}`); return }
  if(a==="move"){ const x=parseInt(args[1]), y=parseInt(args[2]); if(!isNaN(x)) cfg.x=x; if(!isNaN(y)) cfg.y=y; saveCfg(); ChatLib.chat(`&6[SideChat]&r moved to ${cfg.x},${cfg.y}`); return }
  if(a==="size"){ const w=parseInt(args[1]), n=parseInt(args[2]); if(w) cfg.width=Math.max(260,w); if(n) cfg.maxLines=Math.max(3,n); saveCfg(); ChatLib.chat(`&6[SideChat]&r size ${cfg.width} x ${cfg.maxLines}`); return }
  if(a==="clear"){ const which=(args[1]||"all").toLowerCase(); if(which==="all"){ store.guild=[]; store.party=[]; store.dm=[]; feed.length=0 } else if(store[which]) store[which]=[]; else return ChatLib.chat("&cUse: clear [all|guild|party|dm]"); ChatLib.chat("&6[SideChat]&r cleared"); return }
  if (a === "test") {
    if ((args[1]||"").toLowerCase() === "send") {
      ChatLib.say('/gc [SCX] guild test ' + Math.floor(Math.random()*1000))
      ChatLib.say('/pc [SCX] party test ' + Math.floor(Math.random()*1000))
      ChatLib.chat("&6[SideChat]&r tried to send /gc and /pc (requires guild/party).")
      return
    }
    const pack = [
      ["guild", "§2[G] §b[MVP§f+§b] BroomFish §2[Elite]§f: §rwrap & colors check — the quick brown fox jumps over the lazy dog 12345"],
      ["party","§9[P] §a[VIP§6+§a] Friend§f: i hate you (wrapping test) aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]
    ]
    pack.forEach(([cat,line]) => pushBoth(cat,line))
    ChatLib.chat("&6[SideChat]&r test: added samples (use &e/scx test send&6 for real /gc /pc)")
    return
  }
  ChatLib.chat("&cUnknown subcommand. Try &e/"+CMD_ALIASES[0]+" help")
}
register("messageSent",(msg,event)=>{ if(!ALIASES_RE.test(msg)) return; cancel(event); const args=msg.trim().split(/\s+/).slice(1); handleCmd(args,"msg") })
register("packetSent",(packet,event)=>{ try{ if(String(packet.getClass().getName())==="net.minecraft.network.play.client.C01PacketChatMessage"){ const m=packet.func_149439_c(); if(ALIASES_RE.test(m)){ cancel(event); const args=m.trim().split(/\s+/).slice(1); handleCmd(args,"pkt") }}}catch(_){}})
