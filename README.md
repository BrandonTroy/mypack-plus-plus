# MyPack++

A browser extension to improve the functionality and user experience of the NCSU MyPack Portal. This is an unofficial, student-developed extension and is not affiliated with or endorsed by NC State University.

## ✨ Features

- **Enhanced Navigation** (in progress): Tracks and saves where you left off on page refresh or session timeout
- **Enrollment Wizard** (coming soon): Integration with Gradient and RateMyProfessor to streamline the course selection process
- More to be thought of!

## 📦 Installation

Will hopefully be in the Chrome Web Store soon, and eventually planning to support Firefox. For now it has to be built manually from source, following developer instructions below.

## 🚀 Usage

Once installed, MyPack++ will automatically activate when you visit the NCSU MyPack Portal at `https://portalsp.acs.ncsu.edu/`. The extension runs seamlessly in the background, enhancing your portal experience without requiring any additional configuration.

## 💻 Development

### Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v18 or higher)
- A modern Chromium-based browser (Chrome, Edge, Brave, etc.)

### Building from Source

1. **Clone the repository**
   ```bash
   git clone https://github.com/BrandonTroy/mypack-plus-plus.git
   cd mypack-plus-plus
   ```

1. **Install dependencies**
   ```bash
   npm install
   ```

1. **Run in development mode**
   ```bash
   npm run dev
   ```
   This starts a development server with automatic rebuilding.

1. **Load the extension in your browser (one-time setup)**
   - Open your browser and navigate to the extensions page (e.g. `chrome://extensions`, `edge://extensions`)
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist/` folder

1. **Start developing!**
   - The extension will automatically reload in the browser as the source files are modified
   - **Important**: Refresh the MyPack Portal page to see your changes take effect
   - Note: When starting the dev server in future sessions, you may need to manually click the reload button in the extensions page once

1. **Build for production**
   ```bash
   npm run build
   ```
   This compiles the extension for release, also outputting to `dist/`

## 🤝 Contributing

Contributions, feature requests, and bug reports are welcome! Please use [Conventional Commits](https://gist.github.com/qoomon/5dfcdf8eec66a051ecd85625518cfd13) for your commit messages.
