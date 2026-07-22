# 📦 Novel Tools

A lightweight, cross-platform application developed by a Vietnamese developer for reading, creating, editing, and converting EPUB/TXT novels.

Novel Tools is designed to work completely offline while providing a modern workflow for both readers and editors.

---

# ✨ Features

## 📖 EReader

- Read EPUB novels directly
- TXT reading support
- Table of Contents (ToC)
- SubToC support
- Search inside books
- Text Highlight
- Bookmark system
- Reading Progress Export / Import
- Book library management
- Book search & filtering
- Single-page & double-page mode
- Basic Text-to-Speech (TTS)
- Mobile Action Button support
- Theme customization
- Responsive reading interface
- Optimized EPUB rendering

---

## ✍️ MDT Editor

- Edit EPUB/TXT
- Find & Replace
- Regex Find & Replace
- Theme support
- Modern editing interface
- Layout customization
- Shortcut support
- Better rendering performance

---

## 🔄 Converter

Convert novels between multiple layouts.

Supported conversion modes:

- Version 1 (MDT Layout)
- Version 2 (Public Layout)

Converter features:

- Regex-based rendering
- Delimiter export
- Converter version switcher
- Improved parser
- Better chapter rendering
- Better EPUB compatibility

---

## 📚 EPUB Creation

Starting from **v1.1.5**, EPUB exporting has been separated into an independent module.

Features include:

- Dedicated EPUB parser
- Independent configuration
- Better maintainability
- Cleaner architecture

---

## 📝 Info Editor

Added in **v1.1.6**

Allows editing EPUB metadata such as:

- Title
- Author
- Category
- Description
  
---

# 🚀 Platform Support

Supported platforms:

- Windows
- Linux
- macOS
- Android
- iOS (WebOnly)
- Web Browser

Works completely offline.

For WebOnly version, localhost mode is required.

---

# 🌐 Offline Support

- Fully Offline
- No Internet required
- LocalStorage support
- Localhost mode recommended for WebOnly version

---

# ⚙️ Version Architecture

## Version 1 (MDT Core)

- Integrated engine
- Single processing pipeline
- Regex rendering
- Reader + Editor workflow
- Tight UI integration

---

## Version 2 (Extended Engine)

- Modular architecture
- Chapter Detection System
- Splitter-based parser
- Better formatting system

Supports:

- Title
- Description
- Metadata
- Border rendering

Designed for future expansion.

---

# 🧠 MDT Rendering Engine

Novel Tools uses the custom **MDT (Máy Đọc Truyện)** rendering engine.

Current capabilities:

- Regex rendering
- Custom formatting rules
- Multiple conversion layouts
- Modular parser
- Future rule expansion

Workflow:

```
Load
 ↓
Convert
 ↓
Edit
 ↓
Export
```

---

# 🌍 Language Support

Supported UI languages:

- English
- Vietnamese
- Chinese
- Japanese
- Korean
- Russian
- Dutch
- Turkish
- Hindi

> CJK rendering continues to be improved.

---

# 📱 Mobile Features

Android version includes:

- Native interface
- EPUB Reader
- Swipe page navigation
- Mobile Action Button
- Reading Progress Sync
- Bookmark
- Highlight
- Search

---

# 💻 Desktop Features

Desktop version supports:

- Reader
- Editor
- Converter
- EPUB Creation Tool
- Info Editor
- Image Viewer

---

# 📂 File Support

Input:

- EPUB
- TXT

Output:

- EPUB
- TXT

Since **v1.0.1**, external script files have been removed.

Removed:

- .bat
- .ps1
- .sh

The application now uses a universal implementation with LocalStorage.

---

# 📖 Reading Features

Current EReader supports:

- EPUB Reader
- Search
- Highlight
- Bookmark
- ToC
- SubToC
- Progress Export
- Progress Import
- Book Library
- Book Filter
- TTS
- Single Page
- Double Page
- Theme
- Responsive Layout

---

# 🔧 Editor Features

Current MDT Editor supports:

- Theme
- Find
- Replace
- Regex Replace
- Layout
- Improved UI
- Better performance

Shortcut:

```
ALT + H
```

---

# 🔄 Converter Features

- Multiple converter versions
- Regex parser
- Chapter parser
- Delimiter support
- Better EPUB export
- Metadata support

EPUB metadata:

- Title
- Author
- Genre
- Category

---

# 🖼️ Image Support

Added in **v1.1.3**

Supports viewing images inside supported content.

---

# 📑 Library System

EReader Library includes:

- Import books
- Search books
- Filter books
- Reading history
- Reading progress

---

# 📚 EPUB Module

Starting from **v1.1.5**

EPUB creation is separated from MDT Editor.

Advantages:

- Cleaner architecture
- Easier maintenance
- Independent configuration
- Better EPUB compatibility

More information:

https://github.com/TzhouSensei/Novel-Tools/wiki/Edior-in-v1.1.5

---

# 📱 WebOnly Setup

Requirements

- Chrome
- Edge
- Firefox
- Safari
- SHTTPS / KSWEB / similar
- Termux (optional)
- Bluetooth Keyboard (optional)

Steps

1. Install SHTTPS
2. Extract Novel Tools
3. Set Root Directory
4. Enable localhost
5. Open index.html
6. Start reading



# 🤝 Contribution

Suggestions, bug reports, feature requests, and pull requests are welcome.

Novel Tools is still actively under development.

---

# 📄 License

Please refer to the LICENSE file included in this repository.

---

Developed with ❤️ by **TzhouSensei**
