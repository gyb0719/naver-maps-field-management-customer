# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Naver Maps Field Management Program (네이버 지도 필지 관리 프로그램) - a web application for managing parcels/lots using Naver Maps API and Vworld API. It allows users to visualize, color-code, and manage land parcel information with features like address search, parcel data management, and Google Sheets integration.

## Development Commands

```bash
# Development server (Express.js)
node server.js

# Testing (Playwright)
npm test                # Run all tests
npx playwright test     # Run Playwright tests directly

# No build step needed - static files served from /public
npm run build          # No-op (static site)
npm run start          # No-op (static site)
```

The server runs on port 3000 by default, with automatic fallback to port 4000 if 3000 is in use.

## Architecture Overview

### Frontend Structure
- **Static HTML/CSS/JavaScript application** served via Express.js
- **Main entry point**: `public/index.html`
- **Core JavaScript modules** in `public/js/`:
  - `map.js` - Naver Maps integration and initialization
  - `parcel.js` - Parcel data handling and visualization
  - `parcel-manager.js` - Parcel management operations
  - `search.js` - Address and parcel search functionality
  - `sheets.js` - Google Sheets integration
  - `auth.js` - Authentication handling
  - `config.js` - API keys and configuration

### Backend Structure
- **Express.js server** (`server.js`) with:
  - Static file serving from `/public`
  - CORS enabled for API requests
  - VWorld API proxy at `/api/vworld` with multiple API key fallback
  - Automatic port conflict resolution (3000 → 4000)

### API Integration
- **Naver Maps API v3** - Map rendering and geocoding
- **VWorld API** - Korean parcel/lot data retrieval
- **Google Sheets API** - Data export functionality

### Key Configuration Files
- `.env` / `.env.example` - API keys (Naver, VWorld, Google)
- `public/js/config.js` - Frontend configuration and API keys
- `playwright.config.js` - Test configuration
- `package.json` - Dependencies and scripts

### Testing
- **Playwright tests** in `/tests` directory covering:
  - API functionality and fallback mechanisms
  - Parcel data retrieval and rendering
  - Search functionality
  - UI interactions and button testing

## Important Notes

### API Key Management
- Multiple VWorld API keys configured with automatic fallback
- Naver Maps Client ID embedded in frontend config
- Environment variables should be set in `.env` file

### Development Workflow
1. Start server: `node server.js`
2. Access at `http://localhost:3000`
3. Run tests: `npm test` for end-to-end validation

### Server Features
- Automatic port resolution if 3000 is occupied
- VWorld API proxy to handle CORS issues
- Multiple API key rotation for reliability
- Development-friendly error logging