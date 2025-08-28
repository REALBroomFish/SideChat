# SideChat (ChatTriggers Module)

A lightweight, color-accurate side panel for Hypixel chat.  
SideChat mirrors **Guild**, **Party**, and **DM** messages into a tidy overlay with tabs and smart line wrapping — so you can keep chat visible without cluttering your main chat box.

---

## Features
- **Tabbed overlay:** `All • Guild • Party • DMs` (clickable even while chat is open).  
- **Color-accurate rendering:** preserves Hypixel formatting, rank tags (e.g. `MVP+`, `MVP++`), `+` colors, and punctuation colors.  
- **Smart wrapping:** long messages wrap inside the panel and **retain their active color** across lines.  
- **Hide matched lines:** optionally remove captured Guild/Party/DM lines from the main chat stream.  
- **Join/leave capture:** shows guild members joining or leaving with proper formatting.  
- **Test mode:** quickly inject sample messages or send `/gc` and `/pc` test messages.  

---

## Installation
1. Install [ChatTriggers](https://chattriggers.com/).  
2. Place this module folder (`SideChat`) into your ChatTriggers `modules/` directory.  
3. Run `/ct reload` in-game.

---

## Commands
- `/scx help` – list commands  
- `/scx view <all|guild|party|dm>` – switch tabs  
- `/scx next` – cycle tabs  
- `/scx on|off` – toggle overlay  
- `/scx move <x> <y>` – reposition overlay  
- `/scx size <width> <lines>` – resize overlay  
- `/scx clear [all|guild|party|dm]` – clear stored messages  
- `/scx test` – inject sample lines  
- `/scx test send` – send live `/gc` and `/pc` test messages  

