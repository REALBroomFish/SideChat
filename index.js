// SideChat — tabs (fixed labels) + relaxed chat regex; /scx command harness intact
ChatLib.chat("&d[SideChat] tabs fixed — /scx help ; click tabs while chat is open.")

// ---- command aliases (unchanged) ----
const CMD_ALIASES = ["scx","sidechatx","gpd"]
const ALIASES_RE = new RegExp("^\\/(?:" + CMD_ALIASES.map(s => s.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\$&")).join("|") + ")(?:\\s|$)", "i")

// ---- utils ----
const FMT = /§[0-9A-FK-OR]/gi
const strip = s => (s || "").replace(FMT, "")
const pad2 = n => n.toString().padStart(2,"0")
const now = () => { const d = new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}` }

// ---- config + storage ----
let cfg = { enabled:true, x:8, y:110, width:560, gutter:8, maxLines:10, lineSpacing:12, view:"all", hideMatched:true } // all|guild|party|dm
try { const raw = FileLib.read("SideChat","config.json"); if (raw) cfg = Object.assign(cfg, JSON.parse(raw)) } catch(_) {}
const saveCfg = () => FileLib.write("SideChat","config.json", JSON.stringify(cfg,null,2))

const store = { guild:[], party:[], dm:[] }
const feed = []
function pushBoth(cat, raw){
  const line = `§7[${now()}]§r ` + raw
  const arr = store[cat]; if (arr){ arr.push(line); while(arr.length>300) arr.shift() }
  feed.push(line); while(feed.length>900) feed.shift()
}

// ---- render (no destructuring) ----
const TAB_KEYS   = ["all","guild","party","dm"]
const TAB_LABELS = {all:"All",guild:"Guild",party:"Party",dm:"DMs"}
let tabRects = {}

register("renderOverlay",()=>{
  if(!cfg.enabled) return
  const toolbarH = 12, tabH = 14, pad = 6
  const totalH   = toolbarH + tabH + (cfg.maxLines*cfg.lineSpacing) + pad*2

  Renderer.drawRect(Renderer.color(0,0,0,130), cfg.x, cfg.y, cfg.width, totalH)
  Renderer.drawRect(Renderer.color(30,30,30,160), cfg.x, cfg.y, cfg.width, toolbarH)
  Renderer.drawString("§8(Click tabs • /"+CMD_ALIASES[0]+" help)", cfg.x+4, cfg.y+2)

  const tabY = cfg.y+toolbarH
  tabRects = {}
  let tx = cfg.x+4
  for (var i=0;i<TAB_KEYS.length;i++){
    var k=TAB_KEYS[i]
    var label=TAB_LABELS[k]
    var w=Renderer.getStringWidth(label)+14
    var active=(cfg.view===k)
    Renderer.drawRect(active?Renderer.color(90,140,220,180):Renderer.color(55,55,55,160), tx, tabY, w, tabH)
    Renderer.drawStringWithShadow((active?"§f":"§7")+label, tx+6, tabY+3)
    tabRects[k]={x:tx,y:tabY,w:w,h:tabH}
    tx += w + 6
  }

  const listY=tabY+tabH+4
  Renderer.drawRect(Renderer.color(0,0,0,60), cfg.x, listY-2, cfg.width, 1)

  const lines=(cfg.view==="all")?feed:(store[cfg.view]||[])
  const start=Math.max(0,lines.length-cfg.maxLines)
  var yy=listY
  for (var j=start;j<lines.length;j++){
    // <<< CHANGE: keep color codes and shadow
    Renderer.drawStringWithShadow(lines[j], cfg.x + 4, yy)
    yy+=cfg.lineSpacing
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

/* =================== GUILD / PARTY CAPTURE =================== */

/** Split "[RANKS] Name [GUILD_RANK]" into {ranksBefore, name, ranksAfter} */
function parseNameTags(s) {
  s = (s || "").trim();

  // collect leading bracket groups
  let ranksBefore = "";
  while (s.startsWith("[")) {
    const i = s.indexOf("]");
    if (i < 0) break;
    ranksBefore += s.slice(0, i + 1) + " ";
    s = s.slice(i + 1).trim();
  }

  // name = first token up to whitespace or '['
  const nameMatch = s.match(/^([^\s\[]+)/);
  const name = nameMatch ? nameMatch[1] : s.split(/\s+/)[0] || "Unknown";
  s = s.slice(name.length).trim();

  // collect trailing bracket groups
  let ranksAfter = "";
  while (s.startsWith("[")) {
    const i = s.indexOf("]");
    if (i < 0) break;
    ranksAfter += " " + s.slice(0, i + 1);
    s = s.slice(i + 1).trim();
  }

  return { ranksBefore: ranksBefore.trim(), name, ranksAfter: ranksAfter.trim() };
}

/** Format ranks (if any) in gray to keep UI consistent. */
function fmtRanks(rb, ra) {
  const all = [rb, ra].filter(Boolean).join(" ").trim();
  return all ? `§7${all} §r` : "";
}

/* ---------- Primary: exact Hypixel “>” arrow via criteria ---------- */
/* We capture everything between the arrow and the colon as ${nameAndTags} */

register("chat", (nameAndTags, message, event) => {
  const p = parseNameTags(nameAndTags);
  pushBoth("guild", `§a[G] ${fmtRanks(p.ranksBefore, p.ranksAfter)}§f${p.name}§7: §r${message}`);
  if (cfg.hideMatched) cancel(event);
}).setChatCriteria("Guild > ${nameAndTags}: ${message}");

register("chat", (nameAndTags, message, event) => {
  const p = parseNameTags(nameAndTags);
  pushBoth("party", `§d[P] ${fmtRanks(p.ranksBefore, p.ranksAfter)}§f${p.name}§7: §r${message}`);
  if (cfg.hideMatched) cancel(event);
}).setChatCriteria("Party > ${nameAndTags}: ${message}");

/* ---------- Also cover the common “»” arrow (some packs/mods show this) ---------- */

register("chat", (nameAndTags, message, event) => {
  const p = parseNameTags(nameAndTags);
  pushBoth("guild", `§a[G] ${fmtRanks(p.ranksBefore, p.ranksAfter)}§f${p.name}§7: §r${message}`);
  if (cfg.hideMatched) cancel(event);
}).setChatCriteria("Guild » ${nameAndTags}: ${message}");

register("chat", (nameAndTags, message, event) => {
  const p = parseNameTags(nameAndTags);
  pushBoth("party", `§d[P] ${fmtRanks(p.ranksBefore, p.ranksAfter)}§f${p.name}§7: §r${message}`);
  if (cfg.hideMatched) cancel(event);
}).setChatCriteria("Party » ${nameAndTags}: ${message}");

/* ---------- Optional: DM criteria (keep if you want DMs too) ---------- */
// From <nameAndTags>: <message>
register("chat", (nameAndTags, message /*, event*/) => {
  const p = parseNameTags(nameAndTags);
  pushBoth("dm", `§b[DM ←] §f${p.name}§7: §r${message}`);
  // if (cfg.hideMatched) cancel(event);
}).setChatCriteria("From ${nameAndTags}: ${message}");

// To <nameAndTags>: <message>
register("chat", (nameAndTags, message /*, event*/) => {
  const p = parseNameTags(nameAndTags);
  pushBoth("dm", `§b[DM →] §f${p.name}§7: §r${message}`);
  // if (cfg.hideMatched) cancel(event);
}).setChatCriteria("To ${nameAndTags}: ${message}");

/* ---------- Fallback: catch odd arrows or timestamps with one lightweight regex ---------- */

function stripLeader(t) {
  // drop leading "12) " or "[12:34]" or "[12:34:56]" if present
  return (t || "").replace(/^\s*(?:\d+\)\s*|\[\d{1,2}:\d{2}(?::\d{2})?\]\s*)+/, "");
}

register("chat", (raw, event) => {
  const s = stripLeader(String(raw)).replace(/§./g, "").trim();
  // Accept many arrow glyphs: > » › ▸ • ・ ➜ etc.
  const m = s.match(/^(Guild|Party)\s*[^A-Za-z0-9\s]\s*(.+?):\s(.+)$/i);
  if (!m) return;

  const channel = m[1].toLowerCase();
  const nameAndTags = m[2];
  const message = m[3];

  const p = parseNameTags(nameAndTags);
  if (channel === "guild") {
    pushBoth("guild", `§a[G] ${fmtRanks(p.ranksBefore, p.ranksAfter)}§f${p.name}§7: §r${message}`);
  } else {
    pushBoth("party", `§d[P] ${fmtRanks(p.ranksBefore, p.ranksAfter)}§f${p.name}§7: §r${message}`);
  }
  if (cfg.hideMatched) cancel(event);
});

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
  // <<< CHANGE: updated help lines
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
      // <<< CHANGE: real messages to make criteria fire
      ChatLib.say('/gc [SCX] guild test ' + Math.floor(Math.random()*1000))
      ChatLib.say('/pc [SCX] party test ' + Math.floor(Math.random()*1000))
      ChatLib.chat("&6[SideChat]&r tried to send /gc and /pc (requires guild/party).")
      return
    }
    // local samples (don’t hit chat hook)
    const pack = [
      ["guild", "§2[G] §b[MVP§9+§b] BroomFish§r: The pacer gram fitness test is a"],
      ["guild", "§2[G] §b[MVP§9+§b] GuildMember4 §2[Clone]§r: §rThe pacer gram fitness test is a"],

      ["party", "§9[P] §a[VIP§6+§a] F7Non§r: i hate you OtherF7Non"],
      ["guild", "§2[G] §aOtherF7Non§r §r§eleft"],
      ["dm", "§d[DM To] §7'James'§r:§7 hi there"],
      ["dm", "§d[DM From] §7'James'§r:§7 ok!"]
    ];
    pack.forEach(([cat, line]) => pushBoth(cat, line))
    ChatLib.chat("&6[SideChat]&r test: added mixed G/P/DM lines (use &e/scx test send&6 for real /gc /pc)")
    return
  }
  ChatLib.chat("&cUnknown subcommand. Try &e/"+CMD_ALIASES[0]+" help")
}

register("messageSent",(msg,event)=>{ if(!ALIASES_RE.test(msg)) return; cancel(event); const args=msg.trim().split(/\s+/).slice(1); handleCmd(args,"msg") })
register("packetSent",(packet,event)=>{ try{ if(String(packet.getClass().getName())==="net.minecraft.network.play.client.C01PacketChatMessage"){ const m=packet.func_149439_c(); if(ALIASES_RE.test(m)){ cancel(event); const args=m.trim().split(/\s+/).slice(1); handleCmd(args,"pkt") }}}catch(_){}})
